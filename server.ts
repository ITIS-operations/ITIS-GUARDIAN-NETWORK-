import express from 'express';
import cors from 'cors';
import path from 'path';
import { db, maskSaId } from './src/server/dbStore.js';
import { repository, ProductionMigrationEngine } from './src/server/db/index.js';
import { bootstrapDatabase } from './src/server/db/bootstrap.js';
import { enrolmentEngine } from './src/server/enrolmentEngine.js';
import { rbacEngine, AUTHORITATIVE_ROLE_MATRIX, ResourceAccessContext } from './src/server/rbacEngine.js';
import { rbacTestSuite } from './src/server/rbacTestSuite.js';
import { enrolmentTestSuite } from './src/server/enrolmentTestSuite.js';
import { IncidentAlert, ActiveUserSession, PermissionKey, UserRole } from './src/types.js';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ----------------------------------------------------
// RBAC & ABAC SECURITY MIDDLEWARE
// ----------------------------------------------------

declare global {
  namespace Express {
    interface Request {
      user?: ActiveUserSession | null;
      permissions?: string[];
    }
  }
}

// Session resolution middleware (Non-blocking: populates req.user if token is present)
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const sessionRecord = db.getSession(authHeader);
    if (sessionRecord) {
      req.user = sessionRecord.session;
      req.permissions = sessionRecord.permissions;
    }
  }
  next();
});

// Enforce authenticated session
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED: A valid sovereign session token is required to access this endpoint.'
    });
  }
  next();
}

// Helpers for ABAC evaluation
const abacHelpers = {
  isGuardianLinkedToLearner: (guardianId: string, learnerId: string): boolean => {
    for (const rel of db.relationships.values()) {
      if (rel.guardianId === guardianId && rel.learnerId === learnerId) {
        return true;
      }
    }
    return false;
  },
  isLearnerEnrolledInSchool: (learnerId: string, schoolId: string): boolean => {
    for (const enr of db.enrolments.values()) {
      if (enr.learnerId === learnerId && enr.schoolId === schoolId && enr.enrolmentStatus === 'ACTIVE') {
        return true;
      }
    }
    return false;
  },
  isIncidentAssignedToResponder: (incidentId: string, responderUnit?: string, responderId?: string): boolean => {
    const incident = db.incidents.get(incidentId);
    if (!incident || !incident.assignedResponder) return false;
    const unit = db.responderUnits.get(incident.assignedResponder.id);
    return (
      incident.assignedResponder.vehicleId === responderUnit ||
      incident.assignedResponder.id === responderUnit ||
      incident.assignedResponder.id === responderId ||
      unit?.assignedUserId === responderId ||
      incident.assignedResponder.id === 'resp-saps-01'
    );
  }
};

// Express Guard enforcing fine-grained RBAC + ABAC
function enforcePermission(
  permission: PermissionKey,
  contextExtractor?: (req: express.Request) => ResourceAccessContext
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED: Sign in with registered credentials to access this protected service.'
      });
    }

    const context = contextExtractor ? contextExtractor(req) : undefined;
    const decision = rbacEngine.evaluateAccess(req.user, permission, context, abacHelpers);

    if (!decision.allowed) {
      // Record immutable audit log event on authorization violation
      if (decision.auditActionRequired) {
        db.logAuditEvent({
          actionType: (decision.auditAction as any) || 'UNAUTHORIZED_ACCESS_DENIED',
          actorUserId: req.user.id,
          actorName: req.user.name,
          actorRole: req.user.role,
          targetEntity: 'SYSTEM',
          targetId: req.path,
          details: {
            endpoint: req.originalUrl || req.path,
            method: req.method,
            requiredPermission: permission,
            decisionReason: decision.reason,
            ...decision.auditDetails
          },
          ipAddress: req.ip || '127.0.0.1'
        });
      }

      return res.status(decision.statusCode).json({
        error: decision.reason,
        violationCode: decision.auditAction || 'ACCESS_DENIED',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

// ----------------------------------------------------
// 0. AUTHENTICATION & SESSION ENDPOINTS
// [FOUNDER DEVELOPMENT AUTHENTICATION]
// Development/testing mode: Simple Email + Password verification.
// All roles, permissions, scopes, and session tokens are determined
// server-side by the database without client-side role trust.
// ----------------------------------------------------

app.post('/api/auth/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const authResult = db.authenticateUser(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid registered identity credentials. Access Denied.' });
    }

    res.json({
      success: true,
      user: authResult.user,
      token: authResult.token,
      permissions: authResult.permissions,
      scope: authResult.scope
    });
  } catch (err: any) {
    if (err.message && (err.message.includes('SUSPENDED') || err.message.includes('DISABLED'))) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// Self-registration endpoint for Guardians, School Staff, Responders, etc.
app.post('/api/auth/register', (req, res) => {
  try {
    const result = db.registerPublicUser(req.body);
    res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
      permissions: result.permissions,
      scope: result.scope
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

app.get('/api/auth/session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const sessionRecord = db.getSession(authHeader);
  if (!sessionRecord) {
    return res.status(401).json({ error: 'Invalid or expired server session' });
  }

  res.json({
    user: sessionRecord.session,
    permissions: sessionRecord.permissions
  });
});

// Alias endpoint /api/auth/me for standard session introspection
app.get('/api/auth/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const sessionRecord = db.getSession(authHeader);
  if (!sessionRecord) {
    return res.status(401).json({ error: 'Invalid or expired server session' });
  }

  res.json({
    user: sessionRecord.session,
    permissions: sessionRecord.permissions
  });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || req.body?.token;
  if (authHeader) {
    db.revokeSession(authHeader);
  }
  res.json({ success: true, message: 'Server session revoked successfully' });
});

// ----------------------------------------------------
// 1. RBAC MATRIX & SECURITY AUDIT TEST SUITE ENDPOINTS
// ----------------------------------------------------

// Canonical Authoritative 9-Role Permission Matrix Specification
app.get('/api/rbac/matrix', (req, res) => {
  res.json({
    framework: 'ITIS Sovereign RBAC & ABAC Architecture (Phase RBAC-02)',
    rolesCount: Object.keys(AUTHORITATIVE_ROLE_MATRIX).length,
    matrix: AUTHORITATIVE_ROLE_MATRIX,
    immutableLogging: 'SHA-256 Chain Verified'
  });
});

// Active Caller Clearance Inspector
app.get('/api/rbac/my-clearance', requireAuth, (req, res) => {
  const user = req.user!;
  const roleDef = AUTHORITATIVE_ROLE_MATRIX[user.role];
  res.json({
    user,
    roleDefinition: roleDef,
    effectivePermissions: user.role === 'FOUNDER_EXECUTIVE' ? ['*'] : roleDef?.permissions || [],
    isSoleUserCreator: roleDef?.isSoleUserCreator || false
  });
});

// Run Live Server-Authoritative Security Test Suite (All 12+ scenarios)
app.post('/api/rbac/run-security-suite', (req, res) => {
  const report = rbacTestSuite.runAllSecurityTests();
  res.json(report);
});

// ----------------------------------------------------
// 2. PLATFORM USER MANAGEMENT (FOUNDER-EXCLUSIVE ONLY)
// ----------------------------------------------------

// TEMPORARY FOUNDER PASSWORD MANAGEMENT (DEVELOPMENT / TESTING ONLY)
app.post('/api/founder/update-password', requireAuth, (req, res) => {
  try {
    const actorUser = req.user!;
    if (actorUser.role !== 'FOUNDER_EXECUTIVE') {
      db.logAuditEvent({
        actionType: 'UNAUTHORIZED_ACCESS_DENIED',
        actorUserId: actorUser.id,
        actorName: actorUser.name,
        actorRole: actorUser.role,
        targetEntity: 'USER',
        targetId: 'USR-SUPER-001',
        details: {
          violation: 'NON_FOUNDER_PASSWORD_MANAGEMENT_ATTEMPT',
          accountTarget: 'founder@itis365.co.za'
        },
        ipAddress: req.ip || '127.0.0.1'
      });
      return res.status(403).json({
        error: '403 Forbidden: Only authenticated Founder/SuperAdmin is authorized to update Founder credentials.',
        violationCode: 'UNAUTHORIZED_FOUNDER_PASSWORD_UPDATE_ATTEMPT'
      });
    }

    const { newPassword, confirmPassword } = req.body || {};
    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required.' });
    }
    if (!confirmPassword || typeof confirmPassword !== 'string') {
      return res.status(400).json({ error: 'Password confirmation is required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation password do not match.' });
    }

    // Server-side password update & hashing & policy enforcement
    const result = db.updateFounderPassword(actorUser, newPassword);
    res.json(result);
  } catch (err: any) {
    if (err.message && err.message.includes('ACCESS DENIED')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(400).json({ error: err.message || 'Failed to update Founder password.' });
  }
});

// PROTECTED FOUNDER DEVELOPMENT RECOVERY ENDPOINT (DEV/TESTING ONLY)
// Strictly guarded: only available in non-production environments to recover locked Founder credentials
app.post('/api/dev/recover-founder', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'FORBIDDEN: Development recovery is strictly disabled in production deployment mode.'
    });
  }

  try {
    const { newPassword, confirmPassword, devSecret } = req.body || {};

    if (process.env.DEV_RECOVERY_SECRET && devSecret !== process.env.DEV_RECOVERY_SECRET) {
      return res.status(401).json({ error: 'Unauthorized: Invalid development recovery secret.' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required.' });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirmation password do not match.' });
    }

    const result = db.recoverFounderCredential(newPassword, {
      devSecret: devSecret ? 'PROVIDED' : 'DEFAULT_DEV',
      source: `API_DEV_RECOVERY (${req.ip || '127.0.0.1'})`
    });

    res.json({
      success: true,
      message: result.message,
      account: 'founder@itis365.co.za',
      id: 'USR-SUPER-001',
      role: 'SuperAdmin / Founder'
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Founder credential recovery failed.' });
  }
});

app.get('/api/users', requireAuth, (req, res) => {
  try {
    const users = db.getUsers(req.user!);
    res.json(users);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// CRITICAL RULE: Only Founder/SuperAdmin may create platform user accounts
app.post('/api/users', requireAuth, (req, res) => {
  try {
    const {
      email,
      name,
      firstName,
      surname,
      mobileNumber,
      role,
      password,
      schoolId,
      guardianId,
      responderUnit,
      department,
      organization,
      status,
      permissions
    } = req.body;
    
    // Evaluate permission using Authoritative RBAC Engine
    const decision = rbacEngine.evaluateAccess(req.user!, 'USER_IDENTITIES_MANAGE', { targetUserRole: role });
    if (!decision.allowed || req.user!.role !== 'FOUNDER_EXECUTIVE') {
      db.logAuditEvent({
        actionType: 'UNAUTHORIZED_USER_CREATION_ATTEMPT',
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        targetEntity: 'USER',
        targetId: email || 'unknown',
        details: {
          violation: 'NON_FOUNDER_USER_CREATION_ATTEMPT',
          attemptedRole: role,
          attemptedBy: req.user!.role
        },
        ipAddress: req.ip || '127.0.0.1'
      });
      return res.status(403).json({
        error: 'ACCESS DENIED: Only Founder/SuperAdmin is authorized to create platform user identities or assign system roles.',
        violationCode: 'UNAUTHORIZED_USER_CREATION_ATTEMPT'
      });
    }

    const created = db.createUser(req.user!, {
      email,
      name,
      firstName,
      surname,
      mobileNumber,
      role,
      password,
      schoolId,
      guardianId,
      responderUnit,
      department,
      organization,
      status,
      permissions
    });

    res.status(201).json(created);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/users/:id/status', requireAuth, (req, res) => {
  try {
    if (req.user!.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({ error: 'ACCESS DENIED: Only Founder/SuperAdmin may modify platform user account status.' });
    }
    const { status } = req.body;
    if (!status || !['ACTIVE', 'SUSPENDED', 'DISABLED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Allowed: ACTIVE, SUSPENDED, DISABLED.' });
    }
    const updated = db.updateUserStatus(req.user!, req.params.id, status);
    res.json({ success: true, user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/users/:id/deactivate', requireAuth, (req, res) => {
  try {
    const decision = rbacEngine.evaluateAccess(req.user!, 'USER_IDENTITIES_MANAGE');
    if (!decision.allowed || req.user!.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({ error: 'ACCESS DENIED: Only Founder/SuperAdmin may deactivate platform users.' });
    }
    db.deactivateUser(req.user!, req.params.id);
    res.json({ success: true, message: `User ${req.params.id} deactivated successfully.` });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 3. HEALTH & CORE TELEMETRY
// ----------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'ITIS Authoritative Core Engine',
    securityEngine: 'Phase RBAC-02 Authoritative Matrix Active',
    timestamp: new Date().toISOString(),
    stats: {
      registeredPersons: db.persons.size,
      authoritativeLearners: db.learners.size,
      authoritativeGuardians: db.guardians.size,
      relationshipsCount: db.relationships.size,
      activeEnrolments: db.enrolments.size,
      auditEventsCount: db.auditLogs.length
    }
  });
});

// ----------------------------------------------------
// 4. IDENTITY SEARCH & ENROLMENT ONBOARDING
// ----------------------------------------------------

app.post(
  '/api/enrolment/search-identity',
  requireAuth,
  enforcePermission('ENROLMENT_MANAGE'),
  (req, res) => {
    try {
      const { saIdNumber, mobileNumber, emisId, firstName, lastName, dateOfBirth } = req.body;
      const result = enrolmentEngine.searchIdentity({
        saIdNumber,
        mobileNumber,
        emisId,
        firstName,
        lastName,
        dateOfBirth
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Authoritative Onboarding (Requires ENROLMENT_MANAGE / LEARNERS_REGISTER)
app.post(
  '/api/enrolment/authoritative-onboard',
  requireAuth,
  enforcePermission('ENROLMENT_MANAGE', req => ({ schoolId: req.body?.enrolment?.schoolId })),
  (req, res) => {
    try {
      const payload = req.body;
      // Ensure staff context always reflects verified authenticated user
      const authoritativePayload = {
        ...payload,
        staffContext: {
          staffUserId: req.user!.id,
          staffName: req.user!.name,
          staffRole: req.user!.role,
          ipAddress: req.ip || '127.0.0.1'
        }
      };
      const result = enrolmentEngine.authoritativeOnboard(authoritativePayload);
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Advance Academic Year
app.post(
  '/api/enrolment/advance-grade',
  requireAuth,
  enforcePermission('ENROLMENT_MANAGE', req => ({ schoolId: req.body?.schoolId })),
  (req, res) => {
    try {
      const { learnerId, schoolId, newYear, newGrade, newClassSection, homeroomTeacher } = req.body;
      const result = enrolmentEngine.advanceAcademicYear({
        learnerId,
        schoolId,
        newYear,
        newGrade,
        newClassSection,
        homeroomTeacher,
        staffContext: {
          staffUserId: req.user!.id,
          staffName: req.user!.name,
          staffRole: req.user!.role,
          ipAddress: req.ip || '127.0.0.1'
        }
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Annual Learner Safety & Information Update (Never duplicates Person/Learner ID)
app.post(
  '/api/enrolment/annual-safety-update',
  requireAuth,
  enforcePermission('ENROLMENT_MANAGE', req => ({ schoolId: req.body?.schoolId })),
  (req, res) => {
    try {
      const payload = req.body;
      const staffContext = {
        staffUserId: req.user!.id,
        staffName: req.user!.name,
        staffRole: req.user!.role,
        ipAddress: req.ip || '127.0.0.1'
      };
      const result = enrolmentEngine.annualLearnerSafetyUpdate({
        ...payload,
        staffContext
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Link / Assign Approved Hardware Device (Capture-Once Enrolment Administration)
app.post(
  '/api/devices/assign',
  requireAuth,
  enforcePermission('ENROLMENT_MANAGE', req => ({ schoolId: req.body?.schoolId })),
  (req, res) => {
    try {
      const { learnerId, trackingBeaconId, schoolId, forceReassign } = req.body;
      if (!learnerId || !trackingBeaconId) {
        return res.status(400).json({ error: 'learnerId and trackingBeaconId are required parameters.' });
      }

      const result = enrolmentEngine.assignDeviceToLearner({
        learnerId,
        trackingBeaconId,
        schoolId,
        forceReassign: !!forceReassign,
        staffContext: {
          staffUserId: req.user!.id,
          staffName: req.user!.name,
          staffRole: req.user!.role,
          ipAddress: req.ip || '127.0.0.1'
        }
      });
      res.json(result);
    } catch (err: any) {
      if (err.message && err.message.includes('ACCESS DENIED')) {
        return res.status(403).json({ error: err.message });
      }
      res.status(400).json({ error: err.message });
    }
  }
);

// Run Live Enrolment & Duplicate Prevention Validation Test Suite
app.post('/api/enrolment/run-validation-suite', (req, res) => {
  try {
    const report = enrolmentTestSuite.runAllEnrolmentValidationTests();
    res.json(report);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------
// 5. LEARNERS & SCOPED ACCESS (HIGH-SCALE PAGINATED & INDEXED)
// ----------------------------------------------------

app.get('/api/learners', requireAuth, (req, res) => {
  const user = req.user!;
  const { schoolId, guardianId, search, grade, page, limit, offset, paginated } = req.query;

  // Institutional boundary check for school staff
  if ((user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF') && user.schoolId) {
    if (schoolId && schoolId !== user.schoolId) {
      db.logAuditEvent({
        actionType: 'UNAUTHORIZED_ACCESS_DENIED',
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        targetEntity: 'LEARNER',
        targetId: 'CROSS_SCHOOL_QUERY',
        details: { attemptedSchoolId: schoolId, allowedSchoolId: user.schoolId }
      });
      return res.status(403).json({
        error: `ACCESS DENIED: Institutional boundary violation. You are restricted to school '${user.schoolId}'.`
      });
    }
  }

  // Technicians cannot browse learner PII
  if (user.role === 'TECHNICIAN') {
    return res.status(403).json({
      error: 'ACCESS DENIED: Hardware technicians lack clearance to browse personal learner safety records.'
    });
  }

  const queryOptions = {
    schoolId: (schoolId as string) || (user.role.startsWith('SCHOOL_') ? user.schoolId : undefined),
    guardianId: (guardianId as string) || (user.role === 'PARENT_GUARDIAN' ? user.guardianId : undefined),
    search: search as string,
    grade: grade as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined,
    offset: offset ? Number(offset) : undefined
  };

  const paginatedResult = db.queryPaginatedLearners(queryOptions, user);
  const sanitizedData = paginatedResult.data.map(l => rbacEngine.sanitizeLearnerRecord(l, user));

  if (paginated === 'true' || page !== undefined || limit !== undefined) {
    return res.json({
      data: sanitizedData,
      pagination: paginatedResult.pagination
    });
  }

  // Backward compatibility for standard array requests
  res.json(sanitizedData);
});

// Single Learner Inspection (Strict ABAC Check)
app.get('/api/learners/:id', requireAuth, (req, res) => {
  const user = req.user!;
  const learnerId = req.params.id;

  const decision = rbacEngine.evaluateAccess(
    user,
    user.role === 'PARENT_GUARDIAN' ? 'GUARDIAN_CHILDREN_VIEW' : 'LEARNERS_VIEW_SCOPED',
    { learnerId },
    abacHelpers
  );

  if (!decision.allowed) {
    if (decision.auditActionRequired) {
      db.logAuditEvent({
        actionType: (decision.auditAction as any) || 'UNAUTHORIZED_ACCESS_DENIED',
        actorUserId: user.id,
        actorName: user.name,
        actorRole: user.role,
        targetEntity: 'LEARNER',
        targetId: learnerId,
        details: { reason: decision.reason, ...decision.auditDetails }
      });
    }
    return res.status(decision.statusCode).json({ error: decision.reason });
  }

  const hydrated = db.getHydratedLearner(learnerId);
  if (!hydrated) {
    return res.status(404).json({ error: 'Learner record not found.' });
  }

  const sanitized = rbacEngine.sanitizeLearnerRecord(hydrated, user);
  res.json(sanitized);
});

// ----------------------------------------------------
// 6. SCHOOLS & GUARDIANS REGISTRIES (INDEXED & PAGINATED)
// ----------------------------------------------------

app.get('/api/schools', (req, res) => {
  const { search, province, district, page, limit, paginated } = req.query;
  
  if (paginated === 'true' || page !== undefined || limit !== undefined || search !== undefined) {
    const result = db.queryPaginatedSchools({
      search: search as string,
      province: province as string,
      district: district as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    });
    return res.json(paginated === 'true' || page !== undefined || limit !== undefined ? result : result.data);
  }

  res.json(Array.from(db.schools.values()));
});

// Authoritative School Registration (Admins & Founders)
app.post('/api/schools', requireAuth, (req, res) => {
  try {
    const user = req.user!;
    if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({
        error: 'ACCESS DENIED: Only System Administrators and Founder Executives are authorized to register authoritative schools into the national registry.'
      });
    }

    const { name, emisCode, district, province, address, principalName, contactPhone, contactEmail, geofenceCenter } = req.body;
    if (!name || !emisCode || !district || !province || !principalName) {
      return res.status(400).json({ error: 'Missing required school registration fields (name, emisCode, district, province, principalName).' });
    }

    const newSchool = enrolmentEngine.registerSchool({
      name,
      emisCode,
      district,
      province,
      address: address || '',
      principalName,
      contactPhone: contactPhone || '',
      contactEmail: contactEmail || '',
      geofenceCenter: geofenceCenter || { lat: -26.2041, lng: 28.0473, radiusMeters: 500 },
      staffContext: {
        staffUserId: user.id,
        staffName: user.name,
        staffRole: user.role
      }
    });

    res.status(201).json(newSchool);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/guardians', requireAuth, (req, res) => {
  const user = req.user!;
  let list = Array.from(db.guardians.values()).map(g => {
    const p = db.persons.get(g.personId);
    const linkedChildren = enrolmentEngine.getLinkedChildrenForGuardian(g.id);
    return {
      guardian: g,
      person: p,
      linkedChildren
    };
  });

  // If Guardian, return only self
  if (user.role === 'PARENT_GUARDIAN' && user.guardianId) {
    list = list.filter(g => g.guardian.id === user.guardianId);
  }

  res.json(list);
});

// ----------------------------------------------------
// 7. INCIDENTS, SOS & TACTICAL EVENT-DRIVEN DISPATCH
// ----------------------------------------------------

interface IncidentDeltaEvent {
  id: string;
  type: 'NEW_INCIDENT' | 'STATUS_CHANGE' | 'DISPATCH' | 'RESPONDER_ACCEPTED' | 'RESPONDER_EN_ROUTE' | 'RESPONDER_ARRIVED' | 'RESOLUTION';
  incidentId: string;
  timestamp: string;
  payload: Partial<IncidentAlert>;
}

const recentIncidentEvents: IncidentDeltaEvent[] = [];

function recordIncidentDeltaEvent(type: IncidentDeltaEvent['type'], incident: IncidentAlert) {
  const event: IncidentDeltaEvent = {
    id: 'evt-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6),
    type,
    incidentId: incident.id,
    timestamp: new Date().toISOString(),
    payload: {
      id: incident.id,
      status: incident.status,
      severity: incident.severity,
      operationalState: incident.operationalState,
      assignedResponder: incident.assignedResponder,
      notes: incident.notes,
      timestamp: incident.timestamp
    }
  };

  recentIncidentEvents.unshift(event);
  if (recentIncidentEvents.length > 500) {
    recentIncidentEvents.pop();
  }
}

// Delta events endpoint (Clients receive only what changed without polling the entire incident database)
app.get('/api/incidents/events', requireAuth, (req, res) => {
  const { since } = req.query;
  const sinceMs = since ? new Date(since as string).getTime() : 0;
  
  const deltas = recentIncidentEvents.filter(e => new Date(e.timestamp).getTime() > sinceMs);
  res.json({
    events: deltas,
    latestTimestamp: new Date().toISOString()
  });
});

app.get('/api/incidents', requireAuth, (req, res) => {
  const user = req.user!;
  const { activeOnly, status, severity, schoolId, page, limit, paginated } = req.query;

  if (user.role === 'TECHNICIAN') {
    return res.status(403).json({
      error: 'ACCESS DENIED: Technicians lack operational clearance to monitor live tactical emergencies.'
    });
  }

  const queryOptions = {
    activeOnly: activeOnly === 'true',
    status: status as string,
    severity: severity as string,
    schoolId: schoolId as string,
    page: page ? Number(page) : undefined,
    limit: limit ? Number(limit) : undefined
  };

  const paginatedResult = db.queryPaginatedIncidents(queryOptions, user);

  if (paginated === 'true' || page !== undefined || limit !== undefined) {
    return res.json(paginatedResult);
  }

  res.json(paginatedResult.data);
});

// Manual SOS Panic Trigger
app.post('/api/incidents/panic-trigger', (req, res) => {
  try {
    const { learnerId, triggerType, location, customNotes } = req.body;
    const learner = db.learners.get(learnerId);
    if (!learner) return res.status(404).json({ error: 'Learner not found' });

    const person = db.persons.get(learner.personId);
    const hydrated = db.getHydratedLearner(learnerId);

    const id = 'inc-' + Date.now().toString().slice(-6);
    const newIncident: IncidentAlert = {
      id,
      learnerId: learner.id,
      learnerName: person ? `${person.firstName} ${person.lastName}` : 'Unknown Learner',
      learnerGrade: hydrated?.currentAcademicRecord ? `${hydrated.currentAcademicRecord.grade} (${hydrated.currentAcademicRecord.classSection})` : 'Grade 10',
      schoolId: hydrated?.currentSchool?.id || 'sch-001',
      schoolName: hydrated?.currentSchool?.name || 'Pretoria Boys High School',
      guardianName: hydrated?.guardians[0] ? `${hydrated.guardians[0].person.firstName} ${hydrated.guardians[0].person.lastName} (${hydrated.guardians[0].relationship.relationshipType})` : 'Emergency Guardian',
      guardianMobile: hydrated?.guardians[0]?.guardian.mobileNumber || '+27 82 000 0000',
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL_SOS',
      status: 'ACTIVE_ALARM',
      triggerType: triggerType || 'APP_PANIC',
      location: location || {
        lat: -25.7592,
        lng: 28.2340,
        addressDescription: 'Brooklyn Safe Zone - South Gate Corridor',
        accuracyMeters: 3.5
      },
      assignedResponder: {
        id: 'resp-saps-01',
        name: 'SAPS Sunnyside Sector 2 Unit B',
        unitType: 'SAPS',
        vehicleId: 'SAPS-GP-9912',
        etaMinutes: 3
      },
      slaTargetSeconds: 180,
      elapsedSeconds: 0,
      notes: [
        `CRITICAL: SOS Panic activated at ${new Date().toLocaleTimeString()}`,
        customNotes || 'Child initiated manual distress trigger. Authoritative guardian & SAPS alerted.',
        'SAPS Rapid Response auto-dispatched under National Child Protection Directive.'
      ]
    };

    db.incidents.set(id, newIncident);
    recordIncidentDeltaEvent('NEW_INCIDENT', newIncident);

    db.logAuditEvent({
      actionType: 'EMERGENCY_PANIC_TRIGGERED',
      actorUserId: req.user?.id || 'usr-panic-client',
      actorName: req.user?.name || (person ? `${person.firstName} ${person.lastName}` : 'Learner'),
      actorRole: req.user?.role || 'PARENT_GUARDIAN',
      targetEntity: 'INCIDENT',
      targetId: id,
      details: {
        learnerName: newIncident.learnerName,
        triggerType: newIncident.triggerType,
        location: newIncident.location
      }
    });

    res.json(newIncident);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Human-in-the-Loop Responder Dispatch Authorization (Command Officer or Founder Only)
app.post(
  '/api/incidents/dispatch',
  requireAuth,
  enforcePermission('RESPONDER_DISPATCH_AUTHORIZE', req => ({
    incidentId: req.body?.incidentId,
    isHumanDispatch: req.body?.isHumanDispatch !== false
  })),
  (req, res) => {
    try {
      const { incidentId, responderId, responderName, unitType, vehicleId, etaMinutes, note } = req.body;
      const incident = db.incidents.get(incidentId);
      if (!incident) return res.status(404).json({ error: 'Incident not found' });

      incident.status = 'DISPATCHED';
      incident.assignedResponder = {
        id: responderId || 'resp-saps-01',
        name: responderName || 'SAPS Sunnyside Sector 2 Unit B',
        unitType: unitType || 'SAPS',
        vehicleId: vehicleId || 'SAPS-GP-9912',
        etaMinutes: etaMinutes || 3
      };

      if (note) incident.notes.push(note);
      incident.notes.push(`TACTICAL DISPATCH AUTHORIZED by ${req.user!.name} (${req.user!.role}) at ${new Date().toLocaleTimeString()}`);

      recordIncidentDeltaEvent('DISPATCH', incident);

      db.logAuditEvent({
        actionType: 'DISPATCH_ACTIVATED',
        actorUserId: req.user!.id,
        actorName: req.user!.name,
        actorRole: req.user!.role,
        targetEntity: 'INCIDENT',
        targetId: incident.id,
        details: {
          assignedUnit: incident.assignedResponder.name,
          vehicleId: incident.assignedResponder.vehicleId,
          operatorVerification: 'HUMAN_VERIFIED'
        }
      });

      res.json(incident);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// Incident Status Update (Command Officer, Founder, or Assigned Responder)
app.post('/api/incidents/:id/status', requireAuth, (req, res) => {
  const user = req.user!;
  const { status, note } = req.body;
  const incidentId = req.params.id;
  const incident = db.incidents.get(incidentId);
  
  if (!incident) return res.status(404).json({ error: 'Incident not found' });

  // Evaluate status update clearance
  const requiredPermission: PermissionKey = status === 'RESOLVED' ? 'INCIDENT_RESOLVE_CLOSE' : 'RESPONDER_STATUS_UPDATE';
  const decision = rbacEngine.evaluateAccess(
    user,
    requiredPermission,
    { incidentId },
    abacHelpers
  );

  if (!decision.allowed) {
    return res.status(403).json({ error: decision.reason });
  }

  incident.status = status;
  if (note) incident.notes.push(note);
  incident.notes.push(`Status changed to ${status} by ${user.name} (${user.role}) at ${new Date().toLocaleTimeString()}`);

  db.logAuditEvent({
    actionType: status === 'RESOLVED' ? 'INCIDENT_RESOLVED' : 'DISPATCH_ACTIVATED',
    actorUserId: user.id,
    actorName: user.name,
    actorRole: user.role,
    targetEntity: 'INCIDENT',
    targetId: incident.id,
    details: { newStatus: status, note, role: user.role }
  });

  res.json(incident);
});

// ----------------------------------------------------
// 7.1. PHASE RESPONDER-04: "UBER FOR EMERGENCY RESPONSE" DEDICATED APIS
// ----------------------------------------------------

// Responder gets ONLY their assigned active emergency (No browsing permitted)
app.get('/api/responder/assigned-incident', requireAuth, (req, res) => {
  const user = req.user!;
  // Check authorization: FIELD_RESPONDER or Commander/Founder reviewing responder view
  if (user.role !== 'FIELD_RESPONDER' && user.role !== 'FOUNDER_EXECUTIVE' && user.role !== 'COMMAND_OPERATOR') {
    return res.status(403).json({
      error: 'ACCESS_DENIED: Only authorized tactical field responders can receive emergency response assignments.'
    });
  }

  const assignment = db.getAssignedIncidentForResponder(user);
  res.json({ assignment });
});

// Command Officer queries ranked eligible responders for an incident (Distance, Availability, SLA)
app.get(
  '/api/responder/eligible-ranking/:incidentId',
  requireAuth,
  enforcePermission('RESPONDER_DISPATCH_AUTHORIZE'),
  (req, res) => {
    try {
      const rankings = db.getRankedEligibleResponders(req.params.incidentId);
      res.json(rankings);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);

// All Tactical Units Directory (for Command Centre tactical map & dispatch)
app.get('/api/responder/units', requireAuth, (req, res) => {
  res.json(db.getResponderUnits());
});

// Responder Accepts Assigned Emergency
app.post('/api/responder/accept', requireAuth, (req, res) => {
  try {
    const user = req.user!;
    const { incidentId } = req.body;
    if (!incidentId) return res.status(400).json({ error: 'Incident ID is required' });

    // Verify ABAC assignment check
    if (!abacHelpers.isIncidentAssignedToResponder(incidentId, user.responderUnit, user.id) && user.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({
        error: 'FORBIDDEN: You can only accept emergency incidents explicitly dispatched to your tactical unit.'
      });
    }

    const updated = db.acceptIncidentAssignment(incidentId, user);
    const incidentObj = db.incidents.get(incidentId);
    if (incidentObj) {
      recordIncidentDeltaEvent('RESPONDER_ACCEPTED', incidentObj);
    }
    res.json({ success: true, assignment: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Responder Declines Assigned Emergency (Requires mandatory reason)
app.post('/api/responder/decline', requireAuth, (req, res) => {
  try {
    const user = req.user!;
    const { incidentId, reason } = req.body;
    if (!incidentId || !reason) {
      return res.status(400).json({ error: 'Incident ID and a mandatory operational decline reason are required.' });
    }

    // Verify ABAC assignment check
    if (!abacHelpers.isIncidentAssignedToResponder(incidentId, user.responderUnit, user.id) && user.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({
        error: 'FORBIDDEN: You cannot alter assignments for other tactical units.'
      });
    }

    const result = db.declineIncidentAssignment(incidentId, user, reason);
    const incidentObj = db.incidents.get(incidentId);
    if (incidentObj) {
      recordIncidentDeltaEvent('STATUS_CHANGE', incidentObj);
    }
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Responder Updates Tactical Status (EN_ROUTE, ARRIVED, SCENE_SECURED, ASSISTANCE_REQUIRED)
app.post('/api/responder/status', requireAuth, (req, res) => {
  try {
    const user = req.user!;
    const { incidentId, operationalState, note, telemetry } = req.body;
    if (!incidentId || !operationalState) {
      return res.status(400).json({ error: 'Incident ID and operational state are required.' });
    }

    // Verify ABAC assignment check
    if (!abacHelpers.isIncidentAssignedToResponder(incidentId, user.responderUnit, user.id) && user.role !== 'FOUNDER_EXECUTIVE') {
      return res.status(403).json({
        error: 'FORBIDDEN: You are not authorized to update status for an unassigned incident.'
      });
    }

    const updated = db.updateResponderOperationalStatus(incidentId, user, operationalState, note, telemetry);
    const incidentObj = db.incidents.get(incidentId);
    if (incidentObj) {
      const eventType = operationalState === 'EN_ROUTE' ? 'RESPONDER_EN_ROUTE' : operationalState === 'ARRIVED' ? 'RESPONDER_ARRIVED' : 'STATUS_CHANGE';
      recordIncidentDeltaEvent(eventType, incidentObj);
    }
    res.json({ success: true, assignment: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Responder Submits Official Incident Outcome Report
app.post(
  '/api/responder/report',
  requireAuth,
  enforcePermission('INCIDENT_REPORT_SUBMIT', req => ({ incidentId: req.body?.incidentId })),
  (req, res) => {
    try {
      const user = req.user!;
      const report = req.body;
      if (!report.incidentId || !report.learnerCondition || !report.guardianHandoverStatus || !report.handoverPersonName) {
        return res.status(400).json({
          error: 'Incomplete incident report. Learner condition, handover status, and receiving person name are mandatory.'
        });
      }

      const resolvedIncident = db.submitIncidentOutcomeReport(report, user);
      recordIncidentDeltaEvent('RESOLUTION', resolvedIncident);
      res.json({ success: true, incident: resolvedIncident });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  }
);
// ----------------------------------------------------

app.get(
  '/api/audit-logs',
  requireAuth,
  enforcePermission('AUDIT_LOGS_VIEW'),
  (req, res) => {
    const { actionType, actorUserId, targetEntity, targetId, startDate, endDate, search, page, limit, paginated } = req.query;

    const queryOptions = {
      actionType: actionType as any,
      actorUserId: actorUserId as string,
      targetEntity: targetEntity as any,
      targetId: targetId as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined
    };

    const result = db.queryPaginatedAuditLogs(queryOptions);

    if (paginated === 'true' || page !== undefined || limit !== undefined || actionType || search || startDate) {
      return res.json(result);
    }

    res.json(result.data);
  }
);

// ----------------------------------------------------
// PRODUCTION DATABASE READINESS & MIGRATION API
// ----------------------------------------------------
app.get(
  '/api/database/readiness',
  requireAuth,
  enforcePermission('ENTERPRISE_AUDIT_VIEW'),
  async (req, res) => {
    try {
      const health = await repository.checkHealth();
      const validation = ProductionMigrationEngine.validateCurrentStore();
      res.json({
        success: true,
        health,
        validation,
        architecture: {
          targetDatabase: 'PostgreSQL 14+ / Cloud SQL',
          scaleCapacity: '3,000,000+ Enrolled Learners',
          captureOnceCompliance: validation.captureOnceAnomalies.length === 0,
          auditIntegrityCompliant: validation.auditIntegrityPassed
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

app.get(
  '/api/database/migration-plan',
  requireAuth,
  enforcePermission('SYSTEM_CONFIG_MANAGE'),
  (req, res) => {
    try {
      const plan = ProductionMigrationEngine.generateMigrationPlan();
      res.json({ success: true, plan });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ----------------------------------------------------
// FRONTEND STATIC BUNDLE OR VITE DEV SERVER
// ----------------------------------------------------
async function setupServer() {
  try {
    await bootstrapDatabase();
  } catch (err) {
    console.error('[ITIS] Error during database bootstrap:', err);
  }

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Only bind port when running standalone container/server, not in serverless environments
  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`[ITIS] Full-Stack National Child Safety Server with Phase RBAC-02 running on port ${PORT}`);
    });
  }
}

setupServer();

export default app;
export { app };
