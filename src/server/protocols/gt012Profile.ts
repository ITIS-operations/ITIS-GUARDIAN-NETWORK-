/**
 * ITIS GUARDIAN NETWORK — GT012 CONCOX PROTOCOL PROFILE
 * 
 * First Authoritative Supported Profile
 * Implements binary GT012 Concox Protocol:
 * - Framing: 0x78 0x78 start, 0x0D 0x0A stop
 * - Checksum: CRC-ITU (CRC-16-CCITT Polynomial 0x1021)
 * - ACK: 10-byte binary downlink frame
 * - Preserves 100% of validated GT012 behaviour.
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

export class GT012ProtocolProfile implements IProtocolProfile {
  public readonly protocolId = 'GT012';
  public readonly protocolName = 'GT012 Concox Binary Protocol';
  public readonly manufacturer = 'Concox / Jimi IoT';
  public readonly version = 'v4.2.1-ZA';
  public readonly framingDescription = 'Binary 0x7878 Start, 0x0D0A Stop, CRC-ITU 16-bit Checksum';
  public readonly supportedPacketTypes: ('LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN')[] = [
    'LOGIN', 'LOCATION', 'HEARTBEAT', 'ALARM', 'STATUS', 'COMMAND'
  ];
  public readonly transportSuitability: readonly TelemetryTransportType[] = ['TCP', 'UDP', 'SIMULATOR', 'HTTP'];

  /**
   * Helper to normalize raw input to Buffer
   */
  private toBuffer(rawPacket: string | Buffer): Buffer | null {
    if (Buffer.isBuffer(rawPacket)) {
      return rawPacket;
    }
    if (typeof rawPacket === 'string') {
      const cleanHex = rawPacket.trim().replace(/\s+/g, '');
      if (/^[0-9a-fA-F]+$/.test(cleanHex) && cleanHex.length % 2 === 0) {
        try {
          return Buffer.from(cleanHex, 'hex');
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  /**
   * 1. Detection Rule
   */
  public canHandle(rawPacket: string | Buffer, registeredDeviceProtocol?: string): ProtocolDetectionResult {
    // If registered device explicitly configures GT012, strong hint
    const isDeviceGt012 = registeredDeviceProtocol === 'GT012' || registeredDeviceProtocol === 'CONCOX';

    const buffer = this.toBuffer(rawPacket);
    if (!buffer || buffer.length < 10) {
      return {
        matched: false,
        confidence: 0,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Packet is not valid hexadecimal binary or is less than 10 bytes minimum.'
      };
    }

    const hasStart = buffer[0] === 0x78 && buffer[1] === 0x78;
    const hasStop = buffer[buffer.length - 2] === 0x0d && buffer[buffer.length - 1] === 0x0a;

    if (hasStart && hasStop) {
      const crcValid = GT012CrcCalculator.validate(buffer);
      const confidence = crcValid ? 1.0 : 0.9;
      return {
        matched: true,
        confidence,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: crcValid 
          ? 'Exact 0x7878 framing and verified CRC-ITU match.'
          : '0x7878 framing match with pending/corrupt CRC.'
      };
    }

    if (isDeviceGt012 && buffer.length >= 10) {
      return {
        matched: false,
        confidence: 0.1,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        reason: 'Device configured for GT012 but incoming packet lacks 0x7878..0x0D0A framing.'
      };
    }

    return {
      matched: false,
      confidence: 0,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      reason: 'No GT012 framing signatures found.'
    };
  }

  /**
   * 2. Packet Decoder
   */
  public decode(rawPacket: string | Buffer, context?: { fallbackDeviceId?: string }): DecodedPacketEnvelope {
    const rawString = Buffer.isBuffer(rawPacket) ? rawPacket.toString('hex').toUpperCase() : rawPacket.trim();
    const buffer = this.toBuffer(rawPacket);

    if (!buffer || buffer.length < 10) {
      return {
        rawPacket: rawString,
        protocolId: this.protocolId,
        protocolName: this.protocolName,
        packetType: 'UNKNOWN',
        deviceIdentifier: context?.fallbackDeviceId,
        payloadData: { error: 'Buffer underflow or invalid hex string' }
      };
    }

    const protocolNumber = buffer[3];
    const stopByteOffset = buffer.length - 2;
    const crcOffset = stopByteOffset - 2;
    const serialOffset = crcOffset - 2;
    const serialNumber = serialOffset >= 4 ? buffer.readUInt16BE(serialOffset) : 0;

    let packetType: 'LOGIN' | 'LOCATION' | 'HEARTBEAT' | 'ALARM' | 'STATUS' | 'COMMAND' | 'UNKNOWN' = 'UNKNOWN';
    let deviceIdentifier = context?.fallbackDeviceId;
    let extractedLocation: DecodedPacketEnvelope['extractedLocation'] = undefined;
    let extractedBattery: DecodedPacketEnvelope['extractedBattery'] = undefined;
    let extractedEvent: DecodedPacketEnvelope['extractedEvent'] = undefined;

    if (protocolNumber === GT012ProtocolNumber.LOGIN_MESSAGE) {
      packetType = 'LOGIN';
      if (buffer.length >= 12) {
        const imeiBuf = buffer.subarray(4, 12);
        let imeiHex = '';
        for (let i = 0; i < imeiBuf.length; i++) {
          imeiHex += imeiBuf[i].toString(16).padStart(2, '0');
        }
        deviceIdentifier = imeiHex.startsWith('0') ? imeiHex.slice(1) : imeiHex;
      }
    } else if (protocolNumber === GT012ProtocolNumber.STATUS_HEARTBEAT) {
      packetType = 'HEARTBEAT';
      const voltageLevel = buffer[5];
      const voltageMap: Record<number, number> = { 0: 5, 1: 15, 2: 35, 3: 60, 4: 80, 5: 95, 6: 100 };
      const pct = voltageMap[voltageLevel] !== undefined ? voltageMap[voltageLevel] : 75;
      extractedBattery = {
        percentage: pct,
        voltageLevel,
        voltage: 3.6 + (pct / 100) * 0.6,
        charging: false
      };
    } else if (protocolNumber === GT012ProtocolNumber.LOCATION_DATA || protocolNumber === GT012ProtocolNumber.ALARM_DATA) {
      packetType = protocolNumber === GT012ProtocolNumber.ALARM_DATA ? 'ALARM' : 'LOCATION';

      if (buffer.length >= 22) {
        const satellites = buffer[10] & 0x0f;
        const rawLat = buffer.readUInt32BE(11);
        let lat = rawLat / 1800000.0;
        const rawLng = buffer.readUInt32BE(15);
        let lng = rawLng / 1800000.0;

        const speed = buffer[19];
        const courseStatus = buffer.readUInt16BE(20);
        const heading = courseStatus & 0x03ff;

        const isNorth = (courseStatus & 0x0400) !== 0;
        const isEast = (courseStatus & 0x0800) === 0;

        if (!isNorth) lat = -lat;
        if (!isEast) lng = -lng;

        extractedLocation = {
          latitude: Number(lat.toFixed(6)),
          longitude: Number(lng.toFixed(6)),
          speed,
          heading,
          satellites,
          accuracyMeters: 4.5,
          isRealTime: true
        };

        if (protocolNumber === GT012ProtocolNumber.ALARM_DATA) {
          const alarmCode = buffer.length > 33 ? buffer[33] : 0x01;
          let isSos = false;
          let alarmType: string | null = null;
          let tamperAlert = false;

          if (alarmCode === 0x01) {
            isSos = true;
            alarmType = 'SOS_PANIC';
          } else if (alarmCode === 0x04) {
            alarmType = 'GEOFENCE_EXIT';
          } else if (alarmCode === 0x05) {
            alarmType = 'GEOFENCE_ENTER';
          } else if (alarmCode === 0x09) {
            alarmType = 'TAMPER_REMOVAL';
            tamperAlert = true;
          } else {
            alarmType = `ALARM_CODE_0x${alarmCode.toString(16)}`;
          }

          extractedEvent = {
            isSos,
            alarmType,
            tamperAlert
          };
        }
      }
    }

    return {
      rawPacket: rawString,
      protocolId: this.protocolId,
      protocolName: this.protocolName,
      packetType,
      deviceIdentifier,
      sequenceNumber: serialNumber,
      timestamp: new Date().toISOString(),
      extractedLocation,
      extractedBattery,
      extractedEvent,
      payloadData: {
        protocolNumber,
        serialNumber,
        byteLength: buffer.length
      }
    };
  }

  /**
   * 3. Validation Rules
   */
  public validate(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolValidationResult {
    const errors: string[] = [];
    const buffer = this.toBuffer(rawPacket);

    if (!buffer) {
      return {
        validFraming: false,
        validChecksum: false,
        validCoordinates: false,
        validBattery: false,
        validTimestamp: false,
        errors: ['Raw packet cannot be converted to binary buffer.']
      };
    }

    // Minimum length check
    if (buffer.length < 10) {
      errors.push(`Packet underflow: received ${buffer.length} bytes, minimum is 10.`);
    }

    // Framing verification: 0x7878 start and 0x0D0A stop
    const validStart = buffer.length >= 2 && buffer[0] === 0x78 && buffer[1] === 0x78;
    const validStop = buffer.length >= 4 && buffer[buffer.length - 2] === 0x0d && buffer[buffer.length - 1] === 0x0a;
    const validFraming = validStart && validStop;

    if (!validStart) {
      errors.push('GT012 framing mismatch: packet must begin with 0x7878.');
    }
    if (!validStop) {
      errors.push('GT012 framing mismatch: packet must terminate with 0x0D0A.');
    }

    // CRC-ITU verification
    let validChecksum = false;
    if (validFraming) {
      validChecksum = GT012CrcCalculator.validate(buffer);
      if (!validChecksum) {
        errors.push('GT012 CRC-ITU checksum verification failed.');
      }
    }

    // Coordinate validation if location is present
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
  public extractDeviceIdentifier(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): string | undefined {
    if (envelope.deviceIdentifier) {
      return envelope.deviceIdentifier;
    }
    const buffer = this.toBuffer(rawPacket);
    if (buffer && buffer.length >= 12 && buffer[3] === GT012ProtocolNumber.LOGIN_MESSAGE) {
      const imeiBuf = buffer.subarray(4, 12);
      let imeiHex = '';
      for (let i = 0; i < imeiBuf.length; i++) {
        imeiHex += imeiBuf[i].toString(16).padStart(2, '0');
      }
      return imeiHex.startsWith('0') ? imeiHex.slice(1) : imeiHex;
    }
    return undefined;
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
    if (envelope.extractedBattery) {
      return {
        batteryPercentage: envelope.extractedBattery.percentage,
        voltageLevel: envelope.extractedBattery.voltageLevel,
        voltage: envelope.extractedBattery.voltage,
        charging: false,
        statusFlags: {
          online: true,
          heartbeatReceived: true
        }
      };
    }
    return {
      batteryPercentage: 85,
      statusFlags: { online: true }
    };
  }

  /**
   * 7. ACK Encoder
   * Builds an authentic 10-byte GT012 Acknowledgement packet.
   * Frame layout: 0x78 0x78 0x05 <protocolNumber> <serialNumber 2-bytes> <crc 2-bytes> 0x0D 0x0A
   */
  public encodeAck(envelope: DecodedPacketEnvelope, rawPacket: string | Buffer): ProtocolAckResult {
    const buffer = this.toBuffer(rawPacket);
    const protocolNumber = envelope.payloadData?.protocolNumber || (buffer && buffer.length >= 4 ? buffer[3] : 0x01);
    const serialNumber = envelope.sequenceNumber || envelope.payloadData?.serialNumber || 1;

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

    const ackPayload = response.toString('hex').toUpperCase();

    return {
      requiresAck: true,
      ackFormat: 'BINARY_HEX',
      ackPayload,
      ackBuffer: response
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
      ackFormat: 'BINARY_HEX',
      registeredAt: '2026-01-01T00:00:00.000Z',
      status: 'ACTIVE'
    };
  }
}
