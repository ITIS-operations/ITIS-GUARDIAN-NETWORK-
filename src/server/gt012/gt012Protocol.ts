/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Modular Binary Protocol Adapter & Packet Stream Parser
 */

import { GT012Crc } from './gt012Crc.js';
import {
  GT012ProtocolNumber,
  GT012ParsedPacket,
  GT012LoginPacket,
  GT012LocationPacket,
  GT012HeartbeatPacket,
  GT012AlarmPacket,
  GT012CommandPacket,
  GT012AlarmClassification,
  GT012AlarmType
} from './gt012Types.js';

export class GT012Protocol {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Push incoming raw TCP data chunk into stream buffer and parse all complete packets.
   * Handles partial TCP packets and multiple packets received in a single chunk.
   */
  public pushData(chunk: Buffer): GT012ParsedPacket[] {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    const parsedPackets: GT012ParsedPacket[] = [];

    while (this.buffer.length >= 10) {
      // Find packet start boundary: 0x78 0x78
      const startIndex = this.findStartBytes(this.buffer);
      if (startIndex === -1) {
        // No start bytes found in entire buffer, discard stale bytes except the last 1 if it might be 0x78
        const lastByte = this.buffer[this.buffer.length - 1];
        this.buffer = (lastByte === 0x78) ? Buffer.from([0x78]) : Buffer.alloc(0);
        break;
      }

      // If startIndex > 0, discard corrupt/garbage prefix bytes
      if (startIndex > 0) {
        this.buffer = this.buffer.subarray(startIndex);
      }

      if (this.buffer.length < 5) {
        // Wait for more bytes to read packet length
        break;
      }

      const lengthByte = this.buffer[2];
      const totalPacketLength = lengthByte + 5; // 2 (start) + 1 (len) + length + 2 (stop) -> wait, let's verify framing standard
      // In standard GT012:
      // [0,1]: 0x78 0x78 (Start 2 bytes)
      // [2]: Length (1 byte) = number of bytes of (Protocol No + Info Content + Info Serial No + CRC)
      // OR Length (1 byte) = number of bytes of (Protocol No + Info Content + Info Serial No) and CRC is 2 bytes after.
      // Standard Concox/GT012 format:
      // Length byte = (Protocol No 1B) + (Info content N B) + (Serial No 2B) + (CRC 2B) = N + 5 bytes.
      // Total packet bytes = 2 (start) + 1 (len) + lengthByte + 2 (stop 0x0D 0x0A) = lengthByte + 5 bytes.
      // Example: Login packet lengthByte = 0x01(proto) + 8(IMEI) + 2(serial) + 2(CRC) = 13 (0x0D).
      // Total packet size = 2 + 1 + 13 + 2 = 18 bytes.
      
      // Let's also support the alternative framing where lengthByte does not include CRC:
      // In that case total length would be lengthByte + 7 bytes.
      // We check if stop bytes (0x0D 0x0A) match at (lengthByte + 3) or (lengthByte + 5).
      
      let candidateLength = 0;
      if (
        this.buffer.length >= lengthByte + 5 &&
        this.buffer[lengthByte + 3] === 0x0d &&
        this.buffer[lengthByte + 4] === 0x0a
      ) {
        // Format A: lengthByte includes CRC (Length = 1 + N + 2 + 2)
        candidateLength = lengthByte + 5;
      } else if (
        this.buffer.length >= lengthByte + 7 &&
        this.buffer[lengthByte + 5] === 0x0d &&
        this.buffer[lengthByte + 6] === 0x0a
      ) {
        // Format B: lengthByte is purely payload (Length = 1 + N + 2)
        candidateLength = lengthByte + 7;
      } else if (this.buffer.length < lengthByte + 7) {
        // Incomplete packet in stream buffer, wait for next TCP chunk
        break;
      } else {
        // Stop bytes not found at expected offsets, search for next 0x78 0x78 to resynchronize
        this.buffer = this.buffer.subarray(2);
        continue;
      }

      const packetBuffer = this.buffer.subarray(0, candidateLength);
      const parsed = this.parseSinglePacket(packetBuffer);
      if (parsed) {
        parsedPackets.push(parsed);
      }

      // Slide window past parsed packet
      this.buffer = this.buffer.subarray(candidateLength);
    }

    return parsedPackets;
  }

  /**
   * Search for 0x78 0x78 start delimiter
   */
  private findStartBytes(buf: Buffer): number {
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i] === 0x78 && buf[i + 1] === 0x78) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse a single self-contained GT012 packet buffer
   */
  public parseSinglePacket(packet: Buffer): GT012ParsedPacket | null {
    if (packet.length < 10) return null;
    if (packet[0] !== 0x78 || packet[1] !== 0x78) return null;

    const lengthByte = packet[2];
    const protocolNumber = packet[3] as GT012ProtocolNumber;
    
    // Stop byte offset is at packet.length - 2
    const stopByteOffset = packet.length - 2;
    if (packet[stopByteOffset] !== 0x0d || packet[stopByteOffset + 1] !== 0x0a) {
      return null;
    }

    // CRC is 2 bytes before stop bytes
    const crcOffset = stopByteOffset - 2;
    const serialOffset = crcOffset - 2;
    
    const serialNumber = packet.readUInt16BE(serialOffset);
    const packetCrc = packet.readUInt16BE(crcOffset);

    // Calculate expected CRC over bytes from index 2 up to serial number end (crcOffset - 1)
    const crcCalculationLength = crcOffset - 2;
    const calculatedCrc = GT012Crc.calculate(packet, 2, crcCalculationLength);
    const isValidCrc = (calculatedCrc === packetCrc);

    const baseHeader = {
      startBytes: [packet[0], packet[1]],
      length: lengthByte,
      protocolNumber,
      serialNumber,
      crc: packetCrc,
      isValidCrc,
      rawBuffer: packet
    };

    switch (protocolNumber) {
      case GT012ProtocolNumber.LOGIN_MESSAGE:
        return this.decodeLoginPacket(packet, baseHeader);

      case GT012ProtocolNumber.LOCATION_DATA:
        return this.decodeLocationPacket(packet, baseHeader, serialOffset);

      case GT012ProtocolNumber.STATUS_HEARTBEAT:
        return this.decodeHeartbeatPacket(packet, baseHeader);

      case GT012ProtocolNumber.ALARM_DATA:
        return this.decodeAlarmPacket(packet, baseHeader, serialOffset);

      case GT012ProtocolNumber.SERVER_COMMAND:
        return this.decodeCommandPacket(packet, baseHeader, serialOffset);

      default:
        // Generic fallback for extended or proprietary protocol numbers (e.g. 0x15, 0x1A)
        return {
          ...baseHeader,
          protocolNumber
        } as any;
    }
  }

  /**
   * 0x01: Decode Login Message
   * Terminal ID / IMEI is encoded in 8 bytes (either BCD or Hex)
   */
  private decodeLoginPacket(packet: Buffer, header: any): GT012LoginPacket {
    // 8 bytes from index 4 to 11
    const imeiBuf = packet.subarray(4, 12);
    let imeiHex = '';
    for (let i = 0; i < imeiBuf.length; i++) {
      imeiHex += imeiBuf[i].toString(16).padStart(2, '0');
    }
    // Remove leading zero if 16-digit BCD represents a 15-digit IMEI
    const terminalIdentifier = imeiHex.startsWith('0') ? imeiHex.slice(1) : imeiHex;

    return {
      ...header,
      protocolNumber: GT012ProtocolNumber.LOGIN_MESSAGE,
      terminalIdentifier,
      imeiBcd: imeiHex
    };
  }

  /**
   * 0x12: Decode GPS Location Data
   */
  private decodeLocationPacket(packet: Buffer, header: any, serialOffset: number): GT012LocationPacket {
    // Offset 4: Date/Time (6 bytes: YY MM DD HH MM SS)
    const year = 2000 + packet[4];
    const month = packet[5];
    const day = packet[6];
    const hour = packet[7];
    const minute = packet[8];
    const second = packet[9];
    const timestamp = new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();

    // Offset 10: GPS Information & Satellites count
    const gpsInfoByte = packet[10];
    const satelliteCount = gpsInfoByte & 0x0f;

    // Offset 11-14: Latitude (4 bytes in 1/1800000 degrees or decimal)
    const rawLat = packet.readUInt32BE(11);
    let latitude = rawLat / (1800000 * 1.0);

    // Offset 15-18: Longitude (4 bytes)
    const rawLng = packet.readUInt32BE(15);
    let longitude = rawLng / (1800000 * 1.0);

    // Offset 19: Speed in km/h
    const speedKmh = packet[19];

    // Offset 20-21: Course and Status flags (2 bytes)
    const courseStatus = packet.readUInt16BE(20);
    const courseDegrees = courseStatus & 0x03ff; // 0-360 degrees (lowest 10 bits)
    const isRealTime = (courseStatus & 0x2000) !== 0;
    const isGpsPositioned = (courseStatus & 0x1000) !== 0;
    const isEastLongitude = (courseStatus & 0x0800) === 0;
    const isNorthLatitude = (courseStatus & 0x0400) !== 0;

    // Adjust hemisphere
    if (!isNorthLatitude) latitude = -latitude;
    if (!isEastLongitude) longitude = -longitude;

    // Offset 22-29: Cell Info (MCC 2B, MNC 1B, LAC 2B, CellID 3B) if available
    let mcc = 655; // Default RSA MCC
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
      ...header,
      protocolNumber: GT012ProtocolNumber.LOCATION_DATA,
      timestamp,
      satelliteCount,
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      speedKmh,
      courseDegrees,
      gpsValid: isGpsPositioned,
      isRealTime,
      isDifferentialGps: (courseStatus & 0x4000) !== 0,
      isPositioned: isGpsPositioned,
      isWestLongitude: !isEastLongitude,
      isSouthLatitude: !isNorthLatitude,
      mcc,
      mnc,
      lac,
      cellId
    };
  }

  /**
   * 0x13: Decode Status / Heartbeat Packet
   */
  private decodeHeartbeatPacket(packet: Buffer, header: any): GT012HeartbeatPacket {
    // Offset 4: Terminal Status (1 byte)
    const statusByte = packet[4];
    const defenseActive = (statusByte & 0x01) !== 0;
    const accHigh = (statusByte & 0x02) !== 0;
    const charging = (statusByte & 0x04) !== 0;
    const gpsTrackingOn = (statusByte & 0x40) !== 0;

    // Offset 5: Voltage level (0-6)
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

    // Offset 6: GSM Signal Strength (0-4 or CSQ 0-31)
    const gsmSignal = packet[6];
    let gsmSignalDbm = -113; // default poor
    if (gsmSignal >= 0 && gsmSignal <= 4) {
      // 0 = no signal, 4 = strong signal
      const levels = [-110, -95, -85, -75, -55];
      gsmSignalDbm = levels[gsmSignal] || -85;
    } else {
      // CSQ to dBm approximation: 2 * CSQ - 113
      gsmSignalDbm = Math.min(-51, Math.max(-113, 2 * gsmSignal - 113));
    }

    // Offset 7-8: Alarm / Language
    let alarmLanguage = 'EN';
    if (packet.length >= 11) {
      const alarmCode = packet[7];
      alarmLanguage = packet[8] === 0x01 ? 'ZH' : 'EN';
    }

    return {
      ...header,
      protocolNumber: GT012ProtocolNumber.STATUS_HEARTBEAT,
      terminalStatus: {
        defenseActive,
        accHigh,
        charging,
        gpsTrackingOn,
        alarmState: 'NORMAL'
      },
      voltageLevel,
      batteryPercentage,
      gsmSignalStrength: gsmSignal,
      gsmSignalDbm,
      alarmLanguage
    };
  }

  /**
   * 0x16: Decode Alarm Packet
   */
  private decodeAlarmPacket(packet: Buffer, header: any, serialOffset: number): GT012AlarmPacket {
    // Alarm packet contains location fields + terminal status + alarm code
    const loc = this.decodeLocationPacket(packet, header, serialOffset);
    
    // Status and alarm bytes typically follow location data
    // In standard GT012 0x16:
    // [4..9] Time, [10] Satellites, [11..14] Lat, [15..18] Lng, [19] Speed, [20..21] Course
    // [22..29] Cell info (8 bytes)
    // [30] Terminal Information
    // [31] Voltage level
    // [32] GSM Signal
    // [33] Alarm Code / Language
    const terminalInfoByte = packet.length > 30 ? packet[30] : 0;
    const voltageLevel = packet.length > 31 ? packet[31] : 4;
    const gsmSignal = packet.length > 32 ? packet[32] : 3;
    const alarmCode = packet.length > 33 ? packet[33] : 0x01; // 0x01 = SOS

    let alarmType: GT012AlarmType = 'NORMAL_STATUS';
    let alarmClassification: GT012AlarmClassification = 'DEVICE_HEALTH_ALERT';
    let requiresIncidentEscalation = false;

    // Standard GT012 Alarm codes
    switch (alarmCode) {
      case 0x01: // SOS distress button pressed
        alarmType = 'SOS_PANIC';
        alarmClassification = 'CRITICAL_EMERGENCY';
        requiresIncidentEscalation = true;
        break;

      case 0x02: // Power cut / Tracker battery disconnected
        alarmType = 'POWER_CUT';
        alarmClassification = 'SAFETY_ALERT';
        requiresIncidentEscalation = false;
        break;

      case 0x03: // Vibration shock / Impact sensor
        alarmType = 'VIBRATION_SHOCK';
        alarmClassification = 'SAFETY_ALERT';
        requiresIncidentEscalation = false;
        break;

      case 0x04: // Geofence breach (Exit safe perimeter)
        alarmType = 'GEOFENCE_EXIT';
        alarmClassification = 'EMERGENCY_CANDIDATE';
        requiresIncidentEscalation = true;
        break;

      case 0x05: // Geofence enter
        alarmType = 'GEOFENCE_ENTER';
        alarmClassification = 'DEVICE_HEALTH_ALERT';
        requiresIncidentEscalation = false;
        break;

      case 0x06: // Overspeed
        alarmType = 'OVERSPEED';
        alarmClassification = 'SAFETY_ALERT';
        requiresIncidentEscalation = false;
        break;

      case 0x09: // Tamper alert / Removal detection
        alarmType = 'TAMPER_SENSOR';
        alarmClassification = 'EMERGENCY_CANDIDATE';
        requiresIncidentEscalation = false;
        break;

      case 0x0A: // Low battery alarm
        alarmType = 'LOW_BATTERY_WARNING';
        alarmClassification = 'DEVICE_HEALTH_ALERT';
        requiresIncidentEscalation = false;
        break;

      default:
        alarmType = 'NORMAL_STATUS';
        alarmClassification = 'DEVICE_HEALTH_ALERT';
        requiresIncidentEscalation = false;
    }

    const voltageMap: Record<number, number> = { 0: 0, 1: 15, 2: 35, 3: 60, 4: 80, 5: 95, 6: 100 };

    return {
      ...header,
      protocolNumber: GT012ProtocolNumber.ALARM_DATA,
      timestamp: loc.timestamp,
      satelliteCount: loc.satelliteCount,
      latitude: loc.latitude,
      longitude: loc.longitude,
      speedKmh: loc.speedKmh,
      courseDegrees: loc.courseDegrees,
      gpsValid: loc.gpsValid,
      mcc: loc.mcc,
      mnc: loc.mnc,
      lac: loc.lac,
      cellId: loc.cellId,
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
   * 0x80: Decode Server Command
   */
  private decodeCommandPacket(packet: Buffer, header: any, serialOffset: number): GT012CommandPacket {
    const commandBuf = packet.subarray(4, serialOffset);
    return {
      ...header,
      protocolNumber: GT012ProtocolNumber.SERVER_COMMAND,
      commandContent: commandBuf.toString('utf-8')
    };
  }

  /**
   * Authoritative Response Generator:
   * Builds the exact GT012 acknowledgement packet for a given protocol number and serial number.
   * 
   * Acknowledgement Structure:
   * [0,1]: 0x78 0x78
   * [2]: 0x05 (Length = 1B protocol + 2B serial + 2B CRC = 5 bytes)
   * [3]: Protocol Number (e.g. 0x01 for Login, 0x13 for Heartbeat, 0x16 for Alarm)
   * [4,5]: Information Serial Number (Hi, Lo)
   * [6,7]: CRC-ITU (Hi, Lo)
   * [8,9]: 0x0D 0x0A
   */
  public static buildAcknowledgement(protocolNumber: GT012ProtocolNumber, serialNumber: number): Buffer {
    const response = Buffer.alloc(10);
    
    // Start Bytes
    response[0] = 0x78;
    response[1] = 0x78;
    
    // Length (5 bytes: protocol + serial + CRC)
    response[2] = 0x05;
    
    // Protocol Number
    response[3] = protocolNumber;
    
    // Serial Number (Preserved from incoming packet)
    response.writeUInt16BE(serialNumber, 4);
    
    // Calculate CRC-ITU over bytes [2..5] (4 bytes: length, protocol, serialHi, serialLo)
    const crc = GT012Crc.calculate(response, 2, 4);
    response.writeUInt16BE(crc, 6);
    
    // Stop Bytes
    response[8] = 0x0d;
    response[9] = 0x0a;
    
    return response;
  }
}
