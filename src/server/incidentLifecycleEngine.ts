import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { 
  IncidentAlert, 
  IncidentStatus, 
  IncidentSeverity, 
  IncidentTimelineEvent, 
  IncidentResolutionDetails, 
  IncidentSupervisoryReview, 
  IncidentSlaMetrics,
  ActiveUserSession,
  ResponderUnit,
  ResponderOperationalState,
  IncidentOutcomeReport
} from '../types.js';

export interface CreateCandidateParams {
  signalType: 
    | 'EMERGENCY_SOS' 
    | 'APP_PANIC' 
    | 'DEVICE_TAMPER' 
    | 'GEOFENCE_VIOLATION' 
    | 'UNAUTHORIZED_PICKUP' 
    | 'CRITICAL_BATTERY' 
    | 'UNUSUAL_STATIONARY' 
    | 'GPS_SIGNAL_LOST' 
    | 'DEVICE_OFFLINE' 
    | 'GUARDIAN_REPORT' 
    | 'SCHOOL_REPORT' 
    | 'CONFIDENTIAL_SAFETY_REPORT' 
    | 'MANUAL_EMERGENCY';
  severity: IncidentSeverity;
  deviceId?: string;
  trackerDeviceId?: string;
  learnerId?: string;
  schoolId?: string;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    addressDescription?: string;
  };
  details?: Record<string, any>;
  actorUser?: ActiveUserSession;
  idempotencyKey?: string;
}

export interface IncidentCandidateRecord {
  id: string;
  candidateNumber: string;
  signalType: string;
  severity: IncidentSeverity;
  deviceId?: string;
  trackerDeviceId?: string;
  learnerId?: string;
  learnerName?: string;
  schoolId?: string;
  schoolName?: string;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    addressDescription?: string;
  };
  details?: Record<string, any>;
  createdAt: string;
  status: 'PENDING_REVIEW' | 'CONFIRMED_INCIDENT' | 'DISMISSED';
  confirmedIncidentId?: string;
  idempotencyKey?: string;
}

export interface CreateIncidentPayload {
  learnerId: string;
  severity?: IncidentSeverity;
  triggerType?: string;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    addressDescription?: string;
  };
  notes?: string[];
  idempotencyKey?: string;
  sourceCandidateId?: string;
  schoolId?: string;
}

export interface IncidentResolutionPayload {
  category: 
    | 'LEARNER_SAFE_RECOVERY'
    | 'FALSE_ALARM'
    | 'MEDICAL_ASSISTANCE_RENDERED'
    | 'POLICE_INTERVENTION'
    | 'COMMUNITY_ESCORT'
    | 'PARENT_COLLECTED'
    | 'OTHER';
  summary: string;
  emergencyServicesInvolved: boolean;
  followUpRequired: boolean;
  notes?: string;
}

export interface SupervisoryReviewPayload {
  decision: 'APPROVE_CLOSURE' | 'RETURN_FOR_REVIEW' | 'REQUEST_ADDITIONAL_INFO';
  notes?: string;
}

export class IncidentLifecycleEngine {
  private candidates: Map<string, IncidentCandidateRecord> = new Map();
  private candidateIdempotencyIndex: Map<string, string> = new Map();
  private incidentIdempotencyIndex: Map<string, string> = new Map();
  private dispatchIdempotencyIndex: Map<string, { incidentId: string; responderId: string; timestamp: string }> = new Map();
  private deltaNotifier?: (type: string, data: any) => void;

  constructor() {
    this.initializeEngine();
  }

  private initializeEngine() {
    // Ready
  }

  public setDeltaNotifier(fn: (type: string, data: any) => void) {
    this.deltaNotifier = fn;
  }

  private emitDelta(type: string, data: any) {
    if (this.deltaNotifier) {
      try {
        this.deltaNotifier(type, data);
      } catch (err) {
        console.error('[IncidentLifecycleEngine] Delta notify error:', err);
      }
    }
  }

  // ----------------------------------------------------
  // STAGE 1 & 2: SAFETY SIGNAL -> INCIDENT CANDIDATE
  // ----------------------------------------------------
  public createIncidentCandidate(params: CreateCandidateParams): { candidate: IncidentCandidateRecord; isDuplicate: boolean } {
    // Idempotency check
    if (params.idempotencyKey && this.candidateIdempotencyIndex.has(params.idempotencyKey)) {
      const existingId = this.candidateIdempotencyIndex.get(params.idempotencyKey)!;
      const existing = this.candidates.get(existingId);
      if (existing) {
        return { candidate: existing, isDuplicate: true };
      }
    }

    const id = `cand-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const candidateNumber = `CAND-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let learnerName = 'Unknown Learner';
    let schoolId = params.schoolId;
    let schoolName = 'Unknown School';

    if (params.learnerId) {
      const learner = db.learners.get(params.learnerId);
      if (learner) {
        const person = db.persons.get(learner.personId);
        if (person) learnerName = `${person.firstName} ${person.lastName}`;
        if (!schoolId) schoolId = (learner as any).currentSchoolId || (learner as any).schoolId;
      }
    }

    if (schoolId) {
      const school = db.schools.get(schoolId);
      if (school) schoolName = school.name;
    }

    const candidate: IncidentCandidateRecord = {
      id,
      candidateNumber,
      signalType: params.signalType,
      severity: params.severity,
      deviceId: params.deviceId,
      trackerDeviceId: params.trackerDeviceId,
      learnerId: params.learnerId,
      learnerName,
      schoolId,
      schoolName,
      location: params.location,
      details: params.details,
      createdAt: new Date().toISOString(),
      status: 'PENDING_REVIEW',
      idempotencyKey: params.idempotencyKey
    };

    this.candidates.set(id, candidate);
    if (params.idempotencyKey) {
      this.candidateIdempotencyIndex.set(params.idempotencyKey, id);
    }

    // Immutable audit record
    db.logAuditEvent({
      actionType: 'SAFETY_SIGNAL_GENERATED',
      actorUserId: params.actorUser?.id || 'sys-automation',
      actorName: params.actorUser?.name || 'ITIS Safety Automation Engine',
      actorRole: params.actorUser?.role || 'SYSTEM_AUTOMATION',
      targetEntity: 'SAFETY_ALERT',
      targetId: id,
      details: {
        candidateNumber,
        signalType: params.signalType,
        severity: params.severity,
        learnerId: params.learnerId,
        deviceId: params.deviceId
      }
    });

    this.emitDelta('INCIDENT_CANDIDATE_CREATED', candidate);
    return { candidate, isDuplicate: false };
  }

  public getCandidate(candidateId: string): IncidentCandidateRecord | undefined {
    return this.candidates.get(candidateId);
  }

  public listCandidates(status?: 'PENDING_REVIEW' | 'CONFIRMED_INCIDENT' | 'DISMISSED'): IncidentCandidateRecord[] {
    const list = Array.from(this.candidates.values());
    if (status) return list.filter(c => c.status === status);
    return list;
  }

  // ----------------------------------------------------
  // STAGE 3 & 4: CANDIDATE CONFIRMATION / INCIDENT CREATION
  // ----------------------------------------------------
  public async createIncident(
    payload: CreateIncidentPayload,
    actor: ActiveUserSession
  ): Promise<{ incident: IncidentAlert; isDuplicate: boolean }> {
    // 1. Authorization check
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN_STAFF'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error(`ACCESS DENIED: Role '${actor.role}' lacks permission to create authoritative emergencies.`);
    }

    // 2. Idempotency verification
    if (payload.idempotencyKey && this.incidentIdempotencyIndex.has(payload.idempotencyKey)) {
      const existingId = this.incidentIdempotencyIndex.get(payload.idempotencyKey)!;
      const existing = await repository.incidents.findById(existingId);
      if (existing) {
        return { incident: existing, isDuplicate: true };
      }
    }

    // 3. Resolve learner and school context
    const learner = db.learners.get(payload.learnerId);
    let learnerName = 'Emergency Subject';
    let learnerGrade = 'Grade 10';
    let schoolId = payload.schoolId || (learner as any)?.currentSchoolId || (learner as any)?.schoolId || 'sch-001';
    let schoolName = 'Pretoria Campus';
    let guardianName = 'Primary Emergency Contact';
    let guardianMobile = '+27 82 123 4567';

    if (learner) {
      learnerGrade = (learner as any).currentGrade || (learner as any).grade || 'Grade 10';
      const person = db.persons.get(learner.personId);
      if (person) learnerName = `${person.firstName} ${person.lastName}`;

      // Resolve linked guardian
      const rel = Array.from(db.relationships.values()).find(r => r.learnerId === learner.id && r.isPrimary);
      if (rel) {
        const guardian = db.guardians.get(rel.guardianId);
        if (guardian) {
          const gPerson = db.persons.get(guardian.personId);
          if (gPerson) {
            guardianName = `${gPerson.firstName} ${gPerson.lastName}`;
            guardianMobile = gPerson.mobileNumber || guardianMobile;
          }
        }
      }
    }

    if (schoolId) {
      const school = db.schools.get(schoolId);
      if (school) schoolName = school.name;
    }

    // Enforce School Boundary for School Staff
    if ((actor.role === 'SCHOOL_PRINCIPAL' || actor.role === 'SCHOOL_ADMIN_STAFF') && actor.schoolId) {
      if (schoolId !== actor.schoolId) {
        throw new Error(`INSTITUTIONAL BOUNDARY VIOLATION: You can only report emergencies for your school (${actor.schoolId}).`);
      }
    }

    const now = new Date().toISOString();
    const incidentId = `inc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const incidentNumber = `INC-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const severity: IncidentSeverity = payload.severity || 'CRITICAL_SOS';
    const slaTargetSeconds = this.calculateSlaTarget(severity);

    const initialTimeline: IncidentTimelineEvent[] = [
      {
        id: `ev-${Date.now().toString(36)}-init`,
        incidentId,
        eventType: 'INCIDENT_CREATED',
        actorUserId: actor.id,
        actorName: actor.name,
        actorRole: actor.role,
        timestamp: now,
        notes: `Incident authoritative creation logged by ${actor.name} (${actor.role}).`,
        latitude: payload.location?.lat,
        longitude: payload.location?.lng,
        payload: { triggerType: payload.triggerType, severity }
      }
    ];

    const newIncident: IncidentAlert = {
      id: incidentId,
      incidentNumber,
      learnerId: payload.learnerId,
      learnerName,
      learnerGrade,
      schoolId,
      schoolName,
      guardianName,
      guardianMobile,
      timestamp: now,
      severity,
      status: 'QUEUED',
      triggerType: payload.triggerType || 'EMERGENCY_SOS',
      location: {
        lat: payload.location?.lat || -25.7589,
        lng: payload.location?.lng || 28.2321,
        accuracyMeters: payload.location?.accuracyMeters || 5.0,
        addressDescription: payload.location?.addressDescription || 'Identified Active Corridor'
      },
      slaTargetSeconds,
      elapsedSeconds: 0,
      notes: payload.notes || [`Authoritative emergency opened by ${actor.name}`],
      timeline: initialTimeline,
      idempotencyKey: payload.idempotencyKey,
      sourceCandidateId: payload.sourceCandidateId,
      escalationCount: 0
    };

    // Save to repository (both PostgreSQL and In-Memory)
    const created = await repository.incidents.create(newIncident, {
      userId: actor.id,
      userName: actor.name,
      userRole: actor.role
    });

    // Mark candidate confirmed if source provided
    if (payload.sourceCandidateId) {
      const cand = this.candidates.get(payload.sourceCandidateId);
      if (cand) {
        cand.status = 'CONFIRMED_INCIDENT';
        cand.confirmedIncidentId = incidentId;
      }
    }

    if (payload.idempotencyKey) {
      this.incidentIdempotencyIndex.set(payload.idempotencyKey, incidentId);
    }

    // Immutable Audit Log
    db.logAuditEvent({
      actionType: 'INCIDENT_CREATED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: {
        incidentNumber,
        learnerId: payload.learnerId,
        schoolId,
        severity,
        triggerType: payload.triggerType
      }
    });

    this.emitDelta('INCIDENT_CREATED', created);
    return { incident: created, isDuplicate: false };
  }

  // ----------------------------------------------------
  // STAGE 4: PRIORITIZE INCIDENT
  // ----------------------------------------------------
  public async prioritizeIncident(
    incidentId: string,
    newSeverity: IncidentSeverity,
    reason: string,
    actor: ActiveUserSession
  ): Promise<IncidentAlert> {
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE'];
    if (!allowedRoles.includes(actor.role)) {
      throw new Error(`ACCESS DENIED: Only command officers can reprioritize active incidents.`);
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    const oldSeverity = incident.severity;
    const newSla = this.calculateSlaTarget(newSeverity);
    const now = new Date().toISOString();

    const note = `[PRIORITY ESCALATION] Severity adjusted from ${oldSeverity} to ${newSeverity} by ${actor.name}. Reason: ${reason}`;
    incident.severity = newSeverity;
    incident.slaTargetSeconds = newSla;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-prio`,
      incidentId,
      eventType: 'INCIDENT_PRIORITIZED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      notes: note,
      payload: { oldSeverity, newSeverity, reason }
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    await repository.incidents.update(incidentId, {
      severity: newSeverity,
      slaTargetSeconds: newSla
    });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'INCIDENT_PRIORITIZED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { oldSeverity, newSeverity, reason }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  // ----------------------------------------------------
  // STAGE 5 & 6: COMMAND QUEUE & OFFICER ATOMIC CLAIMING
  // ----------------------------------------------------
  public async claimIncident(incidentId: string, officer: ActiveUserSession): Promise<IncidentAlert> {
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE'];
    if (!allowedRoles.includes(officer.role)) {
      throw new Error(`ACCESS DENIED: Role '${officer.role}' cannot claim command of emergencies.`);
    }

    const claimed = await repository.incidents.claimIncident(incidentId, {
      id: officer.id,
      name: officer.name,
      role: officer.role
    });
    claimed.status = 'CLAIMED';
    claimed.primaryOfficerId = officer.id;
    claimed.primaryOfficerName = officer.name;
    claimed.primaryOfficerRole = officer.role;

    const mem = db.incidents.get(incidentId);
    if (mem) {
      mem.status = 'CLAIMED';
      mem.primaryOfficerId = officer.id;
      mem.primaryOfficerName = officer.name;
      mem.primaryOfficerRole = officer.role;
    }

    db.logAuditEvent({
      actionType: 'INCIDENT_CLAIMED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { primaryOfficerId: officer.id, primaryOfficerName: officer.name }
    });

    this.emitDelta('INCIDENT_CLAIMED', claimed);
    return claimed;
  }

  public async releaseIncident(incidentId: string, officer: ActiveUserSession, reason?: string): Promise<IncidentAlert> {
    const released = await repository.incidents.releaseIncident(
      incidentId,
      { id: officer.id, name: officer.name, role: officer.role },
      reason
    );
    released.status = 'QUEUED';
    delete (released as any).primaryOfficerId;
    delete (released as any).primaryOfficerName;
    delete (released as any).primaryOfficerRole;
    delete (released as any).claimedAt;

    const mem = db.incidents.get(incidentId);
    if (mem) {
      mem.status = 'QUEUED';
      delete (mem as any).primaryOfficerId;
      delete (mem as any).primaryOfficerName;
      delete (mem as any).primaryOfficerRole;
      delete (mem as any).claimedAt;
    }

    db.logAuditEvent({
      actionType: 'INCIDENT_RELEASED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { reason }
    });

    this.emitDelta('INCIDENT_RELEASED', released);
    return released;
  }

  public async handoverIncident(
    incidentId: string,
    fromOfficer: ActiveUserSession,
    targetOfficer: { id: string; name: string; role: string },
    reason: string
  ): Promise<IncidentAlert> {
    const updated = await repository.incidents.handoverIncident(
      incidentId,
      { id: fromOfficer.id, name: fromOfficer.name, role: fromOfficer.role },
      targetOfficer,
      reason
    );

    db.logAuditEvent({
      actionType: 'COMMAND_INCIDENT_HANDOVER',
      actorUserId: fromOfficer.id,
      actorName: fromOfficer.name,
      actorRole: fromOfficer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { targetOfficerId: targetOfficer.id, targetOfficerName: targetOfficer.name, reason }
    });

    this.emitDelta('COMMAND_HANDOVER', updated);
    return updated;
  }

  public async joinMonitoring(incidentId: string, officer: ActiveUserSession): Promise<IncidentAlert> {
    const updated = await repository.incidents.joinMonitoring(incidentId, {
      id: officer.id,
      name: officer.name,
      role: officer.role
    });

    db.logAuditEvent({
      actionType: 'INCIDENT_MONITOR_JOINED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { joinedOfficerId: officer.id }
    });

    this.emitDelta('INCIDENT_UPDATED', updated);
    return updated;
  }

  public async leaveMonitoring(incidentId: string, officer: ActiveUserSession): Promise<IncidentAlert> {
    const updated = await repository.incidents.leaveMonitoring(incidentId, officer.id);

    db.logAuditEvent({
      actionType: 'INCIDENT_MONITOR_LEFT',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { leftOfficerId: officer.id }
    });

    this.emitDelta('INCIDENT_UPDATED', updated);
    return updated;
  }

  // ----------------------------------------------------
  // STAGE 7 & 8: RESPONSE ACTIVATION & DISPATCH
  // ----------------------------------------------------
  public async dispatchResponder(
    incidentId: string,
    responderUnitId: string,
    officer: ActiveUserSession,
    instructions?: string,
    idempotencyKey?: string
  ): Promise<{ incident: IncidentAlert; isDuplicate: boolean }> {
    // 1. Authorization check
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE'];
    if (!allowedRoles.includes(officer.role)) {
      throw new Error(`ACCESS DENIED: Role '${officer.role}' lacks operational clearance to dispatch response units.`);
    }

    // 2. Idempotency Check
    const dispatchKey = idempotencyKey || `disp-${incidentId}-${responderUnitId}`;
    if (this.dispatchIdempotencyIndex.has(dispatchKey)) {
      const existing = await repository.incidents.findById(incidentId);
      if (existing && existing.assignedResponder?.id === responderUnitId) {
        return { incident: existing, isDuplicate: true };
      }
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    // 3. Find responder unit
    const responder = await repository.responders.findById(responderUnitId);
    if (!responder) throw new Error(`Responder unit '${responderUnitId}' not found in registry.`);

    const now = new Date().toISOString();
    incident.status = 'DISPATCHED';
    incident.dispatchedAt = now;
    incident.dispatchInstructions = instructions;
    incident.assignedResponder = {
      id: responder.id,
      name: responder.name,
      unitType: responder.unitType,
      vehicleId: responder.vehicleId,
      etaMinutes: 4,
      distanceKm: 2.1,
      currentLat: responder.currentLocation?.lat,
      currentLng: responder.currentLocation?.lng,
      heading: responder.currentLocation?.heading,
      speed: responder.currentLocation?.speed,
      lastLocationUpdate: now
    };

    const dispatchNote = `DISPATCH ACTIVATED: ${officer.name} assigned unit ${responder.name} (${responder.vehicleId}). Instructions: ${instructions || 'Immediate emergency intercept'}`;
    incident.notes.push(dispatchNote);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-disp`,
      incidentId,
      eventType: 'DISPATCH_ACTIVATED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      timestamp: now,
      notes: dispatchNote,
      payload: { responderUnitId, vehicleId: responder.vehicleId, instructions }
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    // Update responder unit status
    await repository.responders.updateOperationalState(responderUnitId, 'ASSIGNMENT_RECEIVED', incidentId);
    await repository.incidents.update(incidentId, {
      status: 'DISPATCHED',
      assignedResponder: incident.assignedResponder
    });
    await repository.incidents.addEvent(incidentId, event);

    this.dispatchIdempotencyIndex.set(dispatchKey, { incidentId, responderId: responderUnitId, timestamp: now });

    db.logAuditEvent({
      actionType: 'DISPATCH_ACTIVATED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: {
        responderUnitId,
        responderName: responder.name,
        vehicleId: responder.vehicleId,
        instructions
      }
    });

    this.emitDelta('INCIDENT_DISPATCHED', incident);
    return { incident, isDuplicate: false };
  }

  public async reassignResponder(
    incidentId: string,
    newResponderUnitId: string,
    officer: ActiveUserSession,
    reason: string,
    instructions?: string
  ): Promise<IncidentAlert> {
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE'];
    if (!allowedRoles.includes(officer.role)) {
      throw new Error(`ACCESS DENIED: Role '${officer.role}' lacks clearance to reassign responders.`);
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    // Release old responder if any
    const oldResponderId = incident.assignedResponder?.id;
    if (oldResponderId) {
      await repository.responders.updateOperationalState(oldResponderId, 'AVAILABLE');
    }

    const newResponder = await repository.responders.findById(newResponderUnitId);
    if (!newResponder) throw new Error(`New responder unit '${newResponderUnitId}' not found.`);

    const now = new Date().toISOString();
    incident.assignedResponder = {
      id: newResponder.id,
      name: newResponder.name,
      unitType: newResponder.unitType,
      vehicleId: newResponder.vehicleId,
      etaMinutes: 3,
      distanceKm: 1.5,
      currentLat: newResponder.currentLocation?.lat,
      currentLng: newResponder.currentLocation?.lng,
      lastLocationUpdate: now
    };

    const reassignNote = `RESPONDER REASSIGNED: Incident transferred from ${oldResponderId || 'None'} to ${newResponder.name}. Reason: ${reason}`;
    incident.notes.push(reassignNote);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-reassign`,
      incidentId,
      eventType: 'RESPONDER_ASSIGNED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      timestamp: now,
      notes: reassignNote,
      payload: { oldResponderId, newResponderUnitId, reason, instructions }
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    await repository.responders.updateOperationalState(newResponderUnitId, 'ASSIGNMENT_RECEIVED', incidentId);
    await repository.incidents.update(incidentId, { assignedResponder: incident.assignedResponder });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'RESPONDER_REASSIGNED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { oldResponderId, newResponderUnitId, reason }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async cancelDispatch(incidentId: string, officer: ActiveUserSession, reason: string): Promise<IncidentAlert> {
    const allowedRoles = ['COMMAND_OPERATOR', 'SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE'];
    if (!allowedRoles.includes(officer.role)) {
      throw new Error(`ACCESS DENIED: Role '${officer.role}' lacks clearance to cancel dispatch.`);
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    const assignedId = incident.assignedResponder?.id;
    if (assignedId) {
      await repository.responders.updateOperationalState(assignedId, 'AVAILABLE');
    }

    const now = new Date().toISOString();
    incident.assignedResponder = undefined;
    incident.status = incident.primaryOfficerId ? 'CLAIMED' : 'QUEUED';

    const cancelNote = `DISPATCH CANCELLED: Dispatch cancelled by ${officer.name}. Reason: ${reason}`;
    incident.notes.push(cancelNote);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-cancel-disp`,
      incidentId,
      eventType: 'DISPATCH_CANCELLED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      timestamp: now,
      notes: cancelNote,
      payload: { previouslyAssignedResponderId: assignedId, reason }
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    await repository.incidents.update(incidentId, {
      status: incident.status,
      assignedResponder: undefined
    });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'DISPATCH_CANCELLED',
      actorUserId: officer.id,
      actorName: officer.name,
      actorRole: officer.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { reason, previouslyAssignedResponderId: assignedId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  // ----------------------------------------------------
  // STAGE 9-11: RESPONDER OPERATIONAL PROGRESSION
  // ----------------------------------------------------
  public async responderAcceptAssignment(incidentId: string, responderUser: ActiveUserSession): Promise<IncidentAlert> {
    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    // Verify responder assignment
    this.assertResponderAuthorization(responderUser, incident);

    const now = new Date().toISOString();
    incident.responderAcceptedAt = now;
    if (incident.assignedResponder) {
      incident.assignedResponder.acceptedAt = now;
    }

    const note = `RESPONDER ACCEPTED: Tactical assignment accepted by ${responderUser.name}. GPS navigation engaged.`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-accept`,
      incidentId,
      eventType: 'RESPONDER_ACCEPTED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      timestamp: now,
      notes: note
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    const respId = incident.assignedResponder?.id || responderUser.responderUnit || responderUser.id;
    await repository.responders.updateOperationalState(respId, 'ACCEPTED', incidentId);
    await repository.incidents.update(incidentId, { assignedResponder: incident.assignedResponder });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'ASSIGNMENT_ACCEPTED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { responderUnitId: respId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async responderSetEnRoute(incidentId: string, responderUser: ActiveUserSession): Promise<IncidentAlert> {
    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    this.assertResponderAuthorization(responderUser, incident);

    const now = new Date().toISOString();
    incident.status = 'EN_ROUTE';

    const note = `EN ROUTE: Field unit ${responderUser.name} is en route to emergency coordinates.`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-enroute`,
      incidentId,
      eventType: 'RESPONDER_EN_ROUTE',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      timestamp: now,
      notes: note
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    const respId = incident.assignedResponder?.id || responderUser.responderUnit || responderUser.id;
    await repository.responders.updateOperationalState(respId, 'EN_ROUTE', incidentId);
    await repository.incidents.update(incidentId, { status: 'EN_ROUTE' });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'RESPONDER_EN_ROUTE',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { responderUnitId: respId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async responderArriveOnScene(incidentId: string, responderUser: ActiveUserSession): Promise<IncidentAlert> {
    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    this.assertResponderAuthorization(responderUser, incident);

    const now = new Date().toISOString();
    incident.status = 'ON_SCENE';
    incident.responderArrivedAt = now;
    if (incident.assignedResponder) {
      incident.assignedResponder.arrivedAt = now;
    }

    const note = `ON SCENE: Field unit ${responderUser.name} arrived at target scene. Commencing tactical perimeter security.`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-arrived`,
      incidentId,
      eventType: 'RESPONDER_ARRIVED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      timestamp: now,
      notes: note
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    const respId = incident.assignedResponder?.id || responderUser.responderUnit || responderUser.id;
    await repository.responders.updateOperationalState(respId, 'ARRIVED', incidentId);
    await repository.incidents.update(incidentId, { status: 'ON_SCENE', assignedResponder: incident.assignedResponder });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'RESPONDER_ARRIVED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { responderUnitId: respId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async responderSecureScene(incidentId: string, responderUser: ActiveUserSession): Promise<IncidentAlert> {
    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    this.assertResponderAuthorization(responderUser, incident);

    const now = new Date().toISOString();
    incident.status = 'ACTIVE';

    const note = `SCENE SECURED: Perimeter secured by ${responderUser.name}. Learner under authoritative operational escort.`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-secured`,
      incidentId,
      eventType: 'SCENE_SECURED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      timestamp: now,
      notes: note
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    const respId = incident.assignedResponder?.id || responderUser.responderUnit || responderUser.id;
    await repository.responders.updateOperationalState(respId, 'SCENE_SECURED', incidentId);
    await repository.incidents.update(incidentId, { status: 'ACTIVE' });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'SCENE_SECURED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { responderUnitId: respId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async responderRequestAssistance(incidentId: string, responderUser: ActiveUserSession, reason: string): Promise<IncidentAlert> {
    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    this.assertResponderAuthorization(responderUser, incident);

    const now = new Date().toISOString();
    const note = `ASSISTANCE REQUESTED: Field unit ${responderUser.name} requested emergency tactical backup. Details: ${reason}`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-assist`,
      incidentId,
      eventType: 'ASSISTANCE_REQUESTED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      timestamp: now,
      notes: note,
      payload: { reason }
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    const respId = incident.assignedResponder?.id || responderUser.responderUnit || responderUser.id;
    await repository.responders.updateOperationalState(respId, 'ASSISTANCE_REQUIRED', incidentId);
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'ASSISTANCE_REQUESTED',
      actorUserId: responderUser.id,
      actorName: responderUser.name,
      actorRole: responderUser.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { reason, responderUnitId: respId }
    });

    this.emitDelta('INCIDENT_UPDATED', incident);
    return incident;
  }

  public async updateResponderLiveLocation(
    responderUnitId: string,
    lat: number,
    lng: number,
    options?: { heading?: number; speed?: number; accuracy?: number },
    actor?: ActiveUserSession
  ): Promise<ResponderUnit | null> {
    const updated = await repository.responders.updateLocation(responderUnitId, lat, lng, options);
    if (!updated) return null;

    // Also update any actively assigned incident's responder location
    if (updated.activeIncidentId) {
      const inc = await repository.incidents.findById(updated.activeIncidentId);
      if (inc && inc.assignedResponder && inc.assignedResponder.id === responderUnitId) {
        inc.assignedResponder.currentLat = lat;
        inc.assignedResponder.currentLng = lng;
        inc.assignedResponder.heading = options?.heading;
        inc.assignedResponder.speed = options?.speed;
        inc.assignedResponder.lastLocationUpdate = new Date().toISOString();
        await repository.incidents.update(inc.id, { assignedResponder: inc.assignedResponder });
        this.emitDelta('RESPONDER_GPS_UPDATED', {
          incidentId: inc.id,
          responderUnitId,
          lat,
          lng,
          heading: options?.heading,
          speed: options?.speed
        });
      }
    }

    db.logAuditEvent({
      actionType: 'RESPONDER_LOCATION_UPDATED',
      actorUserId: actor?.id || responderUnitId,
      actorName: actor?.name || updated.name,
      actorRole: actor?.role || 'FIELD_RESPONDER',
      targetEntity: 'RESPONDER',
      targetId: responderUnitId,
      details: { lat, lng, speed: options?.speed, heading: options?.heading }
    });

    return updated;
  }

  // ----------------------------------------------------
  // STAGE 12 & 13: INCIDENT RESOLUTION & EVIDENCE / NOTES
  // ----------------------------------------------------
  public async resolveIncident(
    incidentId: string,
    payload: IncidentResolutionPayload,
    actor: ActiveUserSession
  ): Promise<IncidentAlert> {
    // Check authorization: Government Auditor, Parent, and Technician are forbidden
    if (actor.role === 'GOVERNMENT_AUDITOR' || actor.role === 'PARENT_GUARDIAN' || actor.role === 'TECHNICIAN') {
      throw new Error(`ACCESS DENIED: Role '${actor.role}' cannot resolve tactical incidents.`);
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    if (actor.role === 'FIELD_RESPONDER') {
      this.assertResponderAuthorization(actor, incident);
    }

    const now = new Date().toISOString();
    incident.status = 'RESOLVED';
    incident.resolvedAt = now;

    const resolutionDetails: IncidentResolutionDetails = {
      status: 'RESOLVED',
      category: payload.category,
      summary: payload.summary,
      emergencyServicesInvolved: payload.emergencyServicesInvolved,
      followUpRequired: payload.followUpRequired,
      resolvedByUserId: actor.id,
      resolvedByUserName: actor.name,
      resolvedByUserRole: actor.role,
      timestamp: now
    };
    incident.resolutionDetails = resolutionDetails;

    const note = `INCIDENT RESOLVED: Closed as '${payload.category}' by ${actor.name} (${actor.role}). Summary: ${payload.summary}`;
    incident.notes.push(note);
    if (payload.notes) incident.notes.push(`Resolution note: ${payload.notes}`);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-res`,
      incidentId,
      eventType: 'INCIDENT_RESOLVED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      timestamp: now,
      notes: note,
      payload: resolutionDetails as any
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    // Free assigned responder
    if (incident.assignedResponder?.id) {
      await repository.responders.updateOperationalState(incident.assignedResponder.id, 'AVAILABLE');
    }

    await repository.incidents.update(incidentId, {
      status: 'RESOLVED',
      resolutionDetails
    });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: 'INCIDENT_RESOLVED',
      actorUserId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: {
        category: payload.category,
        summary: payload.summary,
        emergencyServicesInvolved: payload.emergencyServicesInvolved
      }
    });

    this.emitDelta('INCIDENT_RESOLVED', incident);
    return incident;
  }

  // ----------------------------------------------------
  // STAGE 14-16: SUPERVISORY REVIEW, CLOSED, AUDIT RECORD
  // ----------------------------------------------------
  public async reviewIncident(
    incidentId: string,
    payload: SupervisoryReviewPayload,
    supervisor: ActiveUserSession
  ): Promise<IncidentAlert> {
    // Only System Admin, Founder, or Authorized Supervisor can conduct supervisory review
    const allowedRoles = ['SYSTEM_ADMIN', 'FOUNDER_EXECUTIVE', 'COMMAND_OPERATOR'];
    if (!allowedRoles.includes(supervisor.role)) {
      throw new Error(`ACCESS DENIED: Supervisory review requires administrative clearance.`);
    }

    const incident = await repository.incidents.findById(incidentId);
    if (!incident) throw new Error(`Incident ${incidentId} not found.`);

    const now = new Date().toISOString();
    const review: IncidentSupervisoryReview = {
      decision: payload.decision,
      reviewedByUserId: supervisor.id,
      reviewedByUserName: supervisor.name,
      reviewedByUserRole: supervisor.role,
      reviewedAt: now,
      notes: payload.notes
    };
    incident.supervisoryReview = review;

    let targetStatus: IncidentStatus = incident.status;
    let eventType: any = 'SUPERVISORY_REVIEW_COMPLETED';

    if (payload.decision === 'APPROVE_CLOSURE') {
      targetStatus = 'CLOSED';
      incident.status = 'CLOSED';
      incident.closedAt = now;
      eventType = 'INCIDENT_CLOSED';
    } else if (payload.decision === 'RETURN_FOR_REVIEW') {
      targetStatus = 'ACTIVE';
      incident.status = 'ACTIVE';
    }

    const note = `SUPERVISORY REVIEW: Decision '${payload.decision}' by ${supervisor.name} (${supervisor.role}). Notes: ${payload.notes || 'None'}`;
    incident.notes.push(note);

    const event: IncidentTimelineEvent = {
      id: `ev-${Date.now().toString(36)}-review`,
      incidentId,
      eventType,
      actorUserId: supervisor.id,
      actorName: supervisor.name,
      actorRole: supervisor.role,
      timestamp: now,
      notes: note,
      payload: review as any
    };

    if (!incident.timeline) incident.timeline = [];
    incident.timeline.push(event);

    await repository.incidents.update(incidentId, {
      status: targetStatus,
      supervisoryReview: review
    });
    await repository.incidents.addEvent(incidentId, event);

    db.logAuditEvent({
      actionType: payload.decision === 'APPROVE_CLOSURE' ? 'INCIDENT_CLOSED' : 'SUPERVISORY_REVIEW_COMPLETED',
      actorUserId: supervisor.id,
      actorName: supervisor.name,
      actorRole: supervisor.role,
      targetEntity: 'INCIDENT',
      targetId: incidentId,
      details: { decision: payload.decision, notes: payload.notes }
    });

    this.emitDelta('INCIDENT_CLOSED', incident);
    return incident;
  }

  // ----------------------------------------------------
  // SLA ENGINE & CONTROLLED ESCALATIONS
  // ----------------------------------------------------
  public evaluateSlaMetrics(incident: IncidentAlert): IncidentSlaMetrics {
    const now = Date.now();
    const createdTime = new Date(incident.timestamp).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((now - createdTime) / 1000));
    const slaTargetSeconds = incident.slaTargetSeconds || this.calculateSlaTarget(incident.severity);

    const slaBreached = elapsedSeconds > slaTargetSeconds && incident.status !== 'RESOLVED' && incident.status !== 'CLOSED';

    let timeToClaimSeconds: number | undefined;
    if (incident.claimedAt) {
      timeToClaimSeconds = Math.max(0, Math.floor((new Date(incident.claimedAt).getTime() - createdTime) / 1000));
    }

    let timeToDispatchSeconds: number | undefined;
    if (incident.dispatchedAt) {
      timeToDispatchSeconds = Math.max(0, Math.floor((new Date(incident.dispatchedAt).getTime() - createdTime) / 1000));
    }

    let timeToAcceptSeconds: number | undefined;
    if (incident.responderAcceptedAt) {
      timeToAcceptSeconds = Math.max(0, Math.floor((new Date(incident.responderAcceptedAt).getTime() - createdTime) / 1000));
    }

    let timeToArriveSeconds: number | undefined;
    if (incident.responderArrivedAt) {
      timeToArriveSeconds = Math.max(0, Math.floor((new Date(incident.responderArrivedAt).getTime() - createdTime) / 1000));
    }

    let timeToResolveSeconds: number | undefined;
    if (incident.resolvedAt) {
      timeToResolveSeconds = Math.max(0, Math.floor((new Date(incident.resolvedAt).getTime() - createdTime) / 1000));
    }

    return {
      slaTargetSeconds,
      elapsedSeconds,
      slaBreached,
      slaBreachedAt: incident.slaBreachedAt || (slaBreached ? new Date().toISOString() : undefined),
      timeToClaimSeconds,
      timeToDispatchSeconds,
      timeToAcceptSeconds,
      timeToArriveSeconds,
      timeToResolveSeconds
    };
  }

  public async evaluateAllActiveSlas(): Promise<{ evaluatedCount: number; breachedCount: number; escalatedIncidents: string[] }> {
    const activeIncidents = Array.from(db.incidents.values()).filter(
      i => i.status !== 'RESOLVED' && i.status !== 'CLOSED'
    );

    let breachedCount = 0;
    const escalatedIncidents: string[] = [];

    for (const inc of activeIncidents) {
      const metrics = this.evaluateSlaMetrics(inc);
      inc.elapsedSeconds = metrics.elapsedSeconds;

      if (metrics.slaBreached && !inc.slaBreached) {
        inc.slaBreached = true;
        inc.slaBreachedAt = metrics.slaBreachedAt;
        inc.escalationCount = (inc.escalationCount || 0) + 1;
        inc.lastEscalatedAt = new Date().toISOString();

        const breachMsg = `SLA BREACH DETECTED: Elapsed time (${metrics.elapsedSeconds}s) exceeded target SLA of ${metrics.slaTargetSeconds}s for severity ${inc.severity}. Immediate supervisory escalation.`;
        inc.notes.push(breachMsg);

        const event: IncidentTimelineEvent = {
          id: `ev-${Date.now().toString(36)}-sla-breach`,
          incidentId: inc.id,
          eventType: 'INCIDENT_ESCALATED',
          actorName: 'ITIS SLA & Escalation Engine',
          actorRole: 'SYSTEM_AUTOMATION',
          timestamp: new Date().toISOString(),
          notes: breachMsg,
          payload: { elapsedSeconds: metrics.elapsedSeconds, slaTargetSeconds: metrics.slaTargetSeconds }
        };

        if (!inc.timeline) inc.timeline = [];
        inc.timeline.push(event);

        db.logAuditEvent({
          actionType: 'INCIDENT_ESCALATED',
          actorUserId: 'sys-sla-engine',
          actorName: 'ITIS SLA Engine',
          actorRole: 'SYSTEM_AUTOMATION',
          targetEntity: 'INCIDENT',
          targetId: inc.id,
          details: {
            reason: 'SLA_BREACH',
            elapsedSeconds: metrics.elapsedSeconds,
            slaTargetSeconds: metrics.slaTargetSeconds,
            severity: inc.severity
          }
        });

        breachedCount++;
        escalatedIncidents.push(inc.id);
        this.emitDelta('SLA_BREACH_ALERT', { incidentId: inc.id, metrics });
      }
    }

    return { evaluatedCount: activeIncidents.length, breachedCount, escalatedIncidents };
  }

  // ----------------------------------------------------
  // NEED-TO-KNOW SCOPING & MASKING
  // ----------------------------------------------------
  public canUserAccessIncident(user: ActiveUserSession, incident: IncidentAlert): boolean {
    if (user.role === 'TECHNICIAN') {
      return false; // Technicians have no operational access to incidents
    }

    if (user.role === 'PARENT_GUARDIAN') {
      if (!user.guardianId) return false;
      const childSet = db.guardianLearnersIndex.get(user.guardianId);
      return Boolean(childSet && childSet.has(incident.learnerId));
    }

    if (user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF') {
      if (!user.schoolId) return false;
      return incident.schoolId === user.schoolId;
    }

    if (user.role === 'FIELD_RESPONDER') {
      return (
        incident.assignedResponder?.id === user.id ||
        incident.assignedResponder?.vehicleId === user.responderUnit ||
        incident.assignedResponder?.id === user.responderUnit
      );
    }

    // Founders, Command Officers, System Admins, and Government Auditors can access (Auditors read-only)
    return true;
  }

  public canUserModifyIncident(user: ActiveUserSession, incident: IncidentAlert, action: string): boolean {
    if (user.role === 'GOVERNMENT_AUDITOR') {
      return false; // Government Auditors are strictly read-only
    }
    if (user.role === 'TECHNICIAN') {
      return false;
    }
    if (user.role === 'PARENT_GUARDIAN') {
      return false; // Guardians cannot modify operational incident records
    }
    if (user.role === 'FIELD_RESPONDER') {
      const isAssigned = 
        incident.assignedResponder?.id === user.id ||
        incident.assignedResponder?.vehicleId === user.responderUnit ||
        incident.assignedResponder?.id === user.responderUnit;
      if (!isAssigned) return false;
      return ['ACCEPT', 'EN_ROUTE', 'ARRIVE', 'SECURE', 'ASSIST', 'RESOLVE'].includes(action);
    }
    return true;
  }

  public maskIncidentForUser(incident: IncidentAlert, user: ActiveUserSession): IncidentAlert {
    const cloned = JSON.parse(JSON.stringify(incident)) as IncidentAlert;

    if (user.role === 'PARENT_GUARDIAN') {
      // Guardians see their child's safety status, but tactical responder details and command officer notes are masked
      cloned.notes = cloned.notes.filter(n => !n.includes('[COMMAND') && !n.includes('TACTICAL'));
      if (cloned.assignedResponder) {
        cloned.assignedResponder = {
          id: 'masked-responder-unit',
          name: `${cloned.assignedResponder.unitType} Emergency Patrol`,
          unitType: cloned.assignedResponder.unitType,
          vehicleId: 'DISPATCHED_UNIT',
          etaMinutes: cloned.assignedResponder.etaMinutes,
          lastLocationUpdate: cloned.assignedResponder.lastLocationUpdate
        };
      }
    } else if (user.role === 'GOVERNMENT_AUDITOR') {
      // Auditors see compliance telemetry, but mobile numbers are masked for POPIA compliance
      cloned.guardianMobile = 'PROTECTED_POPIA_AUDIT_MASK';
    }

    return cloned;
  }

  // ----------------------------------------------------
  // HELPERS
  // ----------------------------------------------------
  private calculateSlaTarget(severity: IncidentSeverity): number {
    switch (severity) {
      case 'CRITICAL_SOS':
      case 'CRITICAL':
        return 180; // 3 min
      case 'HIGH':
        return 300; // 5 min
      case 'MEDIUM':
        return 600; // 10 min
      case 'LOW':
      default:
        return 1200; // 20 min
    }
  }

  private assertResponderAuthorization(responderUser: ActiveUserSession, incident: IncidentAlert) {
    if (responderUser.role === 'COMMAND_OPERATOR' || responderUser.role === 'SYSTEM_ADMIN' || responderUser.role === 'FOUNDER_EXECUTIVE') {
      return; // Dispatchers can override
    }

    if (responderUser.role !== 'FIELD_RESPONDER') {
      throw new Error(`ACCESS DENIED: Role '${responderUser.role}' cannot act as a field responder.`);
    }

    const assigned = incident.assignedResponder;
    const matches = 
      assigned?.id === responderUser.id || 
      assigned?.id === responderUser.responderUnit ||
      assigned?.vehicleId === responderUser.responderUnit ||
      (responderUser.responderUnit && assigned?.name?.toLowerCase().includes(responderUser.responderUnit.toLowerCase()));

    if (!matches) {
      throw new Error(`ACCESS DENIED: You are not the dispatched responder for incident '${incident.id}'.`);
    }
  }
}

export const incidentLifecycleEngine = new IncidentLifecycleEngine();
