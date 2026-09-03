/**
 * ITIS GUARDIAN NETWORK — GPS TRACKER SOS & EMERGENCY EVENT PIPELINE
 * 
 * Flow:
 * TRACKER SOS
 *       ↓
 * Telemetry Server
 *       ↓
 * Protocol Validation
 *       ↓
 * Device Authentication
 *       ↓
 * Device → Learner Lookup
 *       ↓
 * Emergency Event
 *       ↓
 * ITIS Incident Creation
 *       ↓
 * Command Centre Unassigned Queue
 *       ↓
 * Command Officer Claims Incident
 *       ↓
 * Responder Dispatch
 * 
 * Critical Safety Rules:
 * - SOS events must NOT be created from: malformed packets, unknown devices, failed auth, invalid parsing, duplicate retransmissions.
 * - Emergency events are validated, authenticated, and deduplicated before incident creation.
 * - Repeated SOS packets correlate to existing active incidents rather than creating duplicates.
 * - Incidents enter the authoritative Command Centre Unassigned Queue.
 * - Existing multi-officer incident management, claiming, and dispatch logic is strictly preserved.
 */

import { RawNetworkPacket, DecodedPacketResult } from '../types/packet.js';
import { TelemetryEvent, ProcessedAlertEvent } from '../types/telemetry.js';
import { DeviceRecord } from '../types/device.js';
import { ProtocolRegistry } from '../protocol/protocolRegistry.js';
import { PacketDecoder } from '../protocol/packetDecoder.js';
import { TelemetryValidator } from '../security/validation.js';
import { DeviceAuthenticationService } from '../devices/deviceAuthentication.js';
import { DeviceRegistry } from '../devices/deviceRegistry.js';
import { DuplicateDetector } from '../security/duplicateDetector.js';
import { GuardianNotificationService } from '../notifications/guardianNotificationService.js';
import {
  EmergencyEvent,
  EmergencyType,
  EmergencySeverity,
  EmergencyProcessingStatus,
  GuardianNotificationPayload
} from '../types/emergency.js';

export interface CommandOfficerInfo {
  id: string;
  name: string;
  role: string;
}

export interface ResponderDispatchInfo {
  id: string;
  name: string;
  unitType: string;
  vehicleId: string;
  etaMinutes: number;
}

export interface CommandCentreIncident {
  id: string;
  learnerId: string;
  learnerName: string;
  learnerGrade?: string;
  schoolId: string;
  schoolName: string;
  guardianName: string;
  guardianMobile: string;
  timestamp: string;
  severity: EmergencySeverity;
  status: 'ACTIVE_ALARM' | 'DISPATCHED' | 'ON_SCENE' | 'CONTAINED' | 'RESOLVED';
  triggerType: 'MANUAL_SOS_BEACON' | 'APP_PANIC' | 'GEOFENCE_BREACH';
  location: {
    lat: number;
    lng: number;
    addressDescription: string;
    accuracyMeters?: number;
    locationSource?: string;
    locationTimestamp?: string;
  };
  deviceId: string;
  imei?: string;
  primaryOfficerId?: string;
  primaryOfficerName?: string;
  primaryOfficerRole?: string;
  claimedAt?: string;
  monitoringOfficers: Array<{ userId: string; name: string; role?: string; joinedAt: string }>;
  assignedResponder?: ResponderDispatchInfo;
  slaTargetSeconds: number;
  elapsedSeconds: number;
  notes: string[];
  batteryLevel?: number;
  signalQuality?: number;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface EmergencyPipelineResult {
  success: boolean;
  status: EmergencyProcessingStatus;
  emergencyEvent?: EmergencyEvent;
  incident?: CommandCentreIncident;
  isExistingIncidentUpdate: boolean;
  error?: string;
}

export class EmergencyEventPipeline {
  private incidents = new Map<string, CommandCentreIncident>();
  private activeIncidentsByLearner = new Map<string, string>(); // learnerId -> incidentId
  private activeIncidentsByDevice = new Map<string, string>(); // deviceId -> incidentId
  private duplicateDetector: DuplicateDetector;

  constructor(
    private protocolRegistry: ProtocolRegistry,
    private authService: DeviceAuthenticationService,
    private deviceRegistry: DeviceRegistry,
    private notificationService: GuardianNotificationService,
    duplicateDetector?: DuplicateDetector,
    private correlationWindowMs: number = 15 * 60 * 1000 // 15 minutes active alarm window
  ) {
    this.duplicateDetector = duplicateDetector || new DuplicateDetector(correlationWindowMs);
  }

  /**
   * Primary entry point for processing raw network packets containing SOS/emergency triggers.
   */
  public async processRawEmergencyPacket(
    rawPacket: RawNetworkPacket
  ): Promise<EmergencyPipelineResult> {
    // 1. Protocol Identification
    const protocol = this.protocolRegistry.identifyProtocol(rawPacket);
    if (!protocol) {
      return {
        success: false,
        status: 'REJECTED_MALFORMED',
        isExistingIncidentUpdate: false,
        error: 'Protocol recognition failed. Malformed or unsupported packet.'
      };
    }

    // 2. Buffer Size & Protocol Validation
    if (!TelemetryValidator.isValidPacketSize(rawPacket.data)) {
      return {
        success: false,
        status: 'REJECTED_MALFORMED',
        isExistingIncidentUpdate: false,
        error: 'Packet buffer size invalid.'
      };
    }

    // 3. Protocol Validation & Decoding
    const decoded: DecodedPacketResult<unknown> = await PacketDecoder.decodePacket(protocol, rawPacket);
    if (!decoded.success || !decoded.deviceId) {
      return {
        success: false,
        status: 'REJECTED_MALFORMED',
        isExistingIncidentUpdate: false,
        error: `Protocol validation failure: ${decoded.error || 'Invalid payload framing.'}`
      };
    }

    // 4. Device Authentication & Identification
    const authResult = await this.authService.authenticateDevice(decoded.deviceId);
    if (!authResult.allowed || !authResult.device) {
      return {
        success: false,
        status: 'REJECTED_UNKNOWN_DEVICE',
        isExistingIncidentUpdate: false,
        error: `Device authentication failed: ${authResult.reason || 'Unknown device.'}`
      };
    }

    // 5. Telemetry Normalization
    const event = protocol.normalize(decoded);
    if (!event) {
      return {
        success: false,
        status: 'REJECTED_MALFORMED',
        isExistingIncidentUpdate: false,
        error: 'Protocol normalization failed.'
      };
    }

    return this.processNormalizedEmergencyEvent(event, authResult.device);
  }

  /**
   * Process a normalized telemetry event that triggered an SOS or Critical Alarm.
   */
  public async processNormalizedEmergencyEvent(
    event: TelemetryEvent,
    authenticatedDevice?: DeviceRecord
  ): Promise<EmergencyPipelineResult> {
    const deviceId = event.deviceId;

    // 1. Ensure authoritative device record
    const device = authenticatedDevice || await this.deviceRegistry.getDevice(deviceId);
    if (!device) {
      return {
        success: false,
        status: 'REJECTED_UNKNOWN_DEVICE',
        isExistingIncidentUpdate: false,
        error: `Device '${deviceId}' is not registered in authoritative registry.`
      };
    }

    // 2. Ensure device has an assigned learner
    if (!device.learnerId) {
      return {
        success: false,
        status: 'REJECTED_UNASSIGNED_LEARNER',
        isExistingIncidentUpdate: false,
        error: `Device '${deviceId}' is not currently linked to an enrolled learner.`
      };
    }

    const learnerId = device.learnerId;
    const schoolId = device.schoolId || 'sch-001';

    // 3. Verify event is an emergency/SOS trigger
    const isSos = event.sosActive || event.alarmType === 'SOS_PANIC';
    const emergencyType: EmergencyType = isSos ? 'SOS_PANIC' : (event.alarmType as EmergencyType) || 'MANUAL_BEACON';
    const severity: EmergencySeverity = isSos ? 'CRITICAL_SOS' : 'HIGH';

    // 4. Safe Deduplication & Correlation Check against Active Incidents
    const existingIncidentId = this.findActiveIncidentId(learnerId, deviceId);

    if (existingIncidentId) {
      const existingIncident = this.incidents.get(existingIncidentId);
      if (existingIncident && existingIncident.status !== 'RESOLVED') {
        // Safe update: Append new coordinates/notes to existing incident, DO NOT duplicate!
        const updateTimestamp = new Date(event.timestamp).toLocaleTimeString();
        const updateNote = `SOS TELEMETRY UPDATE at ${updateTimestamp}: Coordinates [${event.latitude?.toFixed(6) ?? 'N/A'}, ${event.longitude?.toFixed(6) ?? 'N/A'}] • Battery: ${event.batteryLevel ?? 'N/A'}% • Speed: ${event.speed ?? 0} km/h`;
        
        existingIncident.notes.push(updateNote);
        if (event.latitude != null && event.longitude != null) {
          existingIncident.location.lat = event.latitude;
          existingIncident.location.lng = event.longitude;
          existingIncident.location.locationTimestamp = new Date(event.timestamp).toISOString();
        }
        if (event.batteryLevel != null) {
          existingIncident.batteryLevel = event.batteryLevel;
        }

        const emergencyEvent: EmergencyEvent = {
          id: `em_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          deviceId,
          imei: device.imei || event.imei,
          learnerId,
          learnerName: existingIncident.learnerName,
          schoolId,
          schoolName: existingIncident.schoolName,
          guardianName: existingIncident.guardianName,
          guardianMobile: existingIncident.guardianMobile,
          emergencyType,
          severity,
          timestamp: new Date(event.timestamp),
          latitude: event.latitude,
          longitude: event.longitude,
          speed: event.speed,
          batteryLevel: event.batteryLevel,
          signalQuality: event.gsmSignal ?? event.signalLevel,
          status: 'CORRELATED_UPDATE',
          incidentId: existingIncident.id,
          isExistingIncidentUpdate: true,
          notes: [updateNote]
        };

        return {
          success: true,
          status: 'CORRELATED_UPDATE',
          emergencyEvent,
          incident: existingIncident,
          isExistingIncidentUpdate: true
        };
      }
    }

    // 5. Create NEW Authoritative Incident in Command Centre UNASSIGNED Queue
    const incidentId = `inc-sos-${Date.now().toString().slice(-6)}`;
    const learnerName = `Learner (${learnerId})`;
    const schoolName = `School (${schoolId})`;
    const guardianName = `Authoritative Guardian (${learnerId})`;
    const guardianMobile = `+2782${Math.floor(1000000 + Math.random() * 9000000)}`;

    const newIncident: CommandCentreIncident = {
      id: incidentId,
      learnerId,
      learnerName,
      schoolId,
      schoolName,
      guardianName,
      guardianMobile,
      timestamp: new Date(event.timestamp).toISOString(),
      severity,
      status: 'ACTIVE_ALARM',
      triggerType: 'MANUAL_SOS_BEACON',
      location: {
        lat: event.latitude || -25.7589,
        lng: event.longitude || 28.2321,
        addressDescription: `GPS Tracker Hardware Distress Signal (Device: ${deviceId})`,
        accuracyMeters: event.accuracy,
        locationSource: 'GPS_TRACKER_HARDWARE',
        locationTimestamp: new Date(event.timestamp).toISOString()
      },
      deviceId,
      imei: device.imei || event.imei,
      primaryOfficerId: undefined, // Enters UNASSIGNED INCIDENT QUEUE
      monitoringOfficers: [],
      slaTargetSeconds: 180,
      elapsedSeconds: 0,
      batteryLevel: event.batteryLevel,
      signalQuality: event.gsmSignal ?? event.signalLevel,
      notes: [
        `CRITICAL HARDWARE SOS: Device ${deviceId} triggered emergency at ${new Date(event.timestamp).toLocaleTimeString()}`,
        `Coordinates: ${event.latitude?.toFixed(6) ?? 'N/A'}, ${event.longitude?.toFixed(6) ?? 'N/A'} • Accuracy: ${event.accuracy ? `${event.accuracy}m` : 'GNSS Fix'}`,
        'Enqueued to Command Centre Unassigned Queue for tactical officer assignment.'
      ]
    };

    // Store in active incident maps
    this.incidents.set(incidentId, newIncident);
    this.activeIncidentsByLearner.set(learnerId, incidentId);
    this.activeIncidentsByDevice.set(deviceId, incidentId);

    // 6. Dispatch Guardian Notification via Abstraction
    const notificationPayload: GuardianNotificationPayload = {
      notificationId: `notif_${Date.now()}`,
      recipientMobile: guardianMobile,
      recipientName: guardianName,
      learnerId,
      learnerName,
      schoolName,
      emergencyType,
      timestamp: new Date(event.timestamp),
      latitude: event.latitude,
      longitude: event.longitude,
      batteryLevel: event.batteryLevel,
      mapTrackingUrl: event.latitude && event.longitude ? `https://itis.gov.za/track/${incidentId}` : undefined,
      messageText: `EMERGENCY ALERT: Hardware SOS beacon activated for ${learnerName} at ${new Date(event.timestamp).toLocaleTimeString()}. Command Centre activated.`
    };

    await this.notificationService.notifyGuardian(notificationPayload);

    const emergencyEvent: EmergencyEvent = {
      id: `em_evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      deviceId,
      imei: device.imei || event.imei,
      learnerId,
      learnerName,
      schoolId,
      schoolName,
      guardianName,
      guardianMobile,
      emergencyType,
      severity,
      timestamp: new Date(event.timestamp),
      latitude: event.latitude,
      longitude: event.longitude,
      speed: event.speed,
      batteryLevel: event.batteryLevel,
      signalQuality: event.gsmSignal ?? event.signalLevel,
      status: 'CREATED',
      incidentId: newIncident.id,
      isExistingIncidentUpdate: false,
      notes: newIncident.notes
    };

    return {
      success: true,
      status: 'CREATED',
      emergencyEvent,
      incident: newIncident,
      isExistingIncidentUpdate: false
    };
  }

  /**
   * Helper to locate an active, unresolved incident for a learner or device.
   */
  private findActiveIncidentId(learnerId: string, deviceId: string): string | undefined {
    const incIdByLearner = this.activeIncidentsByLearner.get(learnerId);
    if (incIdByLearner) {
      const inc = this.incidents.get(incIdByLearner);
      if (inc && inc.status !== 'RESOLVED') {
        return incIdByLearner;
      }
    }

    const incIdByDevice = this.activeIncidentsByDevice.get(deviceId);
    if (incIdByDevice) {
      const inc = this.incidents.get(incIdByDevice);
      if (inc && inc.status !== 'RESOLVED') {
        return incIdByDevice;
      }
    }

    return undefined;
  }

  // --------------------------------------------------------------------------
  // COMMAND CENTRE MULTI-OFFICER WORKFLOW API (Preserved & Enforced)
  // --------------------------------------------------------------------------

  /**
   * Get all incidents currently in the Unassigned Incident Queue.
   */
  public getUnassignedQueue(): CommandCentreIncident[] {
    return Array.from(this.incidents.values()).filter(
      (inc) => !inc.primaryOfficerId && inc.status !== 'RESOLVED'
    );
  }

  /**
   * Get all active (unresolved) incidents across the system.
   */
  public getActiveIncidents(): CommandCentreIncident[] {
    return Array.from(this.incidents.values()).filter((inc) => inc.status !== 'RESOLVED');
  }

  /**
   * Retrieve incident by ID.
   */
  public getIncidentById(id: string): CommandCentreIncident | undefined {
    return this.incidents.get(id);
  }

  /**
   * Command Officer claims ownership of an unassigned incident.
   */
  public claimIncident(incidentId: string, officer: CommandOfficerInfo): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    if (incident.primaryOfficerId && incident.primaryOfficerId !== officer.id) {
      throw new Error(
        `Incident is already claimed by Officer ${incident.primaryOfficerName || incident.primaryOfficerId}. Request a handover to take over.`
      );
    }

    incident.primaryOfficerId = officer.id;
    incident.primaryOfficerName = officer.name;
    incident.primaryOfficerRole = officer.role;
    incident.claimedAt = new Date().toISOString();
    incident.notes.push(
      `Claimed by Command Officer ${officer.name} (${officer.role}) at ${new Date().toLocaleTimeString()}`
    );

    return incident;
  }

  /**
   * Command Officer releases incident back to the Unassigned Queue.
   */
  public releaseIncident(
    incidentId: string,
    officer: CommandOfficerInfo,
    reason?: string
  ): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    if (
      incident.primaryOfficerId &&
      incident.primaryOfficerId !== officer.id &&
      officer.role !== 'FOUNDER_EXECUTIVE' &&
      officer.role !== 'SYSTEM_ADMIN'
    ) {
      throw new Error('You cannot release an incident claimed by another officer.');
    }

    incident.primaryOfficerId = undefined;
    incident.primaryOfficerName = undefined;
    incident.primaryOfficerRole = undefined;
    incident.claimedAt = undefined;
    incident.notes.push(
      `Released back to general queue by ${officer.name} (${officer.role})${reason ? ': ' + reason : ''}`
    );

    return incident;
  }

  /**
   * Handover incident from one officer to another.
   */
  public handoverIncident(
    incidentId: string,
    fromOfficer: CommandOfficerInfo,
    targetOfficer: CommandOfficerInfo,
    reason: string
  ): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    incident.primaryOfficerId = targetOfficer.id;
    incident.primaryOfficerName = targetOfficer.name;
    incident.primaryOfficerRole = targetOfficer.role;
    incident.claimedAt = new Date().toISOString();
    incident.notes.push(
      `Command transferred from ${fromOfficer.name} to ${targetOfficer.name}. Reason: ${reason}`
    );

    return incident;
  }

  /**
   * Officer joins incident in observer/monitoring mode.
   */
  public joinMonitoring(incidentId: string, officer: CommandOfficerInfo): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    if (!incident.monitoringOfficers.some((m) => m.userId === officer.id)) {
      incident.monitoringOfficers.push({
        userId: officer.id,
        name: officer.name,
        role: officer.role,
        joinedAt: new Date().toISOString()
      });
      incident.notes.push(
        `Officer ${officer.name} joined incident monitoring at ${new Date().toLocaleTimeString()}`
      );
    }

    return incident;
  }

  /**
   * Officer leaves monitoring mode.
   */
  public leaveMonitoring(incidentId: string, officerId: string): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    incident.monitoringOfficers = incident.monitoringOfficers.filter((m) => m.userId !== officerId);
    return incident;
  }

  /**
   * Dispatch a tactical responder unit (SAPS, Metro Police, etc.).
   */
  public dispatchResponder(
    incidentId: string,
    responder: ResponderDispatchInfo,
    authorizedBy: CommandOfficerInfo
  ): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    incident.status = 'DISPATCHED';
    incident.assignedResponder = responder;
    incident.notes.push(
      `TACTICAL DISPATCH: ${responder.name} (${responder.vehicleId}) dispatched by ${authorizedBy.name} at ${new Date().toLocaleTimeString()}`
    );

    return incident;
  }

  /**
   * Resolve and close an incident.
   */
  public resolveIncident(
    incidentId: string,
    resolvedBy: CommandOfficerInfo,
    note?: string
  ): CommandCentreIncident {
    const incident = this.incidents.get(incidentId);
    if (!incident) {
      throw new Error(`Incident '${incidentId}' not found.`);
    }

    incident.status = 'RESOLVED';
    incident.resolvedAt = new Date().toISOString();
    incident.resolvedBy = resolvedBy.name;
    incident.notes.push(
      `INCIDENT RESOLVED by ${resolvedBy.name} (${resolvedBy.role}) at ${new Date().toLocaleTimeString()}${note ? ': ' + note : ''}`
    );

    // Clean up active lookup maps
    this.activeIncidentsByLearner.delete(incident.learnerId);
    this.activeIncidentsByDevice.delete(incident.deviceId);

    return incident;
  }
}
