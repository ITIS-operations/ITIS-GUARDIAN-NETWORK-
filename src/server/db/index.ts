import { IDataRepository } from './repository.js';
import { InMemoryDataRepository } from './inMemoryRepository.js';
import { PostgresDataRepository } from './postgresRepository.js';
import { ProductionMigrationEngine } from './migration.js';

const inMemoryRepo = new InMemoryDataRepository();

// Resolve active repository provider based on runtime environment configuration
export const repository: IDataRepository = process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres')
  ? new PostgresDataRepository({ connectionString: process.env.DATABASE_URL }, inMemoryRepo)
  : inMemoryRepo;

export type { IDataRepository } from './repository.js';
export { ProductionMigrationEngine } from './migration.js';
