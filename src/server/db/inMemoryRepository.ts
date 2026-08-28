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
import { db, ServerUserRecord, hashPassword } from '../dbStore.js';
import { enrolmentEngine } from '../enrolmentEngine.js';
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
  AuditLogQueryOptions,
  ActiveUserSession,
  RegisterUserPayload,
  EligibleResponderRanking
} from '../../types.js';

const SYSTEM_ACTOR: ActiveUserSession = {
  id: 'USR-SUPER-001',
  name: 'Executive Founder / SuperAdmin',
  email: 'founder@itis365.co.za',
  role: 'FOUNDER_EXECUTIVE',
  token: 'system-internal'
};

class InMemoryUserRepository implements IUserRepository {
  private toPlatformUserItem(u: ServerUserRecord): PlatformUserItem {
    return {
      id: u.id,
      email: u.email,
      aliases: u.aliases,
      name: u.name,
      firstName: u.firstName,
      surname: u.surname,
      mobileNumber: u.mobileNumber,
      role: u.role,
      schoolId: u.schoolId,
      guardianId: u.guardianId,
      responderUnit: u.responderUnit,
      department: u.department,
      organization: u.organization,
      permissions: u.permissions || [],
      status: u.status,
      isDemoAccount: u.isDemoAccount,
      createdAt: u.createdAt
    };
  }

  async findById(id: string): Promise<PlatformUserItem | null> {
    const u = db.users.get(id);
    return u ? this.toPlatformUserItem(u) : null;
  }

  async findByEmailOrAlias(identifier: string): Promise<PlatformUserItem | null> {
    const clean = identifier.trim().toLowerCase();
    for (const u of db.users.values()) {
      if (u.email.toLowerCase() === clean || u.aliases?.some(a => a.toLowerCase() === clean)) {
        return this.toPlatformUserItem(u);
      }
    }
    return null;
  }

  async findAll(): Promise<PlatformUserItem[]> {
    return Array.from(db.users.values()).map(u => this.toPlatformUserItem(u));
  }

  async create(payload: CreateUserPayload, actorUserId: string): Promise<PlatformUserItem> {
    const actor = db.users.get(actorUserId);
    const actorSession: ActiveUserSession = actor ? {
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
      schoolId: actor.schoolId,
      guardianId: actor.guardianId,
      responderUnit: actor.responderUnit,
      department: actor.department,
      organization: actor.organization,
      token: 'internal'
    } : SYSTEM_ACTOR;

    const created = db.createUser(actorSession, payload);
    const full = db.users.get(created.id);
    if (!full) throw new Error('User creation failed');
    return this.toPlatformUserItem(full);
  }

  async updateStatus(id: string, status: 'ACTIVE' | 'SUSPENDED' | 'DISABLED', actorUserId: string): Promise<PlatformUserItem> {
    const u = db.users.get(id);
    if (!u) throw new Error(`User ${id} not found`);
    u.status = status;
    db.persistToDisk();
    return this.toPlatformUserItem(u);
  }

  async updatePassword(userId: string, newPasswordPlain: string): Promise<void> {
    const u = db.users.get(userId);
    if (u) {
      u.password = newPasswordPlain;
      db.persistToDisk();
    }
  }

  async verifyCredentials(identifier: string, passwordPlain: string): Promise<PlatformUserItem | null> {
    const clean = identifier.trim().toLowerCase();
    for (const u of db.users.values()) {
      if (u.email.toLowerCase() === clean || u.aliases?.some(a => a.toLowerCase() === clean)) {
        if (u.password === passwordPlain || u.passwordHash === hashPassword(passwordPlain, u.passwordSalt) || u.password === hashPassword(passwordPlain)) {
          return this.toPlatformUserItem(u);
        }
      }
    }
    return null;
  }

  async registerPublicUser(params: RegisterUserPayload): Promise<{
    user: ActiveUserSession;
    token: string;
    permissions: string[];
    scope: any;
  }> {
    return db.registerPublicUser(params);
  }
}

class InMemorySchoolRepository implements ISchoolRepository {
  async findById(id: string): Promise<School | null> {
    return db.schools.get(id) || null;
  }

  async findByEmisCode(emisCode: string): Promise<School | null> {
    for (const s of db.schools.values()) {
      if (s.emisCode.toLowerCase() === emisCode.toLowerCase()) return s;
    }
    return null;
  }

  async findAll(options?: SchoolQueryOptions): Promise<PaginatedResponse<School>> {
    return db.queryPaginatedSchools(options || {});
  }

  async create(payload: RegisterSchoolPayload): Promise<School> {
    return enrolmentEngine.registerSchool(payload);
  }

  async update(id: string, updates: Partial<School>): Promise<School> {
    const s = db.schools.get(id);
    if (!s) throw new Error(`School ${id} not found`);
    const updated = { ...s, ...updates };
    db.schools.set(id, updated);
    return updated;
  }
}

class InMemoryPersonRepository implements IPersonRepository {
  async findById(id: string): Promise<Person | null> {
    return db.persons.get(id) || null;
  }

  async findByOfficialId(officialId: string): Promise<Person | null> {
    for (const p of db.persons.values()) {
      if (p.officialId?.toLowerCase() === officialId.toLowerCase()) return p;
    }
    return null;
  }

  async create(person: Person): Promise<Person> {
    db.persons.set(person.id, person);
    return person;
  }

  async update(id: string, updates: Partial<Person>): Promise<Person> {
    const p = db.persons.get(id);
    if (!p) throw new Error(`Person ${id} not found`);
    const updated = { ...p, ...updates, updatedAt: new Date().toISOString() };
    db.persons.set(id, updated);
    return updated;
  }
}

class InMemoryLearnerRepository implements ILearnerRepository {
  async findById(id: string): Promise<Learner | null> {
    return db.learners.get(id) || null;
  }

  async findByEmisId(emisId: string): Promise<Learner | null> {
    for (const l of db.learners.values()) {
      if (l.emisId.toLowerCase() === emisId.toLowerCase()) return l;
    }
    return null;
  }

  async findHydratedById(id: string): Promise<HydratedLearnerRecord | null> {
    return db.getHydratedLearner(id);
  }

  async queryHydrated(options?: LearnerQueryOptions): Promise<PaginatedResponse<HydratedLearnerRecord>> {
    return db.queryPaginatedLearners(options || {}, SYSTEM_ACTOR);
  }

  async onboardAtomic(payload: AuthoritativeOnboardPayload): Promise<HydratedLearnerRecord> {
    const res = enrolmentEngine.authoritativeOnboard(payload);
    const hydrated = db.getHydratedLearner(res.learnerId);
    if (!hydrated) throw new Error('Hydration failed after authoritative onboard');
    return hydrated;
  }

  async advanceAcademicYear(learnerId: string, payload: {
    schoolId: string;
    newAcademicYear: number;
    newGrade: string;
    newClassSection: string;
    homeroomTeacher?: string;
  }, staffContext: any): Promise<HydratedLearnerRecord> {
    enrolmentEngine.advanceAcademicYear({
      learnerId,
      schoolId: payload.schoolId,
      newYear: payload.newAcademicYear,
      newGrade: payload.newGrade,
      newClassSection: payload.newClassSection,
      homeroomTeacher: payload.homeroomTeacher,
      staffContext
    });
    const hydrated = db.getHydratedLearner(learnerId);
    if (!hydrated) throw new Error('Hydration failed after academic year advance');
    return hydrated;
  }

  async submitAnnualSafetyUpdate(payload: AnnualSafetyUpdatePayload): Promise<HydratedLearnerRecord> {
    enrolmentEngine.annualLearnerSafetyUpdate(payload);
    const hydrated = db.getHydratedLearner(payload.learnerId);
    if (!hydrated) throw new Error('Hydration failed after annual safety update');
    return hydrated;
  }

  async searchIdentity(params: any): Promise<any> {
    return enrolmentEngine.searchIdentity(params);
  }

  async assignDeviceToLearner(params: any): Promise<any> {
    return enrolmentEngine.assignDeviceToLearner(params);
  }
}

class InMemoryGuardianRepository implements IGuardianRepository {
  async findById(id: string): Promise<Guardian | null> {
    return db.guardians.get(id) || null;
  }

  async findBySaId(saId: string): Promise<Guardian | null> {
    for (const g of db.guardians.values()) {
      if (g.saIdNumber === saId) return g;
    }
    return null;
  }

  async findByUserId(userId: string): Promise<Guardian | null> {
    for (const g of db.guardians.values()) {
      if (g.id === userId || g.personId === userId) return g;
    }
    return null;
  }

  async findLearnersByGuardianId(guardianId: string): Promise<HydratedLearnerRecord[]> {
    const list: HydratedLearnerRecord[] = [];
    const childIds = db.guardianLearnersIndex.get(guardianId);
    if (childIds) {
      for (const cId of childIds) {
        const h = db.getHydratedLearner(cId);
        if (h) list.push(h);
      }
    }
    return list;
  }

  async findAll(): Promise<Array<{ guardian: Guardian; person: Person | null; linkedChildren: HydratedLearnerRecord[] }>> {
    const results: Array<{ guardian: Guardian; person: Person | null; linkedChildren: HydratedLearnerRecord[] }> = [];
    for (const g of db.guardians.values()) {
      const person = g.personId ? db.persons.get(g.personId) || null : null;
      const linkedChildren = await this.findLearnersByGuardianId(g.id);
      results.push({ guardian: g, person, linkedChildren });
    }
    return results;
  }

  async create(guardian: Guardian): Promise<Guardian> {
    db.guardians.set(guardian.id, guardian);
    return guardian;
  }

  async linkLearner(relationship: GuardianLearnerRelationship): Promise<GuardianLearnerRelationship> {
    db.relationships.set(relationship.id, relationship);
    return relationship;
  }
}

class InMemoryDeviceRepository implements IDeviceRepository {
  async findById(id: string): Promise<any | null> {
    return db.devices.get(id) || null;
  }

  async findBySerialNumber(serialNumber: string): Promise<any | null> {
    for (const d of db.devices.values()) {
      if (d.serialNumber === serialNumber) return d;
    }
    return null;
  }

  async findAssignedToLearner(learnerId: string): Promise<any | null> {
    const learner = db.learners.get(learnerId);
    if (!learner || !learner.trackingBeaconId) return null;
    return db.devices.get(learner.trackingBeaconId) || { id: learner.trackingBeaconId, serialNumber: learner.trackingBeaconId, status: 'ACTIVE' };
  }

  async assignToLearner(deviceId: string, learnerId: string, assignedByUserId: string): Promise<void> {
    const learner = db.learners.get(learnerId);
    if (!learner) throw new Error('Learner not found');
    learner.trackingBeaconId = deviceId;
    db.learners.set(learnerId, learner);
    db.devices.set(deviceId, { id: deviceId, serialNumber: deviceId, learnerId, status: 'ACTIVE', assignedBy: assignedByUserId });
  }

  async updateDiagnostic(deviceId: string, telemetry: { batteryLevel?: number; tamperStatus?: string; lastPingAt?: string }): Promise<void> {
    const dev = db.devices.get(deviceId) || { id: deviceId, serialNumber: deviceId };
    if (telemetry.batteryLevel !== undefined) dev.batteryLevel = telemetry.batteryLevel;
    if (telemetry.tamperStatus !== undefined) dev.tamperStatus = telemetry.tamperStatus;
    if (telemetry.lastPingAt !== undefined) dev.lastPingAt = telemetry.lastPingAt;
    db.devices.set(deviceId, dev);
  }
}

class InMemoryIncidentRepository implements IIncidentRepository {
  async findById(id: string): Promise<IncidentAlert | null> {
    return db.incidents.get(id) || null;
  }

  async query(options?: IncidentQueryOptions): Promise<PaginatedResponse<IncidentAlert>> {
    return db.queryPaginatedIncidents(options || {}, SYSTEM_ACTOR);
  }

  async create(alert: IncidentAlert, actorContext: any): Promise<IncidentAlert> {
    db.incidents.set(alert.id, alert);
    return alert;
  }

  async update(id: string, updates: Partial<IncidentAlert>): Promise<IncidentAlert> {
    const inc = db.incidents.get(id);
    if (!inc) throw new Error(`Incident ${id} not found`);
    Object.assign(inc, updates);
    return inc;
  }

  async updateStatus(incidentId: string, status: string, notes?: string): Promise<IncidentAlert> {
    const inc = db.incidents.get(incidentId);
    if (!inc) throw new Error(`Incident ${incidentId} not found`);
    inc.status = status as any;
    if (notes) inc.notes.push(notes);
    db.incidents.set(incidentId, inc);
    return inc;
  }

  async getTimelineEvents(incidentId: string): Promise<any[]> {
    const inc = db.incidents.get(incidentId);
    if (!inc) return [];
    return inc.notes.map((n, i) => ({ id: `note-${i}`, note: n, timestamp: inc.timestamp }));
  }

  async addEvent(incidentId: string, event: any): Promise<any> {
    const inc = db.incidents.get(incidentId);
    if (!inc) throw new Error(`Incident ${incidentId} not found`);
    if (event.notes) inc.notes.push(event.notes);
    return event;
  }
}

class InMemoryResponderRepository implements IResponderRepository {
  async findById(id: string): Promise<ResponderUnit | null> {
    return db.responderUnits.get(id) || null;
  }

  async findByCallsign(callsign: string): Promise<ResponderUnit | null> {
    for (const r of db.responderUnits.values()) {
      if (r.callSign.toLowerCase() === callsign.toLowerCase()) return r;
    }
    return null;
  }

  async findAll(): Promise<ResponderUnit[]> {
    return Array.from(db.responderUnits.values());
  }

  async findAvailable(district?: string): Promise<ResponderUnit[]> {
    return Array.from(db.responderUnits.values()).filter(r => r.status === 'AVAILABLE');
  }

  async getAssignedIncidentsForUser(user: any): Promise<AssignedIncidentView[]> {
    const inc = db.getAssignedIncidentForResponder(user);
    return inc ? [inc] : [];
  }

  async acceptAssignment(incidentId: string, user: any): Promise<any> {
    return db.acceptIncidentAssignment(incidentId, user);
  }

  async declineAssignment(incidentId: string, user: any, reason: string): Promise<any> {
    return db.declineIncidentAssignment(incidentId, user, reason);
  }

  async updateOperationalStatus(incidentId: string, user: any, status: string, note?: string, telemetry?: any): Promise<any> {
    return db.updateResponderOperationalStatus(incidentId, user, status as any, note, telemetry);
  }

  async submitOutcomeReport(report: IncidentOutcomeReport, user: any): Promise<IncidentAlert> {
    return db.submitIncidentOutcomeReport(report, user);
  }

  async getRankedEligibleResponders(incidentId: string): Promise<EligibleResponderRanking[]> {
    return db.getRankedEligibleResponders(incidentId);
  }
}

class InMemoryAuditRepository implements IAuditRepository {
  async logEvent(event: Omit<ImmutableAuditEvent, 'id' | 'timestamp' | 'checksum'>): Promise<ImmutableAuditEvent> {
    return db.logAuditEvent(event);
  }

  async query(options?: AuditLogQueryOptions): Promise<PaginatedResponse<ImmutableAuditEvent>> {
    return db.queryPaginatedAuditLogs(options || {});
  }

  async verifyIntegrity(): Promise<{ valid: boolean; totalChecked: number; corruptedBlocks: string[] }> {
    return db.verifyAuditTrailIntegrity();
  }
}

export class InMemoryDataRepository implements IDataRepository {
  public users = new InMemoryUserRepository();
  public sessions = {
    async createSession(token: string, userId: string, sessionData: any, permissions: string[]): Promise<void> {
      db.sessions.set(token, {
        token,
        userId,
        session: sessionData,
        permissions,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      } as any);
    },
    async getSession(token: string): Promise<{ token: string; session: any; permissions: string[] } | null> {
      const s = db.getSession(token);
      return s ? { token, session: s.session, permissions: s.permissions } : null;
    },
    async revokeSession(token: string): Promise<void> {
      db.revokeSession(token);
    },
    async revokeUserSessions(userId: string): Promise<void> {
      for (const [t, s] of db.sessions.entries()) {
        if (s.userId === userId) {
          db.sessions.delete(t);
        }
      }
    },
    async cleanupExpiredSessions(): Promise<void> {}
  };
  public schools = new InMemorySchoolRepository();
  public persons = new InMemoryPersonRepository();
  public learners = new InMemoryLearnerRepository();
  public guardians = new InMemoryGuardianRepository();
  public devices = new InMemoryDeviceRepository();
  public incidents = new InMemoryIncidentRepository();
  public responders = new InMemoryResponderRepository();
  public auditLogs = new InMemoryAuditRepository();

  async beginTransaction(): Promise<DatabaseTransaction> {
    return {
      commit: async () => {},
      rollback: async () => {}
    };
  }

  async checkHealth(): Promise<{ status: 'HEALTHY' | 'DEGRADED'; provider: 'POSTGRES' | 'DEVELOPMENT_MEMORY'; details?: any }> {
    return {
      status: 'HEALTHY',
      provider: 'DEVELOPMENT_MEMORY',
      details: {
        learnersCount: db.learners.size,
        schoolsCount: db.schools.size,
        usersCount: db.users.size,
        auditLogsCount: db.auditLogs.length
      }
    };
  }
}
