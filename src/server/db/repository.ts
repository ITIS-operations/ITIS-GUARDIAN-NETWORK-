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
  ActiveUserSession,
  RegisterUserPayload,
  PlatformUserItem,
  CreateUserPayload,
  UpdateUserPayload,
  AuthoritativeOnboardPayload,
  AnnualSafetyUpdatePayload,
  RegisterSchoolPayload,
  PaginatedResponse,
  LearnerQueryOptions,
  SchoolQueryOptions,
  IncidentQueryOptions,
  AuditLogQueryOptions,
  IdentitySearchResult,
  EligibleResponderRanking
} from '../../types.js';

export interface DatabaseTransaction {
  commit(): Promise<void>;
  rollback(): Promise<void>;
}

export interface ISessionRepository {
  createSession(token: string, userId: string, sessionData: any, permissions: string[]): Promise<void>;
  getSession(token: string): Promise<{ token: string; session: any; permissions: string[] } | null>;
  revokeSession(token: string): Promise<void>;
  revokeUserSessions(userId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

export interface IUserRepository {
  findById(id: string): Promise<PlatformUserItem | null>;
  findByEmailOrAlias(identifier: string): Promise<PlatformUserItem | null>;
  findAll(): Promise<PlatformUserItem[]>;
  create(payload: CreateUserPayload, actorUserId: string): Promise<PlatformUserItem>;
  update(id: string, updates: UpdateUserPayload, actorUserId: string): Promise<PlatformUserItem>;
  deleteUser(id: string, actorUserId: string, hardDelete?: boolean): Promise<{ success: boolean; softDeleted: boolean; hardDeleted: boolean }>;
  updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED', actorUserId: string): Promise<PlatformUserItem>;
  updatePassword(userId: string, newPasswordPlain: string): Promise<void>;
  verifyCredentials(identifier: string, passwordPlain: string): Promise<PlatformUserItem | null>;
  registerPublicUser(params: RegisterUserPayload): Promise<{
    user: ActiveUserSession;
    token: string;
    permissions: string[];
    scope: any;
  }>;
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
  searchIdentity(params: {
    saIdNumber?: string;
    mobileNumber?: string;
    emisId?: string;
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
  }): Promise<IdentitySearchResult>;
  assignDeviceToLearner(params: {
    learnerId: string;
    trackingBeaconId: string;
    schoolId?: string;
    forceReassign?: boolean;
    staffContext: any;
  }): Promise<{ success: boolean; learnerId: string; trackingBeaconId: string; message: string; auditEventId: string }>;
}

export interface IGuardianRepository {
  findById(id: string): Promise<Guardian | null>;
  findBySaId(saId: string): Promise<Guardian | null>;
  findByUserId(userId: string): Promise<Guardian | null>;
  findLearnersByGuardianId(guardianId: string): Promise<HydratedLearnerRecord[]>;
  findAll(): Promise<Array<{ guardian: Guardian; person: Person | null; linkedChildren: HydratedLearnerRecord[] }>>;
  create(guardian: Guardian): Promise<Guardian>;
  linkLearner(relationship: GuardianLearnerRelationship): Promise<GuardianLearnerRelationship>;
}

export interface IDeviceRepository {
  findById(id: string): Promise<any | null>;
  findBySerialNumber(serialNumber: string): Promise<any | null>;
  findByImeiOrSerial?(identifier: string): Promise<any | null>;
  findAssignedToLearner(learnerId: string): Promise<any | null>;
  queryDevices?(options?: { schoolId?: string; search?: string; status?: string }): Promise<any[]>;
  assignToLearner(deviceId: string, learnerId: string, assignedByUserId: string): Promise<void>;
  updateDiagnostic(deviceId: string, telemetry: { batteryLevel?: number; tamperStatus?: string; lastPingAt?: string }): Promise<void>;
  calibrate?(deviceId: string): Promise<any>;
  logMaintenance?(payload: { deviceId: string; technicianUserId?: string; technicianName?: string; actionType: string; description: string; status?: string }): Promise<any>;
  getMaintenanceLogs?(deviceId?: string): Promise<any[]>;
  updateConfig?(deviceId: string, config: { firmwareVersion?: string; hardwareRevision?: string; status?: string }): Promise<any>;
  reassignDevice?(params: { oldDeviceId?: string; newDeviceId: string; learnerId: string; assignedByUserId: string; notes?: string }): Promise<void>;
}

export interface IIncidentRepository {
  findById(id: string): Promise<IncidentAlert | null>;
  query(options?: IncidentQueryOptions): Promise<PaginatedResponse<IncidentAlert>>;
  create(alert: IncidentAlert, actorContext: any): Promise<IncidentAlert>;
  update(id: string, updates: Partial<IncidentAlert>): Promise<IncidentAlert>;
  updateStatus(incidentId: string, status: string, notes?: string): Promise<IncidentAlert>;
  claimIncident?(incidentId: string, officer: { id: string; name: string; role: string }): Promise<IncidentAlert>;
  releaseIncident?(incidentId: string, officer: { id: string; name: string; role: string }, reason?: string): Promise<IncidentAlert>;
  handoverIncident?(incidentId: string, fromOfficer: { id: string; name: string; role: string }, targetOfficer: { id: string; name: string; role: string }, reason: string): Promise<IncidentAlert>;
  joinMonitoring?(incidentId: string, officer: { id: string; name: string; role: string }): Promise<IncidentAlert>;
  leaveMonitoring?(incidentId: string, officerId: string): Promise<IncidentAlert>;
  addTacticalNote?(incidentId: string, officer: { id: string; name: string; role: string }, noteText: string): Promise<IncidentAlert>;
  getOfficersWorkload?(): Promise<any[]>;
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
  getRankedEligibleResponders(incidentId: string): Promise<EligibleResponderRanking[]>;
  acceptAssignment(incidentId: string, user: any): Promise<any>;
  declineAssignment(incidentId: string, user: any, reason: string): Promise<any>;
  updateOperationalStatus(incidentId: string, user: any, status: string, note?: string, telemetry?: any): Promise<any>;
  submitOutcomeReport(report: IncidentOutcomeReport, user: any): Promise<IncidentAlert>;
  updateLiveLocation?(responderIdOrUserId: string, locationData: { latitude: number; longitude: number; accuracyMeters?: number; heading?: number; speed?: number; locationSharingStatus?: string; addressDescription?: string }): Promise<ResponderUnit>;
  updateAvailability?(responderIdOrUserId: string, status: string, isAvailable: boolean): Promise<ResponderUnit>;
}

export interface IAuditRepository {
  logEvent(event: Omit<ImmutableAuditEvent, 'id' | 'timestamp' | 'checksum'>): Promise<ImmutableAuditEvent>;
  query(options?: AuditLogQueryOptions): Promise<PaginatedResponse<ImmutableAuditEvent>>;
  verifyIntegrity(): Promise<{ valid: boolean; totalChecked: number; corruptedBlocks: string[] }>;
}

export interface IDataRepository {
  users: IUserRepository;
  sessions: ISessionRepository;
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
