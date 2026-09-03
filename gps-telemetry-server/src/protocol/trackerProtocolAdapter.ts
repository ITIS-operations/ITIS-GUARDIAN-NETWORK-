/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY SERVER
 * GT012 Official Hardware Tracker Protocol Adapter
 * 
 * Implements IDeviceProtocol for the GT012 Binary Tracker Protocol.
 * Authoritative framing: 0x78 0x78 ... 0x0D 0x0A with CRC-ITU (CRC-16-CCITT).
 */

import { IDeviceProtocol } from './deviceProtocol.js';
import { RawNetworkPacket, DecodedPacketResult, EncodedPacketResult } from '../types/packet.js';
import { TelemetryEvent, AlarmClassification } from '../types/telemetry.js';
import { GT012Crc } from './gt012Crc.js';

export enum GT012ProtocolNumber {
  LOGIN_MESSAGE = 0x01,
  LOCATION_DATA = 0x12,
  STATUS_HEARTBEAT = 0x13,
  STRING_INFORMATION = 0x15,
  ALARM_DATA = 0x16,
  GPS_ADDRESS_QUERY = 0x1A,
  SERVER_COMMAND = 0x80
}

export interface DecodedGT012Header {
  startBytes: number[];
  length: number;
  protocolNumber: number;
  serialNumber: number;
  crc: number;
  isValidCrc: boolean;
  rawHex: string;
}

export interface DecodedGT012LoginPayload {
  terminalIdentifier: string; // 15-digit IMEI
  imeiBcd: string;
  serialNumber: number;
}

export interface DecodedGT012LocationPayload {
  timestamp: Date;
  satelliteCount: number;
  latitude: number;
  longitude: number;
  speedKmh: number;
  courseDegrees: number;
  gpsValid: boolean;
  isRealTime: boolean;
  isDifferentialGps: boolean;
  isWestLongitude: boolean;
  isSouthLatitude: boolean;
  mcc: number;
  mnc: number;
  lac: number;
  cellId: number;
  serialNumber: number;
}

export interface DecodedGT012HeartbeatPayload {
  terminalStatus: {
    defenseActive: boolean;
    accHigh: boolean;
    charging: boolean;
    gpsTrackingOn: boolean;
  };
  voltageLevel: number;
  batteryPercentage: number;
  gsmSignalStrength: number;
  gsmSignalDbm: number;
  alarmLanguage: string;
  serialNumber: number;
}

export interface DecodedGT012AlarmPayload extends DecodedGT012LocationPayload {
  terminalStatus: {
    defenseActive: boolean;
    accHigh: boolean;
    charging: boolean;
    gpsTrackingOn: boolean;
  };
  voltageLevel: number;
  batteryPercentage: number;
  gsmSignalDbm: number;
  alarmCode: number;
  alarmType: string;
  alarmClassification: AlarmClassification;
  requiresIncidentEscalation: boolean;
}

export class TrackerProtocolAdapter implements IDeviceProtocol {
  public readonly protocolName = 'GT012';
  public readonly description = 'GT012 / Concox Binary GPS Tracker Protocol (CRC-ITU)';
  public readonly defaultPort = 7012;

  /**
   * Determine if the incoming raw byte stream matches the GT012 protocol signature.
   * Start: 0x78 0x78 | Stop: 0x0D 0x0A | Minimum Length: 10 bytes
   */
  public matches(packet: RawNetworkPacket): boolean {
    const data = packet.data;
    if (!data || data.length < 10) return false;
    if (data[0] !== 0x78 || data[1] !== 0x78) return false;
    if (data[data.length - 2] !== 0x0d || data[data.length - 1] !== 0x0a) return false;
    return true;
  }

  /**
   * Validate CRC-ITU checksum of the GT012 binary packet.
   */
  public validateChecksum(packet: Buffer): boolean {
    return GT012Crc.validate(packet);
  }

  /**
   * Identify the GT012 packet protocol number from the buffer.
   */
  public identifyPacket(packet: Buffer): GT012ProtocolNumber | number | null {
    if (packet.length < 4 || packet[0] !== 0x78 || packet[1] !== 0x78) {
      return null;
    }
    return packet[3];
  }

  /**
   * Decode raw packet bytes into an authoritative DecodedPacketResult.
   */
  public async decode(rawPacket: RawNetworkPacket): Promise<DecodedPacketResult<unknown>> {
    const buffer = rawPacket.data;

    // 1. Framing check
    if (!this.matches(rawPacket)) {
      return {
        success: false,
        protocolName: this.protocolName,
        rawPacketRef: rawPacket.id,
        error: 'MALFORMED_GT012_PACKET: Buffer does not match 0x7878 ... 0x0D0A framing.'
      };
    }

    // 2. Checksum validation
    const isValidCrc = this.validateChecksum(buffer);
    if (!isValidCrc) {
      return {
        success: false,
        protocolName: this.protocolName,
        rawPacketRef: rawPacket.id,
        error: 'CRC_CHECK_FAILED: GT012 CRC-ITU validation failed. Packet rejected.'
      };
    }

    // 3. Parse packet
    try {
      const parsed = this.decodePacket(buffer);
      if (!parsed) {
        return {
          success: false,
          protocolName: this.protocolName,
          rawPacketRef: rawPacket.id,
          error: 'UNSUPPORTED_GT012_PACKET: Unknown or malformed packet structure.'
        };
      }

      const { header, payload, packetType, deviceId, requiresAck, ackData } = parsed;

      return {
        success: true,
        protocolName: this.protocolName,
        deviceId,
        packetType,
        payload: {
          ...payload,
          _gt012Header: header
        },
        rawPacketRef: rawPacket.id,
        requiresAck,
        ackData
      };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        protocolName: this.protocolName,
        rawPacketRef: rawPacket.id,
        error: `GT012_DECODE_ERROR: ${errorMsg}`
      };
    }
  }

  /**
   * Decodes a single validated GT012 packet buffer into structured components.
   */
  public decodePacket(packet: Buffer): {
    header: DecodedGT012Header;
    payload: unknown;
    packetType: 'LOGIN' | 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'STATUS' | 'UNKNOWN';
    deviceId?: string;
    requiresAck: boolean;
    ackData?: Buffer;
  } | null {
    if (packet.length < 10) return null;

    const lengthByte = packet[2];
    const protocolNumber = packet[3];
    const stopByteOffset = packet.length - 2;
    const crcOffset = stopByteOffset - 2;
    const serialOffset = crcOffset - 2;

    const serialNumber = packet.readUInt16BE(serialOffset);
    const crc = packet.readUInt16BE(crcOffset);
    const isValidCrc = GT012Crc.validate(packet);

    const header: DecodedGT012Header = {
      startBytes: [packet[0], packet[1]],
      length: lengthByte,
      protocolNumber,
      serialNumber,
      crc,
      isValidCrc,
      rawHex: packet.toString('hex').toUpperCase()
    };

    switch (protocolNumber) {
      case GT012ProtocolNumber.LOGIN_MESSAGE: {
        const payload = this.decodeLoginPacket(packet, header);
        const ackData = this.buildAcknowledgement(GT012ProtocolNumber.LOGIN_MESSAGE, serialNumber);
        return {
          header,
          payload,
          packetType: 'LOGIN',
          deviceId: payload.terminalIdentifier,
          requiresAck: true,
          ackData
        };
      }

      case GT012ProtocolNumber.STATUS_HEARTBEAT: {
        const payload = this.decodeHeartbeatPacket(packet, header);
        const ackData = this.buildAcknowledgement(GT012ProtocolNumber.STATUS_HEARTBEAT, serialNumber);
        return {
          header,
          payload,
          packetType: 'HEARTBEAT',
          requiresAck: true,
          ackData
        };
      }

      case GT012ProtocolNumber.LOCATION_DATA: {
        const payload = this.decodeLocationPacket(packet, header, serialOffset);
        return {
          header,
          payload,
          packetType: 'LOCATION',
          requiresAck: false
        };
      }

      case GT012ProtocolNumber.ALARM_DATA: {
        const payload = this.decodeAlarmPacket(packet, header, serialOffset);
        const ackData = this.buildAcknowledgement(GT012ProtocolNumber.ALARM_DATA, serialNumber);
        return {
          header,
          payload,
          packetType: 'ALARM',
          requiresAck: true,
          ackData
        };
      }

      default: {
        return {
          header,
          payload: { protocolNumber, serialNumber },
          packetType: 'UNKNOWN',
          requiresAck: false
        };
      }
    }
  }

  /**
   * 0x01: Decode Login Message
   * Extracts the 8-byte BCD terminal identifier (IMEI).
   */
  public decodeLoginPacket(packet: Buffer, header: DecodedGT012Header): DecodedGT012LoginPayload {
    const imeiBuf = packet.subarray(4, 12);
    let imeiHex = '';
    for (let i = 0; i < imeiBuf.length; i++) {
      imeiHex += imeiBuf[i].toString(16).padStart(2, '0');
    }
    const terminalIdentifier = imeiHex.startsWith('0') ? imeiHex.slice(1) : imeiHex;

    return {
      terminalIdentifier,
      imeiBcd: imeiHex,
      serialNumber: header.serialNumber
    };
  }

  /**
   * 0x13: Decode Status / Heartbeat Packet
   * Decodes terminal flags, voltage level (0-6), and GSM signal.
   */
  public decodeHeartbeatPacket(packet: Buffer, header: DecodedGT012Header): DecodedGT012HeartbeatPayload {
    const statusByte = packet[4];
    const defenseActive = (statusByte & 0x01) !== 0;
    const accHigh = (statusByte & 0x02) !== 0;
    const charging = (statusByte & 0x04) !== 0;
    const gpsTrackingOn = (statusByte & 0x40) !== 0;

    const voltageLevel = packet[5];
    const voltageMap: Record<number, number> = {
      0: 0,
      1: 15,
      2: 35,
      3: 60,
      4: 80,
      5: 95,
      6: 100
    };
    const batteryPercentage = voltageMap[voltageLevel] !== undefined ? voltageMap[voltageLevel] : 50;

    const gsmSignal = packet[6];
    let gsmSignalDbm = -113;
    if (gsmSignal >= 0 && gsmSignal <= 4) {
      const levels = [-110, -95, -85, -75, -55];
      gsmSignalDbm = levels[gsmSignal] || -85;
    } else {
      gsmSignalDbm = Math.min(-51, Math.max(-113, 2 * gsmSignal - 113));
    }

    const alarmLanguage = (packet.length >= 11 && packet[8] === 0x01) ? 'ZH' : 'EN';

    return {
      terminalStatus: {
        defenseActive,
        accHigh,
        charging,
        gpsTrackingOn
      },
      voltageLevel,
      batteryPercentage,
      gsmSignalStrength: gsmSignal,
      gsmSignalDbm,
      alarmLanguage,
      serialNumber: header.serialNumber
    };
  }

  /**
   * 0x12: Decode GPS Location Data
   * Decodes UTC timestamp, satellite count, latitude/longitude (1/1800000 scaled), speed, course, cellular info.
   */
  public decodeLocationPacket(
    packet: Buffer,
    header: DecodedGT012Header,
    serialOffset: number
  ): DecodedGT012LocationPayload {
    // Offset 4: Date/Time (YY MM DD HH MM SS)
    const year = 2000 + packet[4];
    const month = packet[5];
    const day = packet[6];
    const hour = packet[7];
    const minute = packet[8];
    const second = packet[9];
    const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second));

    // Offset 10: Satellites count
    const gpsInfoByte = packet[10];
    const satelliteCount = gpsInfoByte & 0x0f;

    // Offset 11-14: Latitude (4 bytes in 1/1800000 degrees)
    const rawLat = packet.readUInt32BE(11);
    let latitude = rawLat / 1800000.0;

    // Offset 15-18: Longitude (4 bytes in 1/1800000 degrees)
    const rawLng = packet.readUInt32BE(15);
    let longitude = rawLng / 1800000.0;

    // Offset 19: Speed in km/h
    const speedKmh = packet[19];

    // Offset 20-21: Course and Status flags
    const courseStatus = packet.readUInt16BE(20);
    const courseDegrees = courseStatus & 0x03ff;
    const isRealTime = (courseStatus & 0x2000) !== 0;
    const isGpsPositioned = (courseStatus & 0x1000) !== 0;
    const isEastLongitude = (courseStatus & 0x0800) === 0;
    const isNorthLatitude = (courseStatus & 0x0400) !== 0;

    if (!isNorthLatitude) latitude = -latitude;
    if (!isEastLongitude) longitude = -longitude;

    // Offset 22-29: Cell Info (MCC, MNC, LAC, CellID)
    let mcc = 655; // Default South Africa MCC
    let mnc = 1;
    let lac = 0;
    let cellId = 0;

    if (serialOffset >= 30) {
      mcc = packet.readUInt16BE(22);
      mnc = packet[24];
      lac = packet.readUInt16BE(25);
      cellId = (packet[27] << 16) | (packet[28] << 8) | packet[29];
    }

    return {
      timestamp,
      satelliteCount,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      speedKmh,
      courseDegrees,
      gpsValid: isGpsPositioned,
      isRealTime,
      isDifferentialGps: (courseStatus & 0x4000) !== 0,
      isWestLongitude: !isEastLongitude,
      isSouthLatitude: !isNorthLatitude,
      mcc,
      mnc,
      lac,
      cellId,
      serialNumber: header.serialNumber
    };
  }

  /**
   * 0x16: Decode Alarm Packet
   * Decodes location + alarm code (0x01 SOS, 0x04 Geofence Exit, etc.) and evaluates classification.
   */
  public decodeAlarmPacket(
    packet: Buffer,
    header: DecodedGT012Header,
    serialOffset: number
  ): DecodedGT012AlarmPayload {
    const loc = this.decodeLocationPacket(packet, header, serialOffset);

    const terminalInfoByte = packet.length > 30 ? packet[30] : 0;
    const voltageLevel = packet.length > 31 ? packet[31] : 4;
    const gsmSignal = packet.length > 32 ? packet[32] : 3;
    const alarmCode = packet.length > 33 ? packet[33] : 0x01;

    let alarmType = 'NORMAL_STATUS';
    let alarmClassification: AlarmClassification = 'ROUTINE_PING';
    let requiresIncidentEscalation = false;

    switch (alarmCode) {
      case 0x01: // SOS button pressed
        alarmType = 'SOS_PANIC';
        alarmClassification = 'SOS_PANIC';
        requiresIncidentEscalation = true;
        break;

      case 0x02: // Power cut
        alarmType = 'POWER_CUT';
        alarmClassification = 'POWER_CUT';
        break;

      case 0x03: // Vibration shock
        alarmType = 'VIBRATION_SHOCK';
        alarmClassification = 'FALL_DETECTED';
        break;

      case 0x04: // Geofence exit
        alarmType = 'GEOFENCE_EXIT';
        alarmClassification = 'GEOFENCE_EXIT';
        requiresIncidentEscalation = true;
        break;

      case 0x05: // Geofence enter
        alarmType = 'GEOFENCE_ENTER';
        alarmClassification = 'GEOFENCE_ENTER';
        break;

      case 0x06: // Overspeed
        alarmType = 'OVERSPEED';
        alarmClassification = 'SPEED_EXCEEDED';
        break;

      case 0x09: // Tamper sensor
        alarmType = 'TAMPER_SENSOR';
        alarmClassification = 'TAMPER_SENSOR';
        break;

      case 0x0a: // Low battery
        alarmType = 'LOW_BATTERY_WARNING';
        alarmClassification = 'LOW_BATTERY';
        break;

      default:
        alarmType = 'NORMAL_STATUS';
        alarmClassification = 'ROUTINE_PING';
    }

    const voltageMap: Record<number, number> = { 0: 0, 1: 15, 2: 35, 3: 60, 4: 80, 5: 95, 6: 100 };

    return {
      ...loc,
      terminalStatus: {
        defenseActive: (terminalInfoByte & 0x01) !== 0,
        accHigh: (terminalInfoByte & 0x02) !== 0,
        charging: (terminalInfoByte & 0x04) !== 0,
        gpsTrackingOn: (terminalInfoByte & 0x40) !== 0
      },
      voltageLevel,
      batteryPercentage: voltageMap[voltageLevel] || 80,
      gsmSignalDbm: -75,
      alarmCode,
      alarmType,
      alarmClassification,
      requiresIncidentEscalation
    };
  }

  /**
   * Authoritative Response Generator:
   * Builds the exact GT012 10-byte acknowledgement packet.
   * [0,1]: 0x78 0x78 | [2]: 0x05 | [3]: Proto | [4,5]: Serial BE | [6,7]: CRC BE | [8,9]: 0x0D 0x0A
   */
  public buildAcknowledgement(protocolNumber: number, serialNumber: number): Buffer {
    const response = Buffer.alloc(10);
    response[0] = 0x78;
    response[1] = 0x78;
    response[2] = 0x05;
    response[3] = protocolNumber;
    response.writeUInt16BE(serialNumber, 4);

    // CRC over length + protocol + serial (bytes 2..5)
    const crc = GT012Crc.calculate(response, 2, 4);
    response.writeUInt16BE(crc, 6);

    response[8] = 0x0d;
    response[9] = 0x0a;

    return response;
  }

  /**
   * Normalize decoded packet into a unified TelemetryEvent for ITIS.
   */
  public normalize(decoded: DecodedPacketResult<unknown>): TelemetryEvent | null {
    if (!decoded.success || !decoded.payload) {
      return null;
    }

    const payload = decoded.payload as Record<string, any>;
    const header = payload._gt012Header as DecodedGT012Header | undefined;
    const deviceId = decoded.deviceId || payload.terminalIdentifier || 'GT012_DEVICE';

    const timestamp = payload.timestamp instanceof Date ? payload.timestamp : new Date();

    const isSos = payload.alarmClassification === 'SOS_PANIC' || payload.alarmType === 'SOS_PANIC';

    return {
      id: `evt_gt012_${deviceId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      deviceId,
      imei: payload.terminalIdentifier || payload.imei || deviceId,
      protocol: this.protocolName,
      timestamp,
      latitude: typeof payload.latitude === 'number' ? payload.latitude : undefined,
      longitude: typeof payload.longitude === 'number' ? payload.longitude : undefined,
      speed: typeof payload.speedKmh === 'number' ? payload.speedKmh : undefined,
      heading: typeof payload.courseDegrees === 'number' ? payload.courseDegrees : undefined,
      accuracy: payload.gpsValid ? 4.5 : undefined,
      batteryLevel: typeof payload.batteryPercentage === 'number' ? payload.batteryPercentage : undefined,
      gsmSignal: typeof payload.gsmSignalStrength === 'number' ? payload.gsmSignalStrength : undefined,
      ignitionStatus: payload.terminalStatus?.accHigh,
      sosActive: isSos,
      alarmType: payload.alarmClassification as AlarmClassification | undefined,
      rawPacketReference: decoded.rawPacketRef,
      metadata: {
        gt012ProtocolNumber: header?.protocolNumber,
        gt012SerialNumber: header?.serialNumber,
        gt012RawHex: header?.rawHex,
        satelliteCount: payload.satelliteCount,
        mcc: payload.mcc,
        mnc: payload.mnc,
        lac: payload.lac,
        cellId: payload.cellId,
        voltageLevel: payload.voltageLevel,
        signalDbm: payload.gsmSignalDbm
      }
    };
  }

  /**
   * Optional ACK helper
   */
  public encodeAck(decoded: DecodedPacketResult<unknown>): Buffer | null {
    if (decoded.ackData) return decoded.ackData;
    const payload = decoded.payload as Record<string, any> | undefined;
    const header = payload?._gt012Header as DecodedGT012Header | undefined;
    if (header) {
      return this.buildAcknowledgement(header.protocolNumber, header.serialNumber);
    }
    return null;
  }

  /**
   * Encode downstream server command (Protocol 0x80)
   */
  public encodeCommand(commandType: string, params?: Record<string, unknown>): EncodedPacketResult {
    const commandText = (params?.commandText as string) || commandType;
    const commandBuf = Buffer.from(commandText, 'utf-8');
    const serialNumber = (params?.serialNumber as number) || 0x0001;

    // Packet: [0,1] 0x78 0x78 | [2] Length = 1(proto) + N(cmd) + 2(serial) + 2(crc) = N + 5
    const lengthByte = commandBuf.length + 5;
    const packet = Buffer.alloc(lengthByte + 5);

    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = lengthByte;
    packet[3] = GT012ProtocolNumber.SERVER_COMMAND;

    commandBuf.copy(packet, 4);

    const serialOffset = 4 + commandBuf.length;
    packet.writeUInt16BE(serialNumber, serialOffset);

    // CRC over index 2 up to serialOffset + 1
    const crc = GT012Crc.calculate(packet, 2, lengthByte - 1);
    packet.writeUInt16BE(crc, serialOffset + 2);

    packet[packet.length - 2] = 0x0d;
    packet[packet.length - 1] = 0x0a;

    return {
      success: true,
      data: packet
    };
  }
}
