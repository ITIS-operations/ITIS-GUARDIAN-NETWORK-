import {
  Person,
  Learner,
  Guardian,
  GuardianLearnerRelationship,
  School,
  SchoolEnrolment,
  AcademicRecord,
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

export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface IUserRepository {
  findById(id: string): Promise<PlatformUserItem | null>;
  findByEmailOrAlias(identifier: string): Promise<PlatformUserItem | null>;
  findAll(): Promise<PlatformUserItem[]>;
  create(payload: CreateUserPayload, actorUserId: string): Promise<PlatformUserItem>;
  updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED', actorUserId: string): Promise<PlatformUserItem>;
  verifyCredentials(identifier: string, passwordPlain: string): Promise<PlatformUserItem | null>;
}

export interface ISchoolRepository {
  findById(id: string): Promise<School | null>;
  findByEmisCode(emisCode: string): Promise<School | null>;
  findAll(options?: SchoolQueryOptions): Promise<PaginatedResponse<School>>;
  create(payload: RegisterSchoolPayload): Promise<School>;
  update(id: string, updates: Partial<School>): Promise<School>;
}

export interface IPersonRepository {
  findById(id: string): Promise<Person | null>;
  findByOfficialId(officialId: string): Promise<Person | null>;
  create(person: Person): Promise<Person>;
  update(id: string, updates: Partial<Person>): Promise<Person>;
}

export interface ILearnerRepository {
  findById(id: string): Promise<Learner | null>;
  findByEmisId(emisId: string): Promise<Learner | null>;
  findHydratedById(id: string): Promise<HydratedLearnerRecord | null>;
  queryHydrated(options?: LearnerQueryOptions): Promise<PaginatedResponse<HydratedLearnerRecord>>;
  onboardAtomic(payload: AuthoritativeOnboardPayload): Promise<HydratedLearnerRecord>;
  advanceAcademicYear(learnerId: string, payload: {
    schoolId: string;
    newAcademicYear: number;
    newGrade: string;
    newClassSection: string;
    homeroomTeacher?: string;
  }, staffContext: any): Promise<HydratedLearnerRecord>;
  submitAnnualSafetyUpdate(payload: AnnualSafetyUpdatePayload): Promise<HydratedLearnerRecord>;
}

export interface IGuardianRepository {
  findById(id: string): Promise<Guardian | null>;
  findBySaId(saId: string): Promise<Guardian | null>;
  findByUserId(userId: string): Promise<Guardian | null>;
  findLearnersByGuardianId(guardianId: string): Promise<HydratedLearnerRecord[]>;
  create(guardian: Guardian): Promise<Guardian>;
  linkLearner(relationship: GuardianLearnerRelationship): Promise<GuardianLearnerRelationship>;
}

export interface IDeviceRepository {
  findById(id: string): Promise<any | null>;
  findBySerialNumber(serialNumber: string): Promise<any | null>;
  findAssignedToLearner(learnerId: string): Promise<any | null>;
  assignToLearner(deviceId: string, learnerId: string, assignedByUserId: string): Promise<void>;
  updateDiagnostic(deviceId: string, telemetry: { batteryLevel?: number; tamperStatus?: string; lastPingAt?: string }): Promise<void>;
}

export interface IIncidentRepository {
  findById(id: string): Promise<IncidentAlert | null>;
  query(options?: IncidentQueryOptions): Promise<PaginatedResponse<IncidentAlert>>;
  create(alert: IncidentAlert, actorContext: any): Promise<IncidentAlert>;
  updateStatus(incidentId: string, status: string, notes?: string): Promise<IncidentAlert>;
  getTimelineEvents(incidentId: string): Promise<any[]>;
  addEvent(incidentId: string, event: {
    eventType: string;
    actorUserId?: string;
    actorName: string;
    actorRole: string;
    notes?: string;
    latitude?: number;
    longitude?: number;
    payload?: any;
  }): Promise<any>;
}

export interface IResponderRepository {
  findById(id: string): Promise<ResponderUnit | null>;
  findByCallsign(callsign: string): Promise<ResponderUnit | null>;
  findAll(): Promise<ResponderUnit[]>;
  findAvailable(district?: string): Promise<ResponderUnit[]>;
  getAssignedIncidentsForUser(user: any): Promise<AssignedIncidentView[]>;
  acceptAssignment(incidentId: string, user: any): Promise<any>;
  declineAssignment(incidentId: string, user: any, reason: string): Promise<any>;
  updateOperationalStatus(incidentId: string, user: any, status: string, note?: string, telemetry?: any): Promise<any>;
  submitOutcomeReport(report: IncidentOutcomeReport, user: any): Promise<IncidentAlert>;
}

export interface IAuditRepository {
  logEvent(event: Omit<ImmutableAuditEvent, 'id' | 'timestamp' | 'checksum'>): Promise<ImmutableAuditEvent>;
  query(options?: AuditLogQueryOptions): Promise<PaginatedResponse<ImmutableAuditEvent>>;
  verifyIntegrity(): Promise<{ valid: boolean; totalChecked: number; corruptedBlocks: string[] }>;
}

export interface IDataRepository {
  users: IUserRepository;
  schools: ISchoolRepository;
  persons: IPersonRepository;
  learners: ILearnerRepository;
  guardians: IGuardianRepository;
  devices: IDeviceRepository;
  incidents: IIncidentRepository;
  responders: IResponderRepository;
  auditLogs: IAuditRepository;
  
  beginTransaction(): Promise<DatabaseTransaction>;
  checkHealth(): Promise<{ status: 'HEALTHY' | 'DEGRADED'; provider: 'POSTGRES' | 'DEVELOPMENT_MEMORY'; details?: any }>;
}
