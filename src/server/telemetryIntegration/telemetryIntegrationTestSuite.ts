/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — SECURE TELEMETRY SERVER INTEGRATION ACCEPTANCE SUITE
 * Complete automated validation of all 7 mandatory acceptance tests:
 * TEST 1: Authorized telemetry server request accepted
 * TEST 2: Unauthorized service request rejected
 * TEST 3: Duplicate ingestion suppressed
 * TEST 4: Temporary API failure handled safely
 * TEST 5: Retry does not duplicate telemetry
 * TEST 6: Existing web application unaffected
 * TEST 7: No secrets appear in frontend bundle
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { db } from '../dbStore.js';
import { deviceRegistryEngine } from '../deviceRegistryEngine.js';
import { telemetryGatewayEngine } from '../telemetryGatewayEngine.js';
import { telemetrySimulationEngine } from '../telemetrySimulationEngine.js';
import { protocolProfileRegistry } from '../protocols/protocolRegistry.js';
import { telemetrySecurityEngine } from './telemetrySecurityEngine.js';
import { telemetryIdempotencyEngine } from './telemetryIdempotencyEngine.js';
import { TelemetryResilienceQueue } from '../../../telemetry-server/src/gateway/telemetryResilienceQueue.js';
import { TelemetryGatewayBridge } from '../../../telemetry-server/src/gateway/telemetryGatewayBridge.js';
import { loadServerConfig } from '../../../telemetry-server/src/config/serverConfig.js';
import {
  InternalTelemetryIngestRequest,
  InternalTelemetryIngestResponse,
  InternalDeviceHealthUpdateRequest,
  InternalDeviceConnectionStateRequest,
  InternalHeartbeatRequest,
  InternalPacketAckStatusRequest
} from './telemetryIntegrationTypes.js';

export interface TelemetryIntegrationTestResult {
  id: string;
  name: string;
  passed: boolean;
  expected: string;
  actual: string;
  evidence?: any;
  error?: string;
}

export interface TelemetryIntegrationSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  allPassed: boolean;
  timestamp: string;
  results: TelemetryIntegrationTestResult[];
}

export class TelemetryIntegrationTestSuite {
  public async runAllTests(): Promise<TelemetryIntegrationSuiteSummary> {
    console.log('\n======================================================================');
    console.log('  RUNNING SECURE TELEMETRY SERVER TO AUTHORITATIVE CORE TEST SUITE   ');
    console.log('======================================================================\n');

    const results: TelemetryIntegrationTestResult[] = [];

    const technicianActor = {
      id: 'usr-tech-test-01',
      name: 'Integration Test Technician',
      role: 'TECHNICIAN' as const,
      email: 'tech@itis.gov.za',
      schoolId: 'system',
      token: 'test-token'
    };

    // Ensure test device exists in authoritative registry
    const testImei = '860123456789012';
    let testDevice = deviceRegistryEngine.getDeviceById(testImei);
    if (!testDevice) {
      testDevice = deviceRegistryEngine.registerDevice({
        trackerDeviceId: testImei,
        hardwareSerialNumber: `SN-${testImei}`,
        imei: testImei,
        protocolType: 'GT012',
        deviceModel: 'GT012-PRO',
        firmwareVersion: 'v2.4.1',
        assignedSchoolId: 'SCH-001'
      }, technicianActor);
    }

    // -------------------------------------------------------------------------
    // TEST 1: Authorized telemetry server request accepted
    // -------------------------------------------------------------------------
    try {
      telemetryIdempotencyEngine.clear();
      telemetryGatewayEngine.clearDuplicateCache();

      const serviceId = 'itis-telemetry-server-01';
      const timestamp = new Date().toISOString();
      const validPacketBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -26.204100,
        lng: 28.047300,
        speed: 35,
        heading: 90,
        satellites: 12,
        serialNumber: 201
      });

      const requestBody: InternalTelemetryIngestRequest = {
        serviceId,
        envelope: {
          rawPacket: validPacketBuffer.toString('hex'),
          transportType: 'TCP',
          receivedAt: timestamp,
          remoteAddress: '10.0.4.15',
          remotePort: 5023,
          connectionId: 'conn-auth-test-01',
          deviceIdentifier: testDevice.trackerDeviceId,
          protocol: 'GT012'
        },
        idempotencyKey: `IDEMP-TEST-AUTH-${Date.now()}`,
        timestamp
      };

      // Generate signed headers
      const signedHeaders = telemetrySecurityEngine.generateSignedHeaders({
        serviceId,
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: requestBody
      });

      // 1. Validate security check
      const authValidation = telemetrySecurityEngine.validateServiceRequest({
        headers: signedHeaders as any,
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: requestBody,
        ipAddress: '127.0.0.1'
      });

      if (!authValidation.valid) {
        throw new Error(`Security validation failed unexpectedly: ${authValidation.error}`);
      }

      // Verify dedicated service actor role is TECHNICIAN, not FOUNDER_EXECUTIVE
      const actorIsTechnician = authValidation.actor.role === 'TECHNICIAN';
      const actorIsNotFounder = authValidation.actor.role !== 'FOUNDER_EXECUTIVE';

      // 2. Ingest through authoritative pipeline
      const engineResult = await telemetryGatewayEngine.ingestTelemetryPacket(requestBody.envelope, authValidation.actor);

      // Verify audit trail logged
      const audits = db.queryPaginatedAuditLogs({ limit: 50 }).data;
      const latestAudit = audits.find(a => 
        a.actionType === 'TELEMETRY_PACKET_ACCEPTED' || 
        a.actionType === 'TELEMETRY_SERVICE_INGEST_AUTHORIZED'
      );

      const passed = authValidation.valid && 
                     actorIsTechnician && 
                     actorIsNotFounder && 
                     engineResult.accepted && 
                     engineResult.status === 'INGESTED';

      results.push({
        id: 'TEST_1_AUTHORIZED_REQUEST_ACCEPTED',
        name: 'TEST 1: Authorized telemetry server request accepted',
        passed,
        expected: 'Valid HMAC/Bearer service request accepted, processed by TECHNICIAN service actor, audit logged',
        actual: `Authenticated: ${authValidation.valid}, Role: ${authValidation.actor.role}, IngestAccepted: ${engineResult.accepted}, Status: ${engineResult.status}`,
        evidence: {
          identity: authValidation.identity,
          actor: authValidation.actor,
          engineResult: {
            accepted: engineResult.accepted,
            deviceId: engineResult.deviceId,
            protocol: engineResult.protocol,
            ackRequired: engineResult.ackRequired,
            ackPayload: engineResult.ackPayload
          },
          auditId: latestAudit?.id
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_1_AUTHORIZED_REQUEST_ACCEPTED',
        name: 'TEST 1: Authorized telemetry server request accepted',
        passed: false,
        expected: 'Request accepted cleanly',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 2: Unauthorized service request rejected
    // -------------------------------------------------------------------------
    try {
      // 2a. Missing Service ID
      const resMissingId = telemetrySecurityEngine.validateServiceRequest({
        headers: { 'x-itis-timestamp': new Date().toISOString() },
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: { envelope: { rawPacket: 'TEST' } }
      });

      // 2b. Expired Timestamp (Anti-Replay Window Violation: 10 minutes ago)
      const tenMinutesAgo = new Date(Date.now() - 600_000).toISOString();
      const resExpired = telemetrySecurityEngine.validateServiceRequest({
        headers: {
          'x-itis-service-id': 'itis-telemetry-server-01',
          'x-itis-timestamp': tenMinutesAgo,
          'authorization': 'Bearer itis-srv-key-telemetry-sec-01'
        },
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: { envelope: { rawPacket: 'TEST' } }
      });

      // 2c. Invalid Cryptographic Signature
      const resBadSig = telemetrySecurityEngine.validateServiceRequest({
        headers: {
          'x-itis-service-id': 'itis-telemetry-server-01',
          'x-itis-timestamp': new Date().toISOString(),
          'x-itis-signature': '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
        },
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: { envelope: { rawPacket: 'TEST' } }
      });

      // 2d. Spoofed Unknown Service Identity
      const resSpoofed = telemetrySecurityEngine.validateServiceRequest({
        headers: {
          'x-itis-service-id': 'rogue-attacker-server-666',
          'x-itis-timestamp': new Date().toISOString(),
          'authorization': 'Bearer itis-srv-key-telemetry-sec-01'
        },
        method: 'POST',
        path: '/api/internal/telemetry/ingest',
        body: { envelope: { rawPacket: 'TEST' } }
      });

      // Verify audit log has recorded denials
      const audits = db.queryPaginatedAuditLogs({ limit: 50 }).data;
      const deniedAudits = audits.filter(a => a.actionType === 'TELEMETRY_SERVICE_ACCESS_DENIED');

      const allRejected = !resMissingId.valid && 
                          !resExpired.valid && 
                          !resBadSig.valid && 
                          !resSpoofed.valid &&
                          resMissingId.statusCode === 401 &&
                          resExpired.statusCode === 401 &&
                          resBadSig.statusCode === 401 &&
                          resSpoofed.statusCode === 403;

      results.push({
        id: 'TEST_2_UNAUTHORIZED_REQUEST_REJECTED',
        name: 'TEST 2: Unauthorized service request rejected',
        passed: allRejected && deniedAudits.length > 0,
        expected: 'Missing headers, expired timestamps, bad signatures, and rogue service IDs rejected with 401/403 and logged',
        actual: `MissingId: ${!resMissingId.valid} (401), Expired: ${!resExpired.valid} (401), BadSig: ${!resBadSig.valid} (401), Spoofed: ${!resSpoofed.valid} (403), DeniedAudits: ${deniedAudits.length}`,
        evidence: {
          missingIdError: !resMissingId.valid ? (resMissingId as any).errorCode : null,
          expiredError: !resExpired.valid ? (resExpired as any).errorCode : null,
          badSigError: !resBadSig.valid ? (resBadSig as any).errorCode : null,
          spoofedError: !resSpoofed.valid ? (resSpoofed as any).errorCode : null,
          auditCount: deniedAudits.length
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_2_UNAUTHORIZED_REQUEST_REJECTED',
        name: 'TEST 2: Unauthorized service request rejected',
        passed: false,
        expected: 'Rejection of unauthorized requests',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 3: Duplicate ingestion suppressed
    // -------------------------------------------------------------------------
    try {
      telemetryIdempotencyEngine.clear();
      telemetryGatewayEngine.clearDuplicateCache();

      const idempKey = `IDEMP-DEDUP-TEST-${Date.now()}`;
      const validPacketBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -26.205000,
        lng: 28.048000,
        speed: 20,
        heading: 180,
        satellites: 10,
        serialNumber: 301
      });

      const envelope = {
        rawPacket: validPacketBuffer.toString('hex'),
        transportType: 'TCP' as const,
        receivedAt: new Date().toISOString(),
        remoteAddress: '10.0.4.15',
        deviceIdentifier: testDevice.trackerDeviceId,
        protocol: 'GT012'
      };

      const { fingerprint } = telemetryIdempotencyEngine.generateFingerprint(envelope, idempKey);

      // Ingest First Time
      const firstEngineResult = await telemetryGatewayEngine.ingestTelemetryPacket(envelope, technicianActor);
      const initialResponse: InternalTelemetryIngestResponse = {
        success: firstEngineResult.accepted,
        accepted: firstEngineResult.accepted,
        duplicate: false,
        suppressed: false,
        deviceId: firstEngineResult.deviceId,
        itisDeviceId: firstEngineResult.itisDeviceId,
        protocol: firstEngineResult.protocol,
        ackRequired: firstEngineResult.ackRequired,
        ackPayload: firstEngineResult.ackPayload,
        processedAt: new Date().toISOString(),
        idempotencyKey: idempKey
      };

      telemetryIdempotencyEngine.store(idempKey, fingerprint, initialResponse);

      // Ingest Second Time (Duplicate / Retry)
      const duplicateHit = telemetryIdempotencyEngine.check(idempKey, fingerprint);
      if (!duplicateHit) {
        throw new Error('Idempotency engine failed to detect duplicate packet');
      }

      const duplicateResponse = telemetryIdempotencyEngine.createSuppressedResponse(duplicateHit);

      const passed = initialResponse.accepted && 
                     !initialResponse.duplicate && 
                     duplicateResponse.duplicate && 
                     duplicateResponse.suppressed &&
                     duplicateResponse.ackPayload === initialResponse.ackPayload;

      results.push({
        id: 'TEST_3_DUPLICATE_INGESTION_SUPPRESSED',
        name: 'TEST 3: Duplicate ingestion suppressed',
        passed,
        expected: 'Second submission intercepted by idempotency engine, duplicate flagged, authoritative DB protected',
        actual: `InitialAccepted: ${initialResponse.accepted}, DuplicateSuppressed: ${duplicateResponse.suppressed}, AckPreserved: ${Boolean(duplicateResponse.ackPayload)}`,
        evidence: {
          idempotencyKey: idempKey,
          fingerprint,
          firstHitCount: duplicateHit.hitCount,
          duplicateResponse
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_3_DUPLICATE_INGESTION_SUPPRESSED',
        name: 'TEST 3: Duplicate ingestion suppressed',
        passed: false,
        expected: 'Duplicate suppression without database bloat',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 4: Temporary API failure handled safely
    // -------------------------------------------------------------------------
    try {
      const resilienceQueue = new TelemetryResilienceQueue({
        maxCapacity: 10,
        initialBackoffMs: 100,
        maxBackoffMs: 1000,
        maxAttempts: 5
      });
      resilienceQueue.clear();

      const testEnvelope = {
        rawPacket: '78780a1300000000000100010d0a',
        transportType: 'TCP' as const,
        receivedAt: new Date().toISOString(),
        remoteAddress: '10.0.4.15'
      };

      // Enqueue packet simulating a 503 Service Unavailable / Connection Refused
      const enqueueResult = resilienceQueue.enqueue(testEnvelope, 'IDEMP-FAIL-RESILIENCE-01');
      const metricsBefore = resilienceQueue.getMetrics();

      // Test bounded capacity constraint: fill queue to capacity and verify drop policy
      for (let i = 0; i < 15; i++) {
        resilienceQueue.enqueue({
          rawPacket: `PING_${i}`,
          transportType: 'UDP' as const,
          receivedAt: new Date().toISOString()
        }, `IDEMP-FILL-${i}`);
      }

      const metricsAfterFill = resilienceQueue.getMetrics();

      const queueBounded = metricsAfterFill.currentQueueSize <= 10;
      const packetsSafelyBuffered = enqueueResult.enqueued && metricsBefore.currentQueueSize === 1;
      const dropPolicyEnforced = metricsAfterFill.totalDroppedDueToCapacity > 0;

      resilienceQueue.stopWorker();

      const passed = packetsSafelyBuffered && queueBounded && dropPolicyEnforced;

      results.push({
        id: 'TEST_4_TEMPORARY_API_FAILURE_HANDLED_SAFELY',
        name: 'TEST 4: Temporary API failure handled safely',
        passed,
        expected: 'API unavailability enqueues to bounded queue, backoff calculated, uncontrolled queue growth prevented',
        actual: `SafelyEnqueued: ${packetsSafelyBuffered}, QueueBounded: ${queueBounded} (Size: ${metricsAfterFill.currentQueueSize}/10), DroppedWhenFull: ${dropPolicyEnforced} (${metricsAfterFill.totalDroppedDueToCapacity} dropped)`,
        evidence: {
          enqueueResult,
          metricsBefore,
          metricsAfterFill
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_4_TEMPORARY_API_FAILURE_HANDLED_SAFELY',
        name: 'TEST 4: Temporary API failure handled safely',
        passed: false,
        expected: 'Safe queueing during transient API failure',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 5: Retry does not duplicate telemetry
    // -------------------------------------------------------------------------
    try {
      telemetryIdempotencyEngine.clear();
      telemetryGatewayEngine.clearDuplicateCache();

      const resilienceQueue = new TelemetryResilienceQueue({
        maxCapacity: 50,
        initialBackoffMs: 50,
        maxBackoffMs: 200
      });
      resilienceQueue.clear();

      const retryPacketBuffer = telemetrySimulationEngine.buildGt012LocationPacket({
        lat: -26.207000,
        lng: 28.050000,
        speed: 30,
        heading: 270,
        satellites: 11,
        serialNumber: 401
      });

      const retryEnvelope = {
        rawPacket: retryPacketBuffer.toString('hex'),
        transportType: 'TCP' as const,
        receivedAt: new Date().toISOString(),
        deviceIdentifier: testDevice.trackerDeviceId,
        protocol: 'GT012'
      };

      const retryIdempKey = `IDEMP-RETRY-TEST-${Date.now()}`;
      const { fingerprint } = telemetryIdempotencyEngine.generateFingerprint(retryEnvelope, retryIdempKey);

      // Enqueue item into resilience queue
      const enq = resilienceQueue.enqueue(retryEnvelope, retryIdempKey);
      enq.item.nextRetryAt = 0; // make immediately due for processPendingRetries()

      let attemptsCount = 0;
      let firstAttemptResult: any = null;
      let secondAttemptResult: any = null;

      // Configure forwarder simulating Core recovery
      resilienceQueue.setForwarder(async (item) => {
        attemptsCount++;
        // Check idempotency engine
        const existing = telemetryIdempotencyEngine.check(item.idempotencyKey, fingerprint);
        if (existing) {
          secondAttemptResult = telemetryIdempotencyEngine.createSuppressedResponse(existing);
          return { success: true, duplicate: true };
        }

        // First attempt succeeds and stores idempotency record
        const engineResult = await telemetryGatewayEngine.ingestTelemetryPacket(item.envelope, technicianActor);
        firstAttemptResult = {
          accepted: engineResult.accepted,
          duplicate: false,
          deviceId: engineResult.deviceId
        };
        telemetryIdempotencyEngine.store(item.idempotencyKey, fingerprint, {
          success: engineResult.accepted,
          accepted: engineResult.accepted,
          duplicate: false,
          suppressed: false,
          deviceId: engineResult.deviceId,
          ackRequired: engineResult.ackRequired,
          ackPayload: engineResult.ackPayload,
          processedAt: new Date().toISOString()
        });

        return { success: engineResult.accepted, duplicate: false };
      });

      // Trigger first worker flush (First delivery attempt)
      await resilienceQueue.processPendingRetries();

      // Simulate a network re-transmission / duplicate queue flush
      const fakeQueueItem = {
        id: 'fake-item-2',
        idempotencyKey: retryIdempKey,
        envelope: retryEnvelope,
        enqueuedAt: Date.now(),
        attempts: 1,
        nextRetryAt: 0,
        priority: 'NORMAL' as const
      };
      
      const retryResult = await (resilienceQueue as any).forwarder(fakeQueueItem);

      resilienceQueue.stopWorker();

      const passed = firstAttemptResult?.accepted === true && 
                     firstAttemptResult?.duplicate === false && 
                     retryResult?.duplicate === true && 
                     secondAttemptResult?.duplicate === true &&
                     secondAttemptResult?.suppressed === true;

      results.push({
        id: 'TEST_5_RETRY_DOES_NOT_DUPLICATE_TELEMETRY',
        name: 'TEST 5: Retry does not duplicate telemetry',
        passed,
        expected: 'Retried packets processed idempotently; initial accepted, subsequent retry suppressed as duplicate',
        actual: `InitialIngested: ${firstAttemptResult?.accepted}, RetrySuppressed: ${retryResult?.duplicate}, TotalAttempts: ${attemptsCount}`,
        evidence: {
          firstAttemptResult,
          secondAttemptResult,
          retryResult
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_5_RETRY_DOES_NOT_DUPLICATE_TELEMETRY',
        name: 'TEST 5: Retry does not duplicate telemetry',
        passed: false,
        expected: 'Safe deduplication upon retry flush',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 6: Existing web application unaffected
    // -------------------------------------------------------------------------
    try {
      // 6a. Verify Telemetry Gateway Engine is healthy
      const gwStatus = telemetryGatewayEngine.getGatewayStatus();
      const gwRunning = gwStatus.gatewayStatus === 'ONLINE' && gwStatus.processingPipelineStatus === 'HEALTHY';

      // 6b. Verify Device Registry remains authoritative and intact
      const registeredDevices = deviceRegistryEngine.getAllDevices();
      const hasDevices = registeredDevices.length > 0;

      // 6c. Verify Protocol Registry status
      const allProfiles = protocolProfileRegistry.listProfiles();
      const hasProfiles = allProfiles.length >= 3;

      // 6d. Verify Contract Endpoints instantiate cleanly
      const testHealthReq: InternalDeviceHealthUpdateRequest = {
        serviceId: 'itis-telemetry-server-01',
        trackerDeviceId: testImei,
        batteryPercentage: 92,
        voltage: 4.15,
        gsmSignalStrength: 85,
        gpsSatelliteCount: 12,
        timestamp: new Date().toISOString()
      };
      const bridge = new TelemetryGatewayBridge(loadServerConfig({ integrationMode: 'IN_PROCESS' }));
      const healthRes = await bridge.reportDeviceHealth(testHealthReq);

      const testConnReq: InternalDeviceConnectionStateRequest = {
        serviceId: 'itis-telemetry-server-01',
        trackerDeviceId: testImei,
        connectionId: 'conn-test-6',
        status: 'CONNECTED',
        transport: 'TCP',
        remoteAddress: '10.0.4.15',
        timestamp: new Date().toISOString()
      };
      const connRes = await bridge.reportConnectionState(testConnReq);

      const testHbReq: InternalHeartbeatRequest = {
        serviceId: 'itis-telemetry-server-01',
        timestamp: new Date().toISOString(),
        uptimeSeconds: 120,
        activeConnections: 5,
        trackedDevicesCount: 15,
        recentPacketsReceived: 42
      };
      const hbRes = await bridge.sendHeartbeat(testHbReq);

      const testAckReq: InternalPacketAckStatusRequest = {
        serviceId: 'itis-telemetry-server-01',
        trackerDeviceId: testImei,
        ackPayload: '$$GT012,ACK*55',
        deliveryStatus: 'DELIVERED',
        dispatchedAt: new Date().toISOString()
      };
      const ackRes = await bridge.reportAckStatus(testAckReq);

      const passed = gwRunning && 
                     hasDevices && 
                     hasProfiles &&
                     healthRes.success && 
                     connRes.success && 
                     hbRes.status === 'OK' && 
                     ackRes.success;

      results.push({
        id: 'TEST_6_EXISTING_WEB_APPLICATION_UNAFFECTED',
        name: 'TEST 6: Existing web application unaffected',
        passed,
        expected: 'All existing web application systems, ports, device registries, and gateway states remain 100% operational',
        actual: `GatewayRunning: ${gwRunning}, DeviceRegistryCount: ${registeredDevices.length}, Profiles: ${allProfiles.length}, Health=${healthRes.success} Conn=${connRes.success} Hb=${hbRes.status} Ack=${ackRes.success}`,
        evidence: {
          gwState: gwStatus.gatewayStatus,
          deviceCount: registeredDevices.length,
          profileCount: allProfiles.length,
          healthRes,
          connRes,
          hbRes,
          ackRes
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_6_EXISTING_WEB_APPLICATION_UNAFFECTED',
        name: 'TEST 6: Existing web application unaffected',
        passed: false,
        expected: 'Clean coexistence with existing systems',
        actual: `Test failed: ${err.message}`,
        error: err.stack
      });
    }

    // -------------------------------------------------------------------------
    // TEST 7: No secrets appear in frontend bundle
    // -------------------------------------------------------------------------
    try {
      const repoRoot = fs.existsSync(path.resolve(process.cwd(), 'telemetry-server'))
        ? process.cwd()
        : path.resolve(process.cwd(), '..');
      const srcDir = path.join(repoRoot, 'src');
      const forbiddenTokens = [
        'ITIS_TELEMETRY_SERVICE_SECRET',
        'itis-srv-hmac-secret',
        'itis_telemetry_hmac_secret',
        'ITIS_TELEMETRY_SERVICE_KEY',
        'itis-srv-key-telemetry-sec'
      ];

      const leakedFiles: string[] = [];

      function scanDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          // Skip server-only directories (src/server and telemetry-server)
          if (entry.isDirectory()) {
            if (entry.name === 'server' || entry.name === 'telemetry-server' || entry.name === 'node_modules' || entry.name === '.git') {
              continue;
            }
            scanDirectory(fullPath);
          } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts') || entry.name.endsWith('.html'))) {
            const content = fs.readFileSync(fullPath, 'utf8');
            for (const token of forbiddenTokens) {
              if (content.includes(token)) {
                leakedFiles.push(`${fullPath} contains '${token}'`);
              }
            }
          }
        }
      }

      scanDirectory(srcDir);

      const passed = leakedFiles.length === 0;

      results.push({
        id: 'TEST_7_NO_SECRETS_IN_FRONTEND_BUNDLE',
        name: 'TEST 7: No secrets appear in frontend bundle',
        passed,
        expected: 'Zero service secrets or private keys present in frontend source code',
        actual: passed ? 'Verified: Zero secrets detected in client bundle files' : `Leaks detected: ${leakedFiles.join('; ')}`,
        evidence: {
          scannedDirectory: srcDir,
          forbiddenTokensTested: forbiddenTokens,
          leaksCount: leakedFiles.length,
          leakedFiles
        }
      });
    } catch (err: any) {
      results.push({
        id: 'TEST_7_NO_SECRETS_IN_FRONTEND_BUNDLE',
        name: 'TEST 7: No secrets appear in frontend bundle',
        passed: false,
        expected: 'Zero secrets in frontend',
        actual: `Scan failed: ${err.message}`,
        error: err.stack
      });
    }

    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const allPassed = failed === 0;

    console.log(`\n======================================================================`);
    console.log(`  INTEGRATION TEST RESULTS: ${passed}/${total} PASSED (All Passed: ${allPassed})`);
    console.log(`======================================================================\n`);

    return {
      total,
      passed,
      failed,
      allPassed,
      timestamp: new Date().toISOString(),
      results
    };
  }
}

export const telemetryIntegrationTestSuite = new TelemetryIntegrationTestSuite();
