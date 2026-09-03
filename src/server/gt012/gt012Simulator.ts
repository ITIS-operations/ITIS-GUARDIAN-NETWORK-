/**
 * ITIS GUARDIAN NETWORK — GT012 GPS TRACKER COMMUNICATION PROTOCOL
 * Phase 11: Development & Acceptance Test Packet Simulator
 * 
 * Generates bit-accurate binary packets for test fixtures without touching live hardware or creating fake learners.
 */

import { GT012Crc } from './gt012Crc.js';
import { GT012ProtocolNumber } from './gt012Types.js';

export class GT012Simulator {
  /**
   * Generates a valid GT012 Login Packet (0x01)
   * @param imei 15-digit decimal string, e.g. "867543029182734"
   * @param serialNumber 2-byte serial, default 0x0001
   */
  public static generateLoginPacket(imei = '867543029182734', serialNumber = 0x0001): Buffer {
    // Standard GT012 Login packet:
    // [0,1]: 0x78 0x78
    // [2]: Length = 0x0D (13 bytes: 1B proto + 8B IMEI + 2B serial + 2B CRC)
    // [3]: 0x01
    // [4..11]: 8 bytes BCD of IMEI
    // [12..13]: Serial Number
    // [14..15]: CRC-ITU
    // [16..17]: 0x0D 0x0A
    const paddedImei = imei.padStart(16, '0');
    const packet = Buffer.alloc(18);

    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x0d; // Length: 13 bytes
    packet[3] = GT012ProtocolNumber.LOGIN_MESSAGE;

    // Encode 16-character hex/BCD into 8 bytes
    for (let i = 0; i < 8; i++) {
      const byteHex = paddedImei.slice(i * 2, i * 2 + 2);
      packet[4 + i] = parseInt(byteHex, 16) || 0;
    }

    packet.writeUInt16BE(serialNumber, 12);

    // Calculate CRC over bytes [2..13] (12 bytes)
    const crc = GT012Crc.calculate(packet, 2, 12);
    packet.writeUInt16BE(crc, 14);

    packet[16] = 0x0d;
    packet[17] = 0x0a;

    return packet;
  }

  /**
   * Generates a valid GT012 Heartbeat / Status Packet (0x13)
   */
  public static generateHeartbeatPacket(
    options: {
      voltageLevel?: number; // 0-6
      gsmSignal?: number; // 0-4
      serialNumber?: number;
      defenseActive?: boolean;
      accHigh?: boolean;
      charging?: boolean;
    } = {}
  ): Buffer {
    const {
      voltageLevel = 5,
      gsmSignal = 4,
      serialNumber = 0x0002,
      defenseActive = true,
      accHigh = true,
      charging = false
    } = options;

    // [0,1]: 0x78 0x78
    // [2]: Length = 0x0A (10 bytes: 1B proto + 5B info + 2B serial + 2B CRC)
    // [3]: 0x13
    // [4]: Terminal Info (Defense, ACC, Charging, GPS)
    // [5]: Voltage Level (0-6)
    // [6]: GSM Signal Strength (0-4)
    // [7]: Alarm / Status Code (0x00)
    // [8]: Language Code (0x02 = English)
    // [9..10]: Serial Number
    // [11..12]: CRC
    // [13..14]: 0x0D 0x0A
    const packet = Buffer.alloc(15);

    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x0a; // Length = 10
    packet[3] = GT012ProtocolNumber.STATUS_HEARTBEAT;

    let terminalInfo = 0x40; // GPS tracking on
    if (defenseActive) terminalInfo |= 0x01;
    if (accHigh) terminalInfo |= 0x02;
    if (charging) terminalInfo |= 0x04;
    packet[4] = terminalInfo;

    packet[5] = voltageLevel;
    packet[6] = gsmSignal;
    packet[7] = 0x00; // Normal status
    packet[8] = 0x02; // English

    packet.writeUInt16BE(serialNumber, 9);

    // CRC over bytes [2..10] (9 bytes)
    const crc = GT012Crc.calculate(packet, 2, 9);
    packet.writeUInt16BE(crc, 11);

    packet[13] = 0x0d;
    packet[14] = 0x0a;

    return packet;
  }

  /**
   * Generates a valid GT012 Location Packet (0x12)
   */
  public static generateLocationPacket(
    options: {
      latitude?: number;
      longitude?: number;
      speedKmh?: number;
      courseDegrees?: number;
      satelliteCount?: number;
      serialNumber?: number;
      timestamp?: Date;
    } = {}
  ): Buffer {
    const {
      latitude = -25.7589, // South Africa coordinates
      longitude = 28.2321,
      speedKmh = 14,
      courseDegrees = 85,
      satelliteCount = 11,
      serialNumber = 0x0003,
      timestamp = new Date()
    } = options;

    // [0,1]: 0x78 0x78
    // [2]: Length = 0x1F (31 bytes: 1B proto + 6B time + 1B sat + 4B lat + 4B lng + 1B spd + 2B course + 8B cell + 2B serial + 2B CRC)
    // [3]: 0x12
    // [4..9]: Date/Time (YY MM DD HH MM SS)
    // [10]: GPS Info (Length/Satellites)
    // [11..14]: Latitude (Uint32)
    // [15..18]: Longitude (Uint32)
    // [19]: Speed
    // [20..21]: Course / Status Flags
    // [22..29]: Cell info (MCC, MNC, LAC, Cell ID)
    // [30..31]: Serial Number
    // [32..33]: CRC
    // [34..35]: 0x0D 0x0A
    const packet = Buffer.alloc(36);

    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x1f; // Length = 31
    packet[3] = GT012ProtocolNumber.LOCATION_DATA;

    const yy = timestamp.getUTCFullYear() % 100;
    const mm = timestamp.getUTCMonth() + 1;
    const dd = timestamp.getUTCDate();
    const hh = timestamp.getUTCHours();
    const min = timestamp.getUTCMinutes();
    const ss = timestamp.getUTCSeconds();

    packet[4] = yy;
    packet[5] = mm;
    packet[6] = dd;
    packet[7] = hh;
    packet[8] = min;
    packet[9] = ss;

    packet[10] = (0x0c << 4) | (satelliteCount & 0x0f); // 12 GPS info length, sat count

    // Lat & Lng in 1/1800000 degrees
    const latScaled = Math.round(Math.abs(latitude) * 1800000);
    const lngScaled = Math.round(Math.abs(longitude) * 1800000);

    packet.writeUInt32BE(latScaled, 11);
    packet.writeUInt32BE(lngScaled, 15);

    packet[19] = speedKmh;

    // Course status: Real-time (0x2000), Positioned (0x1000), East/West (0x0800), North/South (0x0400), Course (10 bits)
    let courseStatus = (courseDegrees & 0x03ff) | 0x2000 | 0x1000;
    if (longitude < 0) courseStatus |= 0x0800; // West
    if (latitude >= 0) courseStatus |= 0x0400; // North (default 0 is South)
    packet.writeUInt16BE(courseStatus, 20);

    // Cell info (RSA MCC 655, Vodacom MNC 01)
    packet.writeUInt16BE(655, 22);
    packet[24] = 0x01;
    packet.writeUInt16BE(0x1234, 25); // LAC
    packet[27] = 0x00; // Cell ID (3 bytes)
    packet[28] = 0x43;
    packet[29] = 0x21;

    packet.writeUInt16BE(serialNumber, 30);

    // CRC over bytes [2..31] (30 bytes)
    const crc = GT012Crc.calculate(packet, 2, 30);
    packet.writeUInt16BE(crc, 32);

    packet[34] = 0x0d;
    packet[35] = 0x0a;

    return packet;
  }

  /**
   * Generates a valid GT012 Alarm Packet (0x16)
   */
  public static generateAlarmPacket(
    options: {
      alarmCode?: number; // 0x01=SOS, 0x04=Geofence Exit, 0x0A=Low Battery
      latitude?: number;
      longitude?: number;
      serialNumber?: number;
    } = {}
  ): Buffer {
    const {
      alarmCode = 0x01, // Default SOS Panic
      latitude = -25.7589,
      longitude = 28.2321,
      serialNumber = 0x0004
    } = options;

    const baseLoc = this.generateLocationPacket({ latitude, longitude, serialNumber });
    
    // Convert to Alarm format (0x16): add terminal info, voltage, signal, alarm code
    const packet = Buffer.alloc(40);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x23; // Length = 35 bytes
    packet[3] = GT012ProtocolNumber.ALARM_DATA;

    // Copy DateTime + GPS from location packet (bytes 4..29)
    baseLoc.copy(packet, 4, 4, 30);

    // Append alarm extra bytes
    packet[30] = 0x47; // Terminal info: Armed, ACC High, Charging
    packet[31] = 0x05; // Voltage level 5 (85%)
    packet[32] = 0x04; // GSM signal 4 (strong)
    packet[33] = alarmCode; // Alarm Code (e.g. 0x01 = SOS)

    packet.writeUInt16BE(serialNumber, 34);

    // CRC over bytes [2..35] (34 bytes)
    const crc = GT012Crc.calculate(packet, 2, 34);
    packet.writeUInt16BE(crc, 36);

    packet[38] = 0x0d;
    packet[39] = 0x0a;

    return packet;
  }

  /**
   * Generates an intentionally invalid CRC packet for security rejection tests
   */
  public static generateCorruptCrcPacket(validPacket: Buffer): Buffer {
    const corrupt = Buffer.from(validPacket);
    const crcOffset = corrupt.length - 4;
    // Invert the CRC bytes
    corrupt[crcOffset] = corrupt[crcOffset] ^ 0xff;
    corrupt[crcOffset + 1] = corrupt[crcOffset + 1] ^ 0xff;
    return corrupt;
  }
}
