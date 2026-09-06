/**
 * ITIS GUARDIAN NETWORK — ASCII PROTOCOL PROFILE
 * 
 * Standard Delimited ASCII Tracker Profile
 * Supports text-based tracker protocols (e.g. NMEA-style, Queclink/Coban ASCII, Meitrack text):
 * - Framing: Starts with '$' or '+RESP:' or '#', delimited by commas ',', optional XOR checksum '*XX', ends with '\r\n' or '\n'
 * - ACK: Protocol-specific ASCII string '*ACK,<DEVICE_ID>,OK\r\n' (Never GT012 binary)
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

export class AsciiProtocolProfile implements IProtocolProfile {
  public readonly protocolId = 'ASCII';
  public readonly protocolName = 'Standard Delimited ASCII Tracker Protocol';
  public readonly manufacturer = 'Generic / Open ASCII Standards';
  public readonly version = 'v1.1.0';
  public readonly framingDescription = "Delimited text '$PREFIX,FIELD1,FIELD2...*XX\\r\\n', XOR 8-bit Checksum";
  public readonly supportedPacketTypes: ('LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN')[] = [
    'LOCATION', 'HEARTBEAT', 'ALARM', 'STATUS', 'LOGIN'
  ];
  public readonly transportSuitability: readonly TelemetryTransportType[] = ['TCP', 'UDP', 'HTTP', 'SIMULATOR'];

  /**
   * Helper to normalize raw input to trimmed string
   */
  private packetToString(rawPacket: string | Buffer): string {
    if (Buffer.isBuffer(rawPacket)) {
      return rawPacket.toString('utf8').trim();
    }
    return String(rawPacket).trim();
  }

  /**
   * Helper to calculate XOR checksum between start marker and '*'
   */
  public static calculateXorChecksum(payload: string): string {
    let checksum = 0;
    for (let i = 0; i < payload.length; i++) {
      checksum ^= payload.charCodeAt(i);
    }
    return checksum.toString(16).padStart(2, '0').toUpperCase();
  }

  /**
   * 1. Protocol Detection Rule
   */
  public canHandle(rawPacket: string | Buffer, registeredDeviceProtocol?: string): ProtocolDetectionResult {
    const isDeviceAscii = registeredDeviceProtocol === 'ASCII';
    const text = this.packetToString(rawPacket);

    if (!text || text.length < 5) {
      return {
        matched: false,
        confidence: 0,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Packet is empty or too short for ASCII protocol.'
      };
    }

    // Do NOT match JSON or hex binary
    if (text.startsWith('{') || text.startsWith('SIM_TELEMETRY:') || /^[0-9a-fA-F]{16,}$/.test(text)) {
      return {
        matched: false,
        confidence: 0,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Packet is JSON or binary hex, not ASCII delimited.'
      };
    }

    // ASCII signature: starts with '$' or '+RESP:' or contains comma-delimited tokens with recognizable header
    const hasAsciiPrefix = text.startsWith('$') || text.startsWith('+RESP:') || text.startsWith('#TRK') || text.startsWith('@TRK');
    const commaCount = (text.match(/,/g) || []).length;

    if (hasAsciiPrefix && commaCount >= 3) {
      return {
        matched: true,
        confidence: 0.95,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: "Valid ASCII prefix and comma-delimited structure detected."
      };
    }

    if (isDeviceAscii && commaCount >= 2) {
      return {
        matched: true,
        confidence: 0.85,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: "Device configured for ASCII and packet contains comma delimiters."
      };
    }

    return {
      matched: false,
      confidence: 0,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      reason: 'No recognized ASCII framing found.'
    };
  }

  /**
   * 2. Packet Decoder
   * Expected format examples:
   * $TRK,DEV-ASCII-001,2026-09-06T07:00:00Z,-25.7589,28.2321,24.5,180,88,NORMAL*4F
   * $SOS,DEV-ASCII-001,2026-09-06T07:00:00Z,-25.7589,28.2321,0,0,92,PANIC*3A
   * $HB,DEV-ASCII-001,2026-09-06T07:00:00Z,95,NORMAL*21
   * $LOGIN,DEV-ASCII-001,867543029182734*1C
   */
  public decode(rawPacket: string | Buffer, context?: { fallbackDeviceId?: string }): DecodedPacketEnvelope {
    const text = this.packetToString(rawPacket);

    // Strip leading '$' or '+' and trailing checksum/newlines
    let clean = text;
    if (clean.startsWith('$') || clean.startsWith('#') || clean.startsWith('@')) {
      clean = clean.slice(1);
    }

    let rawChecksum: string | null = null;
    const starIdx = clean.indexOf('*');
    if (starIdx !== -1) {
      rawChecksum = clean.slice(starIdx + 1).replace(/[\r\n]/g, '').trim();
      clean = clean.slice(0, starIdx);
    } else {
      clean = clean.replace(/[\r\n]/g, '').trim();
    }

    const parts = clean.split(',');
    const header = (parts[0] || '').toUpperCase();
    const deviceIdentifier = parts[1] || context?.fallbackDeviceId;

    let packetType: 'LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN' = 'LOCATION';
    let extractedLocation: DecodedPacketEnvelope['extractedLocation'] = undefined;
    let extractedBattery: DecodedPacketEnvelope['extractedBattery'] = undefined;
    let extractedEvent: DecodedPacketEnvelope['extractedEvent'] = undefined;
    let timestamp = new Date().toISOString();

    if (header === 'LOGIN') {
      packetType = 'LOGIN';
    } else if (header === 'HB' || header === 'HEARTBEAT' || header === 'STATUS') {
      packetType = 'HEARTBEAT';
      timestamp = parts[2] || timestamp;
      const batt = parseFloat(parts[3]);
      if (!isNaN(batt)) {
        extractedBattery = { percentage: Math.min(100, Math.max(0, batt)) };
      }
    } else if (header === 'SOS' || header === 'ALARM') {
      packetType = 'ALARM';
      timestamp = parts[2] || timestamp;
      const lat = parseFloat(parts[3]);
      const lng = parseFloat(parts[4]);
      const speed = parseFloat(parts[5]) || 0;
      const heading = parseFloat(parts[6]) || 0;
      const batt = parseFloat(parts[7]);
      const alarmType = parts[8] || 'SOS_PANIC';

      if (!isNaN(lat) && !isNaN(lng)) {
        extractedLocation = {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          speed,
          heading,
          accuracyMeters: 5.0,
          isRealTime: true,
          satellites: 8
        };
      }
      if (!isNaN(batt)) {
        extractedBattery = { percentage: Math.min(100, Math.max(0, batt)) };
      }
      extractedEvent = {
        isSos: true,
        alarmType
      };
    } else {
      // Default: $TRK or $LOC location packet
      packetType = 'LOCATION';
      timestamp = parts[2] || timestamp;
      const lat = parseFloat(parts[3]);
      const lng = parseFloat(parts[4]);
      const speed = parseFloat(parts[5]) || 0;
      const heading = parseFloat(parts[6]) || 0;
      const batt = parseFloat(parts[7]);
      const statusNote = parts[8];

      if (!isNaN(lat) && !isNaN(lng)) {
        extractedLocation = {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          speed,
          heading,
          accuracyMeters: 4.5,
          isRealTime: true,
          satellites: 9
        };
      }
      if (!isNaN(batt)) {
        extractedBattery = { percentage: Math.min(100, Math.max(0, batt)) };
      }
      if (statusNote && statusNote.toUpperCase().includes('SOS')) {
        extractedEvent = { isSos: true, alarmType: 'SOS_PANIC' };
        packetType = 'ALARM';
      }
    }

    return {
      rawPacket: text,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      packetType,
      deviceIdentifier,
      timestamp,
      extractedLocation,
      extractedBattery,
      extractedEvent,
      payloadData: {
        header,
        fields: parts,
        checksum: rawChecksum
      }
    };
  }

  /**
   * 3. Validation Rules
   */
  public validate(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolValidationResult {
    const errors: string[] = [];
    const text = this.packetToString(rawPacket);

    // Basic framing
    const parts = (envelope.payloadData?.fields as string[]) || [];
    const validFraming = parts.length >= 2;
    if (!validFraming) {
      errors.push('ASCII packet lacks required comma-delimited fields.');
    }

    // Checksum validation if present
    let validChecksum = true;
    const starIdx = text.indexOf('*');
    if (starIdx !== -1) {
      const contentToVerify = text.startsWith('$') ? text.slice(1, starIdx) : text.slice(0, starIdx);
      const expectedChecksum = AsciiProtocolProfile.calculateXorChecksum(contentToVerify);
      const providedChecksum = text.slice(starIdx + 1).replace(/[\r\n]/g, '').trim().toUpperCase();
      if (expectedChecksum !== providedChecksum) {
        validChecksum = false;
        errors.push(`ASCII XOR Checksum mismatch: expected ${expectedChecksum}, got ${providedChecksum}.`);
      }
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
      validChecksum,
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
      batteryPercentage: envelope.extractedBattery?.percentage ?? 90,
      charging: false,
      statusFlags: { online: true }
    };
  }

  /**
   * 7. ACK Encoder
   * Returns protocol-specific ASCII ACK.
   * Frame layout: *ACK,<DEVICE_ID>,OK\r\n
   * INVARIANT: Never returns a GT012 10-byte binary ACK!
   */
  public encodeAck(envelope: DecodedPacketEnvelope, _rawPacket: string | Buffer): ProtocolAckResult {
    const devId = envelope.deviceIdentifier || 'UNKNOWN';
    const ackString = `*ACK,${devId},OK\r\n`;

    return {
      requiresAck: true,
      ackFormat: 'ASCII',
      ackPayload: ackString,
      ackBuffer: Buffer.from(ackString, 'utf8')
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
      ackFormat: 'ASCII',
      registeredAt: '2026-03-01T00:00:00.000Z',
      status: 'ACTIVE'
    };
  }
}
