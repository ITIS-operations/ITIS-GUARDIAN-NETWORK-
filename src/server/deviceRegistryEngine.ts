/**
 * ITIS GUARDIAN NETWORK — AUTHORITATIVE GPS DEVICE REGISTRY & LEARNER LINKING ENGINE
 * 
 * Enterprise Relationship Hierarchy:
 * GPS TRACKER ↔ ITIS DEVICE REGISTRY ↔ LEARNER ↔ GUARDIAN
 * 
 * Strict Architectural Invariants:
 * 1. Single Authoritative Device Record per physical tracker.
 * 2. Strict 1:1 Active Assignment constraint (One Device ↔ One Active Learner).
 * 3. Immutable Assignment History preservation across all reassignment lifecycles.
 * 4. Unknown incoming trackers remain UNREGISTERED until explicitly provisioned.
 * 5. Strict Guardian RBAC/ABAC isolation: Guardians only access linked children devices.
 * 6. Cryptographic Audit logging for all device lifecycle events.
 */

import {
  ItisDeviceRecord,
  ItisDeviceState,
  ItisDeviceProtocolType,
  ItisDeviceCalculatedHealthState,
  DeviceHealthThresholdConfig,
  DEFAULT_DEVICE_HEALTH_CONFIG,
  DeviceAssignmentHistoryRecord,
  GuardianAuthorizedDeviceView,
  ProvisionDevicePayload,
  RegisterDevicePayload,
  ProcureDevicePayload,
  ReplaceDevicePayload,
  AssignDeviceToLearnerPayload,
  ReassignDevicePayload,
  UnassignReason,
  DeviceHealthSummary,
  ActiveUserSession,
  ImmutableAuditEvent
} from '../types.js';
import { db } from './dbStore.js';

export class DeviceRegistryEngine {
  private devices: Map<string, ItisDeviceRecord> = new Map();
  private trackerIdentifierIndex: Map<string, string> = new Map(); // trackerDeviceId -> itisDeviceId
  private imeiIndex: Map<string, string> = new Map(); // imei -> itisDeviceId
  private assignmentHistory: DeviceAssignmentHistoryRecord[] = [];

  constructor() {
    this.seedAuthoritativeDeviceRegistry();
  }

  /**
   * Seed baseline authoritative device registry
   */
  private seedAuthoritativeDeviceRegistry(): void {
    const seededDevices: ItisDeviceRecord[] = [
      {
        itisDeviceId: 'DEV-ITIS-001',
        trackerDeviceId: 'GT012-TRK-8812',
        imei: '867543029182734',
        simIdentifier: '8927010203040506070',
        protocolType: 'GT012',
        deviceModel: 'GT012-4G-SOS-WEARABLE',
        deviceStatus: 'ACTIVE',
        activationStatus: 'ACTIVATED',
        assignedLearnerId: 'lrn-001',
        assignedLearnerName: 'Kagiso Ndlovu',
        assignedLearnerEmis: 'LRN-2025-PTA-0042',
        assignedSchoolId: 'sch-001',
        assignedSchoolName: 'Pretoria Boys High School',
        lastKnownLocation: {
          latitude: -25.7589,
          longitude: 28.2321,
          accuracyMeters: 4.5,
          addressDescription: 'Pretoria Boys High Safe Corridor, Brooklyn, Pretoria',
          timestamp: '2026-09-02T08:00:00.000Z'
        },
        lastTelemetryTimestamp: '2026-09-02T08:00:00.000Z',
        batteryStatus: {
          percentage: 95,
          voltage: 4.12,
          healthStatus: 'NORMAL'
        },
        connectionStatus: 'ONLINE',
        firmwareVersion: 'GT012-v4.2.1-ZA',
        hardwareRevision: 'HW-REV-3B',
        registeredAt: '2026-01-10T08:00:00.000Z',
        updatedAt: '2026-09-02T08:00:00.000Z',
        provisionedAt: '2026-01-10T08:30:00.000Z',
        provisionedByUserId: 'usr-tech-01',
        provisionedByUserName: 'Thabo Sithole (Hardware Lead)'
      },
      {
        itisDeviceId: 'DEV-ITIS-002',
        trackerDeviceId: 'GT012-TRK-8813',
        imei: '867543029182735',
        simIdentifier: '8927010203040506071',
        protocolType: 'GT012',
        deviceModel: 'GT012-4G-SOS-WEARABLE',
        deviceStatus: 'ACTIVE',
        activationStatus: 'ACTIVATED',
        assignedLearnerId: 'lrn-002',
        assignedLearnerName: 'Lindiwe Ndlovu',
        assignedLearnerEmis: 'LRN-2025-PTA-0043',
        assignedSchoolId: 'sch-001',
        assignedSchoolName: 'Pretoria Boys High School',
        lastKnownLocation: {
          latitude: -25.7592,
          longitude: 28.2318,
          accuracyMeters: 5.0,
          addressDescription: 'Pretoria Boys High Campus Zone A',
          timestamp: '2026-09-02T08:05:00.000Z'
        },
        lastTelemetryTimestamp: '2026-09-02T08:05:00.000Z',
        batteryStatus: {
          percentage: 88,
          voltage: 3.98,
          healthStatus: 'NORMAL'
        },
        connectionStatus: 'ONLINE',
        firmwareVersion: 'GT012-v4.2.1-ZA',
        hardwareRevision: 'HW-REV-3B',
        registeredAt: '2026-01-10T08:15:00.000Z',
        updatedAt: '2026-09-02T08:05:00.000Z',
        provisionedAt: '2026-01-10T08:45:00.000Z',
        provisionedByUserId: 'usr-tech-01',
        provisionedByUserName: 'Thabo Sithole (Hardware Lead)'
      },
      {
        itisDeviceId: 'DEV-ITIS-003',
        trackerDeviceId: 'GT012-TRK-8819',
        imei: '867543029182740',
        protocolType: 'GT012',
        deviceModel: 'GT012-4G-SOS-WEARABLE',
        deviceStatus: 'ACTIVE',
        activationStatus: 'ACTIVATED',
        assignedLearnerId: 'lrn-003',
        assignedLearnerName: 'Zola Dlamini',
        assignedLearnerEmis: 'LRN-2025-SOW-0199',
        assignedSchoolId: 'sch-002',
        assignedSchoolName: 'Soweto Community High School',
        lastKnownLocation: {
          latitude: -26.2485,
          longitude: 27.8540,
          accuracyMeters: 6.2,
          addressDescription: 'Vilakazi St Corridor, Soweto',
          timestamp: '2026-09-02T07:45:00.000Z'
        },
        lastTelemetryTimestamp: '2026-09-02T07:45:00.000Z',
        batteryStatus: {
          percentage: 92,
          voltage: 4.05,
          healthStatus: 'NORMAL'
        },
        connectionStatus: 'ONLINE',
        firmwareVersion: 'GT012-v4.2.1-ZA',
        hardwareRevision: 'HW-REV-3B',
        registeredAt: '2026-01-12T09:00:00.000Z',
        updatedAt: '2026-09-02T07:45:00.000Z',
        provisionedAt: '2026-01-12T09:30:00.000Z',
        provisionedByUserId: 'usr-tech-01',
        provisionedByUserName: 'Thabo Sithole (Hardware Lead)'
      },
      {
        itisDeviceId: 'DEV-ITIS-004-SPARE',
        trackerDeviceId: 'GT012-TRK-9901',
        imei: '867543029182991',
        protocolType: 'GT012',
        deviceModel: 'GT012-4G-SOS-WEARABLE',
        deviceStatus: 'ACTIVE',
        activationStatus: 'ACTIVATED',
        assignedLearnerId: null,
        batteryStatus: {
          percentage: 100,
          voltage: 4.20,
          healthStatus: 'NORMAL'
        },
        connectionStatus: 'STANDBY',
        firmwareVersion: 'GT012-v4.2.1-ZA',
        hardwareRevision: 'HW-REV-3B',
        registeredAt: '2026-02-01T10:00:00.000Z',
        updatedAt: '2026-02-01T10:00:00.000Z',
        provisionedAt: '2026-02-01T10:30:00.000Z',
        provisionedByUserId: 'usr-tech-01',
        provisionedByUserName: 'Thabo Sithole (Hardware Lead)'
      }
    ];

    for (const dev of seededDevices) {
      this.devices.set(dev.itisDeviceId, dev);
      this.trackerIdentifierIndex.set(dev.trackerDeviceId, dev.itisDeviceId);
      if (dev.imei) {
        this.imeiIndex.set(dev.imei, dev.itisDeviceId);
      }

      if (dev.assignedLearnerId) {
        const hist: DeviceAssignmentHistoryRecord = {
          id: `hist-seed-${dev.itisDeviceId}`,
          deviceId: dev.itisDeviceId,
          trackerDeviceId: dev.trackerDeviceId,
          learnerId: dev.assignedLearnerId,
          learnerEmisId: dev.assignedLearnerEmis || 'EMIS-UNKNOWN',
          learnerName: dev.assignedLearnerName || 'Learner',
          schoolId: dev.assignedSchoolId || undefined,
          schoolName: dev.assignedSchoolName || undefined,
          assignedAt: dev.registeredAt,
          assignedByUserId: dev.provisionedByUserId || 'usr-tech-01',
          assignedByUserName: dev.provisionedByUserName || 'Thabo Sithole',
          assignedByUserRole: 'TECHNICIAN',
          status: 'ACTIVE'
        };
        this.assignmentHistory.push(hist);
      }
    }
  }

  // ====================================================
  // 1. INCOMING TRACKER DISCOVERY & UNREGISTERED HANDLING
  // ====================================================

  /**
   * Handle an incoming tracker connection or packet.
   * INVARIANT: Unknown trackers remain UNREGISTERED until explicitly provisioned by authorized staff.
   */
  public handleIncomingTrackerConnection(
    trackerIdentifier: string,
    protocolType: ItisDeviceProtocolType,
    telemetry?: {
      latitude?: number;
      longitude?: number;
      batteryPercentage?: number;
      voltage?: number;
      rawPayload?: any;
    }
  ): ItisDeviceRecord {
    // Check if device is already indexed
    let deviceId = this.trackerIdentifierIndex.get(trackerIdentifier);
    if (!deviceId && this.imeiIndex.has(trackerIdentifier)) {
      deviceId = this.imeiIndex.get(trackerIdentifier);
    }

    if (deviceId && this.devices.has(deviceId)) {
      const existing = this.devices.get(deviceId)!;

      // If device is suspended, reject/flag telemetry and do NOT mark online
      if (existing.deviceStatus === 'SUSPENDED') {
        db.logAuditEvent({
          actionType: 'SUSPENDED_DEVICE_TELEMETRY_BLOCKED',
          actorUserId: 'SYSTEM_TELEMETRY_INGEST',
          actorName: 'ITIS Ingestion Pipeline',
          actorRole: 'TECHNICIAN',
          targetEntity: 'DEVICE',
          targetId: existing.itisDeviceId,
          details: {
            trackerIdentifier,
            reason: 'Device status is SUSPENDED. Ingestion blocked from updating online state.'
          }
        });
        existing.connectionStatus = 'STANDBY';
        existing.calculatedHealthState = 'SUSPENDED';
        return existing;
      }

      // If device is retired, lost, or replaced, block telemetry and keep offline
      if (existing.deviceStatus === 'RETIRED' || existing.deviceStatus === 'LOST' || existing.deviceStatus === 'REPLACED') {
        db.logAuditEvent({
          actionType: 'SUSPENDED_DEVICE_TELEMETRY_BLOCKED',
          actorUserId: 'SYSTEM_TELEMETRY_INGEST',
          actorName: 'ITIS Ingestion Pipeline',
          actorRole: 'TECHNICIAN',
          targetEntity: 'DEVICE',
          targetId: existing.itisDeviceId,
          details: {
            trackerIdentifier,
            reason: `Device status is ${existing.deviceStatus}. Ingestion blocked.`
          }
        });
        existing.connectionStatus = 'OFFLINE';
        existing.calculatedHealthState = 'RETIRED';
        return existing;
      }

      existing.connectionStatus = 'ONLINE';
      existing.lastTelemetryTimestamp = new Date().toISOString();
      existing.lastHeartbeatTimestamp = new Date().toISOString();
      existing.lastCommunicationTimestamp = new Date().toISOString();
      existing.networkStatus = 'CONNECTED';
      existing.updatedAt = new Date().toISOString();

      if (telemetry?.latitude !== undefined && telemetry?.longitude !== undefined) {
        existing.lastKnownLocation = {
          latitude: telemetry.latitude,
          longitude: telemetry.longitude,
          accuracyMeters: 5.0,
          timestamp: new Date().toISOString()
        };
      }
      if (telemetry?.batteryPercentage !== undefined) {
        existing.batteryStatus.percentage = telemetry.batteryPercentage;
        existing.batteryStatus.healthStatus = telemetry.batteryPercentage < 20 ? 'LOW' : 'NORMAL';
      }
      if (telemetry?.voltage !== undefined) {
        existing.batteryStatus.voltage = telemetry.voltage;
      }
      this.calculateDeviceHealthState(existing);
      return existing;
    }

    // Tracker is UNKNOWN -> Create UNREGISTERED record
    const newId = `DEV-UNREG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const unregDevice: ItisDeviceRecord = {
      itisDeviceId: newId,
      trackerDeviceId: trackerIdentifier,
      hardwareSerialNumber: trackerIdentifier,
      imei: /^\d{15,16}$/.test(trackerIdentifier) ? trackerIdentifier : undefined,
      protocolType,
      deviceModel: `UNPROVISIONED-${protocolType}`,
      deviceStatus: 'UNREGISTERED',
      activationStatus: 'PENDING_ACTIVATION',
      assignedLearnerId: null,
      batteryStatus: {
        percentage: telemetry?.batteryPercentage ?? 100,
        voltage: telemetry?.voltage,
        healthStatus: 'NORMAL'
      },
      connectionStatus: 'ONLINE',
      firmwareVersion: 'UNKNOWN',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastTelemetryTimestamp: new Date().toISOString(),
      lastCommunicationTimestamp: new Date().toISOString(),
      lastKnownLocation: telemetry?.latitude !== undefined && telemetry?.longitude !== undefined ? {
        latitude: telemetry.latitude,
        longitude: telemetry.longitude,
        timestamp: new Date().toISOString()
      } : undefined
    };

    this.devices.set(newId, unregDevice);
    this.trackerIdentifierIndex.set(trackerIdentifier, newId);
    if (unregDevice.imei) {
      this.imeiIndex.set(unregDevice.imei, newId);
    }

    return unregDevice;
  }

  // ====================================================
  // 2. AUTHORIZED PROVISIONING & REGISTRATION
  // ====================================================

  /**
   * Ingest physical hardware shipments into authoritative INVENTORY state.
   * Records procurement batch, supplier, warranty, and initial hardware attributes.
   */
  public procureDevice(
    payload: ProcureDevicePayload,
    actorUser: ActiveUserSession
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_PROCUREMENT');

    const trackerId = (payload.trackerDeviceId || payload.serialNumber || payload.hardwareSerialNumber)?.trim();
    if (!trackerId || trackerId.length < 3) {
      throw new Error('Valid physical tracker device identifier or serial number is required.');
    }

    const cleanTrackerId = trackerId;
    const cleanImei = payload.imei?.trim();
    const cleanProtocol: ItisDeviceProtocolType = (payload.protocolType || payload.protocol || 'GT012') as ItisDeviceProtocolType;
    const cleanModel = payload.deviceModel || payload.model || `GPS-TRACKER-${cleanProtocol}`;

    if (cleanImei && !/^\d{14,16}$/.test(cleanImei)) {
      throw new Error(`Invalid IMEI '${cleanImei}'. IMEI must be 14 to 16 digits.`);
    }

    // Duplicate detection against existing non-retired devices
    for (const dev of this.devices.values()) {
      if (dev.deviceStatus === 'RETIRED') continue;

      if (dev.trackerDeviceId.toLowerCase() === cleanTrackerId.toLowerCase()) {
        db.logAuditEvent({
          actionType: 'DUPLICATE_DEVICE_REGISTRATION_BLOCKED',
          actorUserId: actorUser.id,
          actorName: actorUser.name,
          actorRole: actorUser.role,
          targetEntity: 'DEVICE',
          targetId: dev.itisDeviceId,
          details: {
            attemptedTrackerId: cleanTrackerId,
            existingDeviceId: dev.itisDeviceId,
            existingStatus: dev.deviceStatus,
            reason: 'DUPLICATE_SERIAL_IDENTIFIER_AT_PROCUREMENT'
          }
        });
        const err: any = new Error(`Duplicate device identifier detected: Tracker '${cleanTrackerId}' is already present in inventory or registry with ID '${dev.itisDeviceId}' (Status: ${dev.deviceStatus}).`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_DEVICE';
        throw err;
      }

      if (cleanImei && dev.imei && dev.imei.toLowerCase() === cleanImei.toLowerCase()) {
        const err: any = new Error(`Duplicate IMEI detected: IMEI '${cleanImei}' is already present with ID '${dev.itisDeviceId}'.`);
        err.statusCode = 409;
        err.code = 'DUPLICATE_DEVICE';
        throw err;
      }
    }

    const initialStatus: ItisDeviceState = payload.initialStatus === 'REGISTERED' ? 'REGISTERED' : 'INVENTORY';
    const deviceId = `DEV-ITIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const device: ItisDeviceRecord = {
      itisDeviceId: deviceId,
      trackerDeviceId: cleanTrackerId,
      hardwareSerialNumber: payload.hardwareSerialNumber || payload.serialNumber || cleanTrackerId,
      imei: cleanImei,
      simIdentifier: payload.simIdentifier || payload.iccid,
      phoneNumber: payload.phoneNumber,
      protocolType: cleanProtocol,
      manufacturer: payload.manufacturer || 'Topin/Generic',
      deviceModel: cleanModel,
      deviceStatus: initialStatus,
      activationStatus: 'PENDING_ACTIVATION',
      assignedLearnerId: null,
      assignedSchoolId: payload.assignedSchoolId || null,
      batteryStatus: {
        percentage: payload.initialBatteryPercentage ?? 100,
        healthStatus: 'NORMAL',
        chargingState: false
      },
      connectionStatus: 'STANDBY',
      healthClassification: 'UNPROVISIONED',
      calculatedHealthState: 'OFFLINE',
      firmwareVersion: payload.firmwareVersion || 'v1.0.0-PROVISIONED',
      hardwareRevision: payload.hardwareRevision || payload.hardwareVersion || 'REV-A',
      procurementDate: payload.procurementDate || new Date().toISOString(),
      procurementBatch: payload.procurementBatch || `BATCH-${new Date().toISOString().slice(0, 10)}`,
      supplier: payload.supplier || 'ITIS Authoritative Hardware Supply',
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.devices.set(deviceId, device);
    this.trackerIdentifierIndex.set(cleanTrackerId, deviceId);
    if (cleanImei) {
      this.imeiIndex.set(cleanImei, deviceId);
    }

    db.logAuditEvent({
      actionType: 'DEVICE_PROCURED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: deviceId,
      details: {
        trackerDeviceId: cleanTrackerId,
        imei: cleanImei,
        batch: device.procurementBatch,
        supplier: device.supplier,
        protocol: cleanProtocol,
        status: initialStatus
      }
    });

    return device;
  }

  /**
   * Register a physical GPS device in the authoritative Device Registry.
   * Enforces duplicate serial / IMEI detection and logs audit events.
   */
  public registerDevice(
    payload: RegisterDevicePayload,
    actorUser: ActiveUserSession
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_REGISTRATION');

    const trackerId = (payload.trackerDeviceId || payload.serialNumber || payload.hardwareSerialNumber)?.trim();
    if (!trackerId || trackerId.length < 3) {
      throw new Error('Valid physical tracker device identifier or serial number is required.');
    }

    const cleanTrackerId = trackerId;
    const cleanImei = payload.imei?.trim();
    const cleanProtocol: ItisDeviceProtocolType = (payload.protocolType || payload.protocol || 'GT012') as ItisDeviceProtocolType;
    const cleanModel = payload.deviceModel || payload.model || `GPS-TRACKER-${cleanProtocol}`;

    if (cleanImei && !/^\d{14,16}$/.test(cleanImei)) {
      throw new Error(`Invalid IMEI '${cleanImei}'. IMEI must be 14 to 16 digits.`);
    }

    // Duplicate detection against existing non-retired, non-unregistered, non-inventory devices
    for (const dev of this.devices.values()) {
      if (dev.deviceStatus === 'RETIRED') continue;

      if (dev.trackerDeviceId.toLowerCase() === cleanTrackerId.toLowerCase()) {
        if (dev.deviceStatus !== 'UNREGISTERED' && dev.deviceStatus !== 'INVENTORY') {
          db.logAuditEvent({
            actionType: 'DUPLICATE_DEVICE_REGISTRATION_BLOCKED',
            actorUserId: actorUser.id,
            actorName: actorUser.name,
            actorRole: actorUser.role,
            targetEntity: 'DEVICE',
            targetId: dev.itisDeviceId,
            details: {
              attemptedTrackerId: cleanTrackerId,
              existingDeviceId: dev.itisDeviceId,
              existingStatus: dev.deviceStatus,
              reason: 'DUPLICATE_SERIAL_IDENTIFIER'
            }
          });
          const err: any = new Error(`Duplicate device identifier detected: Tracker '${cleanTrackerId}' is already registered with ID '${dev.itisDeviceId}' (Status: ${dev.deviceStatus}).`);
          err.statusCode = 409;
          err.code = 'DUPLICATE_DEVICE';
          throw err;
        }
      }

      if (cleanImei && dev.imei && dev.imei.toLowerCase() === cleanImei.toLowerCase()) {
        if (dev.deviceStatus !== 'UNREGISTERED' && dev.deviceStatus !== 'INVENTORY') {
          db.logAuditEvent({
            actionType: 'DUPLICATE_DEVICE_REGISTRATION_BLOCKED',
            actorUserId: actorUser.id,
            actorName: actorUser.name,
            actorRole: actorUser.role,
            targetEntity: 'DEVICE',
            targetId: dev.itisDeviceId,
            details: {
              attemptedImei: cleanImei,
              existingDeviceId: dev.itisDeviceId,
              existingStatus: dev.deviceStatus,
              reason: 'DUPLICATE_IMEI'
            }
          });
          const err: any = new Error(`Duplicate IMEI detected: IMEI '${cleanImei}' is already registered with ID '${dev.itisDeviceId}'.`);
          err.statusCode = 409;
          err.code = 'DUPLICATE_DEVICE';
          throw err;
        }
      }
    }

    // Check if promoting from UNREGISTERED record
    let deviceId = this.trackerIdentifierIndex.get(cleanTrackerId);
    let device: ItisDeviceRecord;

    if (deviceId && this.devices.has(deviceId)) {
      device = this.devices.get(deviceId)!;
      device.deviceModel = cleanModel;
      device.manufacturer = payload.manufacturer || device.manufacturer || 'Topin/Generic';
      device.protocolType = cleanProtocol;
      device.imei = cleanImei || device.imei;
      device.hardwareSerialNumber = cleanTrackerId;
      device.simIdentifier = payload.simIdentifier || payload.iccid || device.simIdentifier;
      device.phoneNumber = payload.phoneNumber || device.phoneNumber;
      device.firmwareVersion = payload.firmwareVersion || device.firmwareVersion || 'v1.0.0-PROVISIONED';
      device.hardwareRevision = payload.hardwareRevision || device.hardwareRevision || 'REV-A';
      device.deviceStatus = 'REGISTERED';
      device.activationStatus = 'PENDING_ACTIVATION';
      device.assignedSchoolId = payload.assignedSchoolId || device.assignedSchoolId || null;
      device.updatedAt = new Date().toISOString();
      if (payload.initialBatteryPercentage !== undefined) {
        device.batteryStatus.percentage = payload.initialBatteryPercentage;
      }
    } else {
      deviceId = `DEV-ITIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      device = {
        itisDeviceId: deviceId,
        trackerDeviceId: cleanTrackerId,
        hardwareSerialNumber: cleanTrackerId,
        imei: cleanImei,
        simIdentifier: payload.simIdentifier || payload.iccid,
        phoneNumber: payload.phoneNumber,
        protocolType: cleanProtocol,
        manufacturer: payload.manufacturer || 'Topin/Generic',
        deviceModel: cleanModel,
        deviceStatus: 'REGISTERED',
        activationStatus: 'PENDING_ACTIVATION',
        assignedLearnerId: null,
        assignedSchoolId: payload.assignedSchoolId || null,
        batteryStatus: {
          percentage: payload.initialBatteryPercentage ?? 100,
          healthStatus: 'NORMAL',
          chargingState: false
        },
        connectionStatus: 'STANDBY',
        healthClassification: 'UNPROVISIONED',
        firmwareVersion: payload.firmwareVersion || 'v1.0.0-REG',
        hardwareRevision: payload.hardwareRevision || 'REV-A',
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      this.devices.set(deviceId, device);
      this.trackerIdentifierIndex.set(cleanTrackerId, deviceId);
      if (cleanImei) {
        this.imeiIndex.set(cleanImei, deviceId);
      }
    }

    db.logAuditEvent({
      actionType: 'DEVICE_REGISTERED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        trackerDeviceId: device.trackerDeviceId,
        protocolType: device.protocolType,
        model: device.deviceModel,
        imeiProvided: !!device.imei,
        registeredBy: actorUser.name
      }
    });

    return device;
  }

  /**
   * Provision a physical GPS tracker into the authoritative ITIS Device Registry.
   * Only authorized roles (Technician, Admin, Founder) may perform provisioning.
   */
  public provisionDevice(
    payload: ProvisionDevicePayload,
    actorUser: ActiveUserSession
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_PROVISIONING');

    if (!payload.trackerDeviceId || payload.trackerDeviceId.trim().length < 3) {
      throw new Error('Valid physical tracker device identifier is required for provisioning.');
    }

    const cleanTrackerId = payload.trackerDeviceId.trim();
    const cleanImei = payload.imei?.trim();

    // Check for duplicate identifier collisions among active/provisioned devices
    for (const dev of this.devices.values()) {
      if (dev.deviceStatus === 'RETIRED') continue;

      if (dev.trackerDeviceId.toLowerCase() === cleanTrackerId.toLowerCase()) {
        // If it's already registered and NOT in UNREGISTERED state, reject as duplicate
        if (dev.deviceStatus !== 'UNREGISTERED') {
          throw new Error(`Duplicate device identifier detected: Tracker '${cleanTrackerId}' is already registered with ID '${dev.itisDeviceId}' (Status: ${dev.deviceStatus}).`);
        }
      }

      if (cleanImei && dev.imei && dev.imei.toLowerCase() === cleanImei.toLowerCase()) {
        if (dev.deviceStatus !== 'UNREGISTERED') {
          throw new Error(`Duplicate IMEI detected: IMEI '${cleanImei}' is already registered with ID '${dev.itisDeviceId}'.`);
        }
      }
    }

    // Check if transitioning from an existing UNREGISTERED record
    let deviceId = this.trackerIdentifierIndex.get(cleanTrackerId);
    let device: ItisDeviceRecord;

    if (deviceId && this.devices.has(deviceId)) {
      device = this.devices.get(deviceId)!;
      device.deviceModel = payload.deviceModel;
      device.protocolType = payload.protocolType;
      device.imei = cleanImei || device.imei;
      device.simIdentifier = payload.simIdentifier || device.simIdentifier;
      device.firmwareVersion = payload.firmwareVersion || 'v1.0.0-PROVISIONED';
      device.hardwareRevision = payload.hardwareRevision || 'REV-A';
      device.deviceStatus = 'ACTIVE';
      device.activationStatus = 'ACTIVATED';
      device.provisionedAt = new Date().toISOString();
      device.provisionedByUserId = actorUser.id;
      device.provisionedByUserName = actorUser.name;
      device.updatedAt = new Date().toISOString();
      if (payload.initialBatteryPercentage !== undefined) {
        device.batteryStatus.percentage = payload.initialBatteryPercentage;
      }
    } else {
      deviceId = `DEV-ITIS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      device = {
        itisDeviceId: deviceId,
        trackerDeviceId: cleanTrackerId,
        imei: cleanImei,
        simIdentifier: payload.simIdentifier,
        protocolType: payload.protocolType,
        deviceModel: payload.deviceModel,
        deviceStatus: 'ACTIVE',
        activationStatus: 'ACTIVATED',
        assignedLearnerId: null,
        batteryStatus: {
          percentage: payload.initialBatteryPercentage ?? 100,
          healthStatus: 'NORMAL'
        },
        connectionStatus: 'STANDBY',
        firmwareVersion: payload.firmwareVersion || 'v1.0.0-PROVISIONED',
        hardwareRevision: payload.hardwareRevision || 'REV-A',
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        provisionedAt: new Date().toISOString(),
        provisionedByUserId: actorUser.id,
        provisionedByUserName: actorUser.name
      };
      this.devices.set(deviceId, device);
      this.trackerIdentifierIndex.set(cleanTrackerId, deviceId);
      if (cleanImei) {
        this.imeiIndex.set(cleanImei, deviceId);
      }
    }

    // Immutable Audit Logs
    db.logAuditEvent({
      actionType: 'DEVICE_REGISTERED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        trackerDeviceId: device.trackerDeviceId,
        protocolType: device.protocolType,
        model: device.deviceModel,
        imeiProvided: !!device.imei
      }
    });

    db.logAuditEvent({
      actionType: 'DEVICE_PROVISIONED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        provisionedStatus: device.deviceStatus,
        activationStatus: device.activationStatus,
        provisionedBy: actorUser.name
      }
    });

    return device;
  }

  // ====================================================
  // 3. DEVICE TO LEARNER LINKING (1:1 ACTIVE RULE)
  // ====================================================

  /**
   * Assign an active physical tracker to an authoritative learner.
   * INVARIANT: One Device ↔ One Active Learner Assignment.
   * Assignment history is preserved forever.
   */
  public assignDeviceToLearner(
    payload: AssignDeviceToLearnerPayload,
    actorUser: ActiveUserSession
  ): {
    device: ItisDeviceRecord;
    assignment: DeviceAssignmentHistoryRecord;
    auditEvent: ImmutableAuditEvent;
  } {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_ASSIGNMENT');

    const device = this.devices.get(payload.deviceId) || this.findByTrackerIdentifier(payload.deviceId);
    if (!device) {
      throw new Error(`Device '${payload.deviceId}' not found in registry.`);
    }

    if (device.deviceStatus === 'SUSPENDED' || device.deviceStatus === 'RETIRED' || device.deviceStatus === 'UNREGISTERED' || device.deviceStatus === 'LOST' || device.deviceStatus === 'REPLACED' || device.deviceStatus === 'INVENTORY') {
      throw new Error(`Cannot assign device '${device.itisDeviceId}': Device status is '${device.deviceStatus}'. Suspended, retired, lost, replaced, inventory, or unregistered devices cannot be assigned to learners.`);
    }

    // Verify Learner exists in Authoritative Store
    const learner = db.learners.get(payload.learnerId);
    if (!learner) {
      throw new Error(`Learner '${payload.learnerId}' not found in authoritative learner registry.`);
    }

    const hydrated = db.getHydratedLearner(payload.learnerId);
    const learnerName = hydrated ? `${hydrated.person.firstName} ${hydrated.person.lastName}` : 'Enrolled Learner';
    const learnerEmis = learner.emisId;
    const schoolId = hydrated?.currentSchool?.id;
    const schoolName = hydrated?.currentSchool?.name;

    // 1. Check if device is currently assigned to someone else
    if (device.assignedLearnerId && device.assignedLearnerId !== payload.learnerId) {
      if (!payload.forceReassignIfOccupied) {
        throw new Error(`Device '${device.itisDeviceId}' is currently assigned to learner '${device.assignedLearnerName || device.assignedLearnerId}'. Duplicate active assignment prevented. Set forceReassignIfOccupied=true or unassign first.`);
      }
      // Unassign existing learner
      this.unassignDevice(device.itisDeviceId, actorUser, 'ADMIN_REASSIGNMENT', 'Reassigned to new learner.');
    }

    // 2. Check if learner currently has another active device assigned (Enforce 1:1 active constraint)
    for (const otherDev of this.devices.values()) {
      if (otherDev.itisDeviceId !== device.itisDeviceId && otherDev.assignedLearnerId === payload.learnerId) {
        if (!payload.forceReassignIfOccupied) {
          throw new Error(`Learner '${learnerName}' (${learnerEmis}) already has an active tracker assigned ('${otherDev.itisDeviceId}'). Duplicate active assignment prevented. Set forceReassignIfOccupied=true or use replacement flow.`);
        }
        // Unassign learner's previous device with immutable history preservation
        this.unassignDevice(otherDev.itisDeviceId, actorUser, 'DEVICE_REPLACEMENT', `Replaced by device ${device.itisDeviceId}.`);
      }
    }

    const assignedTimestamp = new Date().toISOString();

    // 3. Create immutable assignment history record
    const historyId = `hist-asgn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const assignmentRecord: DeviceAssignmentHistoryRecord = {
      id: historyId,
      deviceId: device.itisDeviceId,
      trackerDeviceId: device.trackerDeviceId,
      learnerId: learner.id,
      learnerEmisId: learnerEmis,
      learnerName,
      schoolId,
      schoolName,
      assignedAt: assignedTimestamp,
      assignedByUserId: actorUser.id,
      assignedByUserName: actorUser.name,
      assignedByUserRole: actorUser.role,
      notes: payload.notes,
      status: 'ACTIVE'
    };

    this.assignmentHistory.push(assignmentRecord);

    // 4. Update Device Record
    device.deviceStatus = 'ASSIGNED';
    device.activationStatus = 'ACTIVATED';
    device.assignedLearnerId = learner.id;
    device.assignedLearnerName = learnerName;
    device.assignedLearnerEmis = learnerEmis;
    device.assignedSchoolId = schoolId || null;
    device.assignedSchoolName = schoolName;
    device.updatedAt = assignedTimestamp;
    this.calculateDeviceHealthState(device);

    // 5. Update Learner trackingBeaconId
    learner.trackingBeaconId = device.trackerDeviceId;
    learner.updatedAt = assignedTimestamp;
    db.hydratedLearnerCache.delete(learner.id);

    // 6. Log Audit Events
    const audit = db.logAuditEvent({
      actionType: 'DEVICE_ASSIGNED_TO_LEARNER',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        learnerId: learner.id,
        learnerEmis,
        learnerName,
        schoolId,
        schoolName,
        trackerDeviceId: device.trackerDeviceId,
        assignmentHistoryId: historyId
      }
    });

    db.logAuditEvent({
      actionType: 'DEVICE_ASSIGNED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        learnerId: learner.id,
        learnerEmis,
        learnerName,
        trackerDeviceId: device.trackerDeviceId,
        assignmentHistoryId: historyId
      }
    });

    return {
      device,
      assignment: assignmentRecord,
      auditEvent: audit
    };
  }

  /**
   * Unassign a physical tracker from a learner, documenting timestamps and reason.
   */
  public unassignDevice(
    deviceIdOrTrackerId: string,
    actorUser: ActiveUserSession,
    reason: UnassignReason = 'ADMIN_REASSIGNMENT',
    notes?: string
  ): {
    device: ItisDeviceRecord;
    closedAssignment: DeviceAssignmentHistoryRecord | null;
    auditEvent: ImmutableAuditEvent;
  } {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_UNASSIGNMENT');

    const device = this.devices.get(deviceIdOrTrackerId) || this.findByTrackerIdentifier(deviceIdOrTrackerId);
    if (!device) {
      throw new Error(`Device '${deviceIdOrTrackerId}' not found.`);
    }

    const previousLearnerId = device.assignedLearnerId;
    const previousLearnerName = device.assignedLearnerName;
    const previousLearnerEmis = device.assignedLearnerEmis;

    const unassignedTimestamp = new Date().toISOString();

    // Close open assignment in history
    let closedHistory: DeviceAssignmentHistoryRecord | null = null;
    for (let i = this.assignmentHistory.length - 1; i >= 0; i--) {
      const h = this.assignmentHistory[i];
      if (h.deviceId === device.itisDeviceId && h.status === 'ACTIVE' && (!h.unassignedAt)) {
        h.unassignedAt = unassignedTimestamp;
        h.unassignedByUserId = actorUser.id;
        h.unassignedByUserName = actorUser.name;
        h.unassignReason = reason;
        h.status = 'TERMINATED';
        if (notes) h.notes = h.notes ? `${h.notes} | ${notes}` : notes;
        closedHistory = h;
        break;
      }
    }

    // Clear Device Link
    device.assignedLearnerId = null;
    device.assignedLearnerName = undefined;
    device.assignedLearnerEmis = undefined;
    device.assignedSchoolId = null;
    device.assignedSchoolName = undefined;
    device.deviceStatus = 'ACTIVE';
    device.activationStatus = 'ACTIVATED';
    device.updatedAt = unassignedTimestamp;

    // Clear Learner Beacon Link
    if (previousLearnerId && db.learners.has(previousLearnerId)) {
      const lrn = db.learners.get(previousLearnerId)!;
      if (lrn.trackingBeaconId === device.trackerDeviceId || lrn.trackingBeaconId === device.itisDeviceId) {
        lrn.trackingBeaconId = undefined;
        lrn.updatedAt = unassignedTimestamp;
        db.hydratedLearnerCache.delete(lrn.id);
      }
    }

    // Audit Event
    const audit = db.logAuditEvent({
      actionType: 'DEVICE_UNASSIGNED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        unassignedFromLearnerId: previousLearnerId,
        learnerName: previousLearnerName,
        learnerEmis: previousLearnerEmis,
        reason,
        notes
      }
    });

    return {
      device,
      closedAssignment: closedHistory,
      auditEvent: audit
    };
  }

  /**
   * Reassign a physical device from an old tracker to a new tracker, maintaining complete history.
   */
  public reassignDevice(
    payload: ReassignDevicePayload,
    actorUser: ActiveUserSession
  ): {
    oldDevice?: ItisDeviceRecord;
    newDevice: ItisDeviceRecord;
    newAssignment: DeviceAssignmentHistoryRecord;
  } {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_REASSIGNMENT');

    let oldDevice: ItisDeviceRecord | undefined;
    if (payload.oldDeviceId) {
      const oldRes = this.unassignDevice(payload.oldDeviceId, actorUser, payload.unassignReason as UnassignReason, payload.notes);
      oldDevice = oldRes.device;
    }

    const assignRes = this.assignDeviceToLearner({
      deviceId: payload.newDeviceId,
      learnerId: payload.learnerId,
      notes: payload.notes,
      forceReassignIfOccupied: true
    }, actorUser);

    return {
      oldDevice,
      newDevice: assignRes.device,
      newAssignment: assignRes.assignment
    };
  }

  // ====================================================
  // 4. DEVICE LIFECYCLE MANAGEMENT (SUSPEND / RETIRE / REPLACE / HEALTH)
  // ====================================================

  /**
   * Validate if a physical device is ready for operational activation.
   * Operational readiness rules:
   * - Device must exist in registry
   * - Cannot activate RETIRED devices
   * - Device cannot be in UNREGISTERED state without registration
   * - Protocol must be supported
   * - Valid learner assignment if requested
   */
  public validateDeviceActivationReadiness(
    deviceId: string,
    options?: { requireLearnerAssignment?: boolean }
  ): { ready: boolean; issues: string[]; device: ItisDeviceRecord } {
    const device = this.devices.get(deviceId) || this.findByTrackerIdentifier(deviceId);
    if (!device) {
      throw new Error(`Device '${deviceId}' not found in registry.`);
    }

    const issues: string[] = [];

    if (device.deviceStatus === 'RETIRED') {
      issues.push('Device is permanently RETIRED/decommissioned and cannot be reactivated.');
    }

    if (device.deviceStatus === 'UNREGISTERED') {
      issues.push('Device is UNREGISTERED. Hardware provisioning and registration required before activation.');
    }

    const supportedProtocols: ItisDeviceProtocolType[] = ['GT012', 'CONCOX', 'TOPIN', 'SIMULATED_JSON', 'SIMULATED', 'LORAWAN', 'BLE_BEACON'];
    if (!supportedProtocols.includes(device.protocolType)) {
      issues.push(`Unsupported protocol '${device.protocolType}'.`);
    }

    if (options?.requireLearnerAssignment && !device.assignedLearnerId) {
      issues.push('Device requires an authoritative learner assignment before operational activation.');
    }

    return {
      ready: issues.length === 0,
      issues,
      device
    };
  }

  /**
   * Suspend an active device (e.g. administrative lock or security hold).
   */
  public suspendDevice(
    deviceId: string,
    actorUser: ActiveUserSession,
    reason?: string
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_SUSPEND');
    const device = this.devices.get(deviceId) || this.findByTrackerIdentifier(deviceId);
    if (!device) throw new Error(`Device '${deviceId}' not found.`);

    device.deviceStatus = 'SUSPENDED';
    device.activationStatus = 'DEACTIVATED';
    device.calculatedHealthState = 'SUSPENDED';
    device.updatedAt = new Date().toISOString();

    db.logAuditEvent({
      actionType: 'DEVICE_SUSPENDED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: { reason: reason || 'Administrative suspension' }
    });

    return device;
  }

  /**
   * Activate or reactivate a physical tracker device.
   * Enforces readiness validation and prevents activation of decommissioned devices.
   */
  public activateDevice(
    deviceId: string,
    actorUser: ActiveUserSession,
    reason?: string,
    options?: { requireLearnerAssignment?: boolean }
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_ACTIVATE');
    const { ready, issues, device } = this.validateDeviceActivationReadiness(deviceId, options);

    if (!ready) {
      throw new Error(`Device '${device.itisDeviceId}' failed activation readiness: ${issues.join('; ')}`);
    }

    const previousStatus = device.deviceStatus;
    device.deviceStatus = device.assignedLearnerId ? 'ASSIGNED' : 'ACTIVE';
    device.activationStatus = 'ACTIVATED';
    device.activatedAt = new Date().toISOString();
    device.updatedAt = new Date().toISOString();

    const isReactivation = previousStatus === 'SUSPENDED' || previousStatus === 'REPLACED';
    this.calculateDeviceHealthState(device);

    db.logAuditEvent({
      actionType: isReactivation ? 'DEVICE_REACTIVATED' : 'DEVICE_ACTIVATED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: {
        reason: reason || (isReactivation ? 'Reactivated by authorized technician/admin' : 'Operational activation'),
        previousStatus,
        newStatus: device.deviceStatus
      }
    });

    return device;
  }

  /**
   * Replace a physical GPS tracker for a learner (e.g. damaged, lost, upgraded).
   * - Old device: unassigned, marked REPLACED, replacedByDeviceId set.
   * - Active assignment history closed with unassignReason='DEVICE_REPLACEMENT'.
   * - New device: assigned to learner, replacementForDeviceId set, marked ASSIGNED/ACTIVATED.
   * - New assignment history record created.
   * - Learner's trackingBeaconId updated to new tracker.
   * - Audit events emitted: DEVICE_REPLACED, DEVICE_ASSIGNED.
   */
  public replaceDevice(
    payload: ReplaceDevicePayload,
    actorUser: ActiveUserSession
  ): {
    oldDevice: ItisDeviceRecord;
    newDevice: ItisDeviceRecord;
    closedAssignment: DeviceAssignmentHistoryRecord | null;
    newAssignment: DeviceAssignmentHistoryRecord;
  } {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_REPLACEMENT');

    const oldDevice = this.devices.get(payload.oldDeviceId) || this.findByTrackerIdentifier(payload.oldDeviceId);
    if (!oldDevice) {
      throw new Error(`Old device '${payload.oldDeviceId}' not found in registry.`);
    }

    const newDevice = this.devices.get(payload.newDeviceId) || this.findByTrackerIdentifier(payload.newDeviceId);
    if (!newDevice) {
      throw new Error(`New replacement device '${payload.newDeviceId}' not found in registry.`);
    }

    if (oldDevice.itisDeviceId === newDevice.itisDeviceId) {
      throw new Error('Old device and new replacement device cannot be the same device.');
    }

    // Verify learner
    const learner = db.learners.get(payload.learnerId);
    if (!learner) {
      throw new Error(`Learner '${payload.learnerId}' not found in learner registry.`);
    }

    // Validate oldDevice is assigned to the learner
    if (oldDevice.assignedLearnerId && oldDevice.assignedLearnerId !== payload.learnerId) {
      throw new Error(`Old device '${oldDevice.itisDeviceId}' is assigned to learner '${oldDevice.assignedLearnerId}', not '${payload.learnerId}'.`);
    }

    // Validate newDevice cannot be RETIRED, SUSPENDED, LOST, REPLACED, or UNREGISTERED
    if (newDevice.deviceStatus === 'RETIRED' || newDevice.deviceStatus === 'SUSPENDED' || newDevice.deviceStatus === 'LOST' || newDevice.deviceStatus === 'REPLACED' || newDevice.deviceStatus === 'UNREGISTERED') {
      throw new Error(`Cannot use device '${newDevice.itisDeviceId}' as replacement: device status is '${newDevice.deviceStatus}'. Suspended, retired, lost, or unregistered devices cannot be assigned.`);
    }

    // If newDevice is assigned to another learner, unassign it first
    if (newDevice.assignedLearnerId && newDevice.assignedLearnerId !== payload.learnerId) {
      this.unassignDevice(newDevice.itisDeviceId, actorUser, 'ADMIN_REASSIGNMENT', 'Reassigned as replacement device.');
    }

    const timestamp = new Date().toISOString();
    const reasonText = payload.reason || payload.notes || 'Hardware swap / replacement';

    // 1. Close old device assignment in history
    let closedAssignment: DeviceAssignmentHistoryRecord | null = null;
    for (const h of this.assignmentHistory) {
      if (h.deviceId === oldDevice.itisDeviceId && h.learnerId === payload.learnerId && h.status === 'ACTIVE') {
        h.status = 'TRANSFERRED';
        h.unassignedAt = timestamp;
        h.unassignReason = 'DEVICE_REPLACEMENT';
        h.notes = payload.notes ? `${payload.notes} | Replaced by ${newDevice.itisDeviceId}` : `Replaced by ${newDevice.itisDeviceId} (${newDevice.trackerDeviceId}). Reason: ${reasonText}`;
        closedAssignment = h;
      }
    }

    // 2. Transition old device state
    oldDevice.assignedLearnerId = null;
    oldDevice.assignedLearnerName = undefined;
    oldDevice.assignedLearnerEmis = undefined;
    oldDevice.deviceStatus = 'REPLACED';
    oldDevice.activationStatus = 'DEACTIVATED';
    oldDevice.replacedByDeviceId = newDevice.itisDeviceId;
    oldDevice.updatedAt = timestamp;
    this.calculateDeviceHealthState(oldDevice);

    // 3. Setup new device state
    const hydrated = db.getHydratedLearner(payload.learnerId);
    const learnerName = hydrated ? `${hydrated.person.firstName} ${hydrated.person.lastName}` : 'Enrolled Learner';
    const learnerEmis = learner.emisId;
    const schoolId = hydrated?.currentSchool?.id || oldDevice.assignedSchoolId || null;
    const schoolName = hydrated?.currentSchool?.name;

    newDevice.assignedLearnerId = payload.learnerId;
    newDevice.assignedLearnerName = learnerName;
    newDevice.assignedLearnerEmis = learnerEmis;
    newDevice.assignedSchoolId = schoolId;
    newDevice.assignedSchoolName = schoolName;
    newDevice.deviceStatus = 'ASSIGNED';
    newDevice.activationStatus = 'ACTIVATED';
    newDevice.replacementForDeviceId = oldDevice.itisDeviceId;
    newDevice.activatedAt = timestamp;
    newDevice.updatedAt = timestamp;
    this.calculateDeviceHealthState(newDevice);

    // 4. Create new assignment history record
    const historyId = `hist-repl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newAssignment: DeviceAssignmentHistoryRecord = {
      id: historyId,
      deviceId: newDevice.itisDeviceId,
      trackerDeviceId: newDevice.trackerDeviceId,
      learnerId: learner.id,
      learnerEmisId: learnerEmis,
      learnerName,
      schoolId: schoolId || undefined,
      schoolName: schoolName || undefined,
      assignedAt: timestamp,
      assignedByUserId: actorUser.id,
      assignedByUserName: actorUser.name,
      assignedByUserRole: actorUser.role,
      status: 'ACTIVE',
      notes: `Replacement for ${oldDevice.itisDeviceId} (${oldDevice.trackerDeviceId}). Reason: ${reasonText}`
    };
    this.assignmentHistory.push(newAssignment);

    // 5. Update learner's trackingBeaconId
    learner.trackingBeaconId = newDevice.trackerDeviceId;
    learner.updatedAt = timestamp;
    db.hydratedLearnerCache.delete(learner.id);

    // 6. Audit logs
    db.logAuditEvent({
      actionType: 'DEVICE_REPLACED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: oldDevice.itisDeviceId,
      details: {
        oldDeviceId: oldDevice.itisDeviceId,
        newDeviceId: newDevice.itisDeviceId,
        newTrackerDeviceId: newDevice.trackerDeviceId,
        learnerId: payload.learnerId,
        learnerName,
        reason: reasonText
      }
    });

    db.logAuditEvent({
      actionType: 'DEVICE_ASSIGNED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: newDevice.itisDeviceId,
      details: {
        action: 'ASSIGNED_VIA_REPLACEMENT',
        replacementForDeviceId: oldDevice.itisDeviceId,
        learnerId: payload.learnerId,
        learnerName,
        reason: reasonText
      }
    });

    return {
      oldDevice,
      newDevice,
      closedAssignment,
      newAssignment
    };
  }

  /**
   * Mark a device as LOST.
   * If assigned to a learner, unassigns and logs audit.
   */
  public markDeviceLost(
    deviceId: string,
    actorUser: ActiveUserSession,
    reason?: string
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_LOST');
    const device = this.devices.get(deviceId) || this.findByTrackerIdentifier(deviceId);
    if (!device) throw new Error(`Device '${deviceId}' not found.`);

    if (device.assignedLearnerId) {
      this.unassignDevice(device.itisDeviceId, actorUser, 'LOST_DEVICE', reason || 'Device reported lost.');
    }

    device.deviceStatus = 'LOST';
    device.activationStatus = 'DEACTIVATED';
    device.connectionStatus = 'OFFLINE';
    device.calculatedHealthState = 'OFFLINE';
    device.updatedAt = new Date().toISOString();

    db.logAuditEvent({
      actionType: 'DEVICE_LOST',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: { reason: reason || 'Hardware marked as lost.' }
    });

    return device;
  }

  /**
   * Retire a device permanently (end-of-life decommission).
   */
  public retireDevice(
    deviceId: string,
    actorUser: ActiveUserSession,
    reason?: string
  ): ItisDeviceRecord {
    this.assertTechnicianOrAdminClearance(actorUser, 'DEVICE_RETIRE');
    const device = this.devices.get(deviceId) || this.findByTrackerIdentifier(deviceId);
    if (!device) throw new Error(`Device '${deviceId}' not found.`);

    if (device.assignedLearnerId) {
      this.unassignDevice(device.itisDeviceId, actorUser, 'DEVICE_RETIRED', reason || 'Decommissioning hardware.');
    }

    device.deviceStatus = 'RETIRED';
    device.activationStatus = 'DEACTIVATED';
    device.connectionStatus = 'OFFLINE';
    device.calculatedHealthState = 'RETIRED';
    device.updatedAt = new Date().toISOString();

    db.logAuditEvent({
      actionType: 'DEVICE_RETIRED',
      actorUserId: actorUser.id,
      actorName: actorUser.name,
      actorRole: actorUser.role,
      targetEntity: 'DEVICE',
      targetId: device.itisDeviceId,
      details: { reason: reason || 'Hardware retirement / End of life' }
    });

    return device;
  }

  /**
   * Authoritative Device Health State Calculation.
   * Computes one of: ONLINE, DEGRADED, OFFLINE, STALE, SUSPENDED, RETIRED
   * Based on:
   * - lastTelemetryTimestamp / lastHeartbeatTimestamp
   * - battery level
   * - GPS accuracy
   * - network status
   * - administrative status (SUSPENDED, RETIRED)
   */
  public calculateDeviceHealthState(
    device: ItisDeviceRecord,
    config?: Partial<DeviceHealthThresholdConfig>
  ): ItisDeviceCalculatedHealthState {
    const cfg: DeviceHealthThresholdConfig = {
      ...DEFAULT_DEVICE_HEALTH_CONFIG,
      ...config
    };

    if (device.deviceStatus === 'RETIRED') {
      device.calculatedHealthState = 'RETIRED';
      return 'RETIRED';
    }

    if (device.deviceStatus === 'SUSPENDED') {
      device.calculatedHealthState = 'SUSPENDED';
      return 'SUSPENDED';
    }

    const lastContactTime = device.lastTelemetryTimestamp || device.lastHeartbeatTimestamp || device.lastCommunicationTimestamp;
    if (!lastContactTime) {
      device.calculatedHealthState = 'OFFLINE';
      return 'OFFLINE';
    }

    const elapsedSeconds = Math.floor((Date.now() - new Date(lastContactTime).getTime()) / 1000);

    if (elapsedSeconds > cfg.staleThresholdSeconds) {
      device.calculatedHealthState = 'OFFLINE';
      return 'OFFLINE';
    }

    if (elapsedSeconds > cfg.onlineThresholdSeconds) {
      device.calculatedHealthState = 'STALE';
      return 'STALE';
    }

    // Within online threshold (fresh contact)
    const battery = device.batteryStatus?.percentage ?? 100;
    const accuracy = device.lastKnownLocation?.accuracyMeters ?? 5.0;
    const isDegradedNetwork = device.networkStatus === 'ROAMING' || device.networkStatus === 'SEARCHING';

    if (battery <= cfg.degradedBatteryThreshold || accuracy > cfg.degradedAccuracyMetersThreshold || isDegradedNetwork) {
      device.calculatedHealthState = 'DEGRADED';
      return 'DEGRADED';
    }

    device.calculatedHealthState = 'ONLINE';
    return 'ONLINE';
  }

  /**
   * Retrieve authoritative device health summary with metric diagnostics.
   */
  public getDeviceHealthSummary(
    deviceId: string,
    config?: Partial<DeviceHealthThresholdConfig>
  ): DeviceHealthSummary {
    const device = this.devices.get(deviceId) || this.findByTrackerIdentifier(deviceId);
    if (!device) throw new Error(`Device '${deviceId}' not found.`);

    const state = this.calculateDeviceHealthState(device, config);
    const lastContactTime = device.lastTelemetryTimestamp || device.lastHeartbeatTimestamp || device.lastCommunicationTimestamp;
    const elapsedSeconds = lastContactTime ? Math.floor((Date.now() - new Date(lastContactTime).getTime()) / 1000) : 999999;

    const reasons: string[] = [];
    if (device.deviceStatus === 'RETIRED') reasons.push('Device decommissioned (RETIRED)');
    if (device.deviceStatus === 'SUSPENDED') reasons.push('Device administratively SUSPENDED');
    if (elapsedSeconds > 300) reasons.push(`No telemetry communication for ${elapsedSeconds} seconds`);
    if ((device.batteryStatus?.percentage ?? 100) <= 20) reasons.push(`Battery low (${device.batteryStatus?.percentage ?? 0}%)`);
    if ((device.lastKnownLocation?.accuracyMeters ?? 0) > 30) reasons.push(`GPS accuracy degraded (${device.lastKnownLocation?.accuracyMeters}m)`);
    if (device.networkStatus === 'ROAMING' || device.networkStatus === 'SEARCHING') reasons.push(`Network status: ${device.networkStatus}`);
    if (reasons.length === 0) reasons.push('All telemetry indicators within nominal operating thresholds');

    return {
      deviceId: device.itisDeviceId,
      trackerDeviceId: device.trackerDeviceId,
      deviceStatus: device.deviceStatus,
      healthState: state,
      calculatedHealthState: state,
      connectionStatus: device.connectionStatus,
      lastConnectionStatus: device.connectionStatus,
      lastTelemetryTimestamp: device.lastTelemetryTimestamp,
      lastHeartbeatTimestamp: device.lastHeartbeatTimestamp,
      batteryPercentage: device.batteryStatus?.percentage ?? 0,
      batteryLevel: device.batteryStatus?.percentage ?? 0,
      batteryHealth: device.batteryStatus?.healthStatus ?? 'NORMAL',
      batteryVoltage: device.batteryStatus?.voltage,
      gpsCoordinates: device.lastKnownLocation ? {
        latitude: device.lastKnownLocation.latitude,
        longitude: device.lastKnownLocation.longitude,
        accuracyMeters: device.lastKnownLocation.accuracyMeters,
        timestamp: device.lastKnownLocation.timestamp
      } : undefined,
      lastGpsCoordinates: device.lastKnownLocation ? {
        latitude: device.lastKnownLocation.latitude,
        longitude: device.lastKnownLocation.longitude,
        accuracyMeters: device.lastKnownLocation.accuracyMeters,
        timestamp: device.lastKnownLocation.timestamp
      } : undefined,
      lastPacketSequence: device.lastPacketSequence,
      networkStatus: device.networkStatus || 'ONLINE',
      reasons,
      evaluatedAt: new Date().toISOString()
    };
  }

  // ====================================================
  // 5. GUARDIAN AUTHORIZATION & PRIVACY-PRESERVING ACCESS
  // ====================================================

  /**
   * Authoritatively retrieve device status for a verified Guardian.
   * INVARIANT: Guardian may ONLY access their verified linked learner's device.
   * Access to any unrelated learner's device is STRICTLY DENIED with 403.
   */
  public getDeviceForGuardian(
    guardianUserIdOrId: string,
    learnerId: string
  ): GuardianAuthorizedDeviceView {
    if (!guardianUserIdOrId || !learnerId) {
      throw new Error('Guardian identity and Target Learner ID are required.');
    }

    // 1. Locate Guardian
    let guardian = db.guardians.get(guardianUserIdOrId);
    if (!guardian) {
      for (const g of db.guardians.values()) {
        if (g.userId === guardianUserIdOrId || g.saIdNumber === guardianUserIdOrId) {
          guardian = g;
          break;
        }
      }
    }

    if (!guardian) {
      throw new Error(`Unauthorized: Guardian account not found for '${guardianUserIdOrId}'.`);
    }

    // 2. Validate Active, Verified Relationship to requested Learner
    let isAuthorized = false;
    for (const rel of db.relationships.values()) {
      if (
        rel.guardianId === guardian.id &&
        rel.learnerId === learnerId &&
        rel.verificationStatus === 'VERIFIED'
      ) {
        isAuthorized = true;
        break;
      }
    }

    if (!isAuthorized) {
      // Log unauthorized attempt in audit trail
      db.logAuditEvent({
        actionType: 'UNAUTHORIZED_ACCESS_DENIED',
        actorUserId: guardian.userId || guardian.id,
        actorName: 'Guardian Portal User',
        actorRole: 'PARENT_GUARDIAN',
        targetEntity: 'DEVICE',
        targetId: learnerId,
        details: {
          attemptedLearnerId: learnerId,
          guardianId: guardian.id,
          reason: 'ACCESS_DENIED_UNRELATED_LEARNER_DEVICE'
        }
      });

      const err: any = new Error(`ACCESS DENIED (HTTP 403): Guardian '${guardian.id}' is not authoritatively linked with custodial rights to Learner '${learnerId}'.`);
      err.statusCode = 403;
      err.code = 'ACCESS_DENIED_UNRELATED_LEARNER';
      throw err;
    }

    // 3. Find Learner & Assigned Device
    const learner = db.learners.get(learnerId);
    if (!learner) {
      throw new Error(`Learner '${learnerId}' not found.`);
    }

    const hydrated = db.getHydratedLearner(learnerId);
    const learnerFullName = hydrated ? `${hydrated.person.firstName} ${hydrated.person.lastName}` : 'Linked Child';

    // Locate device assigned to this learner
    let assignedDevice: ItisDeviceRecord | undefined;
    for (const dev of this.devices.values()) {
      if (dev.assignedLearnerId === learnerId && (dev.deviceStatus === 'ASSIGNED' || dev.deviceStatus === 'ACTIVE')) {
        assignedDevice = dev;
        break;
      }
    }

    // If no active device assigned
    if (!assignedDevice) {
      return {
        deviceId: 'UNASSIGNED',
        trackerDeviceId: 'NONE',
        learnerId: learner.id,
        learnerName: learnerFullName,
        learnerEmis: learner.emisId,
        deviceStatus: 'UNREGISTERED',
        connectionStatus: 'OFFLINE',
        batteryPercentage: 0,
        batteryHealth: 'NORMAL',
        activeAlertCount: 0,
        isEmergencyAlertActive: false
      };
    }

    // 4. Return sanitized, privacy-preserving view (No internal tech secrets, No other learners)
    const activeAlerts = Array.from(db.incidents.values()).filter(
      inc => inc.learnerId === learnerId && inc.status !== 'RESOLVED'
    );

    return {
      deviceId: assignedDevice.itisDeviceId,
      trackerDeviceId: assignedDevice.trackerDeviceId,
      learnerId: learner.id,
      learnerName: learnerFullName,
      learnerEmis: learner.emisId,
      deviceStatus: assignedDevice.deviceStatus,
      connectionStatus: assignedDevice.connectionStatus,
      batteryPercentage: assignedDevice.batteryStatus.percentage,
      batteryHealth: assignedDevice.batteryStatus.healthStatus,
      approvedLocation: assignedDevice.lastKnownLocation ? {
        latitude: assignedDevice.lastKnownLocation.latitude,
        longitude: assignedDevice.lastKnownLocation.longitude,
        addressDescription: assignedDevice.lastKnownLocation.addressDescription || 'Verified Safe Zone Perimeter',
        lastReportedAt: assignedDevice.lastKnownLocation.timestamp || assignedDevice.lastTelemetryTimestamp,
        isVerified: true
      } : undefined,
      lastTelemetryAt: assignedDevice.lastTelemetryTimestamp,
      activeAlertCount: activeAlerts.length,
      isEmergencyAlertActive: activeAlerts.some(a => a.severity === 'CRITICAL_SOS' || a.status === 'ACTIVE_ALARM')
    };
  }

  // ====================================================
  // 6. QUERY & AUDIT INSPECTION
  // ====================================================

  public getDeviceById(idOrTrackerId: string): ItisDeviceRecord | null {
    return this.devices.get(idOrTrackerId) || this.findByTrackerIdentifier(idOrTrackerId) || null;
  }

  public getDeviceForLearner(learnerId: string): ItisDeviceRecord | null {
    for (const dev of this.devices.values()) {
      if (dev.assignedLearnerId === learnerId && dev.deviceStatus !== 'RETIRED') {
        return dev;
      }
    }
    const learner = db.learners.get(learnerId);
    if ((learner as any)?.currentDeviceId) {
      return this.getDeviceById((learner as any).currentDeviceId);
    }
    return null;
  }

  public findByTrackerIdentifier(trackerId: string): ItisDeviceRecord | null {
    const id = this.trackerIdentifierIndex.get(trackerId) || this.imeiIndex.get(trackerId);
    if (id && this.devices.has(id)) {
      return this.devices.get(id)!;
    }
    for (const d of this.devices.values()) {
      if (d.trackerDeviceId === trackerId || d.imei === trackerId) {
        return d;
      }
    }
    return null;
  }

  public getAllDevices(): ItisDeviceRecord[] {
    return Array.from(this.devices.values());
  }

  public getDeviceAssignmentHistory(deviceId: string): DeviceAssignmentHistoryRecord[] {
    return this.assignmentHistory.filter(h => h.deviceId === deviceId);
  }

  public getLearnerAssignmentHistory(learnerId: string): DeviceAssignmentHistoryRecord[] {
    return this.assignmentHistory.filter(h => h.learnerId === learnerId);
  }

  public getAllAssignmentHistory(): DeviceAssignmentHistoryRecord[] {
    return [...this.assignmentHistory];
  }

  /**
   * Scoped Device Query enforcing role-based data views:
   * - System Admin / Founder: Full visibility
   * - Technician: Hardware telemetry visible, child PII masked
   * - School Principal / Staff: Scoped to their school learners
   * - Guardian: Sanitized view strictly for verified linked child
   */
  public getDevicesScoped(
    actorUser: ActiveUserSession,
    queryParams?: { schoolId?: string; search?: string; status?: string }
  ): Partial<ItisDeviceRecord>[] {
    const all = Array.from(this.devices.values());
    let filtered = all;

    if (actorUser.role === 'FOUNDER_EXECUTIVE' || actorUser.role === 'SYSTEM_ADMIN') {
      if (queryParams?.schoolId) {
        filtered = filtered.filter(d => d.assignedSchoolId === queryParams.schoolId);
      }
    } else if (actorUser.role === 'SCHOOL_PRINCIPAL' || actorUser.role === 'SCHOOL_ADMIN_STAFF') {
      filtered = filtered.filter(d => d.assignedSchoolId === actorUser.schoolId);
    } else if (actorUser.role === 'TECHNICIAN') {
      // Technicians see all technical hardware, but child PII is masked!
      if (queryParams?.schoolId) {
        filtered = filtered.filter(d => d.assignedSchoolId === queryParams.schoolId);
      }
    } else if (actorUser.role === 'PARENT_GUARDIAN') {
      // Guardian sees only device for their linked child
      const guardianId = actorUser.guardianId || actorUser.id;
      const guardianLearnerIds: string[] = [];
      for (const rel of db.relationships.values()) {
        if ((rel.guardianId === guardianId || rel.guardianId === actorUser.id) && rel.verificationStatus === 'VERIFIED') {
          guardianLearnerIds.push(rel.learnerId);
        }
      }
      filtered = filtered.filter(d => d.assignedLearnerId && guardianLearnerIds.includes(d.assignedLearnerId));
    } else {
      const err: any = new Error(`ACCESS DENIED: Role '${actorUser.role}' is not authorized to query devices.`);
      err.statusCode = 403;
      throw err;
    }

    if (queryParams?.status && queryParams.status !== 'ALL') {
      filtered = filtered.filter(d => d.deviceStatus === queryParams.status);
    }

    if (queryParams?.search) {
      const q = queryParams.search.toLowerCase();
      filtered = filtered.filter(d => 
        d.itisDeviceId.toLowerCase().includes(q) ||
        d.trackerDeviceId.toLowerCase().includes(q) ||
        (d.imei && d.imei.toLowerCase().includes(q)) ||
        d.deviceModel.toLowerCase().includes(q) ||
        (d.assignedLearnerEmis && d.assignedLearnerEmis.toLowerCase().includes(q))
      );
    }

    // Apply Child PII Masking for Technicians
    if (actorUser.role === 'TECHNICIAN') {
      return filtered.map(d => ({
        ...d,
        assignedLearnerName: d.assignedLearnerEmis ? `Learner (${d.assignedLearnerEmis})` : (d.assignedLearnerId ? 'Assigned Learner' : undefined)
      }));
    }

    // Apply Technical Data Masking for Guardians
    if (actorUser.role === 'PARENT_GUARDIAN') {
      return filtered.map(d => ({
        itisDeviceId: d.itisDeviceId,
        trackerDeviceId: d.trackerDeviceId,
        deviceStatus: d.deviceStatus,
        connectionStatus: d.connectionStatus,
        batteryStatus: d.batteryStatus,
        assignedLearnerId: d.assignedLearnerId,
        assignedLearnerName: d.assignedLearnerName,
        assignedLearnerEmis: d.assignedLearnerEmis,
        lastKnownLocation: d.lastKnownLocation,
        lastTelemetryTimestamp: d.lastTelemetryTimestamp
      }));
    }

    return filtered;
  }

  /**
   * Scoped Device Detail Query by ID / Tracker ID
   */
  public getDeviceByIdScoped(
    idOrTrackerId: string,
    actorUser: ActiveUserSession
  ): Partial<ItisDeviceRecord> {
    const device = this.getDeviceById(idOrTrackerId);
    if (!device) {
      const err: any = new Error(`Device '${idOrTrackerId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (actorUser.role === 'FOUNDER_EXECUTIVE' || actorUser.role === 'SYSTEM_ADMIN') {
      return device;
    }

    if (actorUser.role === 'TECHNICIAN') {
      return {
        ...device,
        assignedLearnerName: device.assignedLearnerEmis ? `Learner (${device.assignedLearnerEmis})` : (device.assignedLearnerId ? 'Assigned Learner' : undefined)
      };
    }

    if (actorUser.role === 'SCHOOL_PRINCIPAL' || actorUser.role === 'SCHOOL_ADMIN_STAFF') {
      if (device.assignedSchoolId && device.assignedSchoolId !== actorUser.schoolId) {
        const err: any = new Error(`ACCESS DENIED (HTTP 403): Device belongs to another school.`);
        err.statusCode = 403;
        throw err;
      }
      return device;
    }

    if (actorUser.role === 'PARENT_GUARDIAN') {
      const guardianId = actorUser.guardianId || actorUser.id;
      let isLinked = false;
      if (device.assignedLearnerId) {
        for (const rel of db.relationships.values()) {
          if ((rel.guardianId === guardianId || rel.guardianId === actorUser.id) && rel.learnerId === device.assignedLearnerId && rel.verificationStatus === 'VERIFIED') {
            isLinked = true;
            break;
          }
        }
      }
      if (!isLinked) {
        const err: any = new Error(`ACCESS DENIED (HTTP 403): Guardian is not authoritatively linked to this device.`);
        err.statusCode = 403;
        throw err;
      }
      return {
        itisDeviceId: device.itisDeviceId,
        trackerDeviceId: device.trackerDeviceId,
        deviceStatus: device.deviceStatus,
        connectionStatus: device.connectionStatus,
        batteryStatus: device.batteryStatus,
        assignedLearnerId: device.assignedLearnerId,
        assignedLearnerName: device.assignedLearnerName,
        assignedLearnerEmis: device.assignedLearnerEmis,
        lastKnownLocation: device.lastKnownLocation,
        lastTelemetryTimestamp: device.lastTelemetryTimestamp
      };
    }

    const err: any = new Error(`ACCESS DENIED: Insufficient clearance.`);
    err.statusCode = 403;
    throw err;
  }

  // Helper authorization validator
  private assertTechnicianOrAdminClearance(actorUser: ActiveUserSession, action: string): void {
    const authorizedRoles = ['TECHNICIAN', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN_STAFF'];
    if (!authorizedRoles.includes(actorUser.role)) {
      const err: any = new Error(`ACCESS DENIED (HTTP 403): Role '${actorUser.role}' lacks clearance to execute '${action}'. Authorized roles: ${authorizedRoles.join(', ')}.`);
      err.statusCode = 403;
      err.code = 'INSUFFICIENT_CLEARANCE';
      throw err;
    }
  }
}

export const deviceRegistryEngine = new DeviceRegistryEngine();
