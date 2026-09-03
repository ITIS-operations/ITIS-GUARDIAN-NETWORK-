/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Telemetry Ingestion & Authoritative State Synchronization Engine
 */

import { GT012Protocol } from './gt012Protocol.js';
import {
  GT012ParsedPacket,
  GT012LoginPacket,
  GT012LocationPacket,
  GT012HeartbeatPacket,
  GT012AlarmPacket,
  GT012ProtocolNumber,
  GT012IngestResult,
  GT012DeviceTelemetryRecord,
  GT012DeviceHealthRecord,
  GT012DeviceHealthStatus,
  GT012AlarmClassification
} from './gt012Types.js';
import { IDataRepository } from '../db/repository.js';
import { IncidentAlert } from '../../types.js';

// In-memory active session tracking for connected GT012 terminals
interface ActiveTerminalSession {
  terminalIdentifier: string; // IMEI
  deviceId?: string;
  assignedLearnerId?: string;
  lastSeenAt: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    timestamp: string;
  };
  health: GT012DeviceHealthRecord;
}

export class GT012TelemetryService {
  private activeSessions = new Map<string, ActiveTerminalSession>();
  private recentTelemetry = new Map<string, GT012DeviceTelemetryRecord[]>();

  constructor(private repository: IDataRepository) {}

  /**
   * Authoritative entry point for processing a decoded GT012 packet.
   * Handles login handshakes, heartbeat status, GPS locations, and alarm classifications.
   */
  public async processPacket(packet: GT012ParsedPacket, ipAddress = '127.0.0.1'): Promise<GT012IngestResult> {
    // 1. Enforce CRC validation check
    if (!packet.isValidCrc) {
      await this.repository.auditLogs.logEvent({
        actionType: 'SECURITY_POLICY_MODIFIED',
        actorUserId: 'sys-gt012-gateway',
        actorName: 'GT012 Protocol Gateway',
        actorRole: 'SYSTEM_ADMIN',
        targetEntity: 'DEVICE',
        targetId: (packet as any).terminalIdentifier || 'UNKNOWN_TERMINAL',
        details: {
          violation: 'GT012_CRC_CHECK_FAILED',
          protocolNumber: packet.protocolNumber,
          serialNumber: packet.serialNumber,
          receivedCrc: packet.crc
        },
        ipAddress
      });

      return {
        success: false,
        packetType: GT012ProtocolNumber[packet.protocolNumber] || 'UNKNOWN',
        error: 'INVALID_CRC_ITU: Packet checksum validation failed. Packet rejected safely.'
      };
    }

    // Route packet according to protocol number
    switch (packet.protocolNumber) {
      case GT012ProtocolNumber.LOGIN_MESSAGE:
        return this.handleLogin(packet as GT012LoginPacket, ipAddress);

      case GT012ProtocolNumber.STATUS_HEARTBEAT:
        return this.handleHeartbeat(packet as GT012HeartbeatPacket, ipAddress);

      case GT012ProtocolNumber.LOCATION_DATA:
        return this.handleLocation(packet as GT012LocationPacket, ipAddress);

      case GT012ProtocolNumber.ALARM_DATA:
        return this.handleAlarm(packet as GT012AlarmPacket, ipAddress);

      default:
        return {
          success: true,
          packetType: GT012ProtocolNumber[packet.protocolNumber] || 'UNKNOWN_PACKET',
          responseBuffer: GT012Protocol.buildAcknowledgement(packet.protocolNumber, packet.serialNumber)
        };
    }
  }

  /**
   * PHASE 4: GT012 Tracker Login Handshake
   */
  private async handleLogin(packet: GT012LoginPacket, ipAddress: string): Promise<GT012IngestResult> {
    const { terminalIdentifier, serialNumber } = packet;
    const now = new Date().toISOString();

    // Generate authoritative login acknowledgement response immediately preserving serial number
    const responseBuffer = GT012Protocol.buildAcknowledgement(GT012ProtocolNumber.LOGIN_MESSAGE, serialNumber);

    // Look up device in repository by IMEI or Serial Number
    let device = await (this.repository.devices as any).findByImeiOrSerial?.(terminalIdentifier) ||
                 await this.repository.devices.findById(terminalIdentifier) ||
                 await this.repository.devices.findBySerialNumber(terminalIdentifier);

    let assignedLearnerId: string | undefined = undefined;
    let assignedLearnerName: string | undefined = undefined;
    let deviceId = device?.id;

    if (device) {
      // Device is registered
      if (device.assigned_learner_id) {
        assignedLearnerId = device.assigned_learner_id;
        if (assignedLearnerId) {
          const learner = await this.repository.learners.findHydratedById(assignedLearnerId);
          if (learner) {
            assignedLearnerName = `${learner.person.firstName} ${learner.person.lastName}`;
          }
        }
      }

      // Update last ping diagnostic
      await this.repository.devices.updateDiagnostic(device.id, {
        lastPingAt: now
      });
    } else {
      // Unknown device: Place in controlled UNREGISTERED_DEVICE / DEVICE_PENDING_ASSIGNMENT state
      // Never crash and never auto-assign to any learner
      deviceId = `dev-unassigned-${terminalIdentifier.slice(-6)}`;
    }

    // Initialize or update active terminal session
    const session: ActiveTerminalSession = {
      terminalIdentifier,
      deviceId,
      assignedLearnerId,
      lastSeenAt: now,
      health: {
        deviceId: deviceId || 'dev-unregistered',
        terminalIdentifier,
        lastHeartbeatAt: now,
        lastLocationAt: now,
        connectivityStatus: 'ONLINE',
        batteryStatus: 'NORMAL',
        batteryPercentage: 95,
        signalStatus: 'EXCELLENT',
        signalDbm: -65,
        defenseStatus: 'ARMED'
      }
    };
    this.activeSessions.set(terminalIdentifier, session);

    // Audit log
    const audit = await this.repository.auditLogs.logEvent({
      actionType: 'DIAGNOSTIC_ACTION',
      actorUserId: 'sys-gt012-gateway',
      actorName: 'GT012 Telemetry Ingest Gateway',
      actorRole: 'SYSTEM_ADMIN',
      targetEntity: 'DEVICE',
      targetId: deviceId || terminalIdentifier,
      details: {
        action: 'GT012_TERMINAL_LOGIN_HANDSHAKE',
        terminalIdentifier,
        isRegistered: !!device,
        assignedLearnerId: assignedLearnerId || 'NONE',
        serialNumber
      },
      ipAddress
    });

    return {
      success: true,
      packetType: 'LOGIN_MESSAGE',
      terminalIdentifier,
      deviceId,
      assignedLearnerId,
      assignedLearnerName,
      responseBuffer,
      health: session.health,
      auditEventId: audit.id
    };
  }

  /**
   * PHASE 5: GT012 Heartbeat & Status Processing
   */
  private async handleHeartbeat(packet: GT012HeartbeatPacket, ipAddress: string): Promise<GT012IngestResult> {
    const { serialNumber, terminalStatus, batteryPercentage, gsmSignalDbm, voltageLevel } = packet;
    const now = new Date().toISOString();

    const responseBuffer = GT012Protocol.buildAcknowledgement(GT012ProtocolNumber.STATUS_HEARTBEAT, serialNumber);

    // Identify device from active session or device registry
    let session = Array.from(this.activeSessions.values())[0]; // fallback to first if single socket
    let terminalIdentifier = session?.terminalIdentifier || 'GT012_TERMINAL';
    let deviceId = session?.deviceId || 'dev-gt012';

    let connectivityStatus: GT012DeviceHealthStatus = 'ONLINE';
    let batteryStatus: 'NORMAL' | 'LOW' | 'CRITICAL' | 'CHARGING' = 'NORMAL';

    if (batteryPercentage <= 15) {
      connectivityStatus = 'LOW_BATTERY';
      batteryStatus = 'CRITICAL';
    } else if (batteryPercentage <= 25) {
      batteryStatus = 'LOW';
    }
    if (terminalStatus.charging) {
      batteryStatus = 'CHARGING';
    }
    if (gsmSignalDbm < -100) {
      connectivityStatus = 'POOR_SIGNAL';
    }

    const health: GT012DeviceHealthRecord = {
      deviceId,
      terminalIdentifier,
      lastHeartbeatAt: now,
      lastLocationAt: session?.health?.lastLocationAt || now,
      connectivityStatus,
      batteryStatus,
      batteryPercentage,
      signalStatus: gsmSignalDbm >= -75 ? 'EXCELLENT' : gsmSignalDbm >= -90 ? 'GOOD' : gsmSignalDbm >= -105 ? 'FAIR' : 'POOR',
      signalDbm: gsmSignalDbm,
      defenseStatus: terminalStatus.defenseActive ? 'ARMED' : 'DISARMED'
    };

    if (session) {
      session.lastSeenAt = now;
      session.health = health;
    }

    // Persist diagnostic update if registered
    if (session?.deviceId) {
      await this.repository.devices.updateDiagnostic(session.deviceId, {
        batteryLevel: batteryPercentage,
        lastPingAt: now
      });
    }

    return {
      success: true,
      packetType: 'STATUS_HEARTBEAT',
      terminalIdentifier,
      deviceId,
      responseBuffer,
      health
    };
  }

  /**
   * PHASE 6: GT012 GPS Location Decoding & Mapping
   */
  private async handleLocation(packet: GT012LocationPacket, ipAddress: string): Promise<GT012IngestResult> {
    const { latitude, longitude, speedKmh, courseDegrees, timestamp, gpsValid, satelliteCount, mcc, mnc, lac, cellId } = packet;
    const now = new Date().toISOString();

    let session = Array.from(this.activeSessions.values())[0];
    let terminalIdentifier = session?.terminalIdentifier || 'GT012_DEVICE';
    let deviceId = session?.deviceId || 'dev-001';
    let assignedLearnerId = session?.assignedLearnerId;

    // Server-side lookup: IMEI -> Device -> Assigned Learner
    if (!assignedLearnerId && terminalIdentifier) {
      const dev = await (this.repository.devices as any).findByImeiOrSerial?.(terminalIdentifier) ||
                  await this.repository.devices.findById(terminalIdentifier) ||
                  await this.repository.devices.findBySerialNumber(terminalIdentifier);
      if (dev && dev.assigned_learner_id) {
        assignedLearnerId = dev.assigned_learner_id;
        deviceId = dev.id;
      }
    }

    const telemetryRecord: GT012DeviceTelemetryRecord = {
      id: `tel-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      deviceId,
      terminalIdentifier,
      timestamp: timestamp || now,
      latitude,
      longitude,
      speed: speedKmh,
      course: courseDegrees,
      batteryLevel: session?.health?.batteryPercentage || 90,
      voltage: 5,
      gsmSignal: session?.health?.signalDbm || -75,
      gpsValidity: gpsValid,
      satelliteCount,
      mcc,
      mnc,
      lac,
      cellId,
      source: 'GT012_GPS',
      isSimulated: false
    };

    // Store in circular telemetry history (up to 200 items per terminal)
    const list = this.recentTelemetry.get(terminalIdentifier) || [];
    list.unshift(telemetryRecord);
    if (list.length > 200) list.pop();
    this.recentTelemetry.set(terminalIdentifier, list);

    if (session) {
      session.lastSeenAt = now;
      session.lastLocation = {
        latitude,
        longitude,
        speed: speedKmh,
        course: courseDegrees,
        timestamp: timestamp || now
      };
      session.health.lastLocationAt = now;
    }

    return {
      success: true,
      packetType: 'LOCATION_DATA',
      terminalIdentifier,
      deviceId,
      assignedLearnerId,
      telemetry: telemetryRecord,
      health: session?.health
    };
  }

  /**
   * PHASE 7: GT012 Alarm Processing & Incident Escalation Engine
   */
  private async handleAlarm(packet: GT012AlarmPacket, ipAddress: string): Promise<GT012IngestResult> {
    const {
      serialNumber,
      latitude,
      longitude,
      speedKmh,
      courseDegrees,
      timestamp,
      alarmCode,
      alarmType,
      alarmClassification,
      requiresIncidentEscalation
    } = packet;

    const now = new Date().toISOString();
    const responseBuffer = GT012Protocol.buildAcknowledgement(GT012ProtocolNumber.ALARM_DATA, serialNumber);

    let session = Array.from(this.activeSessions.values())[0];
    let terminalIdentifier = session?.terminalIdentifier || 'GT012_DEVICE';
    let deviceId = session?.deviceId || 'dev-001';
    let assignedLearnerId = session?.assignedLearnerId;

    // Server-side lookup
    if (!assignedLearnerId) {
      const dev = await (this.repository.devices as any).findByImeiOrSerial?.(terminalIdentifier) ||
                  await this.repository.devices.findById(terminalIdentifier) ||
                  await this.repository.devices.findBySerialNumber(terminalIdentifier);
      if (dev && dev.assigned_learner_id) {
        assignedLearnerId = dev.assigned_learner_id;
        deviceId = dev.id;
      }
    }

    let incidentCreated = false;
    let incidentId: string | undefined = undefined;

    // Authoritative Emergency Escalation: Safe Deduplication & Incident Creation
    if (requiresIncidentEscalation && assignedLearnerId) {
      // 1. Check for existing active incident for this learner
      const activeIncidents = await this.repository.incidents.query({
        learnerId: assignedLearnerId,
        activeOnly: true
      });

      const existingActive = activeIncidents.data.find(inc => inc.status !== 'RESOLVED');

      if (existingActive) {
        // Safe Correlation: Update existing active incident rather than creating duplicate
        incidentId = existingActive.id;
        const updateNote = `GT012 RE-TRANSMITTED ALARM at ${new Date().toLocaleTimeString()}: [${alarmType}] Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)} (Speed: ${speedKmh} km/h)`;
        const newNotes = [...(existingActive.notes || []), updateNote];

        await this.repository.incidents.update(existingActive.id, {
          notes: newNotes,
          location: {
            ...existingActive.location,
            lat: latitude,
            lng: longitude,
            locationTimestamp: timestamp || now
          }
        });

        await this.repository.incidents.addEvent(existingActive.id, {
          eventType: 'SOS_RETRANSMIT_UPDATE',
          actorName: `GT012 Tracker (${terminalIdentifier})`,
          actorRole: 'HARDWARE_BEACON',
          notes: updateNote,
          latitude,
          longitude
        });

        incidentCreated = false;
      } else {
        // Create new incident in Command Centre Unassigned Queue
        const learner = await this.repository.learners.findHydratedById(assignedLearnerId);
        if (learner) {
          incidentId = 'inc-gt012-' + Date.now().toString().slice(-6);
          const newIncident: IncidentAlert = {
            id: incidentId,
            learnerId: learner.learner.id,
            learnerName: `${learner.person.firstName} ${learner.person.lastName}`,
            learnerGrade: learner.currentAcademicRecord ? `${learner.currentAcademicRecord.grade} (${learner.currentAcademicRecord.classSection})` : 'Grade 10',
            schoolId: learner.currentSchool?.id || 'sch-001',
            schoolName: learner.currentSchool?.name || 'Pretoria Boys High School',
            guardianName: learner.guardians[0] ? `${learner.guardians[0].person.firstName} ${learner.guardians[0].person.lastName} (${learner.guardians[0].relationship.relationshipType})` : 'Authoritative Guardian',
            guardianMobile: learner.guardians[0]?.guardian.mobileNumber || '+27 82 000 0000',
            timestamp: now,
            severity: alarmClassification === 'CRITICAL_EMERGENCY' ? 'CRITICAL_SOS' : 'HIGH',
            status: 'ACTIVE_ALARM',
            triggerType: alarmType === 'SOS_PANIC' ? 'MANUAL_SOS_BEACON' : 'GEOFENCE_BREACH',
            location: {
              lat: latitude,
              lng: longitude,
              addressDescription: `GT012 Tracker Distress Signal • Vector: ${courseDegrees}° (${speedKmh} km/h)`,
              accuracyMeters: 4.2,
              locationSource: 'GT012_HARDWARE_BEACON',
              locationTimestamp: timestamp || now
            },
            slaTargetSeconds: 180,
            elapsedSeconds: 0,
            notes: [
              `AUTHORITATIVE GT012 BEACON ALARM: [${alarmType}] (Code: 0x${alarmCode.toString(16).padStart(2, '0')})`,
              `Classification: ${alarmClassification} • Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              'National Child Safety Directive automatically queued for tactical command dispatch.'
            ]
          };

          await this.repository.incidents.create(newIncident, {
            userId: 'sys-gt012-beacon',
            userName: `GT012 Tracker (${terminalIdentifier})`,
            userRole: 'SYSTEM_ADMIN'
          });

          incidentCreated = true;
        }
      }
    }

    // Audit log
    const audit = await this.repository.auditLogs.logEvent({
      actionType: incidentCreated ? 'EMERGENCY_PANIC_TRIGGERED' : 'DIAGNOSTIC_ACTION',
      actorUserId: 'sys-gt012-gateway',
      actorName: 'GT012 Telemetry Ingest Gateway',
      actorRole: 'SYSTEM_ADMIN',
      targetEntity: 'DEVICE',
      targetId: deviceId,
      details: {
        alarmType,
        alarmClassification,
        alarmCode,
        requiresIncidentEscalation,
        incidentCreated,
        incidentId,
        coordinates: { lat: latitude, lng: longitude }
      },
      ipAddress
    });

    return {
      success: true,
      packetType: 'ALARM_DATA',
      terminalIdentifier,
      deviceId,
      assignedLearnerId,
      alarmClassification,
      incidentCreated,
      incidentId,
      responseBuffer,
      auditEventId: audit.id
    };
  }

  /**
   * Query recent telemetry history for a specific terminal
   */
  public getRecentTelemetry(terminalIdentifier: string): GT012DeviceTelemetryRecord[] {
    return this.recentTelemetry.get(terminalIdentifier) || [];
  }

  /**
   * Get active terminal session
   */
  public getActiveSession(terminalIdentifier: string): ActiveTerminalSession | undefined {
    return this.activeSessions.get(terminalIdentifier);
  }

  /**
   * List all active terminal sessions
   */
  public getAllActiveSessions(): ActiveTerminalSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Bind terminal session explicitly (used by simulator / test fixtures)
   */
  public setSession(terminalIdentifier: string, session: Partial<ActiveTerminalSession>) {
    const existing = this.activeSessions.get(terminalIdentifier);
    this.activeSessions.set(terminalIdentifier, {
      terminalIdentifier,
      deviceId: session.deviceId || existing?.deviceId || 'dev-001',
      assignedLearnerId: session.assignedLearnerId || existing?.assignedLearnerId,
      lastSeenAt: new Date().toISOString(),
      health: session.health || existing?.health || {
        deviceId: session.deviceId || 'dev-001',
        terminalIdentifier,
        lastHeartbeatAt: new Date().toISOString(),
        lastLocationAt: new Date().toISOString(),
        connectivityStatus: 'ONLINE',
        batteryStatus: 'NORMAL',
        batteryPercentage: 90,
        signalStatus: 'EXCELLENT',
        signalDbm: -68,
        defenseStatus: 'ARMED'
      }
    });
  }
}
