/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — DETERMINISTIC DATABASE MIGRATION ENGINE
 * ==============================================================================
 * Versioned, repeatable, transaction-safe migration runner for PostgreSQL.
 * Tracks schema versions in `schema_migrations` with cryptographic checksums.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pool, query, withTransaction } from '../client.js';

export interface MigrationFile {
  version: string;
  name: string;
  filename: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigrationRecord {
  version: string;
  name: string;
  checksum: string;
  applied_at: string;
  execution_time_ms: number;
}

export interface MigrationExecutionResult {
  version: string;
  name: string;
  checksum: string;
  status: 'APPLIED' | 'SKIPPED_ALREADY_APPLIED' | 'FAILED';
  executionTimeMs: number;
  error?: string;
}

export interface MigrationSummary {
  success: boolean;
  totalMigrations: number;
  appliedCount: number;
  skippedCount: number;
  failedCount: number;
  results: MigrationExecutionResult[];
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'src/server/db/migrations');

/**
 * Loads all versioned .sql migration files sorted in ascending version order
 */
export function loadMigrationFiles(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const fullPath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(fullPath, 'utf-8');
    const checksum = crypto.createHash('sha256').update(sql).digest('hex');

    // Filename convention: 001_core_schema.sql -> version "001", name "core_schema"
    const match = filename.match(/^([0-9]+)_(.+)\.sql$/);
    const version = match ? match[1] : filename;
    const name = match ? match[2] : filename;

    return {
      version,
      name,
      filename,
      sql,
      checksum
    };
  });
}

/**
 * Ensures the authoritative schema_migrations audit table exists in PostgreSQL
 */
export async function ensureMigrationTableExists(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(128) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      execution_time_ms INT NOT NULL
    );
  `);
}

/**
 * Fetches all applied migrations recorded in PostgreSQL
 */
export async function getAppliedMigrations(): Promise<Map<string, AppliedMigrationRecord>> {
  await ensureMigrationTableExists();
  const res = await query<AppliedMigrationRecord>(
    `SELECT version, name, checksum, applied_at, execution_time_ms FROM schema_migrations ORDER BY version ASC;`
  );
  const map = new Map<string, AppliedMigrationRecord>();
  for (const row of res.rows) {
    map.set(row.version, row);
  }
  return map;
}

/**
 * Executes all pending database migrations in deterministic sequence
 */
export async function runMigrations(): Promise<MigrationSummary> {
  await ensureMigrationTableExists();
  const applied = await getAppliedMigrations();
  const files = loadMigrationFiles();

  const results: MigrationExecutionResult[] = [];
  let appliedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const migration of files) {
    if (applied.has(migration.version)) {
      results.push({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        status: 'SKIPPED_ALREADY_APPLIED',
        executionTimeMs: 0
      });
      skippedCount++;
      continue;
    }

    const start = Date.now();
    try {
      await withTransaction(async (client) => {
        // Run migration DDL
        await client.query(migration.sql);
        const duration = Date.now() - start;

        // Record in schema_migrations
        await client.query(
          `INSERT INTO schema_migrations (version, name, checksum, execution_time_ms)
           VALUES ($1, $2, $3, $4);`,
          [migration.version, migration.name, migration.checksum, duration]
        );
      });

      const totalDuration = Date.now() - start;
      results.push({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        status: 'APPLIED',
        executionTimeMs: totalDuration
      });
      appliedCount++;
    } catch (err: any) {
      const duration = Date.now() - start;
      failedCount++;
      results.push({
        version: migration.version,
        name: migration.name,
        checksum: migration.checksum,
        status: 'FAILED',
        executionTimeMs: duration,
        error: err.message
      });
      console.error(`[Migration Engine] Error executing migration ${migration.version} (${migration.name}):`, err);
      return {
        success: false,
        totalMigrations: files.length,
        appliedCount,
        skippedCount,
        failedCount,
        results
      };
    }
  }

  return {
    success: failedCount === 0,
    totalMigrations: files.length,
    appliedCount,
    skippedCount,
    failedCount,
    results
  };
}

/**
 * Reports current migration status for observability and verification
 */
export async function getMigrationStatus(): Promise<{
  applied: AppliedMigrationRecord[];
  pending: Array<{ version: string; name: string; filename: string }>;
  allApplied: boolean;
}> {
  await ensureMigrationTableExists();
  const appliedMap = await getAppliedMigrations();
  const files = loadMigrationFiles();

  const pending: Array<{ version: string; name: string; filename: string }> = [];
  for (const f of files) {
    if (!appliedMap.has(f.version)) {
      pending.push({ version: f.version, name: f.name, filename: f.filename });
    }
  }

  return {
    applied: Array.from(appliedMap.values()),
    pending,
    allApplied: pending.length === 0
  };
}

// CLI Execution Handler
if (process.argv[1]?.endsWith('migrationRunner.ts')) {
  const command = process.argv[2] || 'migrate';

  (async () => {
    try {
      if (command === 'status') {
        const status = await getMigrationStatus();
        console.log('\n=============================================================');
        console.log('  ITIS GUARDIAN NETWORK — DATABASE MIGRATION STATUS          ');
        console.log('=============================================================');
        console.log(`Applied Migrations: ${status.applied.length}`);
        for (const a of status.applied) {
          console.log(`  [✓ APPLIED] Version ${a.version}: ${a.name} (${a.applied_at})`);
        }
        console.log(`Pending Migrations: ${status.pending.length}`);
        for (const p of status.pending) {
          console.log(`  [○ PENDING] Version ${p.version}: ${p.name} (${p.filename})`);
        }
        console.log('=============================================================\n');
      } else {
        console.log('\n=============================================================');
        console.log('  ITIS GUARDIAN NETWORK — RUNNING POSTGRESQL MIGRATIONS     ');
        console.log('=============================================================');
        const summary = await runMigrations();
        for (const r of summary.results) {
          const mark = r.status === 'APPLIED' ? '✓ APPLIED' : r.status === 'SKIPPED_ALREADY_APPLIED' ? '- SKIPPED' : '✗ FAILED';
          console.log(`  [${mark}] ${r.version}: ${r.name} (${r.executionTimeMs}ms)`);
          if (r.error) console.error(`      Error: ${r.error}`);
        }
        console.log('-------------------------------------------------------------');
        console.log(`Total: ${summary.totalMigrations} | Applied: ${summary.appliedCount} | Skipped: ${summary.skippedCount} | Failed: ${summary.failedCount}`);
        console.log('=============================================================\n');
        if (!summary.success) {
          process.exit(1);
        }
      }
      process.exit(0);
    } catch (e) {
      console.error('[Migration Fatal Error]', e);
      process.exit(1);
    }
  })();
}
