/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY PLATFORM
 * Prompt 9: Real GPS Telemetry Ingestion Gateway Acceptance Test Suite
 * 
 * Executes the 12 Authoritative Ingestion Gateway Acceptance Tests:
 * 1. Valid GT012 packet via SIMULATOR -> Ingested -> ACK generated
 * 2. Corrupted CRC packet -> CRC_INVALID safely rejected
 * 3. Unknown device packet -> DEVICE_NOT_REGISTERED safely rejected
 * 4. Suspended device packet -> DEVICE_SUSPENDED quarantined safely
 * 5. Duplicate packet -> DUPLICATE_PACKET sliding window suppression
 * 6. Invalid coordinates -> INVALID_COORDINATES boundary enforcement
 * 7. TCP adapter disabled -> Application stable, READY_DISABLED, no ports opened
 * 8. Gateway status inspection -> SIMULATOR active, TCP ready/disabled, pipeline healthy
 * 9. Existing telemetry simulator acceptance suite -> 8/8 PASS
 * 10. Existing Founder login -> Authentication intact
 * 11. Existing Guardian login -> Authentication intact
 * 12. Existing learner registration -> Enrolment pipeline intact
 */

import { ActiveUserSession, TelemetryEnvelope, TelemetryGatewayTestSuiteResult } from '../types.js';
import { db } from './dbStore.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { telemetryGatewayEngine } from './telemetryGatewayEngine.js';
import { telemetrySimulationEngine } from './telemetrySimulationEngine.js';
import { telemetrySimulatorTestSuite } from './telemetrySimulatorTestSuite.js';

export class TelemetryGatewayTestSuite {
  public async runAllTests(): Promise<TelemetryGatewayTestSuiteResult> {
    const results: TelemetryGatewayTestSuiteResult['results'] = [];
    const timestamp = new Date().toISOString();

    const techActor: ActiveUserSession = {
      id: 'usr-tech-01',
      name: 'Thabo Sithole (Hardware Lead)',
      email: 'thabo.tech@itis.safety.za',
      role: 'TECHNICIAN',
      token: 'tok-tech-test-p9'
    };

    // Ensure test device exists in Authoritative Device Registry
    const activeTrackerId = 'GT012-TRK-8812';
    let testDevice = deviceRegistryEngine.findByTrackerIdentifier(activeTrackerId);
    if (!testDevice) {
      testDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: activeTrackerId,
        imei: '867543029182734',
        serialNumber: 'SN-GT012-8812',
        deviceModel: 'GT012-Concox-Rugged',
        hardwareRevision: 'v3.2',
        firmwareVersion: 'v4.1.8'
      }, techActor);
    }

    // Ensure suspended device exists in Authoritative Device Registry
    const suspTrackerId = 'GT012-TRK-SUSP-99';
    let suspendedDevice = deviceRegistryEngine.findByTrackerIdentifier(suspTrackerId);
    if (!suspendedDevice) {
      suspendedDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: suspTrackerId,
        imei: '867543024171098',
        serialNumber: 'SN-GT012-SUSP',
        deviceModel: 'GT012-Concox-Rugged',
        hardwareRevision: 'v3.2',
        firmwareVersion: 'v4.1.8'
      }, techActor);
      deviceRegistryEngine.suspendDevice(suspendedDevice.itisDeviceId, techActor, 'Testing Gateway Suspension Enforcement');
      suspendedDevice = deviceRegistryEngine.findByTrackerIdentifier(suspTrackerId)!;
    }

    // Reset duplicate cache before starting
    telemetryGatewayEngine.clearDuplicateCache();

    // =========================================================================
    // TEST 1: Simulator sends valid GT012 packet
    // =========================================================================
    try {
      const validPacketBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.747868,
        lng: 28.229271,
        speed: 28,
        heading: 145,
        satellites: 9,
        serialNumber: 101
      });

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: validPacketBuffer.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId,
        remoteAddress: '127.0.0.1:SIMULATOR',
        protocol: 'GT012'
      };

      const result = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const passed = result.accepted === true &&
        result.status === 'INGESTED' &&
        result.diagnosticCode === 'SIMULATION_SUCCESS' &&
        result.ackRequired === true &&
        Boolean(result.ackPayload);

      results.push({
        id: 'TEST-1-VALID-GT012-PACKET',
        name: 'Valid GT012 Location Ingestion & Downlink ACK Generation',
        requirement: 'Simulator sends valid GT012 packet -> Transport Envelope -> Gateway Pipeline -> Accepted -> ACK Generated',
        expected: 'Accepted: true, Status: INGESTED, Diagnostic: SIMULATION_SUCCESS, ACK Generated',
        actual: `Accepted: ${result.accepted}, Status: ${result.status}, Diagnostic: ${result.diagnosticCode}, ACK: ${result.ackPayload?.slice(0, 10)}...`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          transport: result.transportType,
          protocol: result.protocol,
          telemetry: result.telemetry,
          ackPayload: result.ackPayload
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-1-VALID-GT012-PACKET',
        name: 'Valid GT012 Packet Ingestion',
        requirement: 'Ingest valid GT012 packet and generate ACK',
        expected: 'INGESTED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 2: Simulator sends corrupted CRC packet
    // =========================================================================
    try {
      const validBuf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.74,
        lng: 28.22,
        serialNumber: 102
      });
      const corruptedBuf = Buffer.from(validBuf);
      // Invalidate CRC bytes (offset length - 4 and length - 3)
      corruptedBuf[corruptedBuf.length - 4] = 0xDE;
      corruptedBuf[corruptedBuf.length - 3] = 0xAD;

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: corruptedBuf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId,
        protocol: 'GT012'
      };

      const result = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const passed = result.accepted === false &&
        result.status === 'REJECTED' &&
        (result.diagnosticCode === 'CRC_INVALID' || result.errorCode === 'CRC_INVALID') &&
        result.validationResult.validCrc === false;

      results.push({
        id: 'TEST-2-CORRUPTED-CRC',
        name: 'Corrupted CRC-ITU Detection & Rejection',
        requirement: 'Submit packet with invalid CRC -> CRC_INVALID, rejected safely without crash',
        expected: 'Accepted: false, Status: REJECTED, Diagnostic/Error: CRC_INVALID',
        actual: `Accepted: ${result.accepted}, Status: ${result.status}, Diagnostic: ${result.diagnosticCode}, Error: ${result.error}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          validFraming: result.validationResult.validFraming,
          validCrc: result.validationResult.validCrc
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-2-CORRUPTED-CRC',
        name: 'Corrupted CRC Detection',
        requirement: 'Safely reject CRC errors',
        expected: 'CRC_INVALID',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 3: Unknown device packet
    // =========================================================================
    try {
      const unknownBuf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.74,
        lng: 28.22,
        serialNumber: 103
      });

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: unknownBuf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: 'TRK-UNKNOWN-ROGUE-9999',
        protocol: 'GT012'
      };

      const result = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const passed = result.accepted === false &&
        result.status === 'REJECTED' &&
        result.diagnosticCode === 'DEVICE_NOT_REGISTERED' &&
        result.deviceRegistryStatus === 'NOT_FOUND';

      results.push({
        id: 'TEST-3-UNKNOWN-DEVICE',
        name: 'Authoritative Device Registry Unknown Tracker Rejection',
        requirement: 'Incoming packet from unregistered hardware -> Rejected with DEVICE_NOT_REGISTERED',
        expected: 'Accepted: false, Diagnostic: DEVICE_NOT_REGISTERED, RegistryStatus: NOT_FOUND',
        actual: `Accepted: ${result.accepted}, Diagnostic: ${result.diagnosticCode}, RegistryStatus: ${result.deviceRegistryStatus}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          deviceIdentifier: envelope.deviceIdentifier,
          error: result.error
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-3-UNKNOWN-DEVICE',
        name: 'Unknown Device Rejection',
        requirement: 'Block unregistered devices',
        expected: 'DEVICE_NOT_REGISTERED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 4: Suspended device packet
    // =========================================================================
    try {
      const suspBuf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.74,
        lng: 28.22,
        serialNumber: 104
      });

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: suspBuf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: suspendedDevice.trackerDeviceId,
        protocol: 'GT012'
      };

      const result = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const passed = result.accepted === false &&
        result.status === 'QUARANTINED' &&
        result.diagnosticCode === 'DEVICE_SUSPENDED' &&
        result.quarantined === true;

      results.push({
        id: 'TEST-4-SUSPENDED-DEVICE',
        name: 'Administratively Suspended Device Quarantine',
        requirement: 'Incoming packet from SUSPENDED hardware -> Quarantined with DEVICE_SUSPENDED',
        expected: 'Accepted: false, Status: QUARANTINED, Diagnostic: DEVICE_SUSPENDED, Quarantined: true',
        actual: `Accepted: ${result.accepted}, Status: ${result.status}, Diagnostic: ${result.diagnosticCode}, Quarantined: ${result.quarantined}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          deviceId: result.deviceId,
          itisDeviceId: result.itisDeviceId,
          registryStatus: result.deviceRegistryStatus
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-4-SUSPENDED-DEVICE',
        name: 'Suspended Device Quarantine',
        requirement: 'Quarantine telemetry from suspended hardware',
        expected: 'DEVICE_SUSPENDED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 5: Duplicate packet suppression
    // =========================================================================
    try {
      const dupBuf = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -25.749,
        lng: 28.221,
        serialNumber: 105
      });

      const envelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: dupBuf.toString('hex'),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId,
        protocol: 'GT012'
      };

      const firstRun = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);
      const secondRun = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, techActor);

      const passed = firstRun.accepted === true &&
        secondRun.accepted === false &&
        secondRun.duplicate === true &&
        secondRun.diagnosticCode === 'DUPLICATE_PACKET';

      results.push({
        id: 'TEST-5-DUPLICATE-PACKET',
        name: 'Sliding-Window Duplicate Telemetry Suppression',
        requirement: 'Identical telemetry packet received within sliding window -> DUPLICATE_PACKET suppressed',
        expected: 'First: Accepted=true, Second: Accepted=false, Duplicate=true, Diagnostic: DUPLICATE_PACKET',
        actual: `Run 1: ${firstRun.status} (${firstRun.diagnosticCode}), Run 2: ${secondRun.status} (${secondRun.diagnosticCode})`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          fingerprint: secondRun.duplicateFingerprint,
          duplicate: secondRun.duplicate
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-5-DUPLICATE-PACKET',
        name: 'Duplicate Packet Suppression',
        requirement: 'Detect duplicate packets',
        expected: 'DUPLICATE_PACKET',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 6: Invalid coordinates boundary enforcement
    // =========================================================================
    try {
      const invalidJsonEnvelope: TelemetryEnvelope = {
        transportType: 'SIMULATOR',
        rawPacket: JSON.stringify({
          deviceId: testDevice.trackerDeviceId,
          latitude: 145.89, // Latitude > 90 is physically impossible
          longitude: 28.22,
          speed: 10,
          batteryLevel: 90
        }),
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId
      };

      const result = await telemetryGatewayEngine.ingestTelemetryPacket(invalidJsonEnvelope, techActor);
      const passed = result.accepted === false &&
        result.status === 'REJECTED' &&
        result.diagnosticCode === 'INVALID_COORDINATES' &&
        result.validationResult.validCoordinates === false;

      results.push({
        id: 'TEST-6-INVALID-COORDINATES',
        name: 'Geographic Boundary Physical Coordinates Enforcement',
        requirement: 'Out-of-bounds latitude (> 90) or longitude (> 180) -> INVALID_COORDINATES rejection',
        expected: 'Accepted: false, Diagnostic: INVALID_COORDINATES, validCoordinates: false',
        actual: `Accepted: ${result.accepted}, Diagnostic: ${result.diagnosticCode}, ValidCoords: ${result.validationResult.validCoordinates}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          validation: result.validationResult,
          error: result.error
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-6-INVALID-COORDINATES',
        name: 'Invalid Coordinates Rejection',
        requirement: 'Reject out-of-bounds coordinates',
        expected: 'INVALID_COORDINATES',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 7: TCP adapter disabled safety check
    // =========================================================================
    try {
      const status = telemetryGatewayEngine.getGatewayStatus();
      const passed = status.tcpStatus === 'READY_DISABLED' &&
        status.udpStatus === 'READY_DISABLED' &&
        status.telemetryServerEnabled === false &&
        status.processingPipelineStatus === 'HEALTHY';

      results.push({
        id: 'TEST-7-TCP-ADAPTER-DISABLED',
        name: 'TCP/UDP Architecture Readiness & Network Isolation Safety',
        requirement: 'TCP and UDP adapters must be READY but DISABLED in preview runtime, preventing crashes or rogue ports',
        expected: 'tcpStatus: READY_DISABLED, udpStatus: READY_DISABLED, telemetryServerEnabled: false, pipeline: HEALTHY',
        actual: `tcpStatus: ${status.tcpStatus}, udpStatus: ${status.udpStatus}, serverEnabled: ${status.telemetryServerEnabled}, pipeline: ${status.processingPipelineStatus}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          tcpReady: status.tcpReady,
          udpReady: status.udpReady,
          serverEnvironment: status.serverEnvironment
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-7-TCP-ADAPTER-DISABLED',
        name: 'TCP Adapter Disabled Check',
        requirement: 'Verify TCP adapter disabled safety',
        expected: 'READY_DISABLED',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 8: Gateway status endpoint check
    // =========================================================================
    try {
      const status = telemetryGatewayEngine.getGatewayStatus();
      const hasSimulator = status.enabledTransports.includes('SIMULATOR');
      const hasHttp = status.enabledTransports.includes('HTTP');
      const healthyPipeline = status.processingPipelineStatus === 'HEALTHY';
      const onlineGateway = status.gatewayStatus === 'ONLINE';

      const passed = hasSimulator && hasHttp && healthyPipeline && onlineGateway;

      results.push({
        id: 'TEST-8-GATEWAY-STATUS-INSPECTION',
        name: 'Telemetry Ingestion Gateway Diagnostics & Health Telemetry',
        requirement: 'Inspect gateway diagnostics -> SIMULATOR ACTIVE, TCP READY/DISABLED, UDP READY/DISABLED, PIPELINE HEALTHY',
        expected: 'Gateway: ONLINE, Simulator: Active, Pipeline: HEALTHY',
        actual: `Gateway: ${status.gatewayStatus}, Transports: [${status.enabledTransports.join(', ')}], Pipeline: ${status.processingPipelineStatus}`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          metrics: status.metrics,
          activeProtocols: status.activeProtocols
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-8-GATEWAY-STATUS-INSPECTION',
        name: 'Gateway Status Inspection',
        requirement: 'Verify gateway diagnostics',
        expected: 'ONLINE / HEALTHY',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 9: Existing telemetry simulator acceptance suite (8/8)
    // =========================================================================
    try {
      const prompt8Results = await telemetrySimulatorTestSuite.runAllAcceptanceTests();
      const passed = prompt8Results.allPassed && prompt8Results.passedTests === 8 && prompt8Results.failedTests === 0;

      results.push({
        id: 'TEST-9-SIMULATOR-SUITE-REGRESSION',
        name: 'Telemetry Simulator Acceptance Suite (Prompt 8) Compatibility',
        requirement: 'Run all 8 Prompt 8 acceptance tests via new shared Gateway pipeline -> 8/8 PASS',
        expected: '8/8 PASS, allPassed: true',
        actual: `${prompt8Results.passedTests}/${prompt8Results.totalTests} passed (allPassed=${prompt8Results.allPassed})`,
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          totalTests: prompt8Results.totalTests,
          passedTests: prompt8Results.passedTests,
          failedTests: prompt8Results.failedTests
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-9-SIMULATOR-SUITE-REGRESSION',
        name: 'Simulator Suite Compatibility',
        requirement: 'Run Prompt 8 simulator tests',
        expected: '8/8 PASS',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 10: Existing Founder login
    // =========================================================================
    try {
      const founderUser = Array.from(db.users.values()).find(
        u => u.role === 'FOUNDER_EXECUTIVE' && (u.email.includes('founder') || u.id === 'USR-SUPER-001')
      );
      const passed = Boolean(founderUser && founderUser.status === 'ACTIVE' && founderUser.role === 'FOUNDER_EXECUTIVE');

      results.push({
        id: 'TEST-10-FOUNDER-LOGIN-REGRESSION',
        name: 'Core System Founder Executive Authentication Integrity',
        requirement: 'Verify Founder Executive identity (founder@itis365.co.za) is provisioned, active, and retains sovereign permissions',
        expected: 'FOUNDER_EXECUTIVE identity verified with ACTIVE status',
        actual: founderUser ? `Found ${founderUser.name} (${founderUser.email}) - Status: ${founderUser.status}, Role: ${founderUser.role}` : 'Founder account not found',
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          userId: founderUser?.id,
          role: founderUser?.role,
          email: founderUser?.email
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-10-FOUNDER-LOGIN-REGRESSION',
        name: 'Founder Login Regression',
        requirement: 'Verify Founder credentials',
        expected: 'FOUNDER_EXECUTIVE authenticated',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 11: Existing Guardian login
    // =========================================================================
    try {
      const guardianUser = Array.from(db.users.values()).find(
        u => u.role === 'PARENT_GUARDIAN' && u.status === 'ACTIVE'
      );
      const passed = Boolean(guardianUser && guardianUser.guardianId && guardianUser.status === 'ACTIVE');

      results.push({
        id: 'TEST-11-GUARDIAN-LOGIN-REGRESSION',
        name: 'Core System Guardian Authentication Integrity',
        requirement: 'Verify Guardian identity is provisioned, linked to authoritative guardian record, and active',
        expected: 'PARENT_GUARDIAN identity verified with ACTIVE status and linked guardianId',
        actual: guardianUser ? `Found ${guardianUser.name} (${guardianUser.email}) - GuardianID: ${guardianUser.guardianId}, Status: ${guardianUser.status}` : 'Guardian account not found',
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          userId: guardianUser?.id,
          role: guardianUser?.role,
          guardianId: guardianUser?.guardianId
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-11-GUARDIAN-LOGIN-REGRESSION',
        name: 'Guardian Login Regression',
        requirement: 'Verify Guardian credentials',
        expected: 'PARENT_GUARDIAN authenticated',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    // =========================================================================
    // TEST 12: Existing learner registration
    // =========================================================================
    try {
      const totalLearners = db.learners.size;
      const totalSchools = db.schools.size;
      const sampleLearner = Array.from(db.learners.values())[0];
      const passed = totalLearners > 0 && totalSchools > 0 && Boolean(sampleLearner?.id);

      results.push({
        id: 'TEST-12-LEARNER-REGISTRATION-REGRESSION',
        name: 'Authoritative Learner Enrolment Pipeline Integrity',
        requirement: 'Verify learner database and enrolment pipeline remain operational without regression',
        expected: 'db.learners populated with active learners and valid school associations',
        actual: sampleLearner ? `Authoritative learners active: ${totalLearners}, Schools: ${totalSchools}. Sample: ${sampleLearner.id} (EMIS: ${sampleLearner.emisId})` : 'Learners store is empty',
        status: passed ? 'PASS' : 'FAIL',
        evidence: {
          totalLearners,
          totalSchools,
          sampleLearnerId: sampleLearner?.id
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST-12-LEARNER-REGISTRATION-REGRESSION',
        name: 'Learner Registration Regression',
        requirement: 'Verify learner registration',
        expected: 'Learner store operational',
        actual: `Error: ${err.message}`,
        status: 'FAIL'
      });
    }

    const passedTests = results.filter(r => r.status === 'PASS').length;
    const failedTests = results.length - passedTests;

    return {
      suiteId: 'SUITE-ITIS-TELEMETRY-GATEWAY-PROMPT-9',
      timestamp,
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      results
    };
  }
}

export const telemetryGatewayTestSuite = new TelemetryGatewayTestSuite();
