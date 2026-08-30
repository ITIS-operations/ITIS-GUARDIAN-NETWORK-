import {
  UserRole,
  PermissionKey,
  RoleMatrixDefinition,
  ActiveUserSession,
  HydratedLearnerRecord,
  IncidentAlert
} from '../types.js';

export interface ResourceAccessContext {
  schoolId?: string;
  learnerId?: string;
  guardianId?: string;
  incidentId?: string;
  targetUserRole?: UserRole;
  isHumanDispatch?: boolean;
  dataClassification?: 'PUBLIC' | 'OPERATIONAL_INTERNAL' | 'RESTRICTED_CHILD_PII' | 'CRITICAL_TACTICAL' | 'SOVEREIGN_GOVERNANCE';
  needToKnowJustification?: string;
}

export interface AuthorizationDecision {
  allowed: boolean;
  statusCode: 200 | 401 | 403;
  reason?: string;
  auditActionRequired?: boolean;
  auditAction?: string;
  auditDetails?: Record<string, any>;
  dataMaskingRequired?: boolean;
  maskingRules?: {
    hideResponderTacticalDetails?: boolean;
    maskUnlinkedLearnerPii?: boolean;
    hideRawIdNumbers?: boolean;
    hideFullFamilyHistory?: boolean;
  };
}

// --------------------------------------------------------------------------------------
// AUTHORITATIVE ROLE & PERMISSION MATRIX (PHASE RBAC-02 CANONICAL SPECIFICATION)
// --------------------------------------------------------------------------------------
export const AUTHORITATIVE_ROLE_MATRIX: Record<UserRole, RoleMatrixDefinition> = {
  // 1. SUPERADMIN / FOUNDER
  FOUNDER_EXECUTIVE: {
    role: 'FOUNDER_EXECUTIVE',
    displayName: 'Founder & SuperAdmin',
    scope: 'Entire ITIS platform (Universal Sovereign Scope)',
    authorityLevel: 'HIGHEST_SOVEREIGN',
    canList: [
      'Manage ITIS administrators and assign operational roles',
      'Create and deactivate platform user identities',
      'Assign roles and configure fine-grained permissions',
      'Manage organizations and school registries',
      'Manage system configuration and runtime parameters',
      'Manage security policies and compliance standards',
      'View enterprise-wide immutable audit trail',
      'Manage platform governance and sovereign architecture',
      'Access all authorized system data under constitutional oversight',
      'Perform emergency governance overrides and interventions',
      'Manage system-wide configuration'
    ],
    cannotList: [
      'Bypass immutable SHA-256 cryptographic logging (all actions logged permanently)'
    ],
    permissions: [
      'PLATFORM_GOVERNANCE_MANAGE',
      'USER_IDENTITIES_MANAGE',
      'SECURITY_POLICIES_MANAGE',
      'SYSTEM_CONFIG_MANAGE',
      'ENTERPRISE_AUDIT_VIEW',
      'OPERATIONAL_RECORDS_MANAGE',
      'SCHOOLS_REGISTER',
      'SCHOOL_RECORDS_MANAGE',
      'LEARNERS_REGISTER',
      'LEARNERS_VIEW_ALL',
      'GUARDIANS_REGISTER',
      'GUARDIAN_RELATIONSHIPS_MANAGE',
      'ENROLMENT_MANAGE',
      'ATTENDANCE_MANAGE',
      'EMERGENCY_INCIDENTS_VIEW_ALL',
      'SOS_VERIFY_ASSESS',
      'RESPONDER_DISPATCH_AUTHORIZE',
      'RESPONDER_STATUS_UPDATE',
      'INCIDENT_RESOLVE_CLOSE',
      'HARDWARE_DEVICES_VIEW',
      'HARDWARE_DIAGNOSE',
      'HARDWARE_MAINTENANCE_UPDATE',
      'FIRMWARE_DEPLOY',
      'GOVERNMENT_AGGREGATES_VIEW',
      'COMPLIANCE_REPORTS_VIEW',
      'EMIS_INTEGRITY_INSPECT',
      'EXECUTIVE_METRICS_VIEW',
      'STRATEGIC_DASHBOARD_VIEW',
      'AUDIT_LOGS_VIEW'
    ],
    isSoleUserCreator: true // Sole authority to create platform user accounts
  },

  // 2. ADMIN
  SYSTEM_ADMIN: {
    role: 'SYSTEM_ADMIN',
    displayName: 'ITIS Operational Administrator',
    scope: 'ITIS operational administration and entity registries',
    authorityLevel: 'OPERATIONAL_ADMIN',
    canList: [
      'Register new schools into the national safety grid',
      'Register learners (Person + Learner profiles)',
      'Register guardians (Person + Guardian profiles)',
      'Link verified guardians to learners with legal custody checks',
      'Update learner records according to delegated permission',
      'Update guardian records according to delegated permission',
      'Manage school operational records and metadata',
      'Manage learner enrolment and academic progression',
      'Manage operational records across assigned organizational scope',
      'View relevant administrative audit information'
    ],
    cannotList: [
      'Create Founder accounts or SuperAdmin accounts',
      'Assign SuperAdmin role to any user',
      'Change another user\'s security role or create platform user accounts',
      'Modify Founder credentials or session policies',
      'Modify system security configuration or cryptographic settings',
      'Access unrestricted 24/7 Command Centre tactical controls',
      'Autonomously dispatch emergency responders'
    ],
    permissions: [
      'OPERATIONAL_RECORDS_MANAGE',
      'SCHOOLS_REGISTER',
      'SCHOOL_RECORDS_MANAGE',
      'LEARNERS_REGISTER',
      'LEARNERS_VIEW_ALL',
      'GUARDIANS_REGISTER',
      'GUARDIAN_RELATIONSHIPS_MANAGE',
      'ENROLMENT_MANAGE',
      'ATTENDANCE_MANAGE',
      'HARDWARE_DEVICES_VIEW',
      'HARDWARE_DIAGNOSE',
      'AUDIT_LOGS_VIEW'
    ],
    isSoleUserCreator: false // Admin can register operational entities, NOT platform user accounts
  },

  // 3. SCHOOL ADMINISTRATOR (Principal & Staff)
  SCHOOL_PRINCIPAL: {
    role: 'SCHOOL_PRINCIPAL',
    displayName: 'School Principal (Executive Head)',
    scope: 'Assigned school institutional boundary only',
    authorityLevel: 'INSTITUTIONAL_SCOPED',
    canList: [
      'View enrolled learners at assigned school',
      'Manage school learner safety and medical records',
      'Manage school-level guardian relationships and authorized collectors',
      'Manage attendance, homerooms, and campus safety protocols',
      'Receive real-time school-level SOS alerts and geofence breaches',
      'Manage school administrative details and emergency contacts'
    ],
    cannotList: [
      'Perform central Capture-Once Enrolment Administration (Restricted to Founder & System Admin)',
      'Access records or data of other schools',
      'Dispatch tactical armed responders',
      'Access national Command Centre tactical consoles',
      'Manage ITIS platform users',
      'Change system roles or security permissions'
    ],
    permissions: [
      'SCHOOL_RECORDS_MANAGE',
      'LEARNERS_VIEW_SCOPED',
      'ATTENDANCE_MANAGE',
      'EMERGENCY_INCIDENTS_VIEW_SCOPED'
    ],
    isSoleUserCreator: false
  },

  SCHOOL_ADMIN_STAFF: {
    role: 'SCHOOL_ADMIN_STAFF',
    displayName: 'School Administrative Staff (Registrar)',
    scope: 'Assigned school institutional boundary only',
    authorityLevel: 'INSTITUTIONAL_SCOPED',
    canList: [
      'View enrolled learners at assigned school',
      'Maintain daily attendance registers and class rosters',
      'Verify guardian documentation and relationship certificates',
      'Receive campus safety notifications'
    ],
    cannotList: [
      'Perform central Capture-Once Enrolment Administration (Restricted to Founder & System Admin)',
      'Access records of other schools',
      'Dispatch tactical emergency responders',
      'Access national Command Centre',
      'Manage ITIS platform users or roles'
    ],
    permissions: [
      'SCHOOL_RECORDS_MANAGE',
      'LEARNERS_VIEW_SCOPED',
      'ATTENDANCE_MANAGE',
      'EMERGENCY_INCIDENTS_VIEW_SCOPED'
    ],
    isSoleUserCreator: false
  },

  // 4. GUARDIAN / PARENT
  PARENT_GUARDIAN: {
    role: 'PARENT_GUARDIAN',
    displayName: 'Parent / Legal Guardian',
    scope: 'Strictly verified linked children only (Family Boundary)',
    authorityLevel: 'FAMILY_SCOPED',
    canList: [
      'View their verified linked children profile and photo',
      'View live child safety status and zone containment',
      'View approved location telemetry and beacon status',
      'Receive instant critical SOS push sirens and SMS alerts',
      'View historic trip timeline and attendance check-ins',
      'Contact school and ITIS support via approved channels',
      'Update permitted guardian emergency contacts and preferences'
    ],
    cannotList: [
      'View other learners or children outside verified legal custody',
      'View tactical Command Centre data, maps, or telemetry',
      'View responder personal identities, tactical units, or internal notes',
      'Directly dispatch emergency armed responders',
      'Access school administrative records',
      'Access platform system administration'
    ],
    permissions: [
      'GUARDIAN_CHILDREN_VIEW',
      'GUARDIAN_LOCATION_VIEW',
      'GUARDIAN_ALERTS_RECEIVE',
      'GUARDIAN_PROFILE_UPDATE',
      'EMERGENCY_INCIDENTS_VIEW_SCOPED'
    ],
    isSoleUserCreator: false
  },

  // 5. COMMAND OFFICER
  COMMAND_OPERATOR: {
    role: 'COMMAND_OPERATOR',
    displayName: '24/7 Command Centre Officer',
    scope: 'National operational emergency monitoring and tactical coordination',
    authorityLevel: 'COMMAND_OPERATIONAL',
    canList: [
      'View live active emergencies and priority alarms',
      'Verify SOS events with rapid audio/telemetry correlation',
      'Review learner safety and medical dossier required for emergency response',
      'Assess incident threat levels and geofence breaches',
      'View eligible responders in proximity to the incident',
      'See responder live distance, unit capability, and availability',
      'Select and assign tactical responder unit',
      'Authorize tactical dispatch (Human-In-The-Loop mandatory)',
      'Monitor active response ETA and live GPS telemetry',
      'Communicate via approved operational voice and encrypted channels',
      'Resolve incidents with verified safety debrief',
      'Create operational triage and scene notes',
      'Complete audit-required case closure'
    ],
    cannotList: [
      'Autonomously dispatch responders without human verification (AI dispatch banned)',
      'Allow automated systems or bots to dispatch units without officer review',
      'Change Founder/SuperAdmin accounts or configurations',
      'Manage system user identities or assign platform roles',
      'Change platform RBAC security matrix'
    ],
    permissions: [
      'EMERGENCY_INCIDENTS_VIEW_ALL',
      'SOS_VERIFY_ASSESS',
      'RESPONDER_DISPATCH_AUTHORIZE',
      'RESPONDER_STATUS_UPDATE',
      'INCIDENT_RESOLVE_CLOSE',
      'LEARNERS_VIEW_SCOPED', // Need-to-know emergency access
      'AUDIT_LOGS_VIEW'
    ],
    isSoleUserCreator: false
  },

  // 6. RESPONDER
  FIELD_RESPONDER: {
    role: 'FIELD_RESPONDER',
    displayName: 'SAPS & Tactical Armed Responder',
    scope: 'Assigned emergency incident response only (Strict Tactical Scope)',
    authorityLevel: 'TACTICAL_ASSIGNED',
    canList: [
      'Receive dispatched response assignments for their assigned unit',
      'View minimum information required to respond (child photo, medical notes, coordinates, contact)',
      'Accept assigned emergency assignment',
      'Navigate to incident via real-time turn-by-turn guidance',
      'Update response status (EN_ROUTE, ON_SCENE, SECURED, ESCORT_COMPLETE)',
      'Report on-scene arrival timestamp',
      'Report scene status and child condition',
      'Request backup / secondary medical assistance',
      'Complete response assignment and handover',
      'Submit operational field incident report'
    ],
    cannotList: [
      'Browse available emergencies or view unassigned incident feeds',
      'Select which emergency to attend (must follow Command dispatch)',
      'Choose a learner or choose a school independently',
      'Self-dispatch to incidents without Command authorization',
      'Dispatch another responder unit',
      'Access Command Centre tactical controls or administrative screens',
      'View unrelated incidents across the country',
      'View other responders\' assignments or unit rosters',
      'Change incident priority or severity rating'
    ],
    permissions: [
      'ASSIGNED_INCIDENT_VIEW_MINIMAL',
      'ASSIGNED_INCIDENT_STATUS_UPDATE',
      'INCIDENT_REPORT_SUBMIT'
    ],
    isSoleUserCreator: false
  },

  // 7. TECHNICIAN
  TECHNICIAN: {
    role: 'TECHNICIAN',
    displayName: 'Hardware & IoT Gateway Technician',
    scope: 'Assigned technical infrastructure, beacons, and BLE/LoRaWAN gateways',
    authorityLevel: 'TECHNICAL_SCOPED',
    canList: [
      'View assigned IoT devices, towers, and beacon telemetry',
      'View device battery health, signal strength, and firmware status',
      'Diagnose beacon calibration and geofence latency',
      'Update hardware maintenance status and replacement logs',
      'Manage assigned hardware peripherals and test gateways',
      'Submit technical diagnostics and installation reports'
    ],
    cannotList: [
      'Access unrestricted learner personal safety dossiers or family records',
      'Dispatch emergency tactical responders',
      'Access Command Centre incident management controls',
      'Manage system users or modify RBAC access rules'
    ],
    permissions: [
      'HARDWARE_DEVICES_VIEW',
      'HARDWARE_DIAGNOSE',
      'HARDWARE_MAINTENANCE_UPDATE',
      'FIRMWARE_DEPLOY'
    ],
    isSoleUserCreator: false
  },

  // 8. GOVERNMENT / AUDITOR
  GOVERNMENT_AUDITOR: {
    role: 'GOVERNMENT_AUDITOR',
    displayName: 'DBE & Government Regulatory Auditor',
    scope: 'Authorized government governance and compliance data',
    authorityLevel: 'GOVERNANCE_AUDIT',
    canList: [
      'Access approved aggregate national child safety metrics and charts',
      'View DBE compliance reports and EMIS integration verification',
      'View authorized school safety statistics and district summaries',
      'View approved incident response SLA and resolution benchmarks',
      'Inspect national immutable SHA-256 audit trail for regulatory compliance'
    ],
    cannotList: [
      'Access unrestricted live operational incident controls',
      'Dispatch emergency responders',
      'Manage ITIS user accounts',
      'Modify platform security configuration or operational databases'
    ],
    permissions: [
      'GOVERNMENT_AGGREGATES_VIEW',
      'COMPLIANCE_REPORTS_VIEW',
      'EMIS_INTEGRITY_INSPECT',
      'ENTERPRISE_AUDIT_VIEW',
      'AUDIT_LOGS_VIEW'
    ],
    isSoleUserCreator: false
  }
};

// --------------------------------------------------------------------------------------
// SERVER-SIDE RBAC & ABAC EVALUATOR ENGINE
// --------------------------------------------------------------------------------------
export class AuthoritativeRbacEngine {
  /**
   * Check if a given role or explicit permission set contains a capability
   */
  public hasPermission(role: UserRole, userExplicitPermissions: string[] | undefined, required: PermissionKey): boolean {
    if (role === 'FOUNDER_EXECUTIVE') {
      return true; // Founder has universal sovereign access
    }

    const roleDef = AUTHORITATIVE_ROLE_MATRIX[role];
    if (!roleDef) return false;

    // Check role default permissions
    if (roleDef.permissions.includes(required)) {
      return true;
    }

    // Check explicit user overrides
    if (userExplicitPermissions && (userExplicitPermissions.includes(required) || userExplicitPermissions.includes('*'))) {
      return true;
    }

    return false;
  }

  /**
   * Authoritative ABAC Evaluator combining:
   * 1. Authenticated identity
   * 2. Role
   * 3. Permission key
   * 4. Organization / School scope
   * 5. Object relationship (Guardian -> Child, Responder -> Assigned incident)
   * 6. Data classification & Need-to-know
   */
  public async evaluateAccess(
    user: ActiveUserSession | null,
    requiredPermission: PermissionKey,
    context?: ResourceAccessContext,
    helpers?: {
      isGuardianLinkedToLearner?: (guardianId: string, learnerId: string) => boolean | Promise<boolean>;
      isLearnerEnrolledInSchool?: (learnerId: string, schoolId: string) => boolean | Promise<boolean>;
      isIncidentAssignedToResponder?: (incidentId: string, responderUnit?: string, responderId?: string) => boolean | Promise<boolean>;
    }
  ): Promise<AuthorizationDecision> {
    // 1. Authenticated Identity Check
    if (!user) {
      return {
        allowed: false,
        statusCode: 401,
        reason: 'Unauthenticated. Valid sovereign session token required.',
        auditActionRequired: false
      };
    }

    // 2. Founder Override (Universal Governance Scope)
    if (user.role === 'FOUNDER_EXECUTIVE') {
      return {
        allowed: true,
        statusCode: 200,
        dataMaskingRequired: false
      };
    }

    // 3. User Creation Rule Check (Strictly Founder-Only)
    if (requiredPermission === 'USER_IDENTITIES_MANAGE') {
      return {
        allowed: false,
        statusCode: 403,
        reason: 'ACCESS DENIED: Only Founder/SuperAdmin may create or manage platform user identities and system roles.',
        auditActionRequired: true,
        auditAction: 'UNAUTHORIZED_USER_CREATION_ATTEMPT',
        auditDetails: {
          attemptedByUserId: user.id,
          attemptedByRole: user.role,
          targetRole: context?.targetUserRole,
          violation: 'NON_FOUNDER_USER_CREATION_ATTEMPT'
        }
      };
    }

    // 4. Role Permission Check
    const hasBasePermission = this.hasPermission(user.role, undefined, requiredPermission);
    if (!hasBasePermission) {
      return {
        allowed: false,
        statusCode: 403,
        reason: `ACCESS DENIED: Role '${user.role}' lacks capability '${requiredPermission}'.`,
        auditActionRequired: true,
        auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
        auditDetails: {
          userId: user.id,
          role: user.role,
          requiredPermission,
          reason: 'MISSING_ROLE_PERMISSION'
        }
      };
    }

    // 5. ABAC: School Scope Enforcement
    if (context?.schoolId && (user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF')) {
      if (user.schoolId && user.schoolId !== context.schoolId) {
        return {
          allowed: false,
          statusCode: 403,
          reason: `ACCESS DENIED: Institutional boundary violation. User is restricted to school '${user.schoolId}', attempted access to '${context.schoolId}'.`,
          auditActionRequired: true,
          auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
          auditDetails: {
            userId: user.id,
            role: user.role,
            userSchoolId: user.schoolId,
            targetSchoolId: context.schoolId,
            violation: 'CROSS_SCHOOL_ACCESS_BLOCKED'
          }
        };
      }
    }

    // 5b. ABAC: School Staff -> Learner Institutional Enrollment Enforcement
    if (context?.learnerId && (user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF')) {
      if (!user.schoolId) {
        return {
          allowed: false,
          statusCode: 403,
          reason: 'ACCESS DENIED: User has School Staff role but lacks assigned institutional schoolId.',
          auditActionRequired: true,
          auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
          auditDetails: { userId: user.id, role: user.role, violation: 'UNASSIGNED_SCHOOL_STAFF_SESSION' }
        };
      }
      if (helpers?.isLearnerEnrolledInSchool) {
        const isEnrolled = await helpers.isLearnerEnrolledInSchool(context.learnerId, user.schoolId);
        if (!isEnrolled) {
          return {
            allowed: false,
            statusCode: 403,
            reason: `ACCESS DENIED: Institutional boundary violation. Learner '${context.learnerId}' is not enrolled in your institution '${user.schoolId}'.`,
            auditActionRequired: true,
            auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
            auditDetails: {
              schoolId: user.schoolId,
              unlinkedLearnerId: context.learnerId,
              violation: 'CROSS_SCHOOL_LEARNER_ACCESS_BLOCKED'
            }
          };
        }
      }
    }

    // 6. ABAC: Guardian -> Child Legal Relationship Enforcement
    if (user.role === 'PARENT_GUARDIAN' && context?.learnerId) {
      if (!user.guardianId) {
        return {
          allowed: false,
          statusCode: 403,
          reason: 'ACCESS DENIED: User has Guardian role but lacks registered guardian profile link.',
          auditActionRequired: true,
          auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
          auditDetails: { userId: user.id, role: user.role, violation: 'UNLINKED_GUARDIAN_SESSION' }
        };
      }

      if (helpers?.isGuardianLinkedToLearner) {
        const isLinked = await helpers.isGuardianLinkedToLearner(user.guardianId, context.learnerId);
        if (!isLinked) {
          return {
            allowed: false,
            statusCode: 403,
            reason: `ACCESS DENIED (POPIA Section 14 / Child Care Act): Guardian '${user.guardianId}' does not possess verified legal custody/relationship to Learner '${context.learnerId}'.`,
            auditActionRequired: true,
            auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
            auditDetails: {
              guardianId: user.guardianId,
              unlinkedLearnerId: context.learnerId,
              violation: 'UNLINKED_CHILD_ACCESS_BLOCKED'
            }
          };
        }
      }
    }

    // 7. ABAC: Responder -> Assigned Incident Enforcement
    if (user.role === 'FIELD_RESPONDER') {
      if (context?.incidentId && helpers?.isIncidentAssignedToResponder) {
        const isAssigned = await helpers.isIncidentAssignedToResponder(context.incidentId, user.responderUnit, user.id);
        if (!isAssigned) {
          return {
            allowed: false,
            statusCode: 403,
            reason: `ACCESS DENIED: Tactical responder '${user.responderUnit || user.id}' is NOT dispatched or assigned to incident '${context.incidentId}'. Responders are strictly barred from browsing unassigned emergencies.`,
            auditActionRequired: true,
            auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
            auditDetails: {
              responderId: user.id,
              responderUnit: user.responderUnit,
              unassignedIncidentId: context.incidentId,
              violation: 'UNASSIGNED_INCIDENT_ACCESS_BLOCKED'
            }
          };
        }
      }

      // Responder receives minimum operational dossier only
      return {
        allowed: true,
        statusCode: 200,
        dataMaskingRequired: true,
        maskingRules: {
          hideResponderTacticalDetails: false,
          maskUnlinkedLearnerPii: true,
          hideRawIdNumbers: true,
          hideFullFamilyHistory: true
        }
      };
    }

    // 8. ABAC: Command Dispatch Authorization (Human-In-The-Loop Enforcement)
    if (requiredPermission === 'RESPONDER_DISPATCH_AUTHORIZE') {
      if (context?.isHumanDispatch === false) {
        return {
          allowed: false,
          statusCode: 403,
          reason: 'ACCESS DENIED: Autonomous or AI-driven responder dispatch is strictly prohibited under National Child Safety Protocol. Explicit human Command Officer authorization is mandatory.',
          auditActionRequired: true,
          auditAction: 'UNAUTHORIZED_ACCESS_DENIED',
          auditDetails: {
            userId: user.id,
            violation: 'AUTONOMOUS_OR_AI_DISPATCH_PROHIBITED'
          }
        };
      }
    }

    // Default Allow
    return {
      allowed: true,
      statusCode: 200
    };
  }

  /**
   * Sanitizes learner record payload according to the requester's role and need-to-know
   */
  public sanitizeLearnerRecord(record: HydratedLearnerRecord, user: ActiveUserSession): HydratedLearnerRecord {
    // Founder, Admin, and School Admin get full records (school admin within their school)
    if (user.role === 'FOUNDER_EXECUTIVE' || user.role === 'SYSTEM_ADMIN' || user.role === 'SCHOOL_PRINCIPAL' || user.role === 'SCHOOL_ADMIN_STAFF') {
      return record;
    }

    // Guardian gets child record with masked sensitive staff notes
    if (user.role === 'PARENT_GUARDIAN') {
      return {
        ...record,
        person: {
          ...record.person,
          officialId: record.person.officialId ? record.person.officialId.slice(0, 6) + '*****' + record.person.officialId.slice(-2) : '—'
        }
      };
    }

    // Field Responder gets minimum tactical response dossier
    if (user.role === 'FIELD_RESPONDER') {
      return {
        learner: {
          id: record.learner.id,
          personId: record.learner.personId,
          emisId: record.learner.emisId,
          admissionNumber: record.learner.admissionNumber,
          medicalNotes: record.learner.medicalNotes,
          bloodType: record.learner.bloodType,
          allergies: record.learner.allergies,
          photoUrl: record.learner.photoUrl,
          createdAt: '',
          updatedAt: ''
        },
        person: {
          id: record.person.id,
          officialId: 'RESTRICTED (TACTICAL VIEW)',
          idType: record.person.idType,
          firstName: record.person.firstName,
          lastName: record.person.lastName,
          dateOfBirth: record.person.dateOfBirth,
          gender: record.person.gender,
          mobileVerified: false,
          emailVerified: false,
          isVerified: true,
          verificationSource: 'DHA_NPR_LOOKUP',
          createdAt: '',
          updatedAt: ''
        },
        currentSchool: record.currentSchool,
        currentAcademicRecord: record.currentAcademicRecord,
        academicHistory: [], // Hidden
        guardians: record.guardians.map(g => ({
          relationship: g.relationship,
          guardian: {
            id: g.guardian.id,
            personId: g.guardian.personId,
            saIdNumber: 'RESTRICTED',
            saIdMasked: 'RESTRICTED',
            idVerified: true,
            mobileNumber: g.guardian.mobileNumber, // Accessible for emergency pickup contact
            mobileVerified: true,
            preferredLanguage: g.guardian.preferredLanguage,
            pushNotificationsEnabled: false,
            createdAt: '',
            updatedAt: ''
          },
          person: {
            id: g.person.id,
            officialId: 'RESTRICTED',
            idType: g.person.idType,
            firstName: g.person.firstName,
            lastName: g.person.lastName,
            dateOfBirth: '',
            gender: g.person.gender,
            mobileVerified: true,
            emailVerified: false,
            isVerified: true,
            verificationSource: 'DHA_NPR_LOOKUP',
            createdAt: '',
            updatedAt: ''
          }
        }))
      };
    }

    return record;
  }
}

export const rbacEngine = new AuthoritativeRbacEngine();
