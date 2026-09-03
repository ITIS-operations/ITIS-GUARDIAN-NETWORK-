/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY SERVER
 * GT012 Official Hardware Tracker Protocol Acceptance & Fixture Tests
 */

import { TrackerProtocolAdapter, GT012ProtocolNumber } from '../src/protocol/trackerProtocolAdapter.js';
import { GT012Crc } from '../src/protocol/gt012Crc.js';
import { RawNetworkPacket } from '../src/types/packet.js';

export class GT012TestHelper {
  public static generateLoginPacket(imei = '867543029182734', serialNumber = 0x0001): Buffer {
    const paddedImei = imei.padStart(16, '0');
    const packet = Buffer.alloc(18);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x0d;
    packet[3] = GT012ProtocolNumber.LOGIN_MESSAGE;

    for (let i = 0; i < 8; i++) {
      const byteHex = paddedImei.slice(i * 2, i * 2 + 2);
      packet[4 + i] = parseInt(byteHex, 16) || 0;
    }

    packet.writeUInt16BE(serialNumber, 12);
    const crc = GT012Crc.calculate(packet, 2, 12);
    packet.writeUInt16BE(crc, 14);
    packet[16] = 0x0d;
    packet[17] = 0x0a;
    return packet;
  }

  public static generateHeartbeatPacket(options: {
    voltageLevel?: number;
    gsmSignal?: number;
    serialNumber?: number;
  } = {}): Buffer {
    const { voltageLevel = 5, gsmSignal = 4, serialNumber = 0x0002 } = options;
    const packet = Buffer.alloc(15);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x0a;
    packet[3] = GT012ProtocolNumber.STATUS_HEARTBEAT;
    packet[4] = 0x47; // GPS tracking on, defense active, acc high, charging
    packet[5] = voltageLevel;
    packet[6] = gsmSignal;
    packet[7] = 0x00;
    packet[8] = 0x02; // English
    packet.writeUInt16BE(serialNumber, 9);
    const crc = GT012Crc.calculate(packet, 2, 9);
    packet.writeUInt16BE(crc, 11);
    packet[13] = 0x0d;
    packet[14] = 0x0a;
    return packet;
  }

  public static generateLocationPacket(options: {
    latitude?: number;
    longitude?: number;
    speedKmh?: number;
    courseDegrees?: number;
    serialNumber?: number;
    timestamp?: Date;
  } = {}): Buffer {
    const {
      latitude = -25.7589,
      longitude = 28.2321,
      speedKmh = 14,
      courseDegrees = 85,
      serialNumber = 0x0003,
      timestamp = new Date(Date.UTC(2026, 4, 15, 10, 30, 0))
    } = options;

    const packet = Buffer.alloc(36);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x1f;
    packet[3] = GT012ProtocolNumber.LOCATION_DATA;

    packet[4] = timestamp.getUTCFullYear() % 100;
    packet[5] = timestamp.getUTCMonth() + 1;
    packet[6] = timestamp.getUTCDate();
    packet[7] = timestamp.getUTCHours();
    packet[8] = timestamp.getUTCMinutes();
    packet[9] = timestamp.getUTCSeconds();

    packet[10] = (0x0c << 4) | (11 & 0x0f); // 11 satellites

    const latScaled = Math.round(Math.abs(latitude) * 1800000);
    const lngScaled = Math.round(Math.abs(longitude) * 1800000);

    packet.writeUInt32BE(latScaled, 11);
    packet.writeUInt32BE(lngScaled, 15);
    packet[19] = speedKmh;

    let courseStatus = (courseDegrees & 0x03ff) | 0x2000 | 0x1000;
    if (longitude < 0) courseStatus |= 0x0800; // West
    if (latitude >= 0) courseStatus |= 0x0400; // North (0 = South)
    packet.writeUInt16BE(courseStatus, 20);

    // Cell Info (MCC 655, MNC 01, LAC 0x1234, CellId 0x004321)
    packet.writeUInt16BE(655, 22);
    packet[24] = 0x01;
    packet.writeUInt16BE(0x1234, 25);
    packet[27] = 0x00;
    packet[28] = 0x43;
    packet[29] = 0x21;

    packet.writeUInt16BE(serialNumber, 30);
    const crc = GT012Crc.calculate(packet, 2, 30);
    packet.writeUInt16BE(crc, 32);
    packet[34] = 0x0d;
    packet[35] = 0x0a;
    return packet;
  }

  public static generateAlarmPacket(options: {
    alarmCode?: number;
    latitude?: number;
    longitude?: number;
    serialNumber?: number;
  } = {}): Buffer {
    const {
      alarmCode = 0x01,
      latitude = -25.7589,
      longitude = 28.2321,
      serialNumber = 0x0004
    } = options;

    const baseLoc = this.generateLocationPacket({ latitude, longitude, serialNumber });
    const packet = Buffer.alloc(40);
    packet[0] = 0x78;
    packet[1] = 0x78;
    packet[2] = 0x23;
    packet[3] = GT012ProtocolNumber.ALARM_DATA;

    baseLoc.copy(packet, 4, 4, 30);

    packet[30] = 0x47; // Terminal status
    packet[31] = 0x05; // Voltage level 5 (95%)
    packet[32] = 0x04; // GSM signal 4 (strong)
    packet[33] = alarmCode;

    packet.writeUInt16BE(serialNumber, 34);
    const crc = GT012Crc.calculate(packet, 2, 34);
    packet.writeUInt16BE(crc, 36);
    packet[38] = 0x0d;
    packet[39] = 0x0a;
    return packet;
  }
}

export async function testGT012TrackerProtocolSuite(): Promise<boolean> {
  console.log('\n======================================================');
  console.log('  RUNNING GT012 TRACKER PROTOCOL ACCEPTANCE TEST SUITE');
  console.log('======================================================');
  let passed = true;
  const adapter = new TrackerProtocolAdapter();

  // Test 1: Device login packet decoding
  {
    const rawLogin = GT012TestHelper.generateLoginPacket('867543029182734', 0x0101);
    const netPacket: RawNetworkPacket = {
      id: 'pkt_login',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: rawLogin,
      receivedAt: new Date()
    };

    const matches = adapter.matches(netPacket);
    const decoded = await adapter.decode(netPacket);
    const payload = decoded.payload as any;

    if (
      matches &&
      decoded.success &&
      decoded.packetType === 'LOGIN' &&
      payload.terminalIdentifier === '867543029182734' &&
      decoded.requiresAck === true &&
      decoded.ackData !== undefined
    ) {
      console.log('✓ Test 1: Device login packet parsed & IMEI extracted successfully');
    } else {
      console.error('✗ Test 1 Failed: Login packet parsing failed', decoded);
      passed = false;
    }
  }

  // Test 2: GPS location packet decoding
  {
    const rawLoc = GT012TestHelper.generateLocationPacket({
      latitude: -25.7589,
      longitude: 28.2321,
      speedKmh: 45,
      courseDegrees: 180,
      serialNumber: 0x0202
    });
    const netPacket: RawNetworkPacket = {
      id: 'pkt_loc',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: rawLoc,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    const payload = decoded.payload as any;

    if (
      decoded.success &&
      decoded.packetType === 'LOCATION' &&
      Math.abs(payload.latitude - (-25.7589)) < 0.001 &&
      Math.abs(payload.longitude - 28.2321) < 0.001 &&
      payload.speedKmh === 45 &&
      payload.courseDegrees === 180 &&
      payload.gpsValid === true
    ) {
      console.log('✓ Test 2: GPS location coordinates and telemetry decoded accurately');
    } else {
      console.error('✗ Test 2 Failed: GPS location decoding mismatch', decoded);
      passed = false;
    }
  }

  // Test 3: Heartbeat packet decoding
  {
    const rawHb = GT012TestHelper.generateHeartbeatPacket({ voltageLevel: 5, gsmSignal: 4, serialNumber: 0x0303 });
    const netPacket: RawNetworkPacket = {
      id: 'pkt_hb',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: rawHb,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    const payload = decoded.payload as any;

    if (
      decoded.success &&
      decoded.packetType === 'HEARTBEAT' &&
      payload.batteryPercentage === 95 &&
      payload.gsmSignalDbm >= -75 &&
      decoded.requiresAck === true
    ) {
      console.log('✓ Test 3: Heartbeat packet decoded with voltage & signal conversion');
    } else {
      console.error('✗ Test 3 Failed: Heartbeat decoding failed', decoded);
      passed = false;
    }
  }

  // Test 4: SOS Panic Alarm packet decoding
  {
    const rawSos = GT012TestHelper.generateAlarmPacket({ alarmCode: 0x01, serialNumber: 0x0404 });
    const netPacket: RawNetworkPacket = {
      id: 'pkt_sos',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: rawSos,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    const payload = decoded.payload as any;

    if (
      decoded.success &&
      decoded.packetType === 'ALARM' &&
      payload.alarmType === 'SOS_PANIC' &&
      payload.alarmClassification === 'SOS_PANIC' &&
      payload.requiresIncidentEscalation === true
    ) {
      console.log('✓ Test 4: SOS Panic alarm decoded & flagged for incident escalation');
    } else {
      console.error('✗ Test 4 Failed: SOS Alarm decoding failed', decoded);
      passed = false;
    }
  }

  // Test 5: Distinct Alarm types decoding
  {
    const geofenceAlarm = GT012TestHelper.generateAlarmPacket({ alarmCode: 0x04 });
    const lowBatAlarm = GT012TestHelper.generateAlarmPacket({ alarmCode: 0x0a });
    const powerCutAlarm = GT012TestHelper.generateAlarmPacket({ alarmCode: 0x02 });

    const decGeo = await adapter.decode({ id: 'p1', transport: 'TCP', remoteAddress: '127.0.0.1', remotePort: 1, data: geofenceAlarm, receivedAt: new Date() });
    const decBat = await adapter.decode({ id: 'p2', transport: 'TCP', remoteAddress: '127.0.0.1', remotePort: 1, data: lowBatAlarm, receivedAt: new Date() });
    const decPwr = await adapter.decode({ id: 'p3', transport: 'TCP', remoteAddress: '127.0.0.1', remotePort: 1, data: powerCutAlarm, receivedAt: new Date() });

    if (
      (decGeo.payload as any).alarmType === 'GEOFENCE_EXIT' &&
      (decBat.payload as any).alarmType === 'LOW_BATTERY_WARNING' &&
      (decPwr.payload as any).alarmType === 'POWER_CUT'
    ) {
      console.log('✓ Test 5: Multiple alarm codes (Geofence, Low Battery, Power Cut) classified accurately');
    } else {
      console.error('✗ Test 5 Failed: Alarm classification mismatch');
      passed = false;
    }
  }

  // Test 6: Invalid checksum rejection
  {
    const validPacket = GT012TestHelper.generateHeartbeatPacket();
    const corruptPacket = Buffer.from(validPacket);
    // Corrupt CRC bytes
    corruptPacket[corruptPacket.length - 4] ^= 0xff;

    const netPacket: RawNetworkPacket = {
      id: 'pkt_corrupt',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: corruptPacket,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    if (!decoded.success && decoded.error?.includes('CRC')) {
      console.log('✓ Test 6: Corrupted CRC checksum safely rejected');
    } else {
      console.error('✗ Test 6 Failed: Corrupted packet was not rejected', decoded);
      passed = false;
    }
  }

  // Test 7: Malformed / truncated packet rejection
  {
    const truncated = Buffer.from([0x78, 0x78, 0x05, 0x01]);
    const netPacket: RawNetworkPacket = {
      id: 'pkt_trunc',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: truncated,
      receivedAt: new Date()
    };

    const matches = adapter.matches(netPacket);
    const decoded = await adapter.decode(netPacket);

    if (!matches && !decoded.success) {
      console.log('✓ Test 7: Truncated malformed packet rejected before decoding');
    } else {
      console.error('✗ Test 7 Failed: Malformed packet accepted', decoded);
      passed = false;
    }
  }

  // Test 8: Unknown packet type handling
  {
    const unknownBuffer = Buffer.alloc(12);
    unknownBuffer[0] = 0x78;
    unknownBuffer[1] = 0x78;
    unknownBuffer[2] = 0x07;
    unknownBuffer[3] = 0x99; // Unknown protocol number
    unknownBuffer.writeUInt16BE(0x0001, 4); // Dummy data
    unknownBuffer.writeUInt16BE(0x1234, 6); // Serial
    const crc = GT012Crc.calculate(unknownBuffer, 2, 6);
    unknownBuffer.writeUInt16BE(crc, 8);
    unknownBuffer[10] = 0x0d;
    unknownBuffer[11] = 0x0a;

    const netPacket: RawNetworkPacket = {
      id: 'pkt_unknown',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: unknownBuffer,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    if (decoded.success && decoded.packetType === 'UNKNOWN') {
      console.log('✓ Test 8: Unknown protocol number handled cleanly without crash');
    } else {
      console.error('✗ Test 8 Failed: Unknown protocol number caused unexpected error', decoded);
      passed = false;
    }
  }

  // Test 9: Acknowledgement generation
  {
    const serial = 0x0555;
    const ack = adapter.buildAcknowledgement(GT012ProtocolNumber.LOGIN_MESSAGE, serial);

    const hasStart = ack[0] === 0x78 && ack[1] === 0x78;
    const hasLen = ack[2] === 0x05;
    const hasProto = ack[3] === 0x01;
    const hasSerial = ack.readUInt16BE(4) === serial;
    const hasStop = ack[8] === 0x0d && ack[9] === 0x0a;
    const validCrc = GT012Crc.validate(ack);

    if (ack.length === 10 && hasStart && hasLen && hasProto && hasSerial && hasStop && validCrc) {
      console.log('✓ Test 9: Standard 10-byte ACK generated with valid CRC-ITU and preserved serial number');
    } else {
      console.error('✗ Test 9 Failed: ACK generation mismatch', ack);
      passed = false;
    }
  }

  // Test 10: Normalization to ITIS TelemetryEvent
  {
    const rawLoc = GT012TestHelper.generateLocationPacket({ latitude: -25.7589, longitude: 28.2321, serialNumber: 0x0606 });
    const netPacket: RawNetworkPacket = {
      id: 'pkt_norm',
      transport: 'TCP',
      remoteAddress: '192.168.1.100',
      remotePort: 54321,
      data: rawLoc,
      receivedAt: new Date()
    };

    const decoded = await adapter.decode(netPacket);
    decoded.deviceId = '867543029182734';
    const event = adapter.normalize(decoded);

    if (
      event &&
      event.deviceId === '867543029182734' &&
      event.protocol === 'GT012' &&
      event.latitude === -25.7589 &&
      event.longitude === 28.2321 &&
      event.rawPacketReference === 'pkt_norm' &&
      event.metadata?.gt012ProtocolNumber === 0x12
    ) {
      console.log('✓ Test 10: TelemetryEvent normalized with complete diagnostic metadata');
    } else {
      console.error('✗ Test 10 Failed: Normalization error', event);
      passed = false;
    }
  }

  return passed;
}
