/**
 * ITIS GUARDIAN NETWORK — PROTOCOL PROFILE ARCHITECTURE ACCEPTANCE TEST SUITE
 * 
 * Verifies:
 * TEST 1: GT012 remains functional.
 * TEST 2: Protocol detection works.
 * TEST 3: Unknown protocol safely rejected.
 * TEST 4: Invalid protocol/device combination rejected.
 * TEST 5: ACK remains protocol-specific.
 * TEST 6: Simulator compatibility preserved.
 * TEST 7: Zero authentication regression.
 */

import {
  ActiveUserSession,
  ProtocolTestSuiteResult,
  TelemetryEnvelope
} from '../../types.js';
import { protocolProfileRegistry } from './protocolRegistry.js';
import { GT012CrcCalculator } from './gt012Profile.js';
import { AsciiProtocolProfile } from './asciiProfile.js';
import { telemetryGatewayEngine } from '../telemetryGatewayEngine.js';
import { telemetrySimulationEngine } from '../telemetrySimulationEngine.js';

export class ProtocolTestSuite {
  /**
   * Helper to construct a valid GT012 location hex packet
   */
  public static buildTestGt012LocationPacket(serialNumber = 101): string {
    // 0x78 0x78 + length(0x1F=31) + protocol(0x12) + date/time(6) + gps/sat(1) + lat(4) + lng(4) + speed(1) + course(2) + mcc/mnc/lac/cell(9) + serial(2) + crc(2) + 0x0D 0x0A
    // Length: 2(header) + 1(len) + 1(proto) + 6 + 1 + 4 + 4 + 1 + 2 + 9 + 2(serial) + 2(crc) + 2(stop) = 37 bytes
    const buf = Buffer.alloc(37);
    buf[0] = 0x78;
    buf[1] = 0x78;
    buf[2] = 0x20; // length = 32
    buf[3] = 0x12; // LOCATION_DATA
    
    // Date/time: 2026-09-06 08:30:00 (YY MM DD HH MM SS)
    buf[4] = 26; buf[5] = 9; buf[6] = 6; buf[7] = 8; buf[8] = 30; buf[9] = 0;
    buf[10] = 0x99; // 9 satellites, GPS length 9

    // Lat: -25.7589 * 1800000 = 46366020 = 0x02C37F44
    // courseStatus: North/South bit. If South, bit 0x0400 is 0. If East, bit 0x0800 is 0.
    buf.writeUInt32BE(46366020, 11);
    // Lng: 28.2321 * 1800000 = 50817780 = 0x03076EF4
    buf.writeUInt32BE(50817780, 15);

    buf[19] = 25; // Speed 25 km/h
    buf.writeUInt16BE(0x00b4, 20); // heading 180 degrees, South (0x0400 is 0), East (0x0800 is 0)

    // Cell ID / MCC
    buf.writeUInt16BE(655, 22); // MCC South Africa
    buf[24] = 1; // MNC Vodacom
    buf.writeUInt16BE(1234, 25); // LAC
    buf.writeUInt32BE(5678, 27); // Cell ID

    // Serial
    buf.writeUInt16BE(serialNumber, 31);

    // CRC: bytes 2 to 32 (length 31)
    const crc = GT012CrcCalculator.calculate(buf, 2, 31);
    buf.writeUInt16BE(crc, 33);

    buf[35] = 0x0d;
    buf[36] = 0x0a;

    return buf.toString('hex').toUpperCase();
  }

  /**
   * Run the authoritative 7-test suite
   */
  public async runSuite(actor?: ActiveUserSession): Promise<ProtocolTestSuiteResult> {
    const authorizedActor: ActiveUserSession = actor || {
      id: 'usr-tech-01',
      name: 'Thabo Sithole (Hardware Lead)',
      role: 'TECHNICIAN',
      schoolId: 'sch-001',
      email: 'thabo.sithole@itis.gov.za',
      token: 'jwt-mock-tech-token'
    };

    const results: ProtocolTestSuiteResult['results'] = [];

    // =========================================================================
    // TEST 1: GT012 remains functional
    // =========================================================================
    try {
      telemetryGatewayEngine.clearDuplicateCache();
      const gt012Hex = ProtocolTestSuite.buildTestGt012LocationPacket(501);
      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: gt012Hex,
        deviceIdentifier: 'GT012-TRK-8812',
        remoteAddress: '127.0.0.1',
        receivedAt: new Date().toISOString()
      };

      const ingestion = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, authorizedActor);

      const isPass = 
        ingestion.protocol === 'GT012' &&
        ingestion.ackRequired === true &&
        Boolean(ingestion.ackPayload) &&
        ingestion.ackPayload?.startsWith('7878') === true &&
        ingestion.ackPayload?.endsWith('0D0A') === true &&
        ingestion.ackPayload?.length === 20; // 10 bytes = 20 hex chars

      results.push({
        id: 'TEST_1_GT012_FUNCTIONAL',
        name: 'TEST 1: GT012 remains functional',
        requirement: 'Preserve 100% of validated GT012 Concox binary protocol behaviour, CRC validation, and 10-byte downlink ACK.',
        expected: 'Protocol=GT012, Valid framing/CRC, 10-byte binary ACK (0x7878...0x0D0A)',
        actual: `Protocol=${ingestion.protocol}, Status=${ingestion.status}, ACK=${ingestion.ackPayload}, AckLen=${(ingestion.ackPayload || '').length / 2} bytes`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          status: ingestion.status,
          protocol: ingestion.protocol,
          packetType: ingestion.packetType,
          ackPayload: ingestion.ackPayload,
          validation: ingestion.validationResult
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_1_GT012_FUNCTIONAL',
        name: 'TEST 1: GT012 remains functional',
        requirement: 'Preserve 100% of validated GT012 Concox binary protocol behaviour.',
        expected: 'Protocol=GT012, Successful ingestion with 10-byte binary ACK',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 2: Protocol detection works
    // =========================================================================
    try {
      const gt012Hex = ProtocolTestSuite.buildTestGt012LocationPacket(502);
      const asciiPacket = '$TRK,DEV-ASCII-001,2026-09-06T08:00:00Z,-25.7589,28.2321,20,180,95,NORMAL*4F\r\n';
      const jsonPacket = JSON.stringify({
        deviceId: 'DEV-JSON-001',
        latitude: -25.7589,
        longitude: 28.2321,
        speed: 15,
        batteryPercentage: 90
      });

      const detectGt012 = protocolProfileRegistry.detectProtocol(gt012Hex);
      const detectAscii = protocolProfileRegistry.detectProtocol(asciiPacket);
      const detectJson = protocolProfileRegistry.detectProtocol(jsonPacket);

      const isPass = 
        detectGt012?.profile.protocolId === 'GT012' &&
        detectAscii?.profile.protocolId === 'ASCII' &&
        detectJson?.profile.protocolId === 'JSON';

      results.push({
        id: 'TEST_2_PROTOCOL_DETECTION',
        name: 'TEST 2: Protocol detection works',
        requirement: 'Correctly identify GT012, ASCII, and JSON profiles via packet framing and controlled detection rules.',
        expected: 'GT012 detected for hex, ASCII detected for $TRK, JSON detected for {..}',
        actual: `Hex->${detectGt012?.profile.protocolId}, ASCII->${detectAscii?.profile.protocolId}, JSON->${detectJson?.profile.protocolId}`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          gt012Match: detectGt012?.detection,
          asciiMatch: detectAscii?.detection,
          jsonMatch: detectJson?.detection
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_2_PROTOCOL_DETECTION',
        name: 'TEST 2: Protocol detection works',
        requirement: 'Detect protocols reliably via controlled rules.',
        expected: 'Profiles detected without exception',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 3: Unknown protocol safely rejected
    // =========================================================================
    try {
      telemetryGatewayEngine.clearDuplicateCache();
      const unknownGarbage = '!UNSUPPORTED_PROPRIETARY_BINARY_PROTOCOL!@#$^&*()_+XYZ1234567890';
      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: unknownGarbage,
        deviceIdentifier: 'UNKNOWN-TRK-999',
        remoteAddress: '127.0.0.1',
        receivedAt: new Date().toISOString()
      };

      const ingestion = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, authorizedActor);

      const isPass = 
        ingestion.accepted === false &&
        ingestion.status === 'REJECTED' &&
        (ingestion.diagnosticCode === 'UNKNOWN_PROTOCOL' || ingestion.diagnosticCode === 'UNSUPPORTED_PACKET') &&
        ingestion.ackRequired === false &&
        ingestion.telemetry === undefined;

      results.push({
        id: 'TEST_3_UNKNOWN_REJECTED',
        name: 'TEST 3: Unknown protocol safely rejected',
        requirement: 'Safely reject unknown protocol framing without crashing gateway, emitting controlled diagnostics and no persistence.',
        expected: 'accepted=false, status=REJECTED, diagnosticCode=UNKNOWN_PROTOCOL or UNSUPPORTED_PACKET, ackRequired=false',
        actual: `accepted=${ingestion.accepted}, status=${ingestion.status}, code=${ingestion.diagnosticCode}, ackRequired=${ingestion.ackRequired}`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          status: ingestion.status,
          diagnosticCode: ingestion.diagnosticCode,
          ackRequired: ingestion.ackRequired,
          validationResult: ingestion.validationResult
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_3_UNKNOWN_REJECTED',
        name: 'TEST 3: Unknown protocol safely rejected',
        requirement: 'Safely reject unknown protocol framing.',
        expected: 'Handled without crashing',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 4: Invalid protocol/device combination rejected
    // =========================================================================
    try {
      telemetryGatewayEngine.clearDuplicateCache();
      // 'GT012-TRK-8812' is registered in ITIS Device Registry with protocolType 'GT012'
      // Send an ASCII packet claiming this device ID
      const incompatibleAsciiPacket = '$TRK,GT012-TRK-8812,2026-09-06T08:00:00Z,-25.7589,28.2321,15,180,85,NORMAL*4F\r\n';
      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: incompatibleAsciiPacket,
        deviceIdentifier: 'GT012-TRK-8812',
        remoteAddress: '127.0.0.1',
        receivedAt: new Date().toISOString()
      };

      const ingestion = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, authorizedActor);

      const isPass = 
        ingestion.accepted === false &&
        (ingestion.diagnosticCode === 'INVALID_DEVICE_PROTOCOL_COMBINATION' || ingestion.diagnosticCode === 'UNSUPPORTED_PACKET') &&
        ingestion.status === 'REJECTED';

      results.push({
        id: 'TEST_4_INVALID_COMBINATION',
        name: 'TEST 4: Invalid protocol/device combination rejected',
        requirement: 'Reject packet when incoming protocol contradicts registered device profile configuration.',
        expected: 'accepted=false, status=REJECTED, diagnosticCode=INVALID_DEVICE_PROTOCOL_COMBINATION',
        actual: `accepted=${ingestion.accepted}, status=${ingestion.status}, code=${ingestion.diagnosticCode}`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          registeredProtocol: 'GT012',
          receivedProtocol: ingestion.protocol,
          diagnosticCode: ingestion.diagnosticCode,
          error: ingestion.error
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_4_INVALID_COMBINATION',
        name: 'TEST 4: Invalid protocol/device combination rejected',
        requirement: 'Reject incompatible protocol/device combinations.',
        expected: 'Rejected gracefully with diagnostic code',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 5: ACK remains protocol-specific
    // =========================================================================
    try {
      // 1. GT012 profile ACK
      const gt012Profile = protocolProfileRegistry.getProfile('GT012');
      const gt012Envelope = gt012Profile?.decode(ProtocolTestSuite.buildTestGt012LocationPacket(505));
      const gt012Ack = gt012Profile?.encodeAck(gt012Envelope!, ProtocolTestSuite.buildTestGt012LocationPacket(505));

      // 2. ASCII profile ACK
      const asciiProfile = protocolProfileRegistry.getProfile('ASCII');
      const asciiEnvelope = asciiProfile?.decode('$TRK,DEV-ASCII-001,2026-09-06T08:00:00Z,-25.7589,28.2321,20,180,95,NORMAL');
      const asciiAck = asciiProfile?.encodeAck(asciiEnvelope!, '$TRK,DEV-ASCII-001...');

      // 3. JSON profile ACK
      const jsonProfile = protocolProfileRegistry.getProfile('JSON');
      const jsonEnvelope = jsonProfile?.decode(JSON.stringify({ deviceId: 'DEV-JSON-001', latitude: -25.7589, longitude: 28.2321 }));
      const jsonAck = jsonProfile?.encodeAck(jsonEnvelope!, '{}');

      const isPass = 
        gt012Ack?.ackFormat === 'BINARY_HEX' &&
        gt012Ack?.ackPayload?.startsWith('7878') === true &&
        asciiAck?.ackFormat === 'ASCII' &&
        asciiAck?.ackPayload?.startsWith('*ACK,') === true &&
        !asciiAck?.ackPayload?.startsWith('7878') &&
        jsonAck?.ackFormat === 'JSON' &&
        jsonAck?.ackPayload?.includes('"status":"ACK"') === true &&
        !jsonAck?.ackPayload?.startsWith('7878');

      results.push({
        id: 'TEST_5_PROTOCOL_SPECIFIC_ACK',
        name: 'TEST 5: ACK remains protocol-specific',
        requirement: 'ACK generation must remain protocol-specific. System must never send GT012 binary ACKs to non-GT012 protocols.',
        expected: 'GT012->Binary 0x7878, ASCII->*ACK text, JSON->JSON string',
        actual: `GT012 ACK format=${gt012Ack?.ackFormat}, ASCII ACK format=${asciiAck?.ackFormat}, JSON ACK format=${jsonAck?.ackFormat}`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          gt012AckPayload: gt012Ack?.ackPayload,
          asciiAckPayload: asciiAck?.ackPayload,
          jsonAckPayload: jsonAck?.ackPayload
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_5_PROTOCOL_SPECIFIC_ACK',
        name: 'TEST 5: ACK remains protocol-specific',
        requirement: 'ACKs must be protocol specific.',
        expected: 'Correct protocol ACK formats generated',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 6: Simulator compatibility preserved
    // =========================================================================
    try {
      telemetryGatewayEngine.clearDuplicateCache();
      const simResult = await telemetrySimulationEngine.simulatePacket(
        {
          rawPacket: ProtocolTestSuite.buildTestGt012LocationPacket(506),
          targetDeviceId: 'GT012-TRK-8812',
          protocolFormat: 'AUTO',
          notes: 'Protocol test suite regression verification'
        },
        authorizedActor
      );

      const isPass = 
        simResult.status === 'SIMULATION_SUCCESS' &&
        simResult.protocolName === 'GT012' &&
        simResult.extractedLocation?.latitude !== undefined &&
        simResult.requiresAck === true &&
        simResult.ackHex?.startsWith('7878') === true;

      results.push({
        id: 'TEST_6_SIMULATOR_COMPATIBILITY',
        name: 'TEST 6: Simulator compatibility preserved',
        requirement: 'Preserve complete compatibility with existing GpsTelemetrySimulator and simulation engine.',
        expected: 'status=SIMULATION_SUCCESS, protocolName=GT012, valid coordinates extracted, requiresAck=true',
        actual: `status=${simResult.status}, protocol=${simResult.protocolName}, lat=${simResult.extractedLocation?.latitude}, ack=${simResult.ackHex?.slice(0, 8)}...`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          status: simResult.status,
          protocolName: simResult.protocolName,
          diagnosticCode: simResult.diagnosticCode,
          extractedLocation: simResult.extractedLocation,
          requiresAck: simResult.requiresAck
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_6_SIMULATOR_COMPATIBILITY',
        name: 'TEST 6: Simulator compatibility preserved',
        requirement: 'Simulator compatibility preserved.',
        expected: 'Successful simulation run',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 7: Zero authentication regression
    // =========================================================================
    try {
      const unauthorizedActor: ActiveUserSession = {
        id: 'usr-guardian-01',
        name: 'Nomsa Ndlovu',
        role: 'PARENT_GUARDIAN',
        email: 'nomsa.ndlovu@example.com',
        token: 'jwt-mock-guardian-token'
      };

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: ProtocolTestSuite.buildTestGt012LocationPacket(507),
        deviceIdentifier: 'GT012-TRK-8812',
        remoteAddress: '127.0.0.1',
        receivedAt: new Date().toISOString()
      };

      const ingestion = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, unauthorizedActor);

      const isPass = 
        ingestion.accepted === false &&
        ingestion.status === 'ACCESS_DENIED' &&
        ingestion.diagnosticCode === 'ACCESS_DENIED';

      results.push({
        id: 'TEST_7_ZERO_AUTH_REGRESSION',
        name: 'TEST 7: Zero authentication regression',
        requirement: 'Ensure non-authorized roles (e.g. GUARDIAN) cannot ingest telemetry or access internal protocol diagnostics.',
        expected: 'accepted=false, status=ACCESS_DENIED, diagnosticCode=ACCESS_DENIED',
        actual: `accepted=${ingestion.accepted}, status=${ingestion.status}, code=${ingestion.diagnosticCode}`,
        status: isPass ? 'PASS' : 'FAIL',
        evidence: {
          status: ingestion.status,
          diagnosticCode: ingestion.diagnosticCode,
          error: ingestion.error
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_7_ZERO_AUTH_REGRESSION',
        name: 'TEST 7: Zero authentication regression',
        requirement: 'Zero authentication regression.',
        expected: 'Unauthorized access strictly blocked',
        actual: `Exception: ${err.message}`,
        status: 'FAIL'
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.filter(r => r.status === 'FAIL').length;

    return {
      suiteId: `PROTO-SUITE-${Date.now()}`,
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const protocolTestSuite = new ProtocolTestSuite();
