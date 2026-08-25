// ==========================================
// ITIS AUTHORITATIVE CHILD SAFETY DATA ARCHITECTURE
// Principle: PERSON ≠ ENROLMENT ≠ GUARDIAN RELATIONSHIP ≠ ACADEMIC RECORD
// CAPTURE ONCE → VERIFY ONCE → CREATE ONCE → REUSE EVERYWHERE → UPDATE WHEN NECESSARY
// ==========================================

export type IdType = 'SA_ID' | 'PASSPORT' | 'BIRTH_CERTIFICATE' | 'EMIS_ADMISSION_NO';

export type VerificationSource = 
  | 'DHA_NPR_LOOKUP' 
  | 'EMIS_VERIFIED' 
  | 'MANUAL_STAFF_VERIFIED' 
  | 'PENDING';

export type RelationshipType = 
  | 'MOTHER' 
  | 'FATHER' 
  | 'LEGAL_GUARDIAN' 
  | 'GRANDPARENT' 
  | 'FOSTER_PARENT' 
  | 'AUTHORISED_COLLECTOR' 
  | 'OTHER';

export type RelationshipVerificationStatus = 
  | 'VERIFIED' 
  | 'PENDING_DOCUMENTATION' 
  | 'FLAGGED_CONFLICT' 
  | 'REJECTED';

export type EnrolmentStatus = 
  | 'ACTIVE' 
  | 'TRANSFERRED' 
  | 'GRADUATED' 
  | 'WITHDRAWN' 
  | 'SUSPENDED';

export type AcademicStatus = 'CURRENT' | 'PROMOTED' | 'RETAINED' | 'ARCHIVED';

export type ProvinceSA = 
  | 'GAUTENG' 
  | 'WESTERN_CAPE' 
  | 'KWAZULU_NATAL' 
  | 'EASTERN_CAPE' 
  | 'LIMPOPO' 
  | 'MPUMALANGA' 
  | 'FREE_STATE' 
  | 'NORTH_WEST' 
  | 'NORTHERN_CAPE';

// 1. Authoritative Core Person Entity
export interface Person {
  id: string;
  officialId: string; // SA ID, Passport, Birth Cert, or Admission ID
  idType: IdType;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  gender: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'UNDISCLOSED';
  mobileNumber?: string;
  mobileVerified: boolean;
  email?: string;
  emailVerified: boolean;
  physicalAddress?: string;
  isVerified: boolean;
  verificationSource: VerificationSource;
  createdAt: string;
  updatedAt: string;
}

// 2. Authoritative Learner Entity (Child Safety Subject)
export interface Learner {
  id: string;
  personId: string;
  emisId: string; // Official Learner / EMIS / Admission ID
  admissionNumber: string;
  medicalNotes?: string;
  bloodType?: string;
  allergies?: string[];
  trackingBeaconId?: string;
  photoUrl?: string;
  specialSafetyNotes?: string;
  activePanicAlertId?: string;
  createdAt: string;
  updatedAt: string;
}

// 3. Authoritative Guardian Entity (Legal Parent / Caregiver)
export interface Guardian {
  id: string;
  personId: string;
  saIdNumber: string; // e.g. 8503125192084
  saIdMasked: string; // e.g. 850312*****84
  idVerified: boolean;
  mobileNumber: string;
  mobileVerified: boolean;
  alternatePhone?: string;
  employerName?: string;
  preferredLanguage: string;
  pushNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// 4. Authoritative Guardian <-> Learner Relationship (One Guardian -> Many Learners, One Learner -> Many Guardians)
export interface GuardianLearnerRelationship {
  id: string;
  guardianId: string;
  learnerId: string;
  relationshipType: RelationshipType;
  isPrimary: boolean;
  legalCustodyVerified: boolean;
  authorizedForPickup: boolean;
  receiveSosAlerts: boolean;
  verificationStatus: RelationshipVerificationStatus;
  establishedAt: string;
  establishedByStaffUserId: string;
  establishedByStaffName: string;
  establishedBySchoolId: string;
  auditTrailId: string;
  notes?: string;
}

// 5. School Entity
export interface School {
  id: string;
  name: string;
  emisCode: string;
  district: string;
  province: ProvinceSA;
  address: string;
  principalName: string;
  contactPhone: string;
  contactEmail: string;
  activeLearnersCount: number;
  totalGuardiansLinkedCount: number;
  geofenceCenter: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
}

// 6. School Enrolment Record (Explicit affiliation decoupled from Grade/Year)
export interface SchoolEnrolment {
  id: string;
  learnerId: string;
  schoolId: string;
  admissionDate: string;
  enrolmentStatus: EnrolmentStatus;
  currentAcademicYear: number;
  previousSchoolEmis?: string;
  enrolledByStaffId: string;
  createdAt: string;
  updatedAt: string;
}

// 7. Academic Record (Grade / Class / Year progression decoupled from Person)
export interface AcademicRecord {
  id: string;
  learnerId: string;
  schoolId: string;
  academicYear: number; // e.g. 2026
  grade: string;        // e.g. "Grade 10"
  classSection: string; // e.g. "10-A"
  homeroomTeacher: string;
  attendanceRate: number;
  status: AcademicStatus;
  updatedAt: string;
}

// Full Hydrated Learner Record for views
export interface HydratedLearnerRecord {
  learner: Learner;
  person: Person;
  currentSchool?: School;
  currentEnrolment?: SchoolEnrolment;
  currentAcademicRecord?: AcademicRecord;
  academicHistory: AcademicRecord[];
  guardians: Array<{
    guardian: Guardian;
    person: Person;
    relationship: GuardianLearnerRelationship;
  }>;
  recentIncident?: IncidentAlert;
}

// Identity Search Match Result
export type MatchType = 
  | 'EXACT_ID_MATCH' 
  | 'VERIFIED_MOBILE_MATCH' 
  | 'NAME_SURNAME_POSSIBLE' 
  | 'CONFLICT_DETECTED' 
  | 'NO_MATCH';

export interface LinkedChildSummary {
  learnerId: string;
  personId: string;
  fullName: string;
  emisId: string;
  grade: string;
  classSection: string;
  schoolName: string;
  relationshipType: RelationshipType;
  isPrimary: boolean;
  status: EnrolmentStatus;
}

export interface ExistingGuardianMatch {
  guardianId: string;
  personId: string;
  fullName: string;
  saIdMasked: string;
  mobileNumber: string;
  mobileVerified: boolean;
  email?: string;
  linkedChildren: LinkedChildSummary[];
}

export interface ExistingLearnerMatch {
  learnerId: string;
  personId: string;
  fullName: string;
  emisId: string;
  dateOfBirth: string;
  currentSchoolName?: string;
  currentGrade?: string;
  linkedGuardiansCount: number;
}

export interface IdentitySearchResult {
  matchType: MatchType;
  entityType: 'GUARDIAN' | 'LEARNER' | 'BOTH';
  guardianMatch?: ExistingGuardianMatch;
  learnerMatch?: ExistingLearnerMatch;
  confidenceScore: number; // 0 to 100
  title: string;
  description: string;
  requiresStaffReview: boolean;
  conflictReason?: string;
  allowDirectLink: boolean;
}

// Controlled Onboarding Payload (All 4 components captured as ONE atomic transaction)
export interface AuthoritativeOnboardPayload {
  // 1. Learner Information
  learner: {
    existingLearnerId?: string; // If linking to existing authoritative learner
    officialId?: string;       // SA ID or Birth Certificate
    emisId: string;            // EMIS / Admission ID (Primary matching key)
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    gender: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'UNDISCLOSED';
    medicalNotes?: string;
    bloodType?: string;
    allergies?: string[];
    trackingBeaconId?: string;
  };
  
  // 2. Guardian Information
  guardian: {
    existingGuardianId?: string; // If linking to existing authoritative guardian
    saIdNumber: string;          // Primary identity key
    firstName: string;
    lastName: string;
    mobileNumber: string;        // Secondary identity key
    email?: string;
    physicalAddress?: string;
    preferredLanguage?: string;
    employerName?: string;
  };

  // 3. Relationship Specification
  relationship: {
    relationshipType: RelationshipType;
    isPrimary: boolean;
    legalCustodyVerified: boolean;
    authorizedForPickup: boolean;
    receiveSosAlerts: boolean;
    notes?: string;
  };

  // 4. School Enrolment & Academic Placement
  enrolment: {
    schoolId: string;
    academicYear: number;
    grade: string;
    classSection: string;
    homeroomTeacher?: string;
    previousSchoolEmis?: string;
  };

  // Staff Audit Context
  staffContext: {
    staffUserId: string;
    staffName: string;
    staffRole: string;
    ipAddress?: string;
  };
}

// Annual Learner Safety & Information Update Payload (Never duplicates Person/Learner ID)
export interface AnnualSafetyUpdatePayload {
  learnerId: string;
  schoolId: string;
  academicYear: number;
  grade?: string;
  classSection?: string;
  physicalAddress?: string;
  emergencyContacts?: Array<{
    name: string;
    relationship: string;
    mobileNumber: string;
    isPrimary?: boolean;
  }>;
  medicalInfo: {
    bloodType?: string;
    medicalAidScheme?: string;
    medicalAidNumber?: string;
    chronicConditions?: string;
    medications?: string[];
    allergies: string[];
    specialNeeds?: string;
    mobilityRequirements?: string;
    communicationRequirements?: string;
  };
  consentAndAcknowledgements: {
    emergencyMedicalTreatmentApproved: boolean;
    campusExcursionConsent: boolean;
    photoVideoConsent: boolean;
    digitalSafetyPolicySigned: boolean;
    signatureDate: string;
  };
  staffContext: {
    staffUserId: string;
    staffName: string;
    staffRole: string;
    ipAddress?: string;
  };
}

// Register School Payload (Admin / Founder authorized)
export interface RegisterSchoolPayload {
  name: string;
  emisCode: string;
  district: string;
  province: ProvinceSA;
  address: string;
  principalName: string;
  contactPhone: string;
  contactEmail: string;
  geofenceCenter: {
    lat: number;
    lng: number;
    radiusMeters: number;
  };
  staffContext: {
    staffUserId: string;
    staffName: string;
    staffRole: string;
  };
}

// Immutable Audit Log
export interface ImmutableAuditEvent {
  id: string;
  timestamp: string;
  actionType: 
    | 'PERSON_CREATED'
    | 'GUARDIAN_CREATED'
    | 'LEARNER_CREATED'
    | 'SCHOOL_REGISTERED'
    | 'RELATIONSHIP_ESTABLISHED'
    | 'RELATIONSHIP_MODIFIED'
    | 'GUARDIAN_UNLINKED'
    | 'GUARDIAN_UPDATED'
    | 'DEVICE_PAIRED'
    | 'DEVICE_UNPAIRED'
    | 'HARDWARE_DIAGNOSTIC_LOGGED'
    | 'SCHOOL_ENROLLED'
    | 'ACADEMIC_RECORD_ADVANCED'
    | 'ANNUAL_SAFETY_UPDATE_SUBMITTED'
    | 'EXISTING_GUARDIAN_LINKED_TO_NEW_CHILD'
    | 'EXISTING_LEARNER_LINKED_TO_SCHOOL'
    | 'IDENTITY_CONFLICT_REVIEWED'
    | 'LEARNER_DUPLICATE_FLAGGED'
    | 'GUARDIAN_MATCHED'
    | 'IDENTITY_MATCH_EVALUATED'
    | 'ENROLMENT_COMPLETED'
    | 'EMERGENCY_PANIC_TRIGGERED'
    | 'DISPATCH_ACTIVATED'
    | 'ASSIGNMENT_RECEIVED'
    | 'ASSIGNMENT_ACCEPTED'
    | 'ASSIGNMENT_DECLINED'
    | 'RESPONDER_EN_ROUTE'
    | 'RESPONDER_ARRIVED'
    | 'SCENE_SECURED'
    | 'ASSISTANCE_REQUESTED'
    | 'INCIDENT_REPORT_SUBMITTED'
    | 'INCIDENT_RESOLVED'
    | 'UNAUTHORIZED_ACCESS_DENIED'
    | 'UNAUTHORIZED_USER_CREATION_ATTEMPT'
    | 'USER_CREATED'
    | 'USER_DEACTIVATED'
    | 'USER_ROLE_ASSIGNED'
    | 'SECURITY_POLICY_MODIFIED'
    | 'DISPATCH_AUTHORIZATION_VERIFIED'
    | 'NEED_TO_KNOW_DATA_ACCESSED'
    | 'RBAC_PERMISSION_CHECK_FAILED';
  actorUserId: string;
  actorName: string;
  actorRole: string;
  targetEntity: 'PERSON' | 'LEARNER' | 'GUARDIAN' | 'RELATIONSHIP' | 'ENROLMENT' | 'ACADEMIC_RECORD' | 'INCIDENT' | 'USER' | 'POLICY' | 'SYSTEM' | 'SCHOOL' | 'RESPONDER';
  targetId: string;
  details: Record<string, any>;
  ipAddress: string;
  checksum: string;
}

// Safety Telemetry & Incidents
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_SOS';
export type IncidentStatus = 'ACTIVE_ALARM' | 'DISPATCHED' | 'ON_SCENE' | 'CONTAINED' | 'RESOLVED';

// ----------------------------------------------------
// PHASE RESPONDER-04: "UBER FOR EMERGENCY RESPONSE"
// ----------------------------------------------------
export type ResponderOperationalState = 
  | 'AVAILABLE' 
  | 'ASSIGNMENT_RECEIVED' 
  | 'ACCEPTED' 
  | 'EN_ROUTE' 
  | 'ARRIVED' 
  | 'SCENE_SECURED' 
  | 'ASSISTANCE_REQUIRED' 
  | 'RESOLVED' 
  | 'REPORT_SUBMITTED'
  | 'OFF_DUTY';

export type ResponderDeclineReason = 
  | 'VEHICLE_UNAVAILABLE' 
  | 'UNSAFE_TO_PROCEED' 
  | 'MEDICAL_OPERATIONAL_INCAPACITY' 
  | 'EQUIPMENT_FAILURE' 
  | 'COMMUNICATION_FAILURE' 
  | 'OTHER_TACTICAL_CONSTRAINT';

export type ResponderUnitType = 
  | 'NATIONAL_POLICE'
  | 'SAPS' 
  | 'METRO_POLICE' 
  | 'PRIVATE_SECURITY' 
  | 'COMMUNITY_CPF' 
  | 'SCHOOL_SECURITY' 
  | 'PARAMEDIC_EMS';

export interface ResponderUnit {
  id: string;
  callSign: string;
  name: string;
  unitType: ResponderUnitType;
  vehicleId: string;
  contactPhone: string;
  radioFrequency?: string;
  currentLocation: {
    lat: number;
    lng: number;
    addressDescription: string;
    isVerified?: boolean;
    lastReportedAt?: string;
  };
  status: ResponderOperationalState;
  currentIncidentId?: string;
  assignedUserId?: string;
  capabilities: string[];
  ratingScore?: number;
}

export interface AssignedIncidentView {
  incidentId: string;
  learnerId: string;
  learnerName: string;
  learnerGrade: string;
  learnerPhotoUrl?: string;
  learnerAge?: number;
  schoolName: string;
  schoolAddress: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  operationalState: ResponderOperationalState;
  triggerType: string;
  situationSummary: string;
  approvedLocation: {
    lat: number;
    lng: number;
    addressDescription: string;
    accuracyMeters: number;
    isVerified?: boolean;
  };
  route: {
    distanceKm: number;
    etaMinutes: number;
    waypoints: Array<{ lat: number; lng: number; instruction: string }>;
  };
  medicalCriticals: {
    bloodType?: string;
    allergies?: string[];
    medicalNotes?: string;
  };
  primaryGuardianContact: {
    name: string;
    relationship: string;
    mobileNumber: string;
  };
  commandCenterContact: {
    callSign: string;
    phone: string;
    frequency: string;
  };
  dispatchedAt: string;
  acceptedAt?: string;
  enRouteAt?: string;
  arrivedAt?: string;
  sceneSecuredAt?: string;
  isSimulation: boolean;
  declineReason?: string;
}

export interface EligibleResponderRanking {
  responder: ResponderUnit;
  distanceKm: number | null;
  estimatedEtaMinutes: number | null;
  isAvailable: boolean;
  capabilityMatchScore: number;
  rank: number;
  aiRecommendationReason: string;
  locationVerified: boolean;
  statusText: string;
  capabilitiesList: string[];
}

export interface IncidentOutcomeReport {
  incidentId: string;
  responderId: string;
  responderName: string;
  learnerCondition: 
    | 'UNHARMED_SAFE' 
    | 'MINOR_FIRST_AID_APPLIED' 
    | 'PARAMEDIC_CARE_REQUIRED' 
    | 'HOSPITALIZED_EMERGENCY' 
    | 'TRANSPORTED_TO_CAMPUS';
  guardianHandoverStatus: 
    | 'HANDED_TO_AUTHORITATIVE_GUARDIAN' 
    | 'HANDED_TO_SCHOOL_PRINCIPAL' 
    | 'PARAMEDIC_EVACUATION' 
    | 'POLICE_PROTECTIVE_ESCORT';
  handoverPersonName: string;
  handoverPersonContact?: string;
  sceneStatusSummary: string;
  caseReferenceNumber?: string;
  evidenceNotes?: string;
  submittedAt: string;
}

export interface IncidentAlert {
  id: string;
  learnerId: string;
  learnerName: string;
  learnerGrade: string;
  schoolId: string;
  schoolName: string;
  guardianName: string;
  guardianMobile: string;
  timestamp: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  operationalState?: ResponderOperationalState;
  triggerType: 'MANUAL_SOS_BEACON' | 'APP_PANIC' | 'GEOFENCE_BREACH' | 'ROUTE_DEVIATION' | 'UNAUTHORIZED_PICKUP_ATTEMPT';
  location: {
    lat: number;
    lng: number;
    addressDescription: string;
    accuracyMeters: number;
  };
  assignedResponder?: {
    id: string;
    name: string;
    unitType: ResponderUnitType;
    vehicleId: string;
    etaMinutes: number;
    distanceKm?: number;
    acceptedAt?: string;
    arrivedAt?: string;
  };
  isSimulation?: boolean;
  slaTargetSeconds: number; // e.g. 180 (3 min)
  elapsedSeconds: number;
  notes: string[];
  outcomeReport?: IncidentOutcomeReport;
}

// User RBAC roles
export type UserRole = 
  | 'FOUNDER_EXECUTIVE' 
  | 'COMMAND_OPERATOR' 
  | 'SCHOOL_PRINCIPAL' 
  | 'SCHOOL_ADMIN_STAFF' 
  | 'PARENT_GUARDIAN' 
  | 'FIELD_RESPONDER' 
  | 'GOVERNMENT_AUDITOR'
  | 'TECHNICIAN'
  | 'SYSTEM_ADMIN';

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'DISABLED';

export interface PlatformUserItem {
  id: string;
  email: string;
  aliases?: string[];
  name: string;
  firstName?: string;
  surname?: string;
  mobileNumber?: string;
  role: UserRole;
  schoolId?: string;
  guardianId?: string;
  responderUnit?: string;
  department?: string;
  organization?: string;
  permissions: string[];
  status: AccountStatus;
  isDemoAccount?: boolean;
  createdAt?: string;
}

export interface CreateUserPayload {
  firstName: string;
  surname: string;
  email: string;
  mobileNumber?: string;
  role: UserRole;
  password?: string;
  confirmPassword?: string;
  organization?: string;
  schoolId?: string;
  guardianId?: string;
  responderUnit?: string;
  department?: string;
  status?: AccountStatus;
  permissions?: string[];
}

export interface RegisterUserPayload {
  firstName: string;
  surname: string;
  email: string;
  password: string;
  confirmPassword?: string;
  role?: UserRole;
  mobileNumber?: string;
  saIdNumber?: string;
  schoolId?: string;
  organization?: string;
  responderUnit?: string;
  department?: string;
}

export interface ActiveUserSession {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId?: string;
  guardianId?: string;
  responderUnit?: string;
  department?: string;
  organization?: string;
  token: string;
}

// Authoritative Permission Matrix Definitions
export type PermissionKey =
  | 'PLATFORM_GOVERNANCE_MANAGE'
  | 'USER_IDENTITIES_MANAGE'
  | 'SECURITY_POLICIES_MANAGE'
  | 'SYSTEM_CONFIG_MANAGE'
  | 'ENTERPRISE_AUDIT_VIEW'
  | 'OPERATIONAL_RECORDS_MANAGE'
  | 'SCHOOLS_REGISTER'
  | 'SCHOOL_RECORDS_MANAGE'
  | 'LEARNERS_REGISTER'
  | 'LEARNERS_VIEW_ALL'
  | 'LEARNERS_VIEW_SCOPED'
  | 'GUARDIANS_REGISTER'
  | 'GUARDIAN_RELATIONSHIPS_MANAGE'
  | 'ENROLMENT_MANAGE'
  | 'ATTENDANCE_MANAGE'
  | 'EMERGENCY_INCIDENTS_VIEW_ALL'
  | 'EMERGENCY_INCIDENTS_VIEW_SCOPED'
  | 'SOS_VERIFY_ASSESS'
  | 'RESPONDER_DISPATCH_AUTHORIZE'
  | 'RESPONDER_STATUS_UPDATE'
  | 'INCIDENT_RESOLVE_CLOSE'
  | 'ASSIGNED_INCIDENT_VIEW_MINIMAL'
  | 'ASSIGNED_INCIDENT_STATUS_UPDATE'
  | 'INCIDENT_REPORT_SUBMIT'
  | 'GUARDIAN_CHILDREN_VIEW'
  | 'GUARDIAN_LOCATION_VIEW'
  | 'GUARDIAN_ALERTS_RECEIVE'
  | 'GUARDIAN_PROFILE_UPDATE'
  | 'HARDWARE_DEVICES_VIEW'
  | 'HARDWARE_DIAGNOSE'
  | 'HARDWARE_MAINTENANCE_UPDATE'
  | 'FIRMWARE_DEPLOY'
  | 'GOVERNMENT_AGGREGATES_VIEW'
  | 'COMPLIANCE_REPORTS_VIEW'
  | 'EMIS_INTEGRITY_INSPECT'
  | 'EXECUTIVE_METRICS_VIEW'
  | 'STRATEGIC_DASHBOARD_VIEW'
  | 'AUDIT_LOGS_VIEW';

export interface RoleMatrixDefinition {
  role: UserRole;
  displayName: string;
  scope: string;
  authorityLevel: 'HIGHEST_SOVEREIGN' | 'OPERATIONAL_ADMIN' | 'INSTITUTIONAL_SCOPED' | 'FAMILY_SCOPED' | 'COMMAND_OPERATIONAL' | 'TACTICAL_ASSIGNED' | 'TECHNICAL_SCOPED' | 'GOVERNANCE_AUDIT' | 'EXECUTIVE_STRATEGIC';
  canList: string[];
  cannotList: string[];
  permissions: PermissionKey[];
  isSoleUserCreator: boolean;
}

// ----------------------------------------------------
// LIGHTWEIGHT PAGINATION & HIGH-SCALE QUERY MODELS
// ----------------------------------------------------
export interface PaginationMetadata {
  total: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMetadata;
}

export interface LearnerQueryOptions {
  schoolId?: string;
  guardianId?: string;
  grade?: string;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  cursor?: string;
  status?: string;
}

export interface SchoolQueryOptions {
  search?: string;
  province?: string;
  district?: string;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface IncidentQueryOptions {
  status?: string;
  severity?: string;
  schoolId?: string;
  responderUnit?: string;
  learnerId?: string;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
  page?: number;
}

export interface AuditLogQueryOptions {
  actionType?: string;
  actorUserId?: string;
  targetEntity?: string;
  targetId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  limit?: number;
  offset?: number;
  page?: number;
  cursor?: string;
}
