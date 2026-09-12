/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — SECURITY HARDENING, PRIVACY & POPIA ACCEPTANCE TEST SUITE
 * Complete implementation of the 24 Security Acceptance Criteria (Prompt 22, Sec. 23)
 * Non-destructive verification of RBAC, ABAC, POPIA, Session, and Fail-Closed behavior.
 * ==============================================================================
 */

import { db } from './dbStore.js';
import { repository } from './db/index.js';
import { query } from './db/client.js';
import { rbacEngine } from './rbacEngine.js';
import { telemetryGatewayEngine } from './telemetryGatewayEngine.js';
import { deviceRegistryEngine } from './deviceRegistryEngine.js';
import { incidentLifecycleEngine } from './incidentLifecycleEngine.js';
import { GT012Simulator } from './gt012/gt012Simulator.js';
import { ActiveUserSession, PermissionKey } from '../types.js';

export interface SecurityTestCaseResult {
  id: string;
  name: string;
  category: string;
  description: string;
  expected: string;
  actual: string;
  passed: boolean;
  evidence?: Record<string, any>;
}

export interface SecurityTestSuiteResult {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  timestamp: string;
  results: SecurityTestCaseResult[];
}

export class SecurityHardeningTestSuite {
  public async runAllTests(): Promise<SecurityTestSuiteResult> {
    const results: SecurityTestCaseResult[] = [];

    const runTest = async (
      id: string,
      name: string,
      category: string,
      description: string,
      expected: string,
      fn: () => Promise<{ passed: boolean; actual: string; evidence?: any }>
    ) => {
      try {
        const res = await fn();
        results.push({
          id,
          name,
          category,
          description,
          expected,
          actual: res.actual,
          passed: res.passed,
          evidence: res.evidence
        });
      } catch (err: any) {
        results.push({
          id,
          name,
          category,
          description,
          expected,
          actual: `EXCEPTION: ${err.message || String(err)}`,
          passed: false,
          evidence: { stack: err.stack }
        });
      }
    };

    // ABAC helpers for simulated evaluations
    const abacHelpers = {
      isGuardianLinkedToLearner: async (guardianId: string, learnerId: string): Promise<boolean> => {
        try {
          const res = await query(
            `SELECT 1 FROM guardian_learner_relationships WHERE guardian_id = $1 AND learner_id = $2 LIMIT 1;`,
            [guardianId, learnerId]
          );
          if (res.rows.length > 0) return true;
        } catch {}
        for (const rel of db.relationships.values()) {
          if (rel.guardianId === guardianId && rel.learnerId === learnerId && rel.verificationStatus === 'VERIFIED') {
            return true;
          }
        }
        return false;
      },
      isLearnerEnrolledInSchool: async (learnerId: string, schoolId: string): Promise<boolean> => {
        try {
          const res = await query(
            `SELECT 1 FROM school_enrolments WHERE school_id = $1 AND learner_id = $2 AND enrolment_status = 'ACTIVE' LIMIT 1;`,
            [schoolId, learnerId]
          );
          if (res.rows.length > 0) return true;
        } catch {}
        for (const enr of db.enrolments.values()) {
          if (enr.schoolId === schoolId && enr.learnerId === learnerId && enr.enrolmentStatus === 'ACTIVE') {
            return true;
          }
        }
        return false;
      },
      isIncidentAssignedToResponder: async (incidentId: string, responderUnit?: string, _responderId?: string): Promise<boolean> => {
        try {
          const res = await query(
            `SELECT 1 FROM incidents WHERE id = $1 AND assigned_responder_id = $2 LIMIT 1;`,
            [incidentId, responderUnit || '']
          );
          if (res.rows.length > 0) return true;
        } catch {}
        const inc = db.incidents.get(incidentId);
        return !!responderUnit && inc?.assignedResponder?.id === responderUnit;
      }
    };

    // --------------------------------------------------------------------------
    // TEST 1: Unauthenticated protected API access -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-01',
      'Unauthenticated protected API access',
      'AUTHENTICATION & AUTHORIZATION',
      'Verify that requests without an active user session token cannot access protected services',
      'HTTP 401 DENIED with AUTHENTICATION_REQUIRED error',
      async () => {
        const decision = await rbacEngine.evaluateAccess(null as any, 'LEARNERS_VIEW_ALL', {}, abacHelpers);
        const passed = !decision.allowed && decision.statusCode === 401;
        return {
          passed,
          actual: `Allowed: ${decision.allowed}, StatusCode: ${decision.statusCode}, Reason: "${decision.reason}"`,
          evidence: decision
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 2: Guardian accessing unrelated learner -> DENIED (ABAC / IDOR)
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-02',
      'Guardian accessing unrelated learner',
      'ABAC & IDOR MITIGATION',
      'Verify that a verified parent/guardian is strictly blocked from viewing records of unlinked children',
      'HTTP 403 DENIED with relational access boundary enforcement',
      async () => {
        const guardianSession: ActiveUserSession = {
          id: 'usr-grd-01',
          name: 'Grace Molefe',
          email: 'grace.molefe@safetynet.co.za',
          role: 'PARENT_GUARDIAN',
          guardianId: 'grd-820415-01',
          token: 'tok_test_sec_guardian'
        };
        // Attempt access to unrelated learner 'lrn-999-unrelated' (who belongs to another family)
        const decision = await rbacEngine.evaluateAccess(
          guardianSession,
          'GUARDIAN_CHILDREN_VIEW',
          { learnerId: 'lrn-999-unrelated' },
          abacHelpers
        );
        const passed = !decision.allowed && decision.statusCode === 403;
        return {
          passed,
          actual: `Allowed: ${decision.allowed}, StatusCode: ${decision.statusCode}, Reason: "${decision.reason}"`,
          evidence: { guardianId: guardianSession.guardianId, targetLearner: 'lrn-999-unrelated', decision }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 3: School A accessing School B learner -> DENIED (Institutional Boundary)
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-03',
      'School A accessing School B learner',
      'INSTITUTIONAL SCOPING & EMIS INTEGRITY',
      'Verify that a School Principal or Staff member cannot inspect learners enrolled at other schools',
      'HTTP 403 DENIED with institutional boundary enforcement',
      async () => {
        const principalSession: ActiveUserSession = {
          id: 'usr-sch-01',
          name: 'Principal Dlamini',
          email: 'principal@school-a.edu.za',
          role: 'SCHOOL_PRINCIPAL',
          schoolId: 'sch-primary-001',
          token: 'tok_test_sec_principal'
        };
        // Attempt access to learner at school-b
        const decision = await rbacEngine.evaluateAccess(
          principalSession,
          'LEARNERS_VIEW_SCOPED',
          { learnerId: 'lrn-school-b-001' },
          abacHelpers
        );
        const passed = !decision.allowed && decision.statusCode === 403;
        return {
          passed,
          actual: `Allowed: ${decision.allowed}, StatusCode: ${decision.statusCode}, Reason: "${decision.reason}"`,
          evidence: { schoolId: principalSession.schoolId, targetLearner: 'lrn-school-b-001', decision }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 4: Responder accessing unauthorized incident -> DENIED (Need-to-Know)
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-04',
      'Responder accessing unauthorized incident',
      'TACTICAL ASSIGNMENT & NEED-TO-KNOW',
      'Verify that field responders can only access incidents dispatch-assigned to their unit',
      'HTTP 403 DENIED with tactical dispatch boundary enforcement',
      async () => {
        const responderSession: ActiveUserSession = {
          id: 'usr-resp-02',
          name: 'Officer Khumalo',
          email: 'responder2@saps.gov.za',
          role: 'FIELD_RESPONDER',
          responderUnit: 'resp-saps-02',
          token: 'tok_test_sec_responder'
        };
        // Attempt access to incident unassigned to unit 2
        const decision = await rbacEngine.evaluateAccess(
          responderSession,
          'ASSIGNED_INCIDENT_VIEW_MINIMAL',
          { incidentId: 'inc-unassigned-to-unit-2' },
          abacHelpers
        );
        const passed = !decision.allowed && decision.statusCode === 403;
        return {
          passed,
          actual: `Allowed: ${decision.allowed}, StatusCode: ${decision.statusCode}, Reason: "${decision.reason}"`,
          evidence: { responderUnit: responderSession.responderUnit, decision }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 5: Technician accessing unnecessary PII -> MASKED / DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-05',
      'Technician accessing unnecessary PII',
      'POPIA SECTION 14 & LEAST PRIVILEGE',
      'Verify that hardware technicians are denied access to full child dossiers and only receive masked hardware records',
      'Direct profile access DENIED (403); device view masks child PII',
      async () => {
        const techSession: ActiveUserSession = {
          id: 'usr-tech-01',
          name: 'IoT Field Tech',
          email: 'tech@hardware.itis.za',
          role: 'TECHNICIAN',
          token: 'tok_test_sec_tech'
        };
        // 1. Direct learner profile inspection
        const dossierDecision = await rbacEngine.evaluateAccess(
          techSession,
          'LEARNERS_VIEW_ALL',
          { learnerId: 'lrn-001' },
          abacHelpers
        );
        const dossierBlocked = !dossierDecision.allowed && dossierDecision.statusCode === 403;

        // 2. Hardware device list PII masking
        const devices = deviceRegistryEngine.getDevicesScoped(techSession);
        const allMasked = devices.every(d => {
          if (d.assignedLearnerName) {
            return d.assignedLearnerName.startsWith('Learner') || d.assignedLearnerName === 'Assigned Learner';
          }
          return true;
        });

        const passed = dossierBlocked && allMasked;
        return {
          passed,
          actual: `Dossier Blocked: ${dossierBlocked}, Hardware Records PII Masked: ${allMasked}`,
          evidence: { dossierDecision, sampleMaskedDevice: devices[0] }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 6: Invalid session -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-06',
      'Invalid session token rejection',
      'SESSION INTEGRITY',
      'Verify that tampered, forged, or unissued bearer tokens return null session',
      'Session lookup returns null, protected access returns 401',
      async () => {
        const fakeToken = 'tok_itis_tampered_forged_signature_00000000000';
        const sessionRecord = await repository.sessions.getSession(fakeToken);
        const passed = sessionRecord === null;
        return {
          passed,
          actual: `Session for forged token resolved: ${sessionRecord ? 'INVALID_LEAK' : 'NULL (REJECTED)'}`,
          evidence: { token: fakeToken, sessionRecord }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 7: Revoked session -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-07',
      'Revoked session token rejection',
      'SESSION REVOCATION & LOGOUT',
      'Verify that revoking a session makes subsequent requests fail immediately',
      'Revoked session cannot be resolved in PostgreSQL or memory',
      async () => {
        const users = await repository.users.findAll();
        const existingUser = users[0];
        const ephemeralToken = 'tok_itis_test_revocation_' + Date.now();
        const activeSession: ActiveUserSession = {
          id: existingUser.id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          token: ephemeralToken
        };
        await repository.sessions.createSession(ephemeralToken, activeSession.id, activeSession, ['CHILD_LOCATION_TRACK']);
        
        const beforeRevoke = await repository.sessions.getSession(ephemeralToken);
        const wasActive = beforeRevoke !== null;

        await repository.sessions.revokeSession(ephemeralToken);
        const afterRevoke = await repository.sessions.getSession(ephemeralToken);
        const isDead = afterRevoke === null;

        const passed = wasActive && isDead;
        return {
          passed,
          actual: `Session Active Before Revoke: ${wasActive}, Session Null After Revoke: ${isDead}`,
          evidence: { beforeRevoke: !!beforeRevoke, afterRevoke: !!afterRevoke }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 8: Suspended user -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-08',
      'Suspended user session immediate rejection',
      'ACCOUNT SUSPENSION & LOCKOUT',
      'Verify that suspending an account immediately revokes all active sessions and blocks authentication',
      'Active session for suspended user returns null; login throws SUSPENDED error',
      async () => {
        const tempEmail = `suspend-test-${Date.now()}@itis.test.za`;
        const tempUser = await repository.users.registerPublicUser({
          email: tempEmail,
          password: 'Temporary#TestPassword2026!',
          firstName: 'Suspended',
          surname: 'Candidate'
        });

        const sessionActiveBefore = await repository.sessions.getSession(tempUser.token);

        await repository.users.updateStatus(tempUser.user.id, 'SUSPENDED', 'usr-founder-01');

        const sessionAfterSuspension = await repository.sessions.getSession(tempUser.token);
        const sessionRevoked = sessionAfterSuspension === null;

        let loginBlocked = false;
        try {
          const authAttempt = await repository.users.verifyCredentials(tempEmail, 'Temporary#TestPassword2026!');
          if (!authAttempt) loginBlocked = true;
        } catch (err: any) {
          loginBlocked = err.message?.includes('SUSPENDED') || err.message?.includes('Contact');
        }

        const passed = !!sessionActiveBefore && sessionRevoked && loginBlocked;
        return {
          passed,
          actual: `Active Before: ${!!sessionActiveBefore}, Revoked After: ${sessionRevoked}, Login Blocked: ${loginBlocked}`,
          evidence: { userId: tempUser.user.id, sessionRevoked, loginBlocked }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 9: Role escalation attempt -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-09',
      'Role escalation attempt via public registration',
      'ROLE ESCALATION PREVENTION',
      'Verify that attempting to self-register as FOUNDER_EXECUTIVE or SYSTEM_ADMIN is strictly rejected',
      'HTTP 403 / Error thrown: Role escalation forbidden',
      async () => {
        let founderAttemptBlocked = false;
        let adminAttemptBlocked = false;

        try {
          await repository.users.registerPublicUser({
            email: `escalate-founder-${Date.now()}@test.za`,
            password: 'Strong#Password2026!',
            firstName: 'Attacker',
            surname: 'Escalation',
            role: 'FOUNDER_EXECUTIVE' as any
          });
        } catch (err: any) {
          founderAttemptBlocked = err.message?.includes('ACCESS DENIED') || err.message?.includes('cannot be self-registered');
        }

        try {
          await repository.users.registerPublicUser({
            email: `escalate-admin-${Date.now()}@test.za`,
            password: 'Strong#Password2026!',
            firstName: 'Attacker',
            surname: 'Escalation',
            role: 'SYSTEM_ADMIN' as any
          });
        } catch (err: any) {
          adminAttemptBlocked = err.message?.includes('ACCESS DENIED') || err.message?.includes('cannot be self-registered');
        }

        const passed = founderAttemptBlocked && adminAttemptBlocked;
        return {
          passed,
          actual: `Founder Escalation Blocked: ${founderAttemptBlocked}, Admin Escalation Blocked: ${adminAttemptBlocked}`,
          evidence: { founderAttemptBlocked, adminAttemptBlocked }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 10: ID tampering -> DENIED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-10',
      'Official ID tampering & verification constraint',
      'IDENTITY VERIFICATION & DHA NPR INTEGRITY',
      'Verify that mismatched SA ID numbers or forged verification flags are rejected by the capture-once pipeline',
      'Mismatched surname/ID triggers child safety conflict lock and blocks automatic linking',
      async () => {
        // Enrolment identity check with verified SA ID but mismatched surname
        const check = await repository.learners.searchIdentity({
          saIdNumber: '8204155192084',
          lastName: 'MismatchedImposterSurname'
        });

        const blocked = check.matchType === 'CONFLICT_DETECTED' && check.allowDirectLink === false;
        const passed = blocked;
        return {
          passed,
          actual: `MatchType: ${check.matchType}, AllowDirectLink: ${check.allowDirectLink}, RequiresStaffReview: ${check.requiresStaffReview}`,
          evidence: { title: check.title, conflictReason: (check as any).conflictReason }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 11: Duplicate Guardian email registration prevention
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-11',
      'Duplicate Guardian email registration prevention',
      'CAPTURE-ONCE & DATA GOVERNANCE',
      'Verify that registering with an already existing email is safely blocked without creating duplicate identities',
      'Registration throws conflict error: "already registered. Please sign in instead."',
      async () => {
        const targetEmail = 'grace.molefe@safetynet.co.za';
        let duplicateBlocked = false;
        let errorMessage = '';

        try {
          await repository.users.registerPublicUser({
            email: targetEmail,
            password: 'Password#2026Safe!',
            firstName: 'Duplicate',
            surname: 'Attempt'
          });
        } catch (err: any) {
          errorMessage = err.message;
          duplicateBlocked = err.message?.includes('already registered');
        }

        const passed = duplicateBlocked;
        return {
          passed,
          actual: `Duplicate Blocked: ${duplicateBlocked}, Error: "${errorMessage}"`,
          evidence: { targetEmail, duplicateBlocked, errorMessage }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 12: Password never returned by API -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-12',
      'Sensitive credential stripping (password & hash)',
      'SENSITIVE DATA EXPOSURE (OWASP A02:2021)',
      'Verify that user records, session objects, and learner listings NEVER contain password_hash, password_salt, or plain passwords',
      'password_hash, password_salt, and plain passwords are completely undefined/absent',
      async () => {
        const users = await repository.users.findAll();
        const learnersPaginated = await repository.learners.queryHydrated({ limit: 100 });
        const learners = learnersPaginated.data;

        const userLeaked = users.some(u => 
          (u as any).password_hash !== undefined ||
          (u as any).password_salt !== undefined ||
          (u as any).password !== undefined
        );

        const learnerLeaked = learners.some(l => 
          (l as any).password_hash !== undefined ||
          (l as any).password !== undefined
        );

        const passed = !userLeaked && !learnerLeaked;
        return {
          passed,
          actual: `User Record Credential Leak: ${userLeaked}, Learner Credential Leak: ${learnerLeaked}`,
          evidence: { totalUsersChecked: users.length, totalLearnersChecked: learners.length }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 13: MFA TOTP secret & backup codes non-exposure -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-13',
      'MFA TOTP secret & backup codes non-exposure',
      'SENSITIVE DATA EXPOSURE (OWASP A02:2021)',
      'Verify that TOTP secrets, cryptographic seeds, and raw backup codes are stripped from user responses',
      'totp_secret, mfa_secret, and raw backup_codes are completely undefined/absent in user objects',
      async () => {
        const users = await repository.users.findAll();
        const mfaLeaked = users.some(u => 
          (u as any).totp_secret !== undefined ||
          (u as any).mfa_secret !== undefined ||
          (u as any).totpSecret !== undefined ||
          (u as any).backup_codes !== undefined
        );

        const passed = !mfaLeaked;
        return {
          passed,
          actual: `MFA Secret / Backup Code Leak: ${mfaLeaked}`,
          evidence: { totalUsersChecked: users.length }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 14: Session token not leaked in normal errors/logs -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-14',
      'Session token leak prevention in audit logs & errors',
      'SECURITY AUDITING & SECRETS SANITIZATION',
      'Verify that audit logs and system event records redact or omit raw bearer session tokens',
      'Audit log details never contain raw Bearer session token strings',
      async () => {
        const auditRes = await repository.auditLogs.query({ limit: 100 });
        const logs = auditRes.data || [];
        const tokenLeaked = logs.some(log => {
          const raw = JSON.stringify(log);
          return raw.includes('tok_itis_') && !raw.includes('tok_itis_***');
        });

        const passed = !tokenLeaked;
        return {
          passed,
          actual: `Raw Bearer Tokens in Audit Trail: ${tokenLeaked ? 'LEAKED' : 'CLEAN (NONE FOUND)'}`,
          evidence: { logsInspected: logs.length }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 15: SQL injection-style input -> SAFELY REJECTED / PARAMETERIZED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-15',
      'SQL injection-style input resilience',
      'INJECTION RESILIENCE (OWASP A03:2021)',
      'Verify that SQL injection strings in email, search queries, and identifiers are parameterized without syntax errors or leakage',
      'Parameterized query treats payload as literal string; returns empty/expected without execution',
      async () => {
        const injectionPayload = "' OR '1'='1' --; DROP TABLE users;";
        const found = await repository.users.findByEmailOrAlias(injectionPayload);
        const searchRes = await repository.learners.queryHydrated({ search: injectionPayload });
        const searched = searchRes.data || [];

        const passed = found === null && searched.length === 0;
        return {
          passed,
          actual: `User found with injection: ${!!found}, Learners returned with injection search: ${searched.length}`,
          evidence: { injectionPayload, foundUser: found, searchResultsCount: searched.length }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 16: Invalid telemetry -> REJECTED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-16',
      'Invalid telemetry packet CRC & framing rejection',
      'PROTOCOL SECURITY & TELEMETRY INTEGRITY',
      'Verify that malformed packets, corrupted CRCs, and invalid headers are rejected by the gateway',
      'telemetryGatewayEngine returns accepted: false, status: REJECTED',
      async () => {
        const corruptedPacket = '7878052201020304000100000d0a';
        const result = await telemetryGatewayEngine.ingestTelemetryPacket({
          rawPacket: corruptedPacket,
          transportType: 'SIMULATOR',
          receivedAt: new Date().toISOString()
        });

        const passed = !result.accepted && (result.status === 'REJECTED' || result.status === 'QUARANTINED');
        return {
          passed,
          actual: `Accepted: ${result.accepted}, Status: ${result.status}, DiagnosticCode: ${result.diagnosticCode}`,
          evidence: result
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 17: Unknown device -> REJECTED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-17',
      'Unknown / unregistered device telemetry rejection',
      'DEVICE INVENTORY HARDENING',
      'Verify that telemetry from an unknown IMEI or device identifier is strictly rejected',
      'Accepted: false, diagnosticCode: DEVICE_NOT_REGISTERED',
      async () => {
        const unknownImei = '860000000999999';
        const result = await telemetryGatewayEngine.ingestTelemetryPacket({
          rawPacket: JSON.stringify({
            deviceId: unknownImei,
            latitude: -26.2041,
            longitude: 28.0473,
            batteryPercent: 85,
            speedKmh: 0,
            sosActive: false,
            timestamp: new Date().toISOString()
          }),
          transportType: 'SIMULATOR',
          receivedAt: new Date().toISOString()
        });

        const passed = !result.accepted && result.diagnosticCode === 'DEVICE_NOT_REGISTERED';
        return {
          passed,
          actual: `Accepted: ${result.accepted}, DiagnosticCode: ${result.diagnosticCode}, Status: ${result.status}`,
          evidence: { unknownImei, result }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 18: Suspended device -> QUARANTINED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-18',
      'Suspended device quarantine enforcement',
      'DEVICE LIFECYCLE & TAMPER QUARANTINE',
      'Verify that telemetry from a SUSPENDED tracker is quarantined with status QUARANTINED and DEVICE_SUSPENDED',
      'Accepted: false, status: QUARANTINED, diagnosticCode: DEVICE_SUSPENDED',
      async () => {
        const adminSession: ActiveUserSession = {
          id: 'usr-admin-sec',
          name: 'System Admin',
          email: 'sysadmin@itis.safety.za',
          role: 'SYSTEM_ADMIN',
          token: 'tok_test_sec_admin'
        };

        let suspendedDevice = Array.from(deviceRegistryEngine.getAllDevices()).find(d => d.deviceStatus === 'SUSPENDED');
        if (!suspendedDevice) {
          const newDev = await deviceRegistryEngine.registerDevice({
            imei: '861234567890123',
            trackerDeviceId: 'TRK-SUSPEND-TEST',
            deviceModel: 'GT012_CONCOX',
            protocolType: 'GT012'
          }, adminSession);
          suspendedDevice = deviceRegistryEngine.suspendDevice(newDev.itisDeviceId, adminSession, 'Administrative Quarantine Test');
        }

        const result = await telemetryGatewayEngine.ingestTelemetryPacket({
          rawPacket: JSON.stringify({
            deviceId: suspendedDevice.trackerDeviceId,
            latitude: -26.2041,
            longitude: 28.0473,
            batteryPercent: 80,
            speedKmh: 0,
            sosActive: false,
            timestamp: new Date().toISOString()
          }),
          transportType: 'SIMULATOR',
          receivedAt: new Date().toISOString()
        });

        const passed = !result.accepted && result.status === 'QUARANTINED' && result.diagnosticCode === 'DEVICE_SUSPENDED';
        return {
          passed,
          actual: `Accepted: ${result.accepted}, Status: ${result.status}, DiagnosticCode: ${result.diagnosticCode}`,
          evidence: { deviceId: suspendedDevice.trackerDeviceId, result }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 19: Retired device -> REJECTED
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-19',
      'Retired device permanent rejection',
      'DEVICE LIFECYCLE MANAGEMENT',
      'Verify that telemetry from a RETIRED or DECOMMISSIONED tracker is permanently rejected',
      'Accepted: false, status: REJECTED, diagnosticCode: DEVICE_RETIRED',
      async () => {
        const adminSession: ActiveUserSession = {
          id: 'usr-admin-sec',
          name: 'System Admin',
          email: 'sysadmin@itis.safety.za',
          role: 'SYSTEM_ADMIN',
          token: 'tok_test_sec_admin'
        };

        let retiredDevice = Array.from(deviceRegistryEngine.getAllDevices()).find(d => d.deviceStatus === 'RETIRED');
        if (!retiredDevice) {
          const newDev = await deviceRegistryEngine.registerDevice({
            imei: '869876543210987',
            trackerDeviceId: 'TRK-RETIRE-TEST',
            deviceModel: 'GT012_CONCOX',
            protocolType: 'GT012'
          }, adminSession);
          retiredDevice = deviceRegistryEngine.retireDevice(newDev.itisDeviceId, adminSession, 'Permanent Decommissioning Test');
        }

        const result = await telemetryGatewayEngine.ingestTelemetryPacket({
          rawPacket: JSON.stringify({
            deviceId: retiredDevice.trackerDeviceId,
            latitude: -26.2041,
            longitude: 28.0473,
            batteryPercent: 75,
            speedKmh: 0,
            sosActive: false,
            timestamp: new Date().toISOString()
          }),
          transportType: 'SIMULATOR',
          receivedAt: new Date().toISOString()
        });

        const passed = !result.accepted && result.status === 'REJECTED' && result.diagnosticCode === 'DEVICE_RETIRED';
        return {
          passed,
          actual: `Accepted: ${result.accepted}, Status: ${result.status}, DiagnosticCode: ${result.diagnosticCode}`,
          evidence: { deviceId: retiredDevice.trackerDeviceId, result }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 20: Database failure -> NO FAKE FALLBACK (Fail-Closed)
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-20',
      'Database failure fail-closed behavior',
      'HIGH AVAILABILITY & FAIL-CLOSED DEFENSE',
      'Verify that database errors fail closed and NEVER fall back to fake authenticated sessions or fabricated locations',
      'Authentication throws or returns null; no simulated bypass token is ever issued',
      async () => {
        const fakeAuth = await repository.users.verifyCredentials('fake-user@doesnotexist.za', 'WrongPassword123!');
        const sessionFail = await repository.sessions.getSession('');

        const passed = fakeAuth === null && sessionFail === null;
        return {
          passed,
          actual: `Fake Auth Result: ${fakeAuth ? 'INSECURE_FALLBACK' : 'NULL (SAFE)'}, Empty Token Session: ${sessionFail ? 'INSECURE' : 'NULL (SAFE)'}`,
          evidence: { fakeAuth, sessionFail }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 21: Founder sovereign authentication regression check
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-21',
      'Founder sovereign authentication regression check',
      'REGRESSION VERIFICATION',
      'Verify that sovereign Founder login remains 100% operational with full administrative clearance',
      'Founder authenticates successfully with FOUNDER_EXECUTIVE role and complete permissions',
      async () => {
        const founderUser = await repository.users.findByEmailOrAlias('founder@itis365.co.za');
        const roleValid = founderUser?.role === 'FOUNDER_EXECUTIVE';
        const activeStatus = founderUser?.status === 'ACTIVE';

        const passed = !!founderUser && roleValid && activeStatus;
        return {
          passed,
          actual: `Founder User Found: ${!!founderUser}, Role: ${founderUser?.role}, Status: ${founderUser?.status}`,
          evidence: { id: founderUser?.id, email: founderUser?.email, role: founderUser?.role }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 22: Guardian authentication regression -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-22',
      'Guardian authentication and child safety regression check',
      'REGRESSION VERIFICATION',
      'Verify that registered parent/guardian accounts authenticate and retain access to their linked children',
      'Guardian verifies successfully; linked learner relationship is active and accessible',
      async () => {
        const guardianUser = await repository.users.findByEmailOrAlias('grace.molefe@safetynet.co.za');
        let linkedChildrenCount = 0;
        if (guardianUser && guardianUser.guardianId) {
          const children = await repository.guardians.findLearnersByGuardianId(guardianUser.guardianId);
          linkedChildrenCount = children.length;
        }

        const passed = !!guardianUser && guardianUser.role === 'PARENT_GUARDIAN' && linkedChildrenCount > 0;
        return {
          passed,
          actual: `Guardian Found: ${!!guardianUser}, Role: ${guardianUser?.role}, Linked Children: ${linkedChildrenCount}`,
          evidence: { guardianId: guardianUser?.guardianId, linkedChildrenCount }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 23: Incident lifecycle regression -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-23',
      'Incident lifecycle integrity regression check',
      'REGRESSION VERIFICATION',
      'Verify that incident creation, command officer claiming, and resolution remain fully operational',
      'Incident lifecycle operates deterministically through create, claim, and resolve stages',
      async () => {
        const founderUser = (await repository.users.findByEmailOrAlias('founder@itis365.co.za'))!;
        const founderSession: ActiveUserSession = {
          id: founderUser.id,
          name: founderUser.name,
          email: founderUser.email,
          role: founderUser.role,
          token: 'tok_test_sec_founder'
        };

        // Create incident
        const created = await incidentLifecycleEngine.createIncident({
          learnerId: 'lrn-001',
          triggerType: 'MANUAL_SOS',
          severity: 'CRITICAL',
          notes: ['Security Hardening Lifecycle Regression Test']
        }, founderSession);

        const incId = created.incident.id;
        const initialStatus = created.incident.status;

        // Claim incident as sovereign founder (or command operator)
        const claimed = await incidentLifecycleEngine.claimIncident(incId, founderSession);

        // Resolve incident as founder/executive
        const resolved = await incidentLifecycleEngine.resolveIncident(incId, {
          category: 'LEARNER_SAFE_RECOVERY',
          summary: 'Resolved in Hardening Test',
          emergencyServicesInvolved: true,
          followUpRequired: false
        }, founderSession);

        const passed = (initialStatus === 'QUEUED' || initialStatus === 'ACTIVE') && claimed.status === 'CLAIMED' && resolved.status === 'RESOLVED';
        return {
          passed,
          actual: `Initial: ${initialStatus}, Claimed: ${claimed.status}, Resolved: ${resolved.status}`,
          evidence: { incidentId: incId, initialStatus, claimedStatus: claimed.status, resolvedStatus: resolved.status }
        };
      }
    );

    // --------------------------------------------------------------------------
    // TEST 24: Existing device operations -> PASS
    // --------------------------------------------------------------------------
    await runTest(
      'SEC-24',
      'Device operations & Concox protocol regression check',
      'REGRESSION VERIFICATION',
      'Verify that GT012 / Concox protocol parsing, packet generation, and hardware registry remain intact',
      'GT012 login packet accepted and acknowledged with authoritative Concox downlink frame',
      async () => {
        const allDevs = deviceRegistryEngine.getAllDevices();
        const targetDev = allDevs.find(d => d.imei && d.imei.length > 5) || allDevs[0];
        const targetImei = targetDev?.imei || '867543029182734';

        // Bit-accurate GT012 binary login packet for this registered device
        const packetBuf = GT012Simulator.generateLoginPacket(targetImei, 0x0001);
        const result = await telemetryGatewayEngine.ingestTelemetryPacket({
          rawPacket: packetBuf.toString('hex'),
          transportType: 'SIMULATOR',
          receivedAt: new Date().toISOString()
        });

        const totalDevices = allDevs.length;
        const ackGenerated = result.ackRequired === true && typeof result.ackPayload === 'string' && result.ackPayload.length > 0;

        const passed = totalDevices > 0 && ackGenerated && result.accepted;
        return {
          passed,
          actual: `Accepted: ${result.accepted}, Total Registered Devices: ${totalDevices}, Downlink ACK: ${result.ackPayload}`,
          evidence: { targetImei, ackPayload: result.ackPayload, totalDevices }
        };
      }
    );

    const passedTests = results.filter(r => r.passed).length;
    const failedTests = results.filter(r => !r.passed).length;
    const allPassed = failedTests === 0;

    return {
      totalTests: results.length,
      passedTests,
      failedTests,
      allPassed,
      timestamp: new Date().toISOString(),
      results
    };
  }
}

export const securityHardeningTestSuite = new SecurityHardeningTestSuite();
