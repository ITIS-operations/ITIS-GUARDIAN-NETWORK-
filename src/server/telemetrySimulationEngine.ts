/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY PLATFORM
 * GPS Telemetry Simulator & Packet Testing Engine
 * 
 * Implements authoritative GT012 Binary Concox Protocol and Simulated Test Protocol
 * parsing, validation, device lookup, telemetry normalization, duplicate packet suppression,
 * and comprehensive diagnostic audit trails.
 */

import crypto from 'crypto';
import { 
  ActiveUserSession, 
  TelemetrySimulationRequest, 
  TelemetrySimulationResult,
  TelemetrySimulationDiagnosticCode,
  TelemetryEnvelope
} from '../types.js';
import { db } from './dbStore.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { telemetryGatewayEngine } from './telemetryGatewayEngine.js';

// Precomputed 256-entry lookup table for CRC-ITU / CRC-16-CCITT (Polynomial 0x1021)
const CRC_ITU_TABLE: number[] = new Array(256);
(function initCrcTable() {
  const polynomial = 0x1021;
  for (let i = 0; i < 256; i++) {
    let curr = i << 8;
    for (let j = 0; j < 8; j++) {
      if ((curr & 0x8000) !== 0) {
        curr = ((curr << 1) ^ polynomial) & 0xffff;
      } else {
        curr = (curr << 1) & 0xffff;
      }
    }
    CRC_ITU_TABLE[i] = curr;
  }
})();

export class GT012CrcCalculator {
  public static calculate(buffer: Buffer | Uint8Array, start = 0, length?: number): number {
    const end = length !== undefined ? start + length : buffer.length;
    let crc = 0x0000;
    for (let i = start; i < end; i++) {
      const byte = buffer[i];
      const tabIndex = ((crc >> 8) ^ byte) & 0xff;
      crc = ((crc << 8) ^ CRC_ITU_TABLE[tabIndex]) & 0xffff;
    }
    return crc;
  }

  public static validate(packet: Buffer): boolean {
    if (packet.length < 10) return false;
    if (packet[0] !== 0x78 || packet[1] !== 0x78) return false;

    const stopByteOffset = packet.length - 2;
    if (packet[stopByteOffset] !== 0x0d || packet[stopByteOffset + 1] !== 0x0a) {
      return false;
    }

    const crcOffset = stopByteOffset - 2;
    const packetCrc = packet.readUInt16BE(crcOffset);
    const crcCalculationLength = crcOffset - 2; // bytes from index 2 to before crc
    const calculatedCrc = GT012CrcCalculator.calculate(packet, 2, crcCalculationLength);

    return calculatedCrc === packetCrc;
  }
}

export enum GT012ProtocolNumber {
  LOGIN_MESSAGE = 0x01,
  LOCATION_DATA = 0x12,
  STATUS_HEARTBEAT = 0x13,
  STRING_INFORMATION = 0x15,
  ALARM_DATA = 0x16,
  GPS_ADDRESS_QUERY = 0x1A,
  SERVER_COMMAND = 0x80
}

interface DuplicatePacketEntry {
  fingerprint: string;
  receivedAt: number;
}

export class TelemetrySimulationEngine {
  // Sliding TTL cache for duplicate packet detection (10-minute window)
  private packetFingerprintCache: Map<string, number> = new Map();
  private readonly DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

  constructor() {
    // Periodic cache sweep
    setInterval(() => {
      const now = Date.now();
      for (const [fingerprint, timestamp] of this.packetFingerprintCache.entries()) {
        if (now - timestamp > this.DUPLICATE_WINDOW_MS) {
          this.packetFingerprintCache.delete(fingerprint);
        }
      }
    }, 60000);
  }

  /**
   * Main simulation execution entry point.
   * Passes simulated raw packet through the authentic protocol processing pipeline via TelemetryGatewayEngine.
   */
  public async simulatePacket(
    request: TelemetrySimulationRequest,
    actor: ActiveUserSession
  ): Promise<TelemetrySimulationResult> {
    const envelope: TelemetryEnvelope = {
      transportType: 'SIMULATOR',
      rawPacket: request.rawPacket || '',
      receivedAt: new Date().toISOString(),
      deviceIdentifier: request.targetDeviceId,
      remoteAddress: '127.0.0.1:SIMULATOR',
      protocol: request.protocolFormat || 'AUTO',
      packetMetadata: {
        notes: request.notes,
        actorUserId: actor.id
      }
    };

    const ingestion = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, actor);

    const simStatus: 'SIMULATION_SUCCESS' | 'PACKET_REJECTED' | 'ACCESS_DENIED' =
      ingestion.status === 'INGESTED' ? 'SIMULATION_SUCCESS' :
      ingestion.status === 'ACCESS_DENIED' ? 'ACCESS_DENIED' : 'PACKET_REJECTED';

    return {
      status: simStatus,
      diagnosticCode: ingestion.diagnosticCode,
      protocolName: ingestion.protocol,
      packetType: ingestion.packetType,
      deviceIdentifier: ingestion.deviceId,
      itisDeviceId: ingestion.itisDeviceId,
      deviceRegistryStatus: ingestion.deviceRegistryStatus,
      isDuplicate: ingestion.duplicate,
      duplicateFingerprint: ingestion.duplicateFingerprint,
      validationResult: ingestion.validationResult,
      extractedLocation: ingestion.telemetry?.latitude !== undefined && ingestion.telemetry?.longitude !== undefined ? {
        latitude: ingestion.telemetry.latitude,
        longitude: ingestion.telemetry.longitude,
        speed: ingestion.telemetry.speed || 0,
        heading: ingestion.telemetry.heading || 0,
        accuracy: ingestion.telemetry.accuracy || 4.5,
        altitude: ingestion.telemetry.altitude,
        isRealTime: ingestion.telemetry.isRealTime !== false,
        satellites: ingestion.telemetry.satellites || 9
      } : undefined,
      extractedBattery: ingestion.telemetry?.batteryPercentage !== undefined ? {
        percentage: ingestion.telemetry.batteryPercentage,
        voltageLevel: ingestion.telemetry.voltageLevel ?? 4,
        charging: false
      } : undefined,
      extractedEvent: {
        eventType: ingestion.packetType,
        sosActive: Boolean(ingestion.telemetry?.sosActive),
        alarmType: ingestion.telemetry?.alarmType || null
      },
      processingTimestamp: ingestion.processedAt,
      requiresAck: ingestion.ackRequired,
      ackHex: ingestion.ackPayload,
      error: ingestion.error
    };
  }

  public clearDuplicateCache(): void {
    telemetryGatewayEngine.clearDuplicateCache();
  }

  // ============================================================================
  // GT012 BINARY PROTOCOL PROCESSING PIPELINE
  // ============================================================================
  private processGt012HexPacket(
    hexString: string,
    targetDeviceIdOverride?: string,
    actor?: ActiveUserSession
  ): TelemetrySimulationResult {
    const timestamp = new Date().toISOString();
    let buffer: Buffer;
    try {
      buffer = Buffer.from(hexString, 'hex');
    } catch {
      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: 'GT012',
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: false,
          validCrc: false,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: 'Invalid hex string representation.'
        },
        processingTimestamp: timestamp,
        error: 'MALFORMED_PACKET: Non-hexadecimal characters detected in buffer.'
      };
    }

    // Framing verification: GT012 requires 0x78 0x78 start and 0x0D 0x0A stop
    const hasValidStart = buffer.length >= 10 && buffer[0] === 0x78 && buffer[1] === 0x78;
    const hasValidStop = buffer.length >= 10 && buffer[buffer.length - 2] === 0x0d && buffer[buffer.length - 1] === 0x0a;
    if (!hasValidStart || !hasValidStop) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'MALFORMED_PACKET_RECEIVED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: targetDeviceIdOverride || 'UNKNOWN_GT012',
          details: { hexLength: buffer.length, hasValidStart, hasValidStop }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: 'GT012',
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: false,
          validCrc: false,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: 'GT012 framing mismatch: packet must start with 0x7878 and terminate with 0x0D0A.'
        },
        processingTimestamp: timestamp,
        error: 'MALFORMED_PACKET: Invalid 0x7878 / 0x0D0A framing.'
      };
    }

    // CRC-ITU verification
    const isValidCrc = GT012CrcCalculator.validate(buffer);
    if (!isValidCrc) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'TELEMETRY_PACKET_REJECTED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: targetDeviceIdOverride || 'GT012_DEVICE',
          details: { reason: 'CRC_CHECK_FAILED', rawHex: hexString.slice(0, 50) }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: 'GT012',
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: true,
          validCrc: false,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: 'CRC-ITU checksum verification failed.'
        },
        processingTimestamp: timestamp,
        error: 'MALFORMED_PACKET: CRC-ITU verification failed.'
      };
    }

    const protocolNumber = buffer[3];
    const stopByteOffset = buffer.length - 2;
    const crcOffset = stopByteOffset - 2;
    const serialOffset = crcOffset - 2;
    const serialNumber = buffer.readUInt16BE(serialOffset);

    // Build ACK if required
    const ackBuffer = this.buildGt012Ack(protocolNumber, serialNumber);
    const ackHex = ackBuffer.toString('hex').toUpperCase();

    // Protocol dispatch
    let packetType: 'LOGIN' | 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'STATUS' | 'UNKNOWN' = 'UNKNOWN';
    let deviceIdentifier = targetDeviceIdOverride;
    let extractedLat: number | undefined;
    let extractedLng: number | undefined;
    let extractedSpeed: number | undefined;
    let extractedHeading: number | undefined;
    let extractedBattery = 85;
    let voltageLevel: number | undefined;
    let isSos = false;
    let alarmType: string | null = null;
    let satellites = 9;

    if (protocolNumber === GT012ProtocolNumber.LOGIN_MESSAGE) {
      packetType = 'LOGIN';
      // 8-byte BCD IMEI at bytes 4..11
      const imeiBuf = buffer.subarray(4, 12);
      let imeiHex = '';
      for (let i = 0; i < imeiBuf.length; i++) {
        imeiHex += imeiBuf[i].toString(16).padStart(2, '0');
      }
      deviceIdentifier = imeiHex.startsWith('0') ? imeiHex.slice(1) : imeiHex;
    } else if (protocolNumber === GT012ProtocolNumber.STATUS_HEARTBEAT) {
      packetType = 'HEARTBEAT';
      voltageLevel = buffer[5];
      const voltageMap: Record<number, number> = { 0: 5, 1: 15, 2: 35, 3: 60, 4: 80, 5: 95, 6: 100 };
      extractedBattery = voltageMap[voltageLevel] !== undefined ? voltageMap[voltageLevel] : 75;
    } else if (protocolNumber === GT012ProtocolNumber.LOCATION_DATA || protocolNumber === GT012ProtocolNumber.ALARM_DATA) {
      packetType = protocolNumber === GT012ProtocolNumber.ALARM_DATA ? 'ALARM' : 'LOCATION';

      satellites = buffer[10] & 0x0f;
      const rawLat = buffer.readUInt32BE(11);
      let lat = rawLat / 1800000.0;
      const rawLng = buffer.readUInt32BE(15);
      let lng = rawLng / 1800000.0;

      extractedSpeed = buffer[19];
      const courseStatus = buffer.readUInt16BE(20);
      extractedHeading = courseStatus & 0x03ff;

      const isNorth = (courseStatus & 0x0400) !== 0;
      const isEast = (courseStatus & 0x0800) === 0;

      if (!isNorth) lat = -lat;
      if (!isEast) lng = -lng;

      extractedLat = Number(lat.toFixed(6));
      extractedLng = Number(lng.toFixed(6));

      if (protocolNumber === GT012ProtocolNumber.ALARM_DATA) {
        const alarmCode = buffer.length > 33 ? buffer[33] : 0x01;
        if (alarmCode === 0x01) {
          isSos = true;
          alarmType = 'SOS_PANIC';
        } else if (alarmCode === 0x04) {
          alarmType = 'GEOFENCE_EXIT';
        } else {
          alarmType = `ALARM_CODE_0x${alarmCode.toString(16)}`;
        }
      }
    }

    // Default identifier fallback if not in payload
    if (!deviceIdentifier) {
      deviceIdentifier = targetDeviceIdOverride || 'GT012-TRK-8812';
    }

    // ==========================================================================
    // DUPLICATE PACKET DETECTION
    // ==========================================================================
    const packetCrc = buffer.readUInt16BE(crcOffset);
    const fingerprint = crypto
      .createHash('sha256')
      .update(`${deviceIdentifier}:${protocolNumber}:${serialNumber}:${packetCrc}:${extractedLat || 0}:${extractedLng || 0}`)
      .digest('hex');

    if (this.packetFingerprintCache.has(fingerprint)) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'TELEMETRY_PACKET_REJECTED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: deviceIdentifier,
          details: {
            reason: 'DUPLICATE_PACKET_SUPPRESSED',
            fingerprint: fingerprint.slice(0, 16),
            serialNumber
          }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DUPLICATE_PACKET',
        protocolName: 'GT012',
        packetType,
        deviceIdentifier,
        isDuplicate: true,
        duplicateFingerprint: fingerprint,
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: 'Duplicate telemetry packet detected within 10-minute sliding window. Packet suppressed.'
        },
        processingTimestamp: timestamp,
        error: 'DUPLICATE_PACKET: Repeated telemetry sequence suppressed to prevent database bloat.'
      };
    }

    // Record fingerprint in cache
    this.packetFingerprintCache.set(fingerprint, Date.now());

    // ==========================================================================
    // DEVICE REGISTRY LOOKUP
    // ==========================================================================
    const registryDevice = deviceRegistryEngine.getDeviceById(deviceIdentifier);

    if (!registryDevice) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'UNKNOWN_DEVICE_TELEMETRY_ATTEMPT',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: deviceIdentifier,
          details: { reason: 'Device not found in Authoritative ITIS Registry', protocol: 'GT012' }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DEVICE_NOT_REGISTERED',
        protocolName: 'GT012',
        packetType,
        deviceIdentifier,
        deviceRegistryStatus: 'NOT_FOUND',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: `Physical device identifier '${deviceIdentifier}' is not provisioned in ITIS Device Registry.`
        },
        processingTimestamp: timestamp,
        error: `DEVICE_NOT_REGISTERED: Identifier '${deviceIdentifier}' rejected. Unknown devices are not authorized.`
      };
    }

    // Check device status
    if (registryDevice.deviceStatus === 'SUSPENDED') {
      if (actor) {
        db.logAuditEvent({
          actionType: 'SUSPENDED_DEVICE_TELEMETRY_ATTEMPT',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'DEVICE',
          targetId: registryDevice.itisDeviceId,
          details: {
            trackerIdentifier: deviceIdentifier,
            reason: 'Device status is administratively SUSPENDED. Ingestion blocked.'
          }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DEVICE_SUSPENDED',
        protocolName: 'GT012',
        packetType,
        deviceIdentifier,
        itisDeviceId: registryDevice.itisDeviceId,
        deviceRegistryStatus: 'SUSPENDED',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: 'Device has been administratively SUSPENDED. Telemetry quarantined.'
        },
        processingTimestamp: timestamp,
        error: `DEVICE_SUSPENDED: Telemetry from suspended device '${registryDevice.itisDeviceId}' rejected.`
      };
    }

    if (registryDevice.deviceStatus === 'RETIRED') {
      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DEVICE_RETIRED',
        protocolName: 'GT012',
        packetType,
        deviceIdentifier,
        itisDeviceId: registryDevice.itisDeviceId,
        deviceRegistryStatus: 'RETIRED',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: 'Device has been decommissioned / RETIRED.'
        },
        processingTimestamp: timestamp,
        error: `DEVICE_RETIRED: Device '${registryDevice.itisDeviceId}' is retired.`
      };
    }

    // ==========================================================================
    // COORDINATE & TELEMETRY VALIDATION
    // ==========================================================================
    if (extractedLat !== undefined && extractedLng !== undefined) {
      const validLat = extractedLat >= -90 && extractedLat <= 90;
      const validLng = extractedLng >= -180 && extractedLng <= 180;

      if (!validLat || !validLng) {
        if (actor) {
          db.logAuditEvent({
            actionType: 'TELEMETRY_PACKET_REJECTED',
            actorUserId: actor.id,
            actorName: actor.name,
            actorRole: actor.role,
            targetEntity: 'DEVICE',
            targetId: registryDevice.itisDeviceId,
            details: { reason: 'INVALID_COORDINATES', latitude: extractedLat, longitude: extractedLng }
          });
        }

        return {
          status: 'PACKET_REJECTED',
          diagnosticCode: 'INVALID_COORDINATES',
          protocolName: 'GT012',
          packetType,
          deviceIdentifier,
          itisDeviceId: registryDevice.itisDeviceId,
          deviceRegistryStatus: registryDevice.deviceStatus,
          validationResult: {
            validFraming: true,
            validCrc: true,
            validCoordinates: false,
            validBattery: true,
            validSpeed: true,
            validHeading: true,
            validTimestamp: true,
            reason: `Coordinates out of physical bounds (Lat: ${extractedLat}, Lng: ${extractedLng}).`
          },
          processingTimestamp: timestamp,
          error: 'INVALID_COORDINATES: Latitude must be -90..+90 and Longitude must be -180..+180.'
        };
      }
    }

    // Update authoritative device state in registry
    deviceRegistryEngine.handleIncomingTrackerConnection(deviceIdentifier, 'GT012', {
      latitude: extractedLat,
      longitude: extractedLng,
      batteryPercentage: extractedBattery,
      voltage: voltageLevel
    });

    // Audit successful simulation
    if (actor) {
      db.logAuditEvent({
        actionType: 'TELEMETRY_PACKET_ACCEPTED',
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetEntity: 'DEVICE',
        targetId: registryDevice.itisDeviceId,
        details: {
          protocol: 'GT012',
          packetType,
          serialNumber,
          isSos,
          coordinates: extractedLat ? `${extractedLat}, ${extractedLng}` : 'N/A'
        }
      });
    }

    return {
      status: 'SIMULATION_SUCCESS',
      diagnosticCode: 'SIMULATION_SUCCESS',
      protocolName: 'GT012',
      packetType,
      deviceIdentifier,
      itisDeviceId: registryDevice.itisDeviceId,
      deviceRegistryStatus: registryDevice.deviceStatus,
      isDuplicate: false,
      validationResult: {
        validFraming: true,
        validCrc: true,
        validCoordinates: true,
        validBattery: true,
        validSpeed: true,
        validHeading: true,
        validTimestamp: true
      },
      extractedLocation: extractedLat !== undefined ? {
        latitude: extractedLat,
        longitude: extractedLng!,
        speed: extractedSpeed || 0,
        heading: extractedHeading || 0,
        accuracy: 4.5,
        satellites,
        isRealTime: true
      } : undefined,
      extractedBattery: {
        percentage: extractedBattery,
        voltageLevel: voltageLevel ?? 4,
        charging: false
      },
      extractedEvent: {
        eventType: packetType,
        sosActive: isSos,
        alarmType
      },
      processingTimestamp: timestamp,
      requiresAck: true,
      ackHex
    };
  }

  // ============================================================================
  // SIMULATED TEST PROTOCOL PROCESSING PIPELINE (JSON / TEXT)
  // ============================================================================
  private processSimulatedJsonPacket(
    rawJson: string,
    targetDeviceIdOverride?: string,
    actor?: ActiveUserSession
  ): TelemetrySimulationResult {
    const timestamp = new Date().toISOString();
    let json: any = {};

    try {
      if (rawJson.startsWith('{')) {
        json = JSON.parse(rawJson);
      } else if (rawJson.startsWith('SIM_TELEMETRY:')) {
        const parts = rawJson.split(':');
        json = {
          deviceId: parts[1],
          latitude: parseFloat(parts[2]),
          longitude: parseFloat(parts[3]),
          speed: parseFloat(parts[4]),
          heading: parseFloat(parts[5]),
          batteryLevel: parseInt(parts[6], 10),
          sosActive: parts[7] === '1' || parts[7] === 'true'
        };
      }
    } catch {
      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: false,
          validCrc: false,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: 'JSON parsing failed.'
        },
        processingTimestamp: timestamp,
        error: 'MALFORMED_PACKET: JSON syntax error in simulated payload.'
      };
    }

    const deviceIdentifier = json.deviceId || json.imei || targetDeviceIdOverride;
    if (!deviceIdentifier) {
      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'MALFORMED_PACKET',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: 'UNKNOWN',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: false,
          validBattery: false,
          validSpeed: false,
          validHeading: false,
          validTimestamp: false,
          reason: 'Missing deviceId in JSON payload.'
        },
        processingTimestamp: timestamp,
        error: 'MALFORMED_PACKET: Missing deviceId in simulated payload.'
      };
    }

    // Duplicate detection
    const fingerprint = crypto
      .createHash('sha256')
      .update(`SIM:${deviceIdentifier}:${json.latitude}:${json.longitude}:${json.timestamp || ''}`)
      .digest('hex');

    if (this.packetFingerprintCache.has(fingerprint)) {
      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DUPLICATE_PACKET',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: json.sosActive ? 'ALARM' : 'LOCATION',
        deviceIdentifier,
        isDuplicate: true,
        duplicateFingerprint: fingerprint,
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: 'Duplicate JSON telemetry packet detected.'
        },
        processingTimestamp: timestamp,
        error: 'DUPLICATE_PACKET: Repeated JSON telemetry packet suppressed.'
      };
    }
    this.packetFingerprintCache.set(fingerprint, Date.now());

    // Coordinate validation
    const lat = typeof json.latitude === 'number' ? json.latitude : parseFloat(json.latitude);
    const lng = typeof json.longitude === 'number' ? json.longitude : parseFloat(json.longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'TELEMETRY_PACKET_REJECTED',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: deviceIdentifier,
          details: { reason: 'INVALID_COORDINATES', latitude: lat, longitude: lng }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'INVALID_COORDINATES',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: 'LOCATION',
        deviceIdentifier,
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: false,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: `Coordinates out of physical bounds (Lat: ${lat}, Lng: ${lng}).`
        },
        processingTimestamp: timestamp,
        error: 'INVALID_COORDINATES: Coordinates must be valid numbers (Lat: -90..90, Lng: -180..180).'
      };
    }

    // Device Registry check
    const registryDevice = deviceRegistryEngine.getDeviceById(deviceIdentifier);
    if (!registryDevice) {
      if (actor) {
        db.logAuditEvent({
          actionType: 'UNKNOWN_DEVICE_TELEMETRY_ATTEMPT',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'HARDWARE',
          targetId: deviceIdentifier,
          details: { reason: 'Device not found in Authoritative ITIS Registry' }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DEVICE_NOT_REGISTERED',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: json.sosActive ? 'ALARM' : 'LOCATION',
        deviceIdentifier,
        deviceRegistryStatus: 'NOT_FOUND',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: `Physical device '${deviceIdentifier}' is not registered.`
        },
        processingTimestamp: timestamp,
        error: `DEVICE_NOT_REGISTERED: Device '${deviceIdentifier}' not found.`
      };
    }

    if (registryDevice.deviceStatus === 'SUSPENDED') {
      if (actor) {
        db.logAuditEvent({
          actionType: 'SUSPENDED_DEVICE_TELEMETRY_ATTEMPT',
          actorUserId: actor.id,
          actorName: actor.name,
          actorRole: actor.role,
          targetEntity: 'DEVICE',
          targetId: registryDevice.itisDeviceId,
          details: { reason: 'Device status is SUSPENDED. Telemetry blocked.' }
        });
      }

      return {
        status: 'PACKET_REJECTED',
        diagnosticCode: 'DEVICE_SUSPENDED',
        protocolName: 'SIMULATED_TEST_PROTOCOL',
        packetType: json.sosActive ? 'ALARM' : 'LOCATION',
        deviceIdentifier,
        itisDeviceId: registryDevice.itisDeviceId,
        deviceRegistryStatus: 'SUSPENDED',
        validationResult: {
          validFraming: true,
          validCrc: true,
          validCoordinates: true,
          validBattery: true,
          validSpeed: true,
          validHeading: true,
          validTimestamp: true,
          reason: 'Device is administratively SUSPENDED.'
        },
        processingTimestamp: timestamp,
        error: `DEVICE_SUSPENDED: Device '${registryDevice.itisDeviceId}' is suspended.`
      };
    }

    // Telemetry accepted
    deviceRegistryEngine.handleIncomingTrackerConnection(deviceIdentifier, 'SIMULATED', {
      latitude: lat,
      longitude: lng,
      batteryPercentage: json.batteryLevel || 90
    });

    if (actor) {
      db.logAuditEvent({
        actionType: 'TELEMETRY_PACKET_ACCEPTED',
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        targetEntity: 'DEVICE',
        targetId: registryDevice.itisDeviceId,
        details: { protocol: 'SIMULATED_TEST_PROTOCOL', lat, lng, isSos: Boolean(json.sosActive) }
      });
    }

    return {
      status: 'SIMULATION_SUCCESS',
      diagnosticCode: 'SIMULATION_SUCCESS',
      protocolName: 'SIMULATED_TEST_PROTOCOL',
      packetType: json.sosActive ? 'ALARM' : 'LOCATION',
      deviceIdentifier,
      itisDeviceId: registryDevice.itisDeviceId,
      deviceRegistryStatus: registryDevice.deviceStatus,
      validationResult: {
        validFraming: true,
        validCrc: true,
        validCoordinates: true,
        validBattery: true,
        validSpeed: true,
        validHeading: true,
        validTimestamp: true
      },
      extractedLocation: {
        latitude: lat,
        longitude: lng,
        speed: json.speed || 0,
        heading: json.heading || 0,
        accuracy: 3.5,
        satellites: 8,
        isRealTime: true
      },
      extractedBattery: {
        percentage: json.batteryLevel || 90,
        charging: false
      },
      extractedEvent: {
        eventType: json.sosActive ? 'SOS_PANIC' : 'LOCATION',
        sosActive: Boolean(json.sosActive),
        alarmType: json.sosActive ? 'SOS_PANIC' : null
      },
      processingTimestamp: timestamp,
      requiresAck: false
    };
  }

  // ============================================================================
  // PROTOCOL PACKET BUILDERS & PRESET TEMPLATES
  // ============================================================================

  /**
   * Builds an authentic 10-byte GT012 Acknowledgement packet.
   */
  public buildGt012Ack(protocolNumber: number, serialNumber: number): Buffer {
    const response = Buffer.alloc(10);
    response[0] = 0x78;
    response[1] = 0x78;
    response[2] = 0x05; // Length = 1(proto) + 2(serial) + 2(crc) = 5
    response[3] = protocolNumber;
    response.writeUInt16BE(serialNumber, 4);

    const crc = GT012CrcCalculator.calculate(response, 2, 4);
    response.writeUInt16BE(crc, 6);

    response[8] = 0x0d;
    response[9] = 0x0a;
    return response;
  }

  /**
   * Builds an authentic GT012 0x01 LOGIN packet with 8-byte BCD IMEI.
   */
  public buildGt012LoginPacket(imei: string, serialNumber = 1): Buffer {
    const cleanImei = imei.replace(/\D/g, '').padStart(16, '0');
    const packet = Buffer.alloc(17);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x0b; // Length = 1(proto) + 8(imei) + 2(serial) = 11 (0x0B)
    packet[3] = GT012ProtocolNumber.LOGIN_MESSAGE;

    // 8-byte BCD IMEI
    for (let i = 0; i < 8; i++) {
      const byteHex = cleanImei.slice(i * 2, i * 2 + 2);
      packet[4 + i] = parseInt(byteHex, 16);
    }

    packet.writeUInt16BE(serialNumber, 12);

    const crc = GT012CrcCalculator.calculate(packet, 2, 12);
    packet.writeUInt16BE(crc, 14);

    packet[16] = 0x0d;
    packet[17] = 0x0a;
    return packet;
  }

  /**
   * Builds an authentic GT012 0x12 LOCATION packet.
   */
  public buildGt012LocationPacket(options: {
    lat: number;
    lng: number;
    speed?: number;
    heading?: number;
    satellites?: number;
    timestamp?: Date;
    serialNumber?: number;
  }): Buffer {
    const ts = options.timestamp || new Date();
    const serial = options.serialNumber || 1;

    // Packet length: 2(start) + 1(len) + 1(proto) + 6(date) + 1(gpsInfo) + 4(lat) + 4(lng) + 1(speed) + 2(course) + 8(cell) + 2(serial) + 2(crc) + 2(stop)
    // = 36 bytes total. Length byte = 29 (0x1D)
    const packet = Buffer.alloc(36);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x1d; // 29 bytes: 1(proto) + 6(dt) + 1(sat) + 8(coords) + 1(spd) + 2(crs) + 8(cell) + 2(serial)
    packet[3] = GT012ProtocolNumber.LOCATION_DATA;

    // Date/Time YY MM DD HH MM SS
    packet[4] = ts.getUTCFullYear() % 100;
    packet[5] = ts.getUTCMonth() + 1;
    packet[6] = ts.getUTCDate();
    packet[7] = ts.getUTCHours();
    packet[8] = ts.getUTCMinutes();
    packet[9] = ts.getUTCSeconds();

    // Satellites count (bits 0..3) | GPS length
    const sats = Math.min(15, options.satellites ?? 9);
    packet[10] = (0x0c << 4) | sats;

    // Lat & Lng scaled to 1/1800000 degrees
    const absLat = Math.abs(options.lat);
    const absLng = Math.abs(options.lng);
    const rawLat = Math.round(absLat * 1800000);
    const rawLng = Math.round(absLng * 1800000);

    packet.writeUInt32BE(rawLat, 11);
    packet.writeUInt32BE(rawLng, 15);

    // Speed in km/h
    packet[19] = Math.min(255, Math.round(options.speed ?? 42));

    // Course and status flags:
    // bit 13: isRealTime (1) -> 0x2000
    // bit 12: isGpsPositioned (1) -> 0x1000
    // bit 11: isEastLongitude (0=East, 1=West)
    // bit 10: isNorthLatitude (1=North, 0=South)
    // bits 0..9: heading (0..360)
    let courseStatus = 0x3000 | ((options.heading ?? 180) & 0x03ff);
    if (options.lng < 0) courseStatus |= 0x0800; // West
    if (options.lat >= 0) courseStatus |= 0x0400; // North
    packet.writeUInt16BE(courseStatus, 20);

    // Cell info: MCC (655 South Africa), MNC (1), LAC (0x2710), CellID (0x012345)
    packet.writeUInt16BE(655, 22);
    packet[24] = 1;
    packet.writeUInt16BE(10000, 25);
    packet[27] = 0x01;
    packet[28] = 0x23;
    packet[29] = 0x45;

    packet.writeUInt16BE(serial, 30);

    const crc = GT012CrcCalculator.calculate(packet, 2, 30);
    packet.writeUInt16BE(crc, 32);

    packet[34] = 0x0d;
    packet[35] = 0x0a;
    return packet;
  }

  /**
   * Builds an authentic GT012 0x13 STATUS / HEARTBEAT packet.
   */
  public buildGt012HeartbeatPacket(options?: {
    voltageLevel?: number;
    gsmSignal?: number;
    defense?: boolean;
    acc?: boolean;
    charging?: boolean;
    serialNumber?: number;
  }): Buffer {
    const packet = Buffer.alloc(15);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x08; // Length = 1(proto) + 1(status) + 1(volt) + 1(gsm) + 1(lang) + 1(unknown) + 2(serial) = 8
    packet[3] = GT012ProtocolNumber.STATUS_HEARTBEAT;

    let status = 0x40; // GPS tracking on
    if (options?.defense) status |= 0x01;
    if (options?.acc) status |= 0x02;
    if (options?.charging) status |= 0x04;
    packet[4] = status;

    packet[5] = options?.voltageLevel ?? 5; // 5 = 95% battery
    packet[6] = options?.gsmSignal ?? 4; // GSM signal 4 (strong)
    packet[7] = 0x02; // English
    packet.writeUInt16BE(options?.serialNumber ?? 1, 9);

    const crc = GT012CrcCalculator.calculate(packet, 2, 9);
    packet.writeUInt16BE(crc, 11);

    packet[13] = 0x0d;
    packet[14] = 0x0a;
    return packet;
  }

  /**
   * Builds an authentic GT012 0x16 ALARM / SOS packet.
   */
  public buildGt012AlarmPacket(options: {
    lat: number;
    lng: number;
    alarmCode?: number; // 0x01 = SOS
    voltageLevel?: number;
    gsmSignal?: number;
    serialNumber?: number;
  }): Buffer {
    // 40 bytes total for GT012 Alarm Data
    const packet = Buffer.alloc(40);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x21; // 33 bytes length
    packet[3] = GT012ProtocolNumber.ALARM_DATA;

    const ts = new Date();
    packet[4] = ts.getUTCFullYear() % 100;
    packet[5] = ts.getUTCMonth() + 1;
    packet[6] = ts.getUTCDate();
    packet[7] = ts.getUTCHours();
    packet[8] = ts.getUTCMinutes();
    packet[9] = ts.getUTCSeconds();

    packet[10] = (0x0c << 4) | 9; // 9 satellites

    const absLat = Math.abs(options.lat);
    const absLng = Math.abs(options.lng);
    packet.writeUInt32BE(Math.round(absLat * 1800000), 11);
    packet.writeUInt32BE(Math.round(absLng * 1800000), 15);

    packet[19] = 0; // Speed 0 km/h during panic

    let courseStatus = 0x3000;
    if (options.lng < 0) courseStatus |= 0x0800;
    if (options.lat >= 0) courseStatus |= 0x0400;
    packet.writeUInt16BE(courseStatus, 20);

    packet.writeUInt16BE(655, 22);
    packet[24] = 1;
    packet.writeUInt16BE(10000, 25);
    packet[27] = 0x01;
    packet[28] = 0x23;
    packet[29] = 0x45;

    packet[30] = 0x44; // terminal info: charging + GPS on
    packet[31] = options.voltageLevel ?? 5; // voltage level
    packet[32] = options.gsmSignal ?? 4; // GSM signal
    packet[33] = options.alarmCode ?? 0x01; // 0x01 = SOS button pressed
    packet[34] = 0x02; // English

    const serial = options.serialNumber ?? 1;
    packet.writeUInt16BE(serial, 34);

    const crc = GT012CrcCalculator.calculate(packet, 2, 34);
    packet.writeUInt16BE(crc, 36);

    packet[38] = 0x0d;
    packet[39] = 0x0a;
    return packet;
  }

  /**
   * Retrieves ready-to-test protocol packet templates.
   */
  public getPresetTemplates(targetTrackerId = 'GT012-TRK-8812') {
    // Generate valid templates with live timestamps
    const validLocation = this.buildGt012LocationPacket({
      lat: -25.7592,
      lng: 28.2340,
      speed: 42,
      heading: 180,
      satellites: 10,
      serialNumber: Math.floor(1 + Math.random() * 60000)
    });

    const validLogin = this.buildGt012LoginPacket('867543024171059', Math.floor(1 + Math.random() * 60000));

    const validHeartbeat = this.buildGt012HeartbeatPacket({
      voltageLevel: 5,
      gsmSignal: 4,
      defense: true,
      serialNumber: Math.floor(1 + Math.random() * 60000)
    });

    const validSos = this.buildGt012AlarmPacket({
      lat: -25.7592,
      lng: 28.2340,
      alarmCode: 0x01,
      serialNumber: Math.floor(1 + Math.random() * 60000)
    });

    // Corrupt CRC: change byte before stop bytes
    const corruptCrc = Buffer.from(validLocation);
    corruptCrc[corruptCrc.length - 3] ^= 0xff;

    // Malformed framing: replace start bytes
    const malformedFraming = Buffer.from(validLocation);
    malformedFraming[0] = 0x12;
    malformedFraming[1] = 0x34;

    return [
      {
        id: 'GT012_VALID_LOCATION',
        name: 'GT012 Valid Location Packet (Pretoria School Zone)',
        protocol: 'GT012',
        packetType: 'LOCATION',
        description: 'Authentic 36-byte GT012 binary location packet (-25.7592, +28.2340, 42 km/h, Heading 180°)',
        rawPacketHex: validLocation.toString('hex').toUpperCase()
      },
      {
        id: 'GT012_VALID_LOGIN',
        name: 'GT012 Terminal Login Message',
        protocol: 'GT012',
        packetType: 'LOGIN',
        description: 'Authentic 18-byte GT012 login frame with terminal IMEI 867543024171059 and CRC-ITU',
        rawPacketHex: validLogin.toString('hex').toUpperCase()
      },
      {
        id: 'GT012_VALID_HEARTBEAT',
        name: 'GT012 Status & Heartbeat Packet',
        protocol: 'GT012',
        packetType: 'HEARTBEAT',
        description: 'Authentic GT012 heartbeat transmitting voltage level 5 (95% battery) and GSM signal 4',
        rawPacketHex: validHeartbeat.toString('hex').toUpperCase()
      },
      {
        id: 'GT012_VALID_SOS',
        name: 'GT012 Emergency Alarm (SOS Panic Trigger)',
        protocol: 'GT012',
        packetType: 'ALARM',
        description: 'Authentic 40-byte GT012 Alarm frame with Alarm Code 0x01 (Physical SOS panic button pressed)',
        rawPacketHex: validSos.toString('hex').toUpperCase()
      },
      {
        id: 'GT012_MALFORMED_CRC',
        name: 'GT012 Malformed Checksum (CRC Corrupted)',
        protocol: 'GT012',
        packetType: 'UNKNOWN',
        description: 'GT012 packet with an intentionally corrupted CRC-ITU checksum byte to test parser rejection',
        rawPacketHex: corruptCrc.toString('hex').toUpperCase()
      },
      {
        id: 'GT012_MALFORMED_FRAMING',
        name: 'GT012 Invalid Framing (Missing 0x7878)',
        protocol: 'GT012',
        packetType: 'UNKNOWN',
        description: 'Corrupted byte sequence lacking required GT012 framing prefix to verify safe rejection',
        rawPacketHex: malformedFraming.toString('hex').toUpperCase()
      },
      {
        id: 'SIMULATED_JSON_VALID',
        name: 'Simulated JSON Telemetry (Pretoria High)',
        protocol: 'SIMULATED_TEST_PROTOCOL',
        packetType: 'LOCATION',
        description: 'Structured JSON payload for integration testing and local simulation',
        rawPacketHex: JSON.stringify({
          simulated: true,
          deviceId: targetTrackerId,
          latitude: -25.7592,
          longitude: 28.2340,
          speed: 24.5,
          heading: 90,
          batteryLevel: 92,
          sosActive: false
        }, null, 2)
      },
      {
        id: 'SIMULATED_JSON_INVALID_COORDS',
        name: 'Simulated Out-of-Bounds Coordinates (Lat: +120°)',
        protocol: 'SIMULATED_TEST_PROTOCOL',
        packetType: 'LOCATION',
        description: 'JSON packet with latitude +120° exceeding physical GPS boundaries to test validation',
        rawPacketHex: JSON.stringify({
          simulated: true,
          deviceId: targetTrackerId,
          latitude: 120.5000,
          longitude: 28.2340,
          speed: 0,
          batteryLevel: 80
        }, null, 2)
      }
    ];
  }
}

export const telemetrySimulationEngine = new TelemetrySimulationEngine();
