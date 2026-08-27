import { IDataRepository } from './repository.js';
import { PostgresDataRepository } from './postgresRepository.js';
import { bootstrapDatabase } from './bootstrap.js';

export const repository: PostgresDataRepository = new PostgresDataRepository();

export const ProductionMigrationEngine = {
  generateMigrationPlan: () => ({
    source: 'In-Memory / JSON',
    target: 'PostgreSQL 14+ / Cloud SQL',
    status: 'MIGRATION_READY',
    steps: [
      '1. Bootstrap schema with uuid-ossp and pgcrypto',
      '2. Seed Sovereign Founder account USR-SUPER-001',
      '3. Enforce PostgresDataRepository authoritative persistence',
      '4. Continuous ACID transaction enforcement for enrolments & incidents'
    ],
    timestamp: new Date().toISOString()
  })
};

export type { IDataRepository } from './repository.js';
export { PostgresDataRepository } from './postgresRepository.js';
export { bootstrapDatabase } from './bootstrap.js';
export { pool, query, isPostgresConnected } from './client.js';
