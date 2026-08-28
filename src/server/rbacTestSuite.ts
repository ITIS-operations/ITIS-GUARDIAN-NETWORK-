import { rbacEngine, AUTHORITATIVE_ROLE_MATRIX } from './rbacEngine.js';
import { UserRole, ActiveUserSession } from '../types.js';

export interface SecurityTestCaseResult {
  id: string;
  role: UserRole;
  scenario: string;
  targetEndpoint: string;
  attemptedOperation: string;
  expectedStatus: 403 | 200;
  actualStatus: 403 | 200 | 401 | 500;
  passed: boolean;
  blockedBy: string;
  auditEventGenerated: boolean;
  auditAction?: string;
  evidence: string;
}

export interface SecurityTestReport {
  timestamp: string;
  totalTests: number;
  passedCount: number;
  failedCount: number;
  complianceVerdict: 'COMPLIANT' | 'NON_COMPLIANT';
  matrixRolesCount: number;
  results: SecurityTestCaseResult[];
  matrixSummary: typeof AUTHORITATIVE_ROLE_MATRIX;
}

export class RbacSecurityTestSuite {
  public async runAllSecurityTests(): Promise<SecurityTestReport> {
    const results: SecurityTestCaseResult[] = [];

    // Setup dummy sessions for testing
    const founderUser: ActiveUserSession = {
      id: 'usr-founder-01',
      name: 'Executive Director',
      email: 'founder@itis.safety.za',
      role: 'FOUNDER_EXECUTIVE',
      token: 'tok-test-founder'
    };

    const adminUser: ActiveUserSession = {
      id: 'usr-sysadmin-01',
      name: 'Sovereign Administrator',
      email: 'sysadmin@itis.safety.za',
      role: 'SYSTEM_ADMIN',
      token: 'tok-test-admin'
    };

    const principalSchool1: ActiveUserSession = {
      id: 'usr-principal-01',
      name: 'Dr. Gregory Hassenkamp',
      email: 'admin@pbhs.co.za',
      role: 'SCHOOL_PRINCIPAL',
      schoolId: 'sch-001',
      token: 'tok-test-principal'
    };

    const guardianUser1: ActiveUserSession = {
      id: 'usr-parent-01',
      name: 'Grace Molefe',
      email: 'grace.molefe@safetynet.co.za',
      role: 'PARENT_GUARDIAN',
      guardianId: 'grd-001',
      token: 'tok-test-guardian'
    };

    const commandUser: ActiveUserSession = {
      id: 'usr-command-01',
      name: 'Command Officer Sipho Ndlovu',
      email: 'command@itis.safety.za',
      role: 'COMMAND_OPERATOR',
      token: 'tok-test-command'
    };

    const responderUser: ActiveUserSession = {
      id: 'usr-responder-01',
      name: 'SAPS Sunnyside Sector 2 Unit B',
      email: 'saps.sunnyside@saps.gov.za',
      role: 'FIELD_RESPONDER',
      responderUnit: 'SAPS-GP-9912',
      token: 'tok-test-responder'
    };

    const techUser: ActiveUserSession = {
      id: 'usr-tech-01',
      name: 'Thabo Sithole',
      email: 'thabo.tech@itis.safety.za',
      role: 'TECHNICIAN',
      token: 'tok-test-tech'
    };

    const govUser: ActiveUserSession = {
      id: 'usr-auditor-01',
      name: 'Adv. P. Dlamini',
      email: 'audit@dbe.gov.za',
      role: 'GOVERNMENT_AUDITOR',
      token: 'tok-test-gov'
    };

    // Helper functions for relationship / scope evaluation
    const isGuardianLinked = (gId: string, lId: string) => {
      return gId === 'grd-001' && lId === 'lrn-001';
    };

    const isIncidentAssigned = (incId: string, unit?: string) => {
      return incId === 'inc-001' && (unit === 'SAPS-GP-9912' || unit === 'resp-saps-01');
    };

    // TEST 1: Admin attempts to create a platform User Account (Violation: Only Founder may create users)
    const t1Decision = await rbacEngine.evaluateAccess(
      adminUser,
      'USER_IDENTITIES_MANAGE',
      { targetUserRole: 'SYSTEM_ADMIN' }
    );
    results.push({
      id: 'SEC-TEST-01',
      role: 'SYSTEM_ADMIN',
      scenario: 'Admin attempts to create a platform User Account via API',
      targetEndpoint: 'POST /api/users',
      attemptedOperation: 'USER_IDENTITIES_MANAGE',
      expectedStatus: 403,
      actualStatus: t1Decision.statusCode,
      passed: t1Decision.statusCode === 403,
      blockedBy: 'Authoritative User Creation Rule (Founder Exclusive)',
      auditEventGenerated: t1Decision.auditActionRequired === true,
      auditAction: t1Decision.auditAction,
      evidence: t1Decision.reason || 'Blocked'
    });

    // TEST 2: Admin attempts to modify System Security Policies (Founder only)
    const t2Decision = await rbacEngine.evaluateAccess(
      adminUser,
      'SECURITY_POLICIES_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-02',
      role: 'SYSTEM_ADMIN',
      scenario: 'Admin attempts to alter Sovereign Security Policies & Cryptography',
      targetEndpoint: 'POST /api/security/policies',
      attemptedOperation: 'SECURITY_POLICIES_MANAGE',
      expectedStatus: 403,
      actualStatus: t2Decision.statusCode,
      passed: t2Decision.statusCode === 403,
      blockedBy: 'Role Matrix Policy Filter',
      auditEventGenerated: t2Decision.auditActionRequired === true,
      auditAction: t2Decision.auditAction,
      evidence: t2Decision.reason || 'Blocked'
    });

    // TEST 3: School Principal of School 1 attempts to access School 2 records
    const t3Decision = await rbacEngine.evaluateAccess(
      principalSchool1,
      'SCHOOL_RECORDS_MANAGE',
      { schoolId: 'sch-002' }
    );
    results.push({
      id: 'SEC-TEST-03',
      role: 'SCHOOL_PRINCIPAL',
      scenario: 'School Principal of PBHS attempts to access Soweto High (Cross-School Breach)',
      targetEndpoint: 'GET /api/learners?schoolId=sch-002',
      attemptedOperation: 'SCHOOL_RECORDS_MANAGE',
      expectedStatus: 403,
      actualStatus: t3Decision.statusCode,
      passed: t3Decision.statusCode === 403,
      blockedBy: 'Institutional School Geofence ABAC Rule',
      auditEventGenerated: t3Decision.auditActionRequired === true,
      auditAction: t3Decision.auditAction,
      evidence: t3Decision.reason || 'Blocked'
    });

    // TEST 4: School Principal attempts to dispatch Armed Tactical Responders
    const t4Decision = await rbacEngine.evaluateAccess(
      principalSchool1,
      'RESPONDER_DISPATCH_AUTHORIZE'
    );
    results.push({
      id: 'SEC-TEST-04',
      role: 'SCHOOL_PRINCIPAL',
      scenario: 'School Principal attempts to dispatch SAPS Armed Tactical Units directly',
      targetEndpoint: 'POST /api/incidents/dispatch',
      attemptedOperation: 'RESPONDER_DISPATCH_AUTHORIZE',
      expectedStatus: 403,
      actualStatus: t4Decision.statusCode,
      passed: t4Decision.statusCode === 403,
      blockedBy: 'Command Authority Boundary',
      auditEventGenerated: t4Decision.auditActionRequired === true,
      auditAction: t4Decision.auditAction,
      evidence: t4Decision.reason || 'Blocked'
    });

    // TEST 5: Guardian attempts to query unlinked child dossier (POPIA / Child Care Act violation)
    const t5Decision = await rbacEngine.evaluateAccess(
      guardianUser1,
      'GUARDIAN_CHILDREN_VIEW',
      { learnerId: 'lrn-003' }, // Zola Dlamini (Not Grace Molefe's child)
      { isGuardianLinkedToLearner: isGuardianLinked }
    );
    results.push({
      id: 'SEC-TEST-05',
      role: 'PARENT_GUARDIAN',
      scenario: 'Guardian attempts to inspect telemetry of unlinked learner (Zola Dlamini)',
      targetEndpoint: 'GET /api/learners/lrn-003',
      attemptedOperation: 'GUARDIAN_CHILDREN_VIEW',
      expectedStatus: 403,
      actualStatus: t5Decision.statusCode,
      passed: t5Decision.statusCode === 403,
      blockedBy: 'Verified Legal Custody ABAC Relationship Guard',
      auditEventGenerated: t5Decision.auditActionRequired === true,
      auditAction: t5Decision.auditAction,
      evidence: t5Decision.reason || 'Blocked'
    });

    // TEST 6: Guardian attempts to access Command Centre incident feed
    const t6Decision = await rbacEngine.evaluateAccess(
      guardianUser1,
      'EMERGENCY_INCIDENTS_VIEW_ALL'
    );
    results.push({
      id: 'SEC-TEST-06',
      role: 'PARENT_GUARDIAN',
      scenario: 'Guardian attempts direct API query on national live incident feed',
      targetEndpoint: 'GET /api/incidents',
      attemptedOperation: 'EMERGENCY_INCIDENTS_VIEW_ALL',
      expectedStatus: 403,
      actualStatus: t6Decision.statusCode,
      passed: t6Decision.statusCode === 403,
      blockedBy: 'Operational Separation Matrix',
      auditEventGenerated: t6Decision.auditActionRequired === true,
      auditAction: t6Decision.auditAction,
      evidence: t6Decision.reason || 'Blocked'
    });

    // TEST 7: Responder attempts to browse unassigned emergencies
    const t7Decision = await rbacEngine.evaluateAccess(
      responderUser,
      'ASSIGNED_INCIDENT_VIEW_MINIMAL',
      { incidentId: 'inc-unassigned-9999' },
      { isIncidentAssignedToResponder: isIncidentAssigned }
    );
    results.push({
      id: 'SEC-TEST-07',
      role: 'FIELD_RESPONDER',
      scenario: 'SAPS Responder attempts to browse & inspect unassigned emergency incidents',
      targetEndpoint: 'GET /api/incidents/inc-unassigned-9999',
      attemptedOperation: 'ASSIGNED_INCIDENT_VIEW_MINIMAL',
      expectedStatus: 403,
      actualStatus: t7Decision.statusCode,
      passed: t7Decision.statusCode === 403,
      blockedBy: 'Tactical Assignment Need-To-Know Gate',
      auditEventGenerated: t7Decision.auditActionRequired === true,
      auditAction: t7Decision.auditAction,
      evidence: t7Decision.reason || 'Blocked'
    });

    // TEST 8: Responder attempts to change platform RBAC or self-dispatch
    const t8Decision = await rbacEngine.evaluateAccess(
      responderUser,
      'RESPONDER_DISPATCH_AUTHORIZE'
    );
    results.push({
      id: 'SEC-TEST-08',
      role: 'FIELD_RESPONDER',
      scenario: 'Responder attempts self-dispatch or dispatch of another unit',
      targetEndpoint: 'POST /api/incidents/dispatch',
      attemptedOperation: 'RESPONDER_DISPATCH_AUTHORIZE',
      expectedStatus: 403,
      actualStatus: t8Decision.statusCode,
      passed: t8Decision.statusCode === 403,
      blockedBy: 'Strict Anti-Self-Dispatch Protocol',
      auditEventGenerated: t8Decision.auditActionRequired === true,
      auditAction: t8Decision.auditAction,
      evidence: t8Decision.reason || 'Blocked'
    });

    // TEST 9: Command Operator attempts Autonomous/AI Dispatch (Prohibited by Directive)
    const t9Decision = await rbacEngine.evaluateAccess(
      commandUser,
      'RESPONDER_DISPATCH_AUTHORIZE',
      { isHumanDispatch: false }
    );
    results.push({
      id: 'SEC-TEST-09',
      role: 'COMMAND_OPERATOR',
      scenario: 'Command Operator attempts Autonomous/AI automated dispatch without human signoff',
      targetEndpoint: 'POST /api/incidents/dispatch',
      attemptedOperation: 'RESPONDER_DISPATCH_AUTHORIZE',
      expectedStatus: 403,
      actualStatus: t9Decision.statusCode,
      passed: t9Decision.statusCode === 403,
      blockedBy: 'Mandatory Human-In-The-Loop Safety Guardrail',
      auditEventGenerated: t9Decision.auditActionRequired === true,
      auditAction: t9Decision.auditAction,
      evidence: t9Decision.reason || 'Blocked'
    });

    // TEST 10: Technician attempts to access confidential child personal safety dossiers
    const t10Decision = await rbacEngine.evaluateAccess(
      techUser,
      'LEARNERS_VIEW_ALL'
    );
    results.push({
      id: 'SEC-TEST-10',
      role: 'TECHNICIAN',
      scenario: 'Hardware Technician attempts to read personal confidential learner health records',
      targetEndpoint: 'GET /api/learners',
      attemptedOperation: 'LEARNERS_VIEW_ALL',
      expectedStatus: 403,
      actualStatus: t10Decision.statusCode,
      passed: t10Decision.statusCode === 403,
      blockedBy: 'Need-To-Know Telemetry Boundary',
      auditEventGenerated: t10Decision.auditActionRequired === true,
      auditAction: t10Decision.auditAction,
      evidence: t10Decision.reason || 'Blocked'
    });

    // TEST 11: Government Auditor attempts to execute operational emergency dispatch
    const t11Decision = await rbacEngine.evaluateAccess(
      govUser,
      'RESPONDER_DISPATCH_AUTHORIZE'
    );
    results.push({
      id: 'SEC-TEST-11',
      role: 'GOVERNMENT_AUDITOR',
      scenario: 'Government DBE Auditor attempts to trigger armed tactical response dispatch',
      targetEndpoint: 'POST /api/incidents/dispatch',
      attemptedOperation: 'RESPONDER_DISPATCH_AUTHORIZE',
      expectedStatus: 403,
      actualStatus: t11Decision.statusCode,
      passed: t11Decision.statusCode === 403,
      blockedBy: 'Auditor Operational Disengagement Protocol',
      auditEventGenerated: t11Decision.auditActionRequired === true,
      auditAction: t11Decision.auditAction,
      evidence: t11Decision.reason || 'Blocked'
    });

    // TEST 12: Founder Authorized Sovereign Operations (Full Governance Allowed)
    const t12Decision = await rbacEngine.evaluateAccess(
      founderUser,
      'USER_IDENTITIES_MANAGE',
      { targetUserRole: 'SYSTEM_ADMIN' }
    );
    results.push({
      id: 'SEC-TEST-12',
      role: 'FOUNDER_EXECUTIVE',
      scenario: 'Founder performs authorized platform user administration & role assignment',
      targetEndpoint: 'POST /api/users',
      attemptedOperation: 'USER_IDENTITIES_MANAGE',
      expectedStatus: 200,
      actualStatus: t12Decision.statusCode,
      passed: t12Decision.statusCode === 200,
      blockedBy: 'None (Authorized Sovereign Authority)',
      auditEventGenerated: false,
      evidence: 'Authoritative Founder Clearance Verified'
    });

    // TEST 13: School Principal attempts to create platform user accounts
    const t13Decision = await rbacEngine.evaluateAccess(
      principalSchool1,
      'USER_IDENTITIES_MANAGE',
      { targetUserRole: 'SCHOOL_ADMIN_STAFF' }
    );
    results.push({
      id: 'SEC-TEST-13',
      role: 'SCHOOL_PRINCIPAL',
      scenario: 'School Principal attempts to provision platform user identities (Violation)',
      targetEndpoint: 'POST /api/users',
      attemptedOperation: 'USER_IDENTITIES_MANAGE',
      expectedStatus: 403,
      actualStatus: t13Decision.statusCode,
      passed: t13Decision.statusCode === 403,
      blockedBy: 'Authoritative User Creation Rule (Founder Exclusive)',
      auditEventGenerated: t13Decision.auditActionRequired === true,
      auditAction: t13Decision.auditAction,
      evidence: t13Decision.reason || 'Blocked'
    });

    // TEST 14: System Admin attempts to alter platform user account status
    const t14Decision = await rbacEngine.evaluateAccess(
      adminUser,
      'USER_IDENTITIES_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-14',
      role: 'SYSTEM_ADMIN',
      scenario: 'System Administrator attempts to alter user account status or suspend identities',
      targetEndpoint: 'PATCH /api/users/:id/status',
      attemptedOperation: 'USER_IDENTITIES_MANAGE',
      expectedStatus: 403,
      actualStatus: t14Decision.statusCode,
      passed: t14Decision.statusCode === 403,
      blockedBy: 'Authoritative User Status Control (Founder Exclusive)',
      auditEventGenerated: t14Decision.auditActionRequired === true,
      auditAction: t14Decision.auditAction,
      evidence: t14Decision.reason || 'Blocked'
    });

    // TEST 15: Non-Founder role attempts to access Founder Password Management endpoint
    const t15Decision = await rbacEngine.evaluateAccess(
      adminUser,
      'USER_IDENTITIES_MANAGE',
      { targetUserRole: 'FOUNDER_EXECUTIVE' }
    );
    results.push({
      id: 'SEC-TEST-15',
      role: 'SYSTEM_ADMIN',
      scenario: 'Non-Founder user attempts to invoke Founder credential management endpoint (Violation)',
      targetEndpoint: 'POST /api/founder/update-password',
      attemptedOperation: 'USER_IDENTITIES_MANAGE',
      expectedStatus: 403,
      actualStatus: t15Decision.statusCode,
      passed: t15Decision.statusCode === 403,
      blockedBy: 'Founder Sovereign Credential Boundary (Founder Exclusive)',
      auditEventGenerated: t15Decision.auditActionRequired === true,
      auditAction: t15Decision.auditAction,
      evidence: t15Decision.reason || 'Blocked'
    });

    // ----------------------------------------------------
    // CAPTURE-ONCE ENROLMENT AUTHORITY LOCK TEST CASES
    // ----------------------------------------------------

    // TEST 16: Founder executes Enrolment Administration (Authorized)
    const t16Decision = await rbacEngine.evaluateAccess(
      founderUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-16',
      role: 'FOUNDER_EXECUTIVE',
      scenario: 'Founder accesses Capture-Once Enrolment Administration (Authorized)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 200,
      actualStatus: t16Decision.statusCode,
      passed: t16Decision.statusCode === 200,
      blockedBy: 'None (Authorized Founder)',
      auditEventGenerated: false,
      evidence: 'Founder Enrolment Clearance Verified'
    });

    // TEST 17: System Admin executes Enrolment Administration (Authorized)
    const t17Decision = await rbacEngine.evaluateAccess(
      adminUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-17',
      role: 'SYSTEM_ADMIN',
      scenario: 'System Administrator accesses Capture-Once Enrolment Administration (Authorized)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 200,
      actualStatus: t17Decision.statusCode,
      passed: t17Decision.statusCode === 200,
      blockedBy: 'None (Authorized System Administrator)',
      auditEventGenerated: false,
      evidence: 'System Administrator Enrolment Clearance Verified'
    });

    // TEST 18: School Principal attempts Enrolment Administration (Blocked by Lock)
    const t18Decision = await rbacEngine.evaluateAccess(
      principalSchool1,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-18',
      role: 'SCHOOL_PRINCIPAL',
      scenario: 'School Principal attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t18Decision.statusCode,
      passed: t18Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t18Decision.auditActionRequired === true,
      auditAction: t18Decision.auditAction,
      evidence: t18Decision.reason || 'Blocked'
    });

    // TEST 19: Parent/Guardian attempts Enrolment Administration (Blocked)
    const t19Decision = await rbacEngine.evaluateAccess(
      guardianUser1,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-19',
      role: 'PARENT_GUARDIAN',
      scenario: 'Parent/Guardian attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t19Decision.statusCode,
      passed: t19Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t19Decision.auditActionRequired === true,
      auditAction: t19Decision.auditAction,
      evidence: t19Decision.reason || 'Blocked'
    });

    // TEST 20: Command Operator attempts Enrolment Administration (Blocked)
    const t20Decision = await rbacEngine.evaluateAccess(
      commandUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-20',
      role: 'COMMAND_OPERATOR',
      scenario: 'Command Operator attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t20Decision.statusCode,
      passed: t20Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t20Decision.auditActionRequired === true,
      auditAction: t20Decision.auditAction,
      evidence: t20Decision.reason || 'Blocked'
    });

    // TEST 21: Field Responder attempts Enrolment Administration (Blocked)
    const t21Decision = await rbacEngine.evaluateAccess(
      responderUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-21',
      role: 'FIELD_RESPONDER',
      scenario: 'Field Responder attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t21Decision.statusCode,
      passed: t21Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t21Decision.auditActionRequired === true,
      auditAction: t21Decision.auditAction,
      evidence: t21Decision.reason || 'Blocked'
    });

    // TEST 22: Technician attempts Enrolment Administration (Blocked)
    const t22Decision = await rbacEngine.evaluateAccess(
      techUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-22',
      role: 'TECHNICIAN',
      scenario: 'Technician attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t22Decision.statusCode,
      passed: t22Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t22Decision.auditActionRequired === true,
      auditAction: t22Decision.auditAction,
      evidence: t22Decision.reason || 'Blocked'
    });

    // TEST 23: Government Auditor attempts Enrolment Administration (Blocked)
    const t23Decision = await rbacEngine.evaluateAccess(
      govUser,
      'ENROLMENT_MANAGE'
    );
    results.push({
      id: 'SEC-TEST-23',
      role: 'GOVERNMENT_AUDITOR',
      scenario: 'Government Auditor attempts Capture-Once Enrolment Administration (Forbidden)',
      targetEndpoint: 'POST /api/enrolment/authoritative-onboard',
      attemptedOperation: 'ENROLMENT_MANAGE',
      expectedStatus: 403,
      actualStatus: t23Decision.statusCode,
      passed: t23Decision.statusCode === 403,
      blockedBy: 'Capture-Once Enrolment Authority Lock (Admin/Founder Only)',
      auditEventGenerated: t23Decision.auditActionRequired === true,
      auditAction: t23Decision.auditAction,
      evidence: t23Decision.reason || 'Blocked'
    });

    const passedCount = results.filter(r => r.passed).length;
    const failedCount = results.length - passedCount;

    return {
      timestamp: new Date().toISOString(),
      totalTests: results.length,
      passedCount,
      failedCount,
      complianceVerdict: failedCount === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      matrixRolesCount: Object.keys(AUTHORITATIVE_ROLE_MATRIX).length,
      results,
      matrixSummary: AUTHORITATIVE_ROLE_MATRIX
    };
  }
}

export const rbacTestSuite = new RbacSecurityTestSuite();
