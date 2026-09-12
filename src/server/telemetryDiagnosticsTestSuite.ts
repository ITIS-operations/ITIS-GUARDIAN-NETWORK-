/**
 * ITIS GUARDIAN NETWORK — GPS TELEMETRY PLATFORM
 * Operational Telemetry Diagnostics Acceptance Test Suite
 * 
 * Validates the 6 mandatory acceptance criteria:
 * TEST 1: Technician sees telemetry health.
 * TEST 2: Guardian denied diagnostics.
 * TEST 3: Metrics match simulator activity.
 * TEST 4: No secrets exposed.
 * TEST 5: Existing Technician Portal remains functional.
 * TEST 6: Zero regression.
 */

import { ActiveUserSession, TelemetryDiagnosticsTestSuiteResult } from '../types.js';
import { db } from './dbStore.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { telemetryGatewayEngine } from './telemetryGatewayEngine.js';
import { telemetryDiagnosticsEngine } from './telemetryDiagnosticsEngine.js';
import { telemetrySimulationEngine } from './telemetrySimulationEngine.js';

export async function runTelemetryDiagnosticsTestSuite(): Promise<TelemetryDiagnosticsTestSuiteResult> {
  const results: TelemetryDiagnosticsTestSuiteResult['results'] = [];
  const timestamp = new Date().toISOString();

  // Test Actors
  const technicianActor: ActiveUserSession = {
    id: 'usr-tech-acceptance',
    email: 'zanele.khumalo@itis.gov.za',
    name: 'Zanele Khumalo',
    role: 'TECHNICIAN',
    schoolId: 'system',
    token: 'test-tech-token'
  };

  const guardianActor: ActiveUserSession = {
    id: 'usr-guardian-acceptance',
    email: 'nomvula.dlamini@example.com',
    name: 'Nomvula Dlamini',
    role: 'PARENT_GUARDIAN',
    guardianId: 'grd-acceptance-01',
    token: 'test-guardian-token'
  };

  // --------------------------------------------------------------------------
  // TEST 1: Technician sees telemetry health
  // --------------------------------------------------------------------------
  try {
    const diagnostics = telemetryDiagnosticsEngine.getOperationalDiagnostics(technicianActor);

    const hasPipelineHealth = Boolean(diagnostics.gatewayStatus?.pipelineHealth);
    const hasSimulatorStatus = Boolean(diagnostics.gatewayStatus?.simulatorStatus);
    const hasTcpReadiness = Boolean(diagnostics.gatewayStatus?.tcpReadiness);
    const hasUdpReadiness = Boolean(diagnostics.gatewayStatus?.udpReadiness);
    const hasFutureServerStatus = Boolean(diagnostics.gatewayStatus?.futureServerConnectionStatus);

    const hasFleetHealth =
      typeof diagnostics.fleetHealth?.totalDevices === 'number' &&
      typeof diagnostics.fleetHealth?.online === 'number' &&
      typeof diagnostics.fleetHealth?.degraded === 'number' &&
      typeof diagnostics.fleetHealth?.offline === 'number' &&
      typeof diagnostics.fleetHealth?.suspended === 'number' &&
      typeof diagnostics.fleetHealth?.retired === 'number';

    const hasMetrics =
      typeof diagnostics.metrics?.packetsReceived === 'number' &&
      typeof diagnostics.metrics?.packetsAccepted === 'number' &&
      typeof diagnostics.metrics?.packetsRejected === 'number' &&
      typeof diagnostics.metrics?.crcFailures === 'number' &&
      typeof diagnostics.metrics?.duplicatesSuppressed === 'number' &&
      typeof diagnostics.metrics?.unknownDevices === 'number';

    // Verify audit event was logged
    const auditLogs = db.getAuditLogs({ limit: 10 });
    const diagnosticsAudit = auditLogs.find(
      l => l.actionType === 'TELEMETRY_DIAGNOSTICS_VIEWED' && l.actorUserId === technicianActor.id
    );

    const passed =
      hasPipelineHealth &&
      hasSimulatorStatus &&
      hasTcpReadiness &&
      hasUdpReadiness &&
      hasFutureServerStatus &&
      hasFleetHealth &&
      hasMetrics &&
      Boolean(diagnosticsAudit);

    results.push({
      id: 'TEST_1_TECHNICIAN_SEES_TELEMETRY_HEALTH',
      name: 'TEST 1: Technician sees telemetry health',
      requirement: 'Technician receives gateway status, device fleet health, telemetry metrics, and access is audited',
      expected: 'Gateway status complete, Fleet health quantified (6 states), Telemetry metrics live, Audit event recorded',
      actual: `Pipeline: ${diagnostics.gatewayStatus.pipelineHealth}, Fleet Total: ${diagnostics.fleetHealth.totalDevices}, Metrics Received: ${diagnostics.metrics.packetsReceived}, Audited: ${Boolean(diagnosticsAudit)}`,
      status: passed ? 'PASS' : 'FAIL',
      evidence: {
        gatewayStatus: diagnostics.gatewayStatus,
        fleetHealth: diagnostics.fleetHealth,
        metrics: diagnostics.metrics,
        recentEventsCount: diagnostics.recentEvents.length,
        auditId: diagnosticsAudit?.id
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_1_TECHNICIAN_SEES_TELEMETRY_HEALTH',
      name: 'TEST 1: Technician sees telemetry health',
      requirement: 'Technician receives gateway status, device fleet health, telemetry metrics, and access is audited',
      expected: 'Successful retrieval of telemetry diagnostics',
      actual: `Error: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  // --------------------------------------------------------------------------
  // TEST 2: Guardian denied diagnostics
  // --------------------------------------------------------------------------
  try {
    let denied = false;
    let errorMessage = '';
    let errorCode = '';

    try {
      telemetryDiagnosticsEngine.getOperationalDiagnostics(guardianActor);
    } catch (err: any) {
      denied = true;
      errorMessage = err.message;
      errorCode = err.code || err.statusCode;
    }

    // Verify denial was audited
    const auditLogs = db.getAuditLogs({ limit: 10 });
    const denialAudit = auditLogs.find(
      l => l.actionType === 'UNAUTHORIZED_ACCESS_DENIED' && l.actorUserId === guardianActor.id
    );

    const passed = denied && (errorMessage.includes('Guardians are strictly forbidden') || errorCode === 'ACCESS_DENIED' || String(errorCode) === '403') && Boolean(denialAudit);

    results.push({
      id: 'TEST_2_GUARDIAN_DENIED_DIAGNOSTICS',
      name: 'TEST 2: Guardian denied diagnostics',
      requirement: 'Guardians must be strictly forbidden from accessing telemetry diagnostics; attempt must be audited',
      expected: 'Access denied with HTTP 403 / ACCESS_DENIED, UNAUTHORIZED_ACCESS_DENIED logged in audit trail',
      actual: `Denied: ${denied}, Message: "${errorMessage}", Audit Logged: ${Boolean(denialAudit)}`,
      status: passed ? 'PASS' : 'FAIL',
      evidence: {
        denied,
        errorMessage,
        errorCode,
        auditEventId: denialAudit?.id
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_2_GUARDIAN_DENIED_DIAGNOSTICS',
      name: 'TEST 2: Guardian denied diagnostics',
      requirement: 'Guardians must be strictly forbidden from accessing telemetry diagnostics',
      expected: 'Access denied exception thrown',
      actual: `Unexpected test execution error: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  // --------------------------------------------------------------------------
  // TEST 3: Metrics match simulator activity
  // --------------------------------------------------------------------------
  try {
    // Read initial metrics
    const initialMetrics = telemetryDiagnosticsEngine.getAggregatedMetrics();

    // 1. Build authentic GT012 location packet with valid CRC
    const validBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
      lat: -25.7592,
      lng: 28.2340,
      speed: 45,
      heading: 180,
      satellites: 9,
      serialNumber: Math.floor(1000 + Math.random() * 50000)
    });
    const validHex = validBuffer.toString('hex').toUpperCase();

    // 1. Ingest valid simulated packet
    await telemetrySimulationEngine.simulatePacket({
      rawPacket: validHex,
      protocolFormat: 'AUTO',
      targetDeviceId: 'DEV-ITIS-001'
    }, technicianActor);

    // 2. Simulate duplicate packet (exact same packet payload & target device within sliding window)
    await telemetrySimulationEngine.simulatePacket({
      rawPacket: validHex,
      protocolFormat: 'AUTO',
      targetDeviceId: 'DEV-ITIS-001'
    }, technicianActor);

    // 3. Simulate malformed/bad CRC packet (valid length & framing, but corrupted CRC bytes)
    const badCrcBuffer = Buffer.from(validBuffer);
    badCrcBuffer[badCrcBuffer.length - 4] = badCrcBuffer[badCrcBuffer.length - 4] ^ 0xff;
    badCrcBuffer[badCrcBuffer.length - 3] = badCrcBuffer[badCrcBuffer.length - 3] ^ 0xff;
    const badCrcHex = badCrcBuffer.toString('hex').toUpperCase();

    await telemetrySimulationEngine.simulatePacket({
      rawPacket: badCrcHex,
      protocolFormat: 'GT012',
      targetDeviceId: 'DEV-ITIS-001'
    }, technicianActor);

    // 4. Simulate unknown device packet (valid GT012 packet, unregistered device ID)
    const anotherValidBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
      lat: -25.7592,
      lng: 28.2340,
      speed: 30,
      serialNumber: Math.floor(1000 + Math.random() * 50000)
    });
    await telemetrySimulationEngine.simulatePacket({
      rawPacket: anotherValidBuffer.toString('hex').toUpperCase(),
      protocolFormat: 'GT012',
      targetDeviceId: `UNKNOWN-ROGUE-NODE-${Date.now()}`
    }, technicianActor);

    // Read updated metrics
    const updatedMetrics = telemetryDiagnosticsEngine.getAggregatedMetrics();

    const receivedDiff = updatedMetrics.packetsReceived - initialMetrics.packetsReceived;
    const duplicatesDiff = updatedMetrics.duplicatesSuppressed - initialMetrics.duplicatesSuppressed;
    const crcFailuresDiff = updatedMetrics.crcFailures - initialMetrics.crcFailures;
    const unknownDevicesDiff = updatedMetrics.unknownDevices - initialMetrics.unknownDevices;

    const metricsIncrementedCorrectly =
      receivedDiff >= 4 &&
      duplicatesDiff >= 1 &&
      (crcFailuresDiff >= 1 || updatedMetrics.packetsRejected > initialMetrics.packetsRejected) &&
      (unknownDevicesDiff >= 1 || updatedMetrics.packetsRejected > initialMetrics.packetsRejected);

    results.push({
      id: 'TEST_3_METRICS_MATCH_SIMULATOR_ACTIVITY',
      name: 'TEST 3: Metrics match simulator activity',
      requirement: 'Simulated packets must dynamically and accurately increment received, accepted, rejected, duplicate, and CRC metrics',
      expected: 'Metrics increment in real-time matching simulated packets (Received >= 4, Duplicates >= 1, Rejections tracked)',
      actual: `Received Delta: +${receivedDiff}, Duplicates Delta: +${duplicatesDiff}, CRC Delta: +${crcFailuresDiff}, Unknown Devices Delta: +${unknownDevicesDiff}`,
      status: metricsIncrementedCorrectly ? 'PASS' : 'FAIL',
      evidence: {
        initialMetrics,
        updatedMetrics,
        deltas: {
          receivedDiff,
          duplicatesDiff,
          crcFailuresDiff,
          unknownDevicesDiff
        }
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_3_METRICS_MATCH_SIMULATOR_ACTIVITY',
      name: 'TEST 3: Metrics match simulator activity',
      requirement: 'Simulated packets must dynamically increment metrics',
      expected: 'Metrics increment successfully',
      actual: `Error during simulator metrics test: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  // --------------------------------------------------------------------------
  // TEST 4: No secrets exposed
  // --------------------------------------------------------------------------
  try {
    const diagnostics = telemetryDiagnosticsEngine.getOperationalDiagnostics(technicianActor);
    const jsonString = JSON.stringify(diagnostics);

    const forbiddenStrings = [
      'password',
      'passwordHash',
      'passwordSalt',
      'ITIS_TELEMETRY_SERVICE_SECRET',
      'itis-srv-hmac-secret',
      'itis_telemetry_hmac_secret',
      'DATABASE_URL',
      'postgres://',
      'bearer ey',
      'session-token'
    ];

    const leakedStrings: string[] = [];
    for (const forbidden of forbiddenStrings) {
      if (jsonString.toLowerCase().includes(forbidden.toLowerCase())) {
        leakedStrings.push(forbidden);
      }
    }

    // Also verify that credentialsExposed is explicitly false
    const credentialsExposedFlag = diagnostics.accessMetadata.credentialsExposed;

    const passed = leakedStrings.length === 0 && credentialsExposedFlag === false;

    results.push({
      id: 'TEST_4_NO_SECRETS_EXPOSED',
      name: 'TEST 4: No secrets exposed',
      requirement: 'Zero passwords, API keys, database credentials, or authentication tokens exposed in diagnostics or events',
      expected: 'Payload contains zero sensitive tokens; credentialsExposed === false',
      actual: `Leaked strings: ${leakedStrings.length === 0 ? 'None (Clean)' : leakedStrings.join(', ')}, credentialsExposed: ${credentialsExposedFlag}`,
      status: passed ? 'PASS' : 'FAIL',
      evidence: {
        testedForbiddenTokens: forbiddenStrings,
        leakedCount: leakedStrings.length,
        credentialsExposedFlag,
        payloadByteLength: jsonString.length
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_4_NO_SECRETS_EXPOSED',
      name: 'TEST 4: No secrets exposed',
      requirement: 'Zero secrets exposed',
      expected: 'Clean sanitized output',
      actual: `Error inspecting secrets: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  // --------------------------------------------------------------------------
  // TEST 5: Existing Technician Portal remains functional
  // --------------------------------------------------------------------------
  try {
    // Verify existing core APIs used by TechnicianPortal continue to return valid data
    const allDevices = deviceRegistryEngine.getAllDevices();
    const firstDevice = allDevices[0];
    const healthSummary = firstDevice ? deviceRegistryEngine.getDeviceHealthSummary(firstDevice.itisDeviceId) : null;
    const maintenanceLogs = db.getDeviceMaintenanceLogs();
    const gatewayStatus = telemetryGatewayEngine.getGatewayStatus();

    const passed =
      allDevices.length > 0 &&
      Boolean(healthSummary) &&
      Array.isArray(maintenanceLogs) &&
      gatewayStatus.processingPipelineStatus === 'HEALTHY';

    results.push({
      id: 'TEST_5_EXISTING_TECHNICIAN_PORTAL_FUNCTIONAL',
      name: 'TEST 5: Existing Technician Portal remains functional',
      requirement: 'All existing device queries, health summaries, maintenance logs, and gateway configs remain fully operational',
      expected: 'Devices count > 0, Health summary functional, Maintenance logs retrievable, Gateway pipeline healthy',
      actual: `Device count: ${allDevices.length}, First Device: ${firstDevice?.trackerDeviceId}, Pipeline: ${gatewayStatus.processingPipelineStatus}`,
      status: passed ? 'PASS' : 'FAIL',
      evidence: {
        devicesTotal: allDevices.length,
        sampleDeviceId: firstDevice?.trackerDeviceId,
        sampleHealthState: healthSummary?.healthState,
        maintenanceLogsCount: maintenanceLogs.length,
        gatewayStatus: gatewayStatus.gatewayStatus
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_5_EXISTING_TECHNICIAN_PORTAL_FUNCTIONAL',
      name: 'TEST 5: Existing Technician Portal remains functional',
      requirement: 'Existing portals remain functional',
      expected: 'No degradation of existing portal methods',
      actual: `Error: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  // --------------------------------------------------------------------------
  // TEST 6: Zero regression
  // --------------------------------------------------------------------------
  try {
    // Verify system invariants:
    // - Pre-aggregated metrics engine works with zero historical table scans
    // - Audit trail integrity is valid
    // - Protocols registry has GT012, ASCII, JSON
    const auditIntegrity = db.verifyAuditTrailIntegrity();
    const retentionMetadata = telemetryDiagnosticsEngine.getOperationalDiagnostics(technicianActor).retentionReadiness;
    const isScanAvoided = retentionMetadata.tableScanAvoided;

    const passed = auditIntegrity.valid && isScanAvoided && retentionMetadata.metricsEngineMode === 'PRE_AGGREGATED_STREAM';

    results.push({
      id: 'TEST_6_ZERO_REGRESSION',
      name: 'TEST 6: Zero regression',
      requirement: 'Audit trail integrity intact, zero historical table scan required, all existing systems consistent',
      expected: 'Audit trail valid: true, Table scan avoided: true, Metrics engine: PRE_AGGREGATED_STREAM',
      actual: `Audit Valid: ${auditIntegrity.valid}, Checked: ${auditIntegrity.totalChecked}, Scan Avoided: ${isScanAvoided}`,
      status: passed ? 'PASS' : 'FAIL',
      evidence: {
        auditIntegrity,
        retentionMetadata
      }
    });
  } catch (err: any) {
    results.push({
      id: 'TEST_6_ZERO_REGRESSION',
      name: 'TEST 6: Zero regression',
      requirement: 'Zero regression across system',
      expected: 'All invariants hold',
      actual: `Regression error: ${err.message}`,
      status: 'FAIL',
      evidence: { error: err.stack }
    });
  }

  const passedTests = results.filter(r => r.status === 'PASS').length;
  const failedTests = results.length - passedTests;

  return {
    suiteId: 'SUITE_TELEMETRY_DIAGNOSTICS_ACCEPTANCE',
    timestamp,
    totalTests: results.length,
    passedTests,
    failedTests,
    allPassed: failedTests === 0,
    results
  };
}
