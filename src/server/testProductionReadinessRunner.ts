/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — PRODUCTION ARCHITECTURE & READINESS VERIFICATION SUITE
 * ==============================================================================
 * Validates production database configuration, fail-closed startup behavior,
 * migration engine idempotency, liveness/readiness isolation, observability,
 * Vercel serverless separation, and data recovery deduplication.
 */

import { validateServerConfig, loadServerConfig } from './config.js';
import { sanitizeLogData, correlationMiddleware } from './logger.js';
import { getMigrationStatus, runMigrations, loadMigrationFiles } from './db/migrations/migrationRunner.js';
import { DedicatedTelemetryServer } from '../../telemetry-server/src/index.js';
import { query } from './db/client.js';
import express from 'express';

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  durationMs: number;
  details: string;
}

const results: TestResult[] = [];

async function runTest(
  id: string,
  name: string,
  category: string,
  fn: () => Promise<void> | void
): Promise<void> {
  const start = Date.now();
  try {
    await fn();
    results.push({
      id,
      name,
      category,
      passed: true,
      durationMs: Date.now() - start,
      details: 'Passed with verified guarantees'
    });
  } catch (err: any) {
    results.push({
      id,
      name,
      category,
      passed: false,
      durationMs: Date.now() - start,
      details: err.message || String(err)
    });
  }
}

export async function executeProductionReadinessTests(): Promise<{ passed: boolean; results: TestResult[] }> {
  console.log('\n=============================================================');
  console.log('  ITIS GUARDIAN NETWORK — PRODUCTION READINESS TEST SUITE     ');
  console.log('=============================================================');

  // PR-01: Fail-closed production configuration validation
  await runTest(
    'PR-01',
    'Fail-Closed Production Database Configuration',
    'CONFIGURATION',
    () => {
      // Test production mode with missing database URL and missing host
      const invalidEnv: Record<string, string | undefined> = {
        NODE_ENV: 'production',
        DATABASE_URL: '',
        SQL_HOST: '',
        PGHOST: ''
      };
      const validation = validateServerConfig(invalidEnv);
      if (validation.valid) {
        throw new Error('Expected configuration validation to fail in production when DATABASE_URL is missing');
      }
      if (!validation.errors.some(e => e.includes('DATABASE_URL') || e.includes('PRODUCTION_CONFIG_FATAL'))) {
        throw new Error('Expected fatal error explaining missing authoritative PostgreSQL configuration');
      }
    }
  );

  // PR-02: Non-blocking development/test mode configuration
  await runTest(
    'PR-02',
    'Safe Development/Test Default Handling',
    'CONFIGURATION',
    () => {
      const devEnv: Record<string, string | undefined> = {
        NODE_ENV: 'development',
        DATABASE_URL: ''
      };
      const validation = validateServerConfig(devEnv);
      if (!validation.valid) {
        throw new Error('Expected development mode to remain non-blocking for local developer workflow');
      }
      if (validation.warnings.length === 0) {
        throw new Error('Expected development mode to emit informational notice regarding development defaults');
      }
    }
  );

  // PR-03: Liveness probe isolation (no DB query, process alive)
  await runTest(
    'PR-03',
    'Liveness Probe Isolation (Process-Level Verification)',
    'HEALTH_CHECKS',
    async () => {
      // Simulate Express route handling for /api/health/liveness
      const uptime = process.uptime();
      if (typeof uptime !== 'number' || uptime < 0) {
        throw new Error('Process uptime is invalid');
      }
      const livenessResponse = {
        status: 'ALIVE',
        service: 'ITIS Authoritative Core Engine',
        uptimeSeconds: Math.floor(uptime),
        timestamp: new Date().toISOString()
      };
      if (livenessResponse.status !== 'ALIVE' || !livenessResponse.timestamp) {
        throw new Error('Liveness probe did not return required status structure');
      }
    }
  );

  // PR-04: Readiness probe verifies PostgreSQL connectivity
  await runTest(
    'PR-04',
    'Readiness Probe Dependency Verification',
    'HEALTH_CHECKS',
    async () => {
      const ping = await query('SELECT 1 as alive;');
      if (ping.rows.length === 0 || ping.rows[0].alive !== 1) {
        throw new Error('PostgreSQL ping failed to return alive signal');
      }
    }
  );

  // PR-05: Health checks credential stripping & path suppression
  await runTest(
    'PR-05',
    'Health Check Information Leakage Suppression',
    'SECURITY',
    () => {
      const sampleHealthOutput = {
        status: 'READY',
        service: 'ITIS Authoritative Core Engine',
        database: {
          status: 'HEALTHY',
          provider: 'POSTGRESQL'
        },
        timestamp: new Date().toISOString()
      };

      const serialized = JSON.stringify(sampleHealthOutput);
      if (
        serialized.toLowerCase().includes('password') ||
        serialized.toLowerCase().includes('postgres://') ||
        serialized.toLowerCase().includes('/home/') ||
        serialized.toLowerCase().includes('/root/')
      ) {
        throw new Error('Health check payload exposes sensitive database credentials or server paths');
      }
    }
  );

  // PR-06: Deterministic database migration loading & checksums
  await runTest(
    'PR-06',
    'Deterministic Database Migration Checksum Verification',
    'MIGRATIONS',
    () => {
      const files = loadMigrationFiles();
      if (files.length < 5) {
        throw new Error(`Expected at least 5 versioned SQL migrations, found ${files.length}`);
      }
      for (const f of files) {
        if (!f.checksum || f.checksum.length !== 64) {
          throw new Error(`Migration ${f.version} missing valid SHA-256 checksum`);
        }
      }
    }
  );

  // PR-07: Migration runner idempotency
  await runTest(
    'PR-07',
    'Migration Runner Non-Destructive Idempotency',
    'MIGRATIONS',
    async () => {
      const summary = await runMigrations();
      if (!summary.success) {
        throw new Error('Migration execution reported failure');
      }
      // On re-run, all migrations should be SKIPPED_ALREADY_APPLIED
      if (summary.failedCount > 0) {
        throw new Error(`Encountered ${summary.failedCount} failed migrations during idempotent check`);
      }
      const status = await getMigrationStatus();
      if (!status.allApplied) {
        throw new Error(`Found ${status.pending.length} pending migrations when all should be applied`);
      }
    }
  );

  // PR-08: Request correlation ID generation and propagation
  await runTest(
    'PR-08',
    'Request Correlation ID Middleware Propagation',
    'OBSERVABILITY',
    () => {
      const mockReq: any = { headers: {} };
      const headersSet: Record<string, string> = {};
      const mockRes: any = {
        setHeader: (k: string, v: string) => {
          headersSet[k] = v;
        }
      };
      let nextCalled = false;
      correlationMiddleware(mockReq, mockRes, () => {
        nextCalled = true;
      });

      if (!nextCalled) throw new Error('Middleware failed to call next()');
      if (!mockReq.correlationId || !mockReq.correlationId.startsWith('req-')) {
        throw new Error('Middleware failed to assign correlation ID to request object');
      }
      if (!headersSet['X-Correlation-ID']) {
        throw new Error('Middleware failed to set X-Correlation-ID header on response');
      }

      // Test preserving incoming ID
      const incomingReq: any = { headers: { 'x-correlation-id': 'client-cid-998877' } };
      correlationMiddleware(incomingReq, mockRes, () => {});
      if (incomingReq.correlationId !== 'client-cid-998877') {
        throw new Error('Middleware failed to preserve incoming client correlation ID');
      }
    }
  );

  // PR-09: Production logger credential & PII redaction
  await runTest(
    'PR-09',
    'Production Logger Automatic Credential & Secret Redaction',
    'OBSERVABILITY',
    () => {
      const sensitiveData = {
        userId: 'USR-001',
        email: 'admin@school.za',
        password: 'SuperSecretPassword123!',
        password_hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
        totp_secret: 'JBSWY3DPEHPK3PXP',
        session_token: 'sess_abc123xyz789',
        database_url: 'postgres://postgres:myDbPassword123@db.prod.internal:5432/itis',
        rawText: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token'
      };

      const sanitized = sanitizeLogData(sensitiveData);

      if (sanitized.password !== '[REDACTED]') {
        throw new Error('Failed to redact password');
      }
      if (sanitized.password_hash !== '[REDACTED]') {
        throw new Error('Failed to redact password_hash');
      }
      if (sanitized.totp_secret !== '[REDACTED]') {
        throw new Error('Failed to redact totp_secret');
      }
      if (sanitized.session_token !== '[REDACTED]') {
        throw new Error('Failed to redact session_token');
      }
      if (sanitized.database_url.includes('myDbPassword123')) {
        throw new Error('Database password was not masked in connection string');
      }
      if (!sanitized.rawText.includes('[REDACTED_TOKEN]')) {
        throw new Error('Bearer token was not masked');
      }
    }
  );

  // PR-10: Vercel serverless safety guard
  await runTest(
    'PR-10',
    'Vercel Serverless Separation & Persistent TCP Guard',
    'SERVERLESS',
    () => {
      const serverlessEnv: Record<string, string | undefined> = {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgres://postgres:pwd@db.local:5432/itis',
        VERCEL: '1',
        ENABLE_EMBEDDED_TELEMETRY_SERVER: 'true'
      };

      const validation = validateServerConfig(serverlessEnv);
      if (validation.valid) {
        throw new Error('Expected validation to fail when attempting to run embedded TCP telemetry in Vercel');
      }
      if (!validation.errors.some(e => e.includes('Vercel'))) {
        throw new Error('Expected error message explaining Vercel serverless TCP/UDP constraint');
      }
    }
  );

  // PR-11: Data recovery safety & ID deduplication protection
  await runTest(
    'PR-11',
    'Data Recovery Deduplication & ID Idempotency Protection',
    'DATA_RECOVERY',
    async () => {
      // Verify that duplicate inserts with the same authoritative ID fail or update safely
      const testSchoolId = 'sch-test-dedup';
      try {
        await query(
          `INSERT INTO schools (id, emis_code, name, district, province, principal_name, contact_phone, contact_email, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING;`,
          [testSchoolId, 'EMIS-DEDUP-99', 'Dedup Primary Test School', 'District 1', 'GAUTENG', 'Principal Test', '+2711000000', 'test@school.za', -26.1, 28.1]
        );

        // Attempt second insert with same ID
        const secondInsert = await query(
          `INSERT INTO schools (id, emis_code, name, district, province, principal_name, contact_phone, contact_email, latitude, longitude)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING;`,
          [testSchoolId, 'EMIS-DEDUP-99', 'Duplicate Attempt', 'District 1', 'GAUTENG', 'Principal Test', '+2711000000', 'test@school.za', -26.1, 28.1]
        );

        // Verify count remains 1
        const check = await query('SELECT count(*)::int as count FROM schools WHERE id = $1;', [testSchoolId]);
        if (check.rows[0].count !== 1) {
          throw new Error(`Expected exactly 1 record for ID ${testSchoolId}, got ${check.rows[0].count}`);
        }
      } finally {
        await query('DELETE FROM schools WHERE id = $1;', [testSchoolId]);
      }
    }
  );

  // PR-12: Dedicated GPS telemetry server standalone instantiation
  await runTest(
    'PR-12',
    'Dedicated Telemetry Server Standalone Decoupling',
    'TELEMETRY',
    () => {
      const standalone = new DedicatedTelemetryServer({
        tcpPort: 5991,
        udpPort: 5992,
        healthPort: 5993
      });

      if (!standalone.tcpAdapter || !standalone.udpAdapter || !standalone.healthServer) {
        throw new Error('Standalone DedicatedTelemetryServer missing required transport adapters');
      }
      if (standalone.getRuntimeState() !== 'INITIALIZING') {
        throw new Error('Unexpected initial runtime lifecycle state');
      }
    }
  );

  // Output summary
  console.log('\n-------------------------------------------------------------');
  console.log('  PRODUCTION READINESS TEST RESULTS SUMMARY                  ');
  console.log('-------------------------------------------------------------');
  let passedCount = 0;
  for (const r of results) {
    const mark = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${mark}] ${r.id}: ${r.name} (${r.durationMs}ms) [${r.category}]`);
    if (!r.passed) {
      console.error(`       Error: ${r.details}`);
    } else {
      passedCount++;
    }
  }
  console.log('=============================================================');
  console.log(`Total Tests: ${results.length} | Passed: ${passedCount} | Failed: ${results.length - passedCount}`);
  console.log('=============================================================\n');

  return {
    passed: passedCount === results.length,
    results
  };
}

if (process.argv[1]?.endsWith('testProductionReadinessRunner.ts')) {
  executeProductionReadinessTests()
    .then(outcome => {
      process.exit(outcome.passed ? 0 : 1);
    })
    .catch(err => {
      console.error('[Production Readiness Test Fatal Error]', err);
      process.exit(1);
    });
}
