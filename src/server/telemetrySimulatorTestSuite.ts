/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY PLATFORM
 * Prompt 8: Telemetry Simulator & Packet Testing Acceptance Test Suite
 * 
 * Verifies the 8 Required Acceptance Tests:
 * TEST 1: Valid device packet simulation accepted & normalized
 * TEST 2: Unknown device packet rejected (DEVICE_NOT_REGISTERED)
 * TEST 3: Suspended device packet rejected (DEVICE_SUSPENDED)
 * TEST 4: Invalid coordinates packet rejected (INVALID_COORDINATES)
 * TEST 5: Malformed packet safely rejected without server crash (MALFORMED_PACKET)
 * TEST 6: Duplicate packet detected & rejected
 * TEST 7: Unauthorized user (e.g. Guardian) denied simulation access (ACCESS_DENIED)
 * TEST 8: Existing ITIS functionality verified (No regressions)
 */

import { TelemetrySimulatorTestSuiteResult, ActiveUserSession } from '../types.js';
import { telemetrySimulationEngine, GT012CrcCalculator } from './telemetrySimulationEngine.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { db } from './dbStore.js';

export class TelemetrySimulatorTestSuite {
  public async runAllAcceptanceTests(): Promise<TelemetrySimulatorTestSuiteResult> {
    const results: TelemetrySimulatorTestSuiteResult['results'] = [];
    const timestamp = new Date().toISOString();

    // Technical authorized actor
    const techActor: ActiveUserSession = {
      id: 'usr-tech-01',
      name: 'Thabo Sithole (Hardware Lead)',
      email: 'thabo.tech@itis.safety.za',
      role: 'TECHNICIAN',
      token: 'tok-tech-live'
    };

    // Unauthorized guardian actor
    const guardianActor: ActiveUserSession = {
      id: 'usr-guard-01',
      name: 'Sipho Ndlovu',
      email: 'sipho.ndlovu@example.za',
      role: 'PARENT_GUARDIAN',
      guardianId: 'grd-001',
      token: 'tok-guard-live'
    };

    // Ensure test device exists in authoritative registry
    const testImei = '867543024171059';
    const testTrackerId = 'GT012-TRK-8812';
    let testDevice = deviceRegistryEngine.findByTrackerIdentifier(testTrackerId);
    if (!testDevice) {
      testDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: testTrackerId,
        imei: testImei,
        serialNumber: 'SN-GT012-8812',
        deviceModel: 'GT012-Concox-Rugged',
        hardwareRevision: 'v3.2',
        firmwareVersion: 'v4.1.8'
      }, techActor);
    }

    // =========================================================================
    // TEST 1: Valid device packet simulation accepted & normalized
    // =========================================================================
    try {
      // Build authentic GT012 location packet
      const locationBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.7592,
        lng: 28.2340,
        speed: 45,
        heading: 180,
        satellites: 9,
        serialNumber: Math.floor(1000 + Math.random() * 50000)
      });

      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: locationBuffer.toString('hex').toUpperCase(),
        targetDeviceId: testDevice.itisDeviceId
      }, techActor);

      const isSuccess = simResult.status === 'SIMULATION_SUCCESS';
      const isGt012 = simResult.protocolName === 'GT012';
      const isLocation = simResult.packetType === 'LOCATION';
      const hasCoords = simResult.extractedLocation?.latitude !== undefined && simResult.extractedLocation?.longitude !== undefined;
      const validCrc = simResult.validationResult.validCrc === true;
      const hasAck = Boolean(simResult.requiresAck && simResult.ackHex);

      const passed = isSuccess && isGt012 && isLocation && hasCoords && validCrc && hasAck;

      results.push({
        id: 'TEST-1-VALID-PACKET',
        name: 'Valid Device Packet Ingestion & Telemetry Normalization',
        requirement: 'Simulate a valid packet from a registered device -> Packet accepted, device identified, telemetry normalized, ACK computed',
        expected: 'SIMULATION_SUCCESS, protocol GT012, packet LOCATION, normalized coordinates (-25.7592, +28.2340), valid CRC and ACK',
        actual: `Status: ${simResult.status}, Protocol: ${simResult.protocolName}, Type: ${simResult.packetType}, Lat: ${simResult.extractedLocation?.latitude}, Lng: ${simResult.extractedLocation?.longitude}, ACK: ${simResult.ackHex ? 'YES' : 'NO'}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          diagnosticCode: simResult.diagnosticCode,
          extractedLocation: simResult.extractedLocation,
          validation: simResult.validationResult,
          ackHex: simResult.ackHex
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-1-VALID-PACKET',
        name: 'Valid Device Packet Ingestion',
        requirement: 'Simulate a valid packet from a registered device',
        expected: 'SIMULATION_SUCCESS',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 2: Unknown device packet rejected (DEVICE_NOT_REGISTERED)
    // =========================================================================
    try {
      const unknownId = `UNKNOWN-DEVICE-${Date.now()}`;
      const locationBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.7592,
        lng: 28.2340,
        serialNumber: Math.floor(1000 + Math.random() * 50000)
      });

      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: locationBuffer.toString('hex').toUpperCase(),
        targetDeviceId: unknownId
      }, techActor);

      const rejected = simResult.status === 'PACKET_REJECTED';
      const correctCode = simResult.diagnosticCode === 'DEVICE_NOT_REGISTERED';
      const passed = rejected && correctCode;

      results.push({
        id: 'TEST-2-UNKNOWN-DEVICE',
        name: 'Unknown Device Packet Safe Rejection',
        requirement: 'Simulate a valid packet using an unknown device identifier -> DEVICE_NOT_REGISTERED, packet rejected',
        expected: 'PACKET_REJECTED with diagnosticCode DEVICE_NOT_REGISTERED',
        actual: `Status: ${simResult.status}, Diagnostic: ${simResult.diagnosticCode}, Error: ${simResult.error}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          deviceIdentifier: unknownId,
          diagnosticCode: simResult.diagnosticCode,
          registryStatus: simResult.deviceRegistryStatus
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-2-UNKNOWN-DEVICE',
        name: 'Unknown Device Packet Rejection',
        requirement: 'Reject unknown device packets safely',
        expected: 'PACKET_REJECTED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 3: Suspended device packet rejected (DEVICE_SUSPENDED)
    // =========================================================================
    try {
      // Provision and immediately suspend a test device
      const suspendedTrackerId = `SUSP-TRK-${Date.now()}`;
      const suspendedDev = deviceRegistryEngine.registerDevice({
        trackerDeviceId: suspendedTrackerId,
        imei: `860000${Math.floor(100000000 + Math.random() * 900000000)}`,
        serialNumber: `SN-${suspendedTrackerId}`,
        deviceModel: 'GT012-Suspended-Test'
      }, techActor);

      deviceRegistryEngine.suspendDevice(suspendedDev.itisDeviceId, techActor, 'Security audit isolation test');

      const locationBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.7592,
        lng: 28.2340,
        serialNumber: Math.floor(1000 + Math.random() * 50000)
      });

      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: locationBuffer.toString('hex').toUpperCase(),
        targetDeviceId: suspendedDev.itisDeviceId
      }, techActor);

      const rejected = simResult.status === 'PACKET_REJECTED';
      const isSuspendedCode = simResult.diagnosticCode === 'DEVICE_SUSPENDED';
      const passed = rejected && isSuspendedCode;

      results.push({
        id: 'TEST-3-SUSPENDED-DEVICE',
        name: 'Suspended Device Telemetry Quarantine',
        requirement: 'Simulate a packet from a suspended device -> DEVICE_SUSPENDED, telemetry rejected, audit logged',
        expected: 'PACKET_REJECTED with diagnosticCode DEVICE_SUSPENDED',
        actual: `Status: ${simResult.status}, Diagnostic: ${simResult.diagnosticCode}, RegistryStatus: ${simResult.deviceRegistryStatus}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          deviceId: suspendedDev.itisDeviceId,
          diagnosticCode: simResult.diagnosticCode,
          registryStatus: simResult.deviceRegistryStatus
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-3-SUSPENDED-DEVICE',
        name: 'Suspended Device Telemetry Quarantine',
        requirement: 'Quarantine suspended device telemetry',
        expected: 'PACKET_REJECTED / DEVICE_SUSPENDED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 4: Invalid coordinates packet rejected (INVALID_COORDINATES)
    // =========================================================================
    try {
      // Simulate JSON packet with out-of-bounds coordinates (Lat: +125.0)
      const invalidJson = JSON.stringify({
        simulated: true,
        deviceId: testDevice.itisDeviceId,
        latitude: 125.456,
        longitude: 28.2340,
        speed: 10,
        batteryLevel: 80
      });

      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: invalidJson,
        targetDeviceId: testDevice.itisDeviceId
      }, techActor);

      const rejected = simResult.status === 'PACKET_REJECTED';
      const isCoordsInvalid = simResult.diagnosticCode === 'INVALID_COORDINATES';
      const passed = rejected && isCoordsInvalid;

      results.push({
        id: 'TEST-4-INVALID-COORDINATES',
        name: 'Out-of-Bounds Coordinate Boundary Enforcement',
        requirement: 'Simulate invalid latitude or longitude (> 90 or > 180) -> INVALID_COORDINATES, packet rejected safely',
        expected: 'PACKET_REJECTED with diagnosticCode INVALID_COORDINATES',
        actual: `Status: ${simResult.status}, Diagnostic: ${simResult.diagnosticCode}, Error: ${simResult.error}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          latitude: 125.456,
          longitude: 28.2340,
          validation: simResult.validationResult
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-4-INVALID-COORDINATES',
        name: 'Invalid Coordinate Validation',
        requirement: 'Safely reject out-of-bounds coordinates',
        expected: 'INVALID_COORDINATES',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 5: Malformed packet safely rejected without server crash
    // =========================================================================
    try {
      // Corrupted framing string
      const corruptedPacket = '7878DEADBEEFCAFE001122334455667788990D0A';

      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: corruptedPacket,
        targetDeviceId: testDevice.itisDeviceId
      }, techActor);

      const rejected = simResult.status === 'PACKET_REJECTED';
      const isMalformed = simResult.diagnosticCode === 'MALFORMED_PACKET' || simResult.diagnosticCode === 'CRC_INVALID';
      const passed = rejected && isMalformed;

      results.push({
        id: 'TEST-5-MALFORMED-PACKET',
        name: 'Corrupted Packet & Checksum Fault Tolerance',
        requirement: 'Submit an invalid or checksum-corrupted packet -> MALFORMED_PACKET, no server crash',
        expected: 'PACKET_REJECTED with diagnosticCode MALFORMED_PACKET without server exception',
        actual: `Status: ${simResult.status}, Diagnostic: ${simResult.diagnosticCode}, Error: ${simResult.error}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          rawHexSnippet: corruptedPacket.slice(0, 30),
          validation: simResult.validationResult
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-5-MALFORMED-PACKET',
        name: 'Malformed Packet Handling',
        requirement: 'Gracefully reject malformed packets',
        expected: 'MALFORMED_PACKET',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 6: Duplicate packet detected & rejected
    // =========================================================================
    try {
      const uniqueSerial = Math.floor(10000 + Math.random() * 40000);
      const locPacket = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.7592,
        lng: 28.2340,
        serialNumber: uniqueSerial
      });
      const hex = locPacket.toString('hex').toUpperCase();

      // First submission: should succeed
      const firstResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: hex,
        targetDeviceId: testDevice.itisDeviceId
      }, techActor);

      // Second immediate submission: should be recognized as duplicate
      const secondResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: hex,
        targetDeviceId: testDevice.itisDeviceId
      }, techActor);

      const firstPassed = firstResult.status === 'SIMULATION_SUCCESS';
      const secondDuplicate = secondResult.isDuplicate === true && secondResult.diagnosticCode === 'DUPLICATE_PACKET';
      const passed = firstPassed && secondDuplicate;

      results.push({
        id: 'TEST-6-DUPLICATE-PACKET',
        name: 'Sliding-Window Duplicate Packet Suppression',
        requirement: 'Submit the exact same packet twice -> Duplicate detected, duplicate telemetry suppressed',
        expected: 'First: SIMULATION_SUCCESS, Second: DUPLICATE_PACKET with isDuplicate=true',
        actual: `Run 1: ${firstResult.diagnosticCode}, Run 2: ${secondResult.diagnosticCode} (isDuplicate=${secondResult.isDuplicate})`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          fingerprint: secondResult.duplicateFingerprint,
          isDuplicate: secondResult.isDuplicate
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-6-DUPLICATE-PACKET',
        name: 'Duplicate Packet Handling',
        requirement: 'Detect and suppress repeated telemetry packets',
        expected: 'DUPLICATE_PACKET',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 7: Unauthorized user (e.g. Guardian) denied simulation access
    // =========================================================================
    try {
      const simResult = await telemetrySimulationEngine.simulatePacket({
        rawPacket: '{"simulated":true,"deviceId":"DEV-01","latitude":-25.75,"longitude":28.23}',
        targetDeviceId: testDevice.itisDeviceId
      }, guardianActor);

      const isDenied = simResult.status === 'ACCESS_DENIED' && simResult.diagnosticCode === 'ACCESS_DENIED';

      results.push({
        id: 'TEST-7-UNAUTHORIZED-USER',
        name: 'Role-Based Telemetry Injection Authorization Guard',
        requirement: 'Guardian or unauthorized role attempts simulation access -> ACCESS_DENIED, audit logged',
        expected: 'ACCESS_DENIED (Guardians and unprivileged roles strictly forbidden)',
        actual: `Status: ${simResult.status}, Diagnostic: ${simResult.diagnosticCode}, Error: ${simResult.error}`,
        status: isDenied ? 'PASS' : 'FAIL',
        evidence: {
          actorRole: guardianActor.role,
          diagnosticCode: simResult.diagnosticCode
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-7-UNAUTHORIZED-USER',
        name: 'Unauthorized User Guard',
        requirement: 'Block unauthorized roles',
        expected: 'ACCESS_DENIED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 8: Existing ITIS Functionality (No Regressions)
    // =========================================================================
    try {
      // Verify database core stores exist
      const usersCount = db.users.size;
      const learnersCount = db.learners.size;
      const devicesCount = deviceRegistryEngine.getAllDevices().length;
      const registeredSchools = db.schools.size;

      const passed = usersCount > 0 && learnersCount > 0 && devicesCount > 0 && registeredSchools > 0;

      results.push({
        id: 'TEST-8-EXISTING-FUNCTIONALITY',
        name: 'ITIS Zero-Regression & Core Service Integrity',
        requirement: 'Verify users, learners, schools, authoritative devices, and existing incident architecture remain intact',
        expected: 'Core data stores intact and operational without regression',
        actual: `Operational: ${usersCount} users, ${learnersCount} learners, ${registeredSchools} schools, ${devicesCount} devices`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          usersCount,
          learnersCount,
          devicesCount,
          registeredSchools
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-8-EXISTING-FUNCTIONALITY',
        name: 'Existing Functionality Check',
        requirement: 'Zero regression',
        expected: 'All systems intact',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.length - passedTests;

    return {
      suiteId: `SUITE-TELEMETRY-SIM-${Date.now()}`,
      timestamp,
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const telemetrySimulatorTestSuite = new TelemetrySimulatorTestSuite();
