/**
 * ITIS GUARDIAN NETWORK — JSON PROTOCOL PROFILE
 * 
 * Standard Structured JSON Telemetry Profile
 * Supports modern IoT devices, REST/MQTT gateways, and simulated hardware envelopes:
 * - Framing: Starts with '{' or 'SIM_TELEMETRY:{'
 * - ACK: Protocol-specific JSON string '{"status":"ACK","protocol":"JSON","deviceId":"...","receivedAt":"..."}' (Never GT012 binary)
 */

import {
  DecodedPacketEnvelope,
  ProtocolValidationResult,
  ProtocolAckResult,
  ProtocolDetectionResult,
  ProtocolProfileSummary,
  TelemetryTransportType
} from '../../types.js';
import { IProtocolProfile } from './interfaces.js';

export class JsonProtocolProfile implements IProtocolProfile {
  public readonly protocolId = 'JSON';
  public readonly protocolName = 'Structured JSON Telemetry Protocol';
  public readonly manufacturer = 'Open IoT Standard / Webhook Ingestion';
  public readonly version = 'v2.0.0';
  public readonly framingDescription = "JSON Object Payload '{ ... }' or 'SIM_TELEMETRY:{ ... }'";
  public readonly supportedPacketTypes: ('LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN')[] = [
    'LOCATION', 'HEARTBEAT', 'ALARM', 'STATUS', 'LOGIN'
  ];
  public readonly transportSuitability: readonly TelemetryTransportType[] = ['HTTP', 'TCP', 'UDP', 'SIMULATOR'];

  private packetToString(rawPacket: string | Buffer): string {
    if (Buffer.isBuffer(rawPacket)) {
      return rawPacket.toString('utf8').trim();
    }
    return String(rawPacket).trim();
  }

  private cleanJsonString(input: string): string {
    let clean = input.trim();
    if (clean.startsWith('SIM_TELEMETRY:')) {
      clean = clean.slice('SIM_TELEMETRY:'.length).trim();
    }
    return clean;
  }

  /**
   * 1. Protocol Detection Rule
   */
  public canHandle(rawPacket: string | Buffer, registeredDeviceProtocol?: string): ProtocolDetectionResult {
    const isDeviceJson = registeredDeviceProtocol === 'JSON' || registeredDeviceProtocol === 'SIMULATED_JSON' || registeredDeviceProtocol === 'SIMULATED';
    const text = this.packetToString(rawPacket);

    if (!text) {
      return {
        matched: false,
        confidence: 0,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Packet is empty.'
      };
    }

    const clean = this.cleanJsonString(text);
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        JSON.parse(clean);
        return {
          matched: true,
          confidence: 1.0,
          protocolId: this.protocolId,
          protocolName: this.protocolName,
          reason: 'Valid JSON object framing confirmed.'
        };
      } catch {
        return {
          matched: true,
          confidence: 0.7,
          protocolId: this.protocolId,
          protocolName: this.protocolName,
          reason: 'JSON framing detected with syntax errors.'
        };
      }
    }

    if (isDeviceJson && (text.startsWith('{') || text.includes('"deviceId"'))) {
      return {
        matched: true,
        confidence: 0.8,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Device configured for JSON protocol and partial JSON syntax detected.'
      };
    }

    return {
      matched: false,
      confidence: 0,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      reason: 'Not a JSON formatted payload.'
    };
  }

  /**
   * 2. Packet Decoder
   */
  public decode(rawPacket: string | Buffer, context?: { fallbackDeviceId?: string }): DecodedPacketEnvelope {
    const text = this.packetToString(rawPacket);
    const clean = this.cleanJsonString(text);

    let parsed: any = {};
    let parseError = false;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parseError = true;
    }

    if (parseError || typeof parsed !== 'object' || parsed === null) {
      return {
        rawPacket: text,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        packetType: 'UNKNOWN',
        deviceIdentifier: context?.fallbackDeviceId,
        payloadData: { parseError: true }
      };
    }

    // Extract device identifier
    const deviceIdentifier =
      parsed.deviceId ||
      parsed.targetDeviceId ||
      parsed.trackerDeviceId ||
      parsed.deviceIdentifier ||
      parsed.imei ||
      context?.fallbackDeviceId;

    // Determine packet type
    let packetType: 'LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN' = 'LOCATION';
    if (parsed.packetType) {
      const pt = String(parsed.packetType).toUpperCase();
      if (['LOGIN', 'LOCATION', 'HEARTBEAT', 'ALARM', 'STATUS', 'COMMAND'].includes(pt)) {
        packetType = pt as any;
      }
    } else if (parsed.sosActive || parsed.alarmType) {
      packetType = 'ALARM';
    } else if (parsed.isHeartbeat || (!parsed.latitude && !parsed.longitude && parsed.batteryPercentage !== undefined)) {
      packetType = 'HEARTBEAT';
    }

    // Extract coordinates
    let extractedLocation: DecodedPacketEnvelope['extractedLocation'] = undefined;
    const lat = parsed.latitude !== undefined ? Number(parsed.latitude) : parsed.lat !== undefined ? Number(parsed.lat) : undefined;
    const lng = parsed.longitude !== undefined ? Number(parsed.longitude) : parsed.lng !== undefined ? Number(parsed.lng) : undefined;

    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      extractedLocation = {
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        speed: parsed.speed !== undefined ? Number(parsed.speed) : 0,
        heading: parsed.heading !== undefined ? Number(parsed.heading) : 0,
        altitude: parsed.altitude !== undefined ? Number(parsed.altitude) : 1350,
        accuracyMeters: parsed.accuracyMeters || parsed.accuracy || 4.5,
        satellites: parsed.satellites || 9,
        isRealTime: parsed.isRealTime !== false
      };
    }

    // Extract battery
    let extractedBattery: DecodedPacketEnvelope['extractedBattery'] = undefined;
    const batt = parsed.batteryPercentage ?? parsed.battery ?? parsed.batteryLevel;
    if (batt !== undefined) {
      const pct = Math.min(100, Math.max(0, Number(batt)));
      extractedBattery = {
        percentage: pct,
        voltageLevel: parsed.voltageLevel ?? 4,
        voltage: parsed.voltage ?? (3.6 + (pct / 100) * 0.6),
        charging: Boolean(parsed.isCharging || parsed.charging)
      };
    }

    // Extract event
    let extractedEvent: DecodedPacketEnvelope['extractedEvent'] = undefined;
    if (parsed.sosActive || parsed.alarmType || parsed.tamperAlert) {
      extractedEvent = {
        isSos: Boolean(parsed.sosActive || parsed.isSos),
        alarmType: parsed.alarmType || (parsed.sosActive ? 'SOS_PANIC' : null),
        tamperAlert: Boolean(parsed.tamperAlert)
      };
    }

    return {
      rawPacket: text,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      packetType,
      deviceIdentifier,
      timestamp: parsed.timestamp || new Date().toISOString(),
      extractedLocation,
      extractedBattery,
      extractedEvent,
      payloadData: parsed
    };
  }

  /**
   * 3. Validation Rules
   */
  public validate(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolValidationResult {
    const errors: string[] = [];
    const text = this.packetToString(rawPacket);
    const clean = this.cleanJsonString(text);

    let validFraming = false;
    try {
      JSON.parse(clean);
      validFraming = true;
    } catch (err: any) {
      errors.push(`Invalid JSON syntax: ${err.message}`);
    }

    // Coordinates validation
    let validCoordinates = true;
    if (envelope.extractedLocation) {
      const { latitude, longitude } = envelope.extractedLocation;
      if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
        validCoordinates = false;
        errors.push('Coordinates are not valid numbers.');
      } else if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        validCoordinates = false;
        errors.push(`Coordinates (${latitude}, ${longitude}) exceed physical boundaries (-90..90, -180..180).`);
      }
    }

    // Battery validation
    let validBattery = true;
    if (envelope.extractedBattery) {
      const { percentage } = envelope.extractedBattery;
      if (percentage < 0 || percentage > 100) {
        validBattery = false;
        errors.push(`Battery percentage (${percentage}%) exceeds valid bounds (0..100).`);
      }
    }

    return {
      validFraming,
      validChecksum: true, // JSON has inherent syntax integrity
      validCoordinates,
      validBattery,
      validTimestamp: true,
      errors
    };
  }

  /**
   * 4. Location Extractor
   */
  public extractLocation(envelope: DecodedPacketEnvelope): DecodedPacketEnvelope['extractedLocation'] {
    return envelope.extractedLocation;
  }

  /**
   * 5. Device Identifier Extractor
   */
  public extractDeviceIdentifier(envelope: DecodedPacketEnvelope, _rawPacket: string | Buffer): string | undefined {
    return envelope.deviceIdentifier;
  }

  /**
   * 6. Heartbeat Parser
   */
  public parseHeartbeat(envelope: DecodedPacketEnvelope): {
    batteryPercentage?: number;
    voltageLevel?: number;
    voltage?: number;
    charging?: boolean;
    statusFlags?: Record<string, boolean>;
  } {
    return {
      batteryPercentage: envelope.extractedBattery?.percentage ?? 88,
      voltageLevel: envelope.extractedBattery?.voltageLevel ?? 4,
      voltage: envelope.extractedBattery?.voltage ?? 4.05,
      charging: envelope.extractedBattery?.charging ?? false,
      statusFlags: { online: true }
    };
  }

  /**
   * 7. ACK Encoder
   * Returns protocol-specific JSON ACK string.
   * INVARIANT: Never returns a GT012 10-byte binary ACK!
   */
  public encodeAck(envelope: DecodedPacketEnvelope, _rawPacket: string | Buffer): ProtocolAckResult {
    const ackObj = {
      status: 'ACK',
      protocol: 'JSON',
      deviceId: envelope.deviceIdentifier || 'UNKNOWN',
      receivedAt: new Date().toISOString()
    };
    const jsonString = JSON.stringify(ackObj);

    return {
      requiresAck: true,
      ackFormat: 'JSON',
      ackPayload: jsonString,
      ackBuffer: Buffer.from(jsonString, 'utf8')
    };
  }

  public getSummary(): ProtocolProfileSummary {
    return {
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      manufacturer: this.manufacturer,
      version: this.version,
      framingDescription: this.framingDescription,
      supportedPacketTypes: [...this.supportedPacketTypes],
      ackSupport: true,
      ackFormat: 'JSON',
      registeredAt: '2026-02-15T00:00:00.000Z',
      status: 'ACTIVE'
    };
  }
}
