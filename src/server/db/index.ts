import { IDataRepository } from './repository.js';
import { PostgresDataRepository } from './postgresRepository.js';
import { bootstrapDatabase } from './bootstrap.js';
import { ProductionMigrationEngine } from './migration.js';

export const repository: PostgresDataRepository = new PostgresDataRepository();

export { ProductionMigrationEngine };
export type { IDataRepository } from './repository.js';
export { PostgresDataRepository } from './postgresRepository.js';
export { bootstrapDatabase } from './bootstrap.js';
export { pool, query, isPostgresConnected, withTransaction, determineConnectionMode } from './client.js';

