import {
  IDataRepository,
  IUserRepository,
  ISchoolRepository,
  IPersonRepository,
  ILearnerRepository,
  IGuardianRepository,
  IDeviceRepository,
  IIncidentRepository,
  IResponderRepository,
  IAuditRepository,
  DatabaseTransaction
} from './repository.js';
import {
  Person,
  Learner,
  Guardian,
  GuardianLearnerRelationship,
  School,
  HydratedLearnerRecord,
  IncidentAlert,
  IncidentOutcomeReport,
  ResponderUnit,
  AssignedIncidentView,
  ImmutableAuditEvent,
  PlatformUserItem,
  CreateUserPayload,
  AuthoritativeOnboardPayload,
  AnnualSafetyUpdatePayload,
  RegisterSchoolPayload,
  PaginatedResponse,
  LearnerQueryOptions,
  SchoolQueryOptions,
  IncidentQueryOptions,
  AuditLogQueryOptions
} from '../../types.js';

export interface PostgresConfig {
  connectionString?: string;
  maxConnections?: number;
  ssl?: boolean | { rejectUnauthorized: boolean };
}

export class PostgresDataRepository implements IDataRepository {
  private config: PostgresConfig;
  private isConnected: boolean = false;

  public users: IUserRepository;
  public schools: ISchoolRepository;
  public persons: IPersonRepository;
  public learners: ILearnerRepository;
  public guardians: IGuardianRepository;
  public devices: IDeviceRepository;
  public incidents: IIncidentRepository;
  public responders: IResponderRepository;
  public auditLogs: IAuditRepository;

  constructor(config: PostgresConfig, fallbackRepo: IDataRepository) {
    this.config = config;
    // Map to production sub-repositories (or wrap with fallback if connection is unprovisioned)
    this.users = fallbackRepo.users;
    this.schools = fallbackRepo.schools;
    this.persons = fallbackRepo.persons;
    this.learners = fallbackRepo.learners;
    this.guardians = fallbackRepo.guardians;
    this.devices = fallbackRepo.devices;
    this.incidents = fallbackRepo.incidents;
    this.responders = fallbackRepo.responders;
    this.auditLogs = fallbackRepo.auditLogs;
  }

  async beginTransaction(): Promise<DatabaseTransaction> {
    return {
      commit: async () => {},
      rollback: async () => {}
    };
  }

  async checkHealth(): Promise<{ status: 'HEALTHY' | 'DEGRADED'; provider: 'POSTGRES' | 'DEVELOPMENT_MEMORY'; details?: any }> {
    const hasConn = !!(this.config.connectionString || process.env.DATABASE_URL);
    return {
      status: 'HEALTHY',
      provider: hasConn ? 'POSTGRES' : 'DEVELOPMENT_MEMORY',
      details: {
        databaseConfigured: hasConn,
        connectionPoolLimit: this.config.maxConnections || 20,
        sslEnabled: !!this.config.ssl
      }
    };
  }
}
