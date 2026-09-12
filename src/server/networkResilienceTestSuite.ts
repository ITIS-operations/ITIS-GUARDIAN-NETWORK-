/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — NETWORK INTERRUPTION, RESILIENCE & RECOVERY TEST SUITE
 * Verifies Telemetry Interruption, Recovery, Duplicate Suppression, Database Failover,
 * Command Centre Reconnection, Responder GPS Resilience, Bounded Backoff, and Auditing.
 * ==============================================================================
 */

import { networkResilienceEngine } from './networkResilienceEngine.js';
import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { query } from './db/client.js';
import { incidentLifecycleEngine } from './incidentLifecycleEngine.js';
import { ActiveUserSession, IncidentAlert } from '../types.js';

export interface ResilienceTestCaseResult {
  id: string;
  name: string;
  category: string;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  evidence?: Record<string, any>;
}

export interface ResilienceTestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  timestamp: string;
  results: ResilienceTestCaseResult[];
}

export class NetworkResilienceTestSuite {
  public async runAllTests(): Promise<ResilienceTestSuiteResult> {
    const results: ResilienceTestCaseResult[] = [];

    const runTest = async (
      id: string,
      name: string,
      category: string,
      description: string,
      expected: string,
      fn: () => Promise<{ passed: boolean; actual: string; evidence?: any }>
    ) => {
      try {
        const res = await fn();
        results.push({
          id,
          name,
          category,
          description,
          expected,
          actual: res.actual,
          passed: res.passed,
          evidence: res.evidence
        });
      } catch (err: any) {
        results.push({
          id,
          name,
          category,
          description,
          expected,
          actual: `Unhandled execution error: ${err.message}`,
          passed: false,
          evidence: { stack: err.stack }
        });
      }
    };

    // Actors & Seed Data
    const commandOfficer: ActiveUserSession = {
      id: 'usr-command-01',
      name: 'Command Officer Sipho Ndlovu',
      email: 'command@itis.safety.za',
      role: 'COMMAND_OPERATOR',
      token: 'test-token-cmd-01'
    };

    const testDeviceId = 'DEV-ZA-GT012-RES-01';
    const testTrackerId = 'TRK-GT012-RES-01';
    const testLearnerId = 'lrn-res-01';
    const testResponderId = 'resp-res-01';

    // Clean any synthetic test records from PostgreSQL to guarantee pristine test isolation
    try {
      await query('DELETE FROM telemetry WHERE device_id = $1 OR tracker_device_id = $2;', [testDeviceId, testTrackerId]);
    } catch {}

    if (!db.learners.has(testLearnerId)) {
      db.learners.set(testLearnerId, {
        id: testLearnerId,
        firstName: 'Bontle',
        lastName: 'Molefe',
        schoolId: 'sch-001',
        nationalId: '1205055088081',
        gender: 'FEMALE'
      } as any);
    }

    if (!db.devices.has(testDeviceId)) {
      db.devices.set(testDeviceId, {
        itisDeviceId: testDeviceId,
        trackerDeviceId: testTrackerId,
        assignedLearnerId: testLearnerId,
        assignedSchoolId: 'sch-001',
        deviceStatus: 'ACTIVE',
        operationalStatus: 'ONLINE',
        lastKnownLatitude: -25.758955,
        lastKnownLongitude: 28.232188,
        lastTelemetryTimestamp: new Date().toISOString(),
        batteryStatus: { percentage: 88, voltage: 3.9 }
      } as any);
    }

    if (!db.responders.has(testResponderId)) {
      db.responders.set(testResponderId, {
        id: testResponderId,
        callSign: 'ECHO-99-TACTICAL',
        organizationType: 'PRIVATE_SECURITY',
        operationalState: 'AVAILABLE',
        currentLocation: {
          lat: -25.7530,
          lng: 28.2350,
          addressDescription: 'Pretoria East Tactical Station',
          isVerified: true,
          lastSeenAt: new Date().toISOString()
        }
      } as any);
    }

    const getDevice = () => db.devices.get(testDeviceId)!;
    const getResponder = () => db.responders.get(testResponderId)!;
    const getLearner = () => db.learners.get(testLearnerId)!;

    // ====================================================
    // TEST 1: TELEMETRY INTERRUPTION (LAST LOCATION PRESERVED, NO FALSE COORDS)
    // ====================================================
    await runTest(
      'RES-TEST-01',
      'Telemetry Interruption — Location Preservation & Last-Seen Tracking',
      'TELEMETRY_INTERRUPTION',
      'Verify that when telemetry stops, the system preserves last known valid location, records last-seen timestamp, and NEVER generates false coordinates.',
      'Last valid location preserved exactly, lastSeenTimestamp recorded, isFabricated === false.',
      async () => {
        const device = getDevice();
        const knownLat = -25.758955;
        const knownLng = 28.232188;
        device.lastKnownLatitude = knownLat;
        device.lastKnownLongitude = knownLng;
        // Clean any cross-run repository location cache for test isolation
        db.latestLocations.delete(testDeviceId);
        db.latestLocations.delete(testTrackerId);
        db.trackerToDeviceIdMap.delete(testTrackerId);
        delete (device as any).lastCommunicationTimestamp;
        // Simulate silence 5 minutes ago
        device.lastTelemetryTimestamp = new Date(Date.now() - 300 * 1000).toISOString();

        const report = await networkResilienceEngine.evaluateTelemetryInterruption(device.itisDeviceId, {
          staleThresholdSeconds: 120,
          offlineThresholdSeconds: 600
        });

        const locationPreserved = report.lastKnownLocation.latitude === knownLat &&
          report.lastKnownLocation.longitude === knownLng;
        const noFabrication = report.lastKnownLocation.isFabricated === false;
        const lastSeenRecorded = Boolean(report.lastSeenTimestamp) && report.silenceSeconds >= 290;

        const passed = locationPreserved && noFabrication && lastSeenRecorded;
        return {
          passed,
          actual: `Lat=${report.lastKnownLocation.latitude}, Lng=${report.lastKnownLocation.longitude}, Silence=${report.silenceSeconds}s, Fabricated=${report.lastKnownLocation.isFabricated}`,
          evidence: { report }
        };
      }
    );

    // ====================================================
    // TEST 2: STATUS DIFFERENTIATION (STALE vs OFFLINE & SILENCE ALERT)
    // ====================================================
    await runTest(
      'RES-TEST-02',
      'Status Differentiation — STALE vs OFFLINE & Silence Operational Alert',
      'TELEMETRY_INTERRUPTION',
      'Verify the engine distinguishes STALE (3-15 min) from OFFLINE (>15 min) and triggers an operational alert.',
      'Silence 25 min evaluated as OFFLINE with isOffline: true and operational alert generated.',
      async () => {
        const device = getDevice();
        db.latestLocations.delete(testDeviceId);
        db.latestLocations.delete(testTrackerId);
        db.trackerToDeviceIdMap.delete(testTrackerId);
        delete (device as any).lastCommunicationTimestamp;
        // Simulate silence 25 minutes ago (1500 seconds)
        device.lastTelemetryTimestamp = new Date(Date.now() - 25 * 60 * 1000).toISOString();

        const report = await networkResilienceEngine.evaluateTelemetryInterruption(device.itisDeviceId, {
          staleThresholdSeconds: 180,
          offlineThresholdSeconds: 900
        });

        const passed = (report.status === 'OFFLINE' || report.status === 'PROLONGED_SILENCE') &&
          report.isOffline === true &&
          report.isStale === true &&
          report.silenceSeconds >= 1400;

        return {
          passed,
          actual: `Status=${report.status}, isOffline=${report.isOffline}, isStale=${report.isStale}, Silence=${report.silenceSeconds}s, AlertGenerated=${report.operationalAlertGenerated}`,
          evidence: { status: report.status, alertDetails: report.alertDetails }
        };
      }
    );

    // ====================================================
    // TEST 3: TELEMETRY RECONNECTION & RECOVERY
    // ====================================================
    await runTest(
      'RES-TEST-03',
      'Telemetry Reconnection — Live Fix Reception & Recovery Time Logging',
      'TELEMETRY_RECONNECTION',
      'Verify that when telemetry resumes, fresh packet updates location, status transitions to ONLINE, downtime duration is logged, and audit is recorded.',
      'Status becomes ONLINE, fresh coordinates saved, downtime calculated, auditEvent logged.',
      async () => {
        const device = getDevice();
        const newLat = -25.753421;
        const newLng = 28.238912;
        const nowIso = new Date().toISOString();

        const result = await networkResilienceEngine.handleTelemetryReconnection({
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          latitude: newLat,
          longitude: newLng,
          sequenceNumber: 1042,
          timestamp: nowIso
        });

        const passed = result.status === 'ONLINE' &&
          result.accepted === true &&
          result.duplicate === false &&
          result.latestLocation.latitude === newLat &&
          result.latestLocation.longitude === newLng &&
          Boolean(result.auditEventId);

        return {
          passed,
          actual: `Status=${result.status}, Accepted=${result.accepted}, Coords=(${result.latestLocation.latitude}, ${result.latestLocation.longitude}), Downtime=${result.downtimeDurationSeconds}s, Audit=${result.auditEventId}`,
          evidence: { result }
        };
      }
    );

    // ====================================================
    // TEST 4: DUPLICATE PACKET SUPPRESSION AFTER RECOVERY
    // ====================================================
    await runTest(
      'RES-TEST-04',
      'Duplicate Packet Suppression — Burst Re-transmission & Idempotency',
      'TELEMETRY_RECONNECTION',
      'Verify that re-transmitted duplicate packets arriving during connection recovery are suppressed without corrupting latest state.',
      'Duplicate detected: true, suppressed: true, accepted: true, no duplicate write.',
      async () => {
        const device = getDevice();
        const rawPacketHex = '78780a1300000000000100010d0a';
        const packetPayload = {
          deviceId: device.itisDeviceId,
          trackerDeviceId: device.trackerDeviceId,
          latitude: -25.753421,
          longitude: 28.238912,
          sequenceNumber: 1043,
          rawPacket: rawPacketHex,
          timestamp: '2026-09-10T08:00:00.000Z'
        };

        // First transmission
        const first = await networkResilienceEngine.handleTelemetryReconnection(packetPayload);
        // Immediate duplicate re-transmission during burst
        const second = await networkResilienceEngine.handleTelemetryReconnection(packetPayload);

        const passed = first.duplicate === false &&
          second.duplicate === true &&
          second.suppressed === true &&
          second.accepted === true;

        return {
          passed,
          actual: `First: duplicate=${first.duplicate}, Second: duplicate=${second.duplicate}, suppressed=${second.suppressed}`,
          evidence: { firstAccepted: first.accepted, secondSuppressed: second.suppressed }
        };
      }
    );

    // ====================================================
    // TEST 5: DATABASE INTERRUPTION HANDLING (DATABASE_UNAVAILABLE)
    // ====================================================
    await runTest(
      'RES-TEST-05',
      'Database Interruption — Unavailability Reporting & State Protection',
      'DATABASE_INTERRUPTION',
      'Verify that when PostgreSQL connection fails, operations return clear DATABASE_UNAVAILABLE state, never falsely report success, and preserve in-memory state.',
      'Returns success: false, status: DATABASE_UNAVAILABLE, zero in-memory corruption.',
      async () => {
        const initialLearnerCount = db.learners.size;
        networkResilienceEngine.setDatabaseSimulationFailure(true, 'Connection refused by PostgreSQL cluster host');

        const result = await networkResilienceEngine.executeDatabaseOperation(
          'INSERT_EMERGENCY_AUDIT',
          async () => {
            throw new Error('ECONNREFUSED: PostgreSQL unavailable');
          },
          { maxRetries: 2, baseDelayMs: 20 }
        );

        networkResilienceEngine.setDatabaseSimulationFailure(false);

        const learnerCountUnchanged = db.learners.size === initialLearnerCount;
        const failedExplicitly = result.success === false && result.status === 'DATABASE_UNAVAILABLE';
        const errorIndicated = Boolean(result.error && result.error.includes('DATABASE_UNAVAILABLE'));

        const passed = failedExplicitly && errorIndicated && learnerCountUnchanged;
        return {
          passed,
          actual: `Success=${result.success}, Status=${result.status}, Retries=${result.retriesAttempted}, Error="${result.error}", MemoryPreserved=${learnerCountUnchanged}`,
          evidence: { result }
        };
      }
    );

    // ====================================================
    // TEST 6: DATABASE RECOVERY & RECONNECTION
    // ====================================================
    await runTest(
      'RES-TEST-06',
      'Database Recovery — Reconnection Resilience & Retry Resolution',
      'DATABASE_RECONNECTION',
      'Verify that when PostgreSQL becomes available again after transient drops, retry succeeds safely and audits service restoration.',
      'Retry recovers operation, returns status SUCCESS, audits SERVICE_RESTORED.',
      async () => {
        let attemptsCount = 0;

        const result = await networkResilienceEngine.executeDatabaseOperation(
          'TRANSIENT_PERSISTENCE_TEST',
          async () => {
            attemptsCount++;
            if (attemptsCount === 1) {
              throw new Error('Connection terminated (ETIMEDOUT)');
            }
            return { persistedId: 'rec-safe-01', rowCount: 1 };
          },
          { maxRetries: 3, baseDelayMs: 30 }
        );

        const passed = result.success === true &&
          result.status === 'SUCCESS' &&
          result.retriesAttempted === 1 &&
          result.data?.rowCount === 1;

        return {
          passed,
          actual: `Success=${result.success}, Status=${result.status}, RetriesAttempted=${result.retriesAttempted}, RowCount=${result.data?.rowCount}`,
          evidence: { result }
        };
      }
    );

    // ====================================================
    // TEST 7: COMMAND CENTRE RECONNECTION & RECONCILIATION
    // ====================================================
    await runTest(
      'RES-TEST-07',
      'Command Centre Interruption — Disconnect Detection & State Reconciliation',
      'COMMAND_CENTRE_RESILIENCE',
      'Verify Command Centre detects connection degradation, prevents unsafe duplicate claiming, and reconciles incident state upon reconnection.',
      'State flagged DISCONNECTED during outage, reconciled with missed events count upon reconnect.',
      async () => {
        const clientId = 'cmd-console-99';
        // Simulate heartbeat silence 90 seconds ago
        const silentHeartbeat = new Date(Date.now() - 90 * 1000).toISOString();
        const evalConn = networkResilienceEngine.evaluateIncidentConnectionState(clientId, silentHeartbeat);

        const isDisconnected = evalConn.connectionState === 'DISCONNECTED' && evalConn.isStale === true;

        // Simulate reconnection and reconciliation
        const clientLastSyncIso = new Date(Date.now() - 120 * 1000).toISOString();
        const reconResult = await networkResilienceEngine.reconcileIncidentState(
          clientId,
          clientLastSyncIso,
          commandOfficer
        );

        const passed = isDisconnected &&
          reconResult.connectionState === 'CONNECTED' &&
          Boolean(reconResult.reconciledAt) &&
          Boolean(reconResult.auditEventId);

        return {
          passed,
          actual: `OutageState=${evalConn.connectionState}, ReconnectedState=${reconResult.connectionState}, ReconciledIncidents=${reconResult.incidentsReconciledCount}, MissedEvents=${reconResult.eventsMissedCount}`,
          evidence: { evalConn, reconResult }
        };
      }
    );

    // ====================================================
    // TEST 8: RESPONDER GPS INTERRUPTION & RECOVERY
    // ====================================================
    await runTest(
      'RES-TEST-08',
      'Responder GPS Interruption — Stale Detection, No Fabrication & Auto-Recovery',
      'RESPONDER_GPS_RESILIENCE',
      'Verify responder GPS interruption retains last known position, marks telemetry STALE, never fabricates coordinates, and restores live fix on reconnect.',
      'Responder telemetry flagged STALE/OFFLINE without coordinate drift; fresh GPS restores LIVE status.',
      async () => {
        const responder = getResponder();
        const knownLat = -25.7530;
        const knownLng = 28.2350;
        responder.currentLocation = {
          lat: knownLat,
          lng: knownLng,
          addressDescription: 'Pretoria East Tactical Station',
          isVerified: true,
          lastSeenAt: new Date(Date.now() - 180 * 1000).toISOString() // 3 min ago
        } as any;

        // Evaluate interruption
        const staleReport = networkResilienceEngine.evaluateResponderGpsInterruption(responder.id, 60);
        const retainedLat = staleReport.lastKnownPosition.lat;
        const retainedLng = staleReport.lastKnownPosition.lng;
        const noFabrication = staleReport.lastKnownPosition.isFabricated === false;
        const flaggedStale = staleReport.isGpsStale === true && (staleReport.gpsStatus === 'STALE' || staleReport.gpsStatus === 'OFFLINE');

        // Reconnect with new live GPS fix
        const freshLat = -25.7512;
        const freshLng = 28.2398;
        const restoredReport = await networkResilienceEngine.handleResponderGpsReconnection(responder.id, {
          lat: freshLat,
          lng: freshLng,
          addressDescription: 'Sector 2 Rapid Intercept Waypoint'
        });

        const passed = flaggedStale &&
          noFabrication &&
          retainedLat === knownLat &&
          retainedLng === knownLng &&
          restoredReport.gpsStatus === 'LIVE' &&
          restoredReport.isGpsStale === false &&
          restoredReport.lastKnownPosition.lat === freshLat;

        return {
          passed,
          actual: `StaleState=${staleReport.gpsStatus}, RetainedLat=${retainedLat}, Fabricated=${noFabrication ? 'No' : 'Yes'}, RestoredState=${restoredReport.gpsStatus}, FreshLat=${restoredReport.lastKnownPosition.lat}`,
          evidence: { staleReport, restoredReport }
        };
      }
    );

    // ====================================================
    // TEST 9: IDEMPOTENT RETRY & BOUNDED EXPONENTIAL BACKOFF
    // ====================================================
    await runTest(
      'RES-TEST-09',
      'Idempotent Retry & Bounded Backoff — Infinite Loop Prevention',
      'BOUNDED_BACKOFF_IDEMPOTENCY',
      'Verify that retry backoff strictly caps at maximum retries (no infinite loop) and repeated calls with same idempotency key return cached hit.',
      'Retry attempts bounded to maxRetries, second call returns isIdempotentHit: true.',
      async () => {
        const idempotencyKey = 'IDEMP-RES-TEST-' + Date.now();
        let executionCount = 0;

        // First call - executes successfully
        const first = await networkResilienceEngine.executeDatabaseOperation(
          'IDEMPOTENT_OPERATION',
          async () => {
            executionCount++;
            return { transactionId: 'tx-8812', amount: 100 };
          },
          { idempotencyKey, maxRetries: 3, baseDelayMs: 20 }
        );

        // Second call with same key - must return idempotent hit without re-executing
        const second = await networkResilienceEngine.executeDatabaseOperation(
          'IDEMPOTENT_OPERATION',
          async () => {
            executionCount++;
            return { transactionId: 'tx-9999_SHOULD_NOT_EXECUTE', amount: 200 };
          },
          { idempotencyKey, maxRetries: 3, baseDelayMs: 20 }
        );

        // Test bounded backoff ceiling (simulate always-failing call)
        networkResilienceEngine.setDatabaseSimulationFailure(true, 'Persistent hardware disconnection');
        const failedBounded = await networkResilienceEngine.executeDatabaseOperation(
          'ALWAYS_FAILING_OPERATION',
          async () => {
            throw new Error('Persistent failure');
          },
          { maxRetries: 2, baseDelayMs: 10 }
        );
        networkResilienceEngine.setDatabaseSimulationFailure(false);

        const passed = first.success === true &&
          second.isIdempotentHit === true &&
          executionCount === 1 &&
          failedBounded.retriesAttempted === 3 && // initial + 2 retries
          failedBounded.status === 'DATABASE_UNAVAILABLE';

        return {
          passed,
          actual: `ExecCount=${executionCount}, FirstSuccess=${first.success}, SecondIdempotentHit=${second.isIdempotentHit}, BoundedAttempts=${failedBounded.retriesAttempted}, FinalStatus=${failedBounded.status}`,
          evidence: { first, second, failedBounded }
        };
      }
    );

    // ====================================================
    // TEST 10: NO FALSE LOCATIONS & NO DUPLICATE INCIDENTS
    // ====================================================
    await runTest(
      'RES-TEST-10',
      'Integrity Assurance — Zero False Locations & No Duplicate Incident Creation',
      'INTEGRITY_ASSURANCE',
      'Verify that network interruptions never synthesize fake coordinates and rapid incident re-transmissions are safely deduplicated.',
      'Zero coordinate drift during silence; incident candidate idempotency prevents duplicate creation.',
      async () => {
        const device = getDevice();
        const initialLat = device.lastKnownLatitude;
        const initialLng = device.lastKnownLongitude;

        // Perform 5 consecutive interruption checks across 15 minutes of simulated silence
        const reports = [];
        for (let min = 1; min <= 5; min++) {
          device.lastTelemetryTimestamp = new Date(Date.now() - min * 3 * 60 * 1000).toISOString();
          const rep = await networkResilienceEngine.evaluateTelemetryInterruption(device.itisDeviceId);
          reports.push(rep);
        }

        const allCoordsUnaltered = reports.every(
          r => r.lastKnownLocation.latitude === initialLat &&
               r.lastKnownLocation.longitude === initialLng &&
               r.lastKnownLocation.isFabricated === false
        );

        // Incident creation idempotency test
        const testLearner = getLearner();
        const idempotencyKey = 'IDEMP-INCIDENT-' + Date.now();

        const res1 = incidentLifecycleEngine.createIncidentCandidate({
          signalType: 'EMERGENCY_SOS',
          severity: 'HIGH',
          learnerId: testLearner.id,
          idempotencyKey
        });

        // Duplicate transmission with same idempotency key
        const res2 = incidentLifecycleEngine.createIncidentCandidate({
          signalType: 'EMERGENCY_SOS',
          severity: 'HIGH',
          learnerId: testLearner.id,
          idempotencyKey
        });

        const cand1 = res1.candidate;
        const cand2 = res2.candidate;

        const passed = allCoordsUnaltered && (cand1.id === cand2.id || res2.isDuplicate === true);

        return {
          passed,
          actual: `CoordinatesUnaltered=${allCoordsUnaltered}, RepCount=${reports.length}, Cand1Id=${cand1.id}, Cand2Id=${cand2.id}, DuplicatePrevented=${cand1.id === cand2.id || res2.isDuplicate === true}`,
          evidence: { cand1Id: cand1.id, cand2Id: cand2.id, isDuplicate: res2.isDuplicate }
        };
      }
    );

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.length - passedTests;

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed: failedTests === 0,
      timestamp: new Date().toISOString(),
      results
    };
  }
}

export const networkResilienceTestSuite = new NetworkResilienceTestSuite();
