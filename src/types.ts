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
  userId?: string;
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
  guardianUserStatus?: 'CREATED' | 'LINKED' | 'CONFLICT' | 'SKIPPED';
  guardianUserMessage?: string;
  message?: string;
  auditEventId?: string;
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
    | 'RBAC_PERMISSION_CHECK_FAILED'
    | 'DEVICE_ASSIGNMENT'
    | 'DEVICE_REASSIGNMENT'
    | 'DIAGNOSTIC_ACTION'
    | 'DEVICE_CALIBRATION'
    | 'MAINTENANCE_ACTION'
    | 'TECHNICAL_CONFIG_CHANGED'
    | 'INCIDENT_CLAIMED'
    | 'INCIDENT_RELEASED'
    | 'COMMAND_INCIDENT_HANDOVER'
    | 'INCIDENT_MONITOR_JOINED'
    | 'INCIDENT_MONITOR_LEFT'
    | 'RESPONDER_LOCATION_SHARING_ENABLED'
    | 'RESPONDER_LOCATION_SHARING_DISABLED'
    | 'RESPONDER_LOCATION_UPDATED'
    | 'RESPONDER_AVAILABILITY_CHANGED'
    | 'DEVICE_PROCURED'
    | 'DEVICE_REGISTERED'
    | 'DEVICE_PROVISIONED'
    | 'DEVICE_ASSIGNED'
    | 'DEVICE_ASSIGNED_TO_LEARNER'
    | 'DEVICE_UNASSIGNED'
    | 'DEVICE_SUSPENDED'
    | 'DEVICE_ACTIVATED'
    | 'DEVICE_REACTIVATED'
    | 'DEVICE_REPLACED'
    | 'DEVICE_LOST'
    | 'DEVICE_RETIRED'
    | 'SUSPENDED_DEVICE_TELEMETRY_BLOCKED'
    | 'DUPLICATE_DEVICE_REGISTRATION_BLOCKED'
    | 'TELEMETRY_SIMULATION_EXECUTED'
    | 'TELEMETRY_PACKET_RECEIVED'
    | 'TELEMETRY_PACKET_ACCEPTED'
    | 'TELEMETRY_PACKET_REJECTED'
    | 'TELEMETRY_DUPLICATE_SUPPRESSED'
    | 'TELEMETRY_DEVICE_QUARANTINED'
    | 'TELEMETRY_GATEWAY_STARTED'
    | 'UNKNOWN_DEVICE_TELEMETRY_ATTEMPT'
    | 'SUSPENDED_DEVICE_TELEMETRY_ATTEMPT'
    | 'MALFORMED_PACKET_RECEIVED'
    | 'LOCATION_VIEWED'
    | 'LOCATION_HISTORY_VIEWED'
    | 'UNAUTHORIZED_LOCATION_ACCESS_DENIED'
    | 'TELEMETRY_ALERT_GENERATED'
    | 'TELEMETRY_ALERT_SUPPRESSED'
    | 'TELEMETRY_INCIDENT_CORRELATED'
    | 'AUTOMATION_RULE_TRIGGERED'
    | 'SAFETY_AUTOMATION_CONFIGURED';
  actorUserId: string;
  actorName: string;
  actorRole: string;
  targetEntity: 'PERSON' | 'LEARNER' | 'GUARDIAN' | 'RELATIONSHIP' | 'ENROLMENT' | 'ACADEMIC_RECORD' | 'INCIDENT' | 'USER' | 'POLICY' | 'SYSTEM' | 'SCHOOL' | 'RESPONDER' | 'DEVICE' | 'HARDWARE' | 'GATEWAY' | 'LOCATION' | 'TELEMETRY' | 'SAFETY_ALERT' | 'AUTOMATION_RULE';
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

export interface MonitoringOfficer {
  userId: string;
  name: string;
  role?: string;
  joinedAt: string;
}

export interface CommandOfficerWorkload {
  userId: string;
  name: string;
  role: string;
  status: 'AVAILABLE' | 'ACTIVE' | 'OFFLINE';
  activeIncidentCount: number;
  monitoredIncidentCount: number;
  totalWorkload: number;
  assignedIncidentIds: string[];
  isOverloaded?: boolean;
}

export interface ResponderLocationUpdate {
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  heading?: number;
  speed?: number;
  locationSharingStatus: 'OFF_DUTY' | 'AVAILABLE' | 'ON_INCIDENT' | 'EMERGENCY_MODE';
  timestamp?: string;
  addressDescription?: string;
}

export interface TacticalMapLayerSettings {
  showIncidents: boolean;
  showResponders: boolean;
  showSchools: boolean;
  showSafeZones: boolean;
  showRoutes: boolean;
  showHeatmap?: boolean;
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
    locationSource?: string;
    locationTimestamp?: string;
  };
  primaryOfficerId?: string;
  primaryOfficerName?: string;
  primaryOfficerRole?: string;
  claimedAt?: string;
  monitoringOfficers?: MonitoringOfficer[];
  assignedResponder?: {
    id: string;
    name: string;
    unitType: ResponderUnitType;
    vehicleId: string;
    etaMinutes: number;
    distanceKm?: number;
    acceptedAt?: string;
    arrivedAt?: string;
    currentLat?: number;
    currentLng?: number;
    heading?: number;
    speed?: number;
    lastLocationUpdate?: string;
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
  normalizedEmail?: string;
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
  mustChangePassword?: boolean;
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

export interface UpdateUserPayload {
  firstName?: string;
  surname?: string;
  name?: string;
  email?: string;
  mobileNumber?: string;
  role?: UserRole;
  password?: string;
  organization?: string;
  schoolId?: string | null;
  guardianId?: string | null;
  responderUnit?: string | null;
  department?: string | null;
  status?: AccountStatus;
  permissions?: string[];
  mustChangePassword?: boolean;
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
  mustChangePassword?: boolean;
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
  learnerIds?: string[];
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

// ----------------------------------------------------
// PHASE 6: TECHNICIAN & HARDWARE TELEMETRY MODELS
// ----------------------------------------------------
export interface DeviceRecord {
  id: string;
  serialNumber: string;
  type: 'WEARABLE_BEACON' | 'RFID_GATE_READER' | 'VEHICLE_GPS' | 'BIOMETRIC_TERMINAL' | 'LORAWAN_GATEWAY';
  assignedSchool: string;
  assignedSubject?: string;
  assignmentState: 'ASSIGNED' | 'UNASSIGNED' | 'IN_MAINTENANCE';
  batteryLevel: number;
  signalStrength: number; // dBm e.g. -58
  snrDb?: number; // SNR in dB e.g. +28
  firmwareVersion: string;
  hardwareRevision?: string;
  status: 'ONLINE' | 'LOW_BATTERY' | 'OFFLINE' | 'MAINTENANCE_REQUIRED' | 'TAMPER_TRIGGERED';
  tamperStatus: 'SECURE' | 'TAMPER_FLAGGED' | 'CALIBRATED';
  calibrationStatus: 'CALIBRATED' | 'PENDING_RECALIBRATION' | 'CALIBRATING';
  rfChannel?: string;
  gatewayStatus?: string;
  lastHeartbeat: string;
  lastPingAt?: string;
  maintenanceDueInDays?: number;
}

export interface DeviceGatewayRecord {
  id: string;
  name: string;
  schoolName: string;
  type: 'RFID_LONG_RANGE' | 'LORAWAN_868' | 'BLE_MESH_REPEATER' | 'BIOMETRIC_GATE';
  rfChannel: string;
  frequencyMhz: number;
  snrDb: number;
  uplinkStatus: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE';
  latencyMs: number;
  activeConnectedNodes: number;
  icasaCertified: boolean;
}

export interface DeviceMaintenanceRecord {
  id: string;
  deviceId: string;
  serialNumber?: string;
  deviceSerialNumber?: string;
  technicianUserId: string;
  technicianName: string;
  actionType: string;
  description: string;
  status: string;
  scheduledDate?: string;
  completedDate?: string;
  performedAt?: string;
  createdAt: string;
}

export interface TechnicianValidationResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    auditEventLogged?: boolean;
    evidence: Record<string, any>;
  }[];
}

// ----------------------------------------------------
// PHASE 9: FOUNDER / EXECUTIVE GOVERNANCE DATA & VALIDATION
// ----------------------------------------------------
export interface ExecutiveProvincialMetric {
  province: string;
  district: string;
  schoolsCount: number;
  learnersCount: number;
  activeDevicesCount: number;
  incidentCount: number;
  resolvedCount: number;
  slaCompliance: string;
  gatewayStatus: 'OPTIMAL' | 'DEGRADED' | 'OPERATIONAL';
}

export interface StrategicKpiItem {
  id: string;
  title: string;
  value: string | number;
  target: string | number;
  unit?: string;
  trend: 'UP' | 'DOWN' | 'STABLE';
  status: 'EXCELLENT' | 'ON_TRACK' | 'ATTENTION';
  description: string;
}

export interface ExecutiveOperationalAlert {
  id: string;
  level: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  category: string;
  description: string;
  recommendedAction: string;
  timestamp: string;
  affectedCount?: number;
}

export interface ExecutiveOverviewData {
  nationalSafetyIndex: number; // e.g. 99.8%
  totalLearnersProtected: number;
  totalSchoolsOnboarded: number;
  totalGuardiansLinked: number;
  totalActiveIncidents: number;
  totalResolvedIncidents: number;
  emergencyResponseAverageEtaSeconds: number; // e.g. 142
  slaComplianceRate: number; // e.g. 99.6
  systemAvailability: number; // e.g. 99.99
  provincialBreakdown: ExecutiveProvincialMetric[];
  schoolCoverage: {
    totalSchools: number;
    certifiedSchools: number;
    adoptionVelocityMonthly: string;
    averageSafetyTier: string;
  };
  learnerProtection: {
    totalActive: number;
    monitoredBeacons: number;
    safeZoneContainmentRate: string;
    unresolvedIncidents: number;
  };
  deviceNetworkHealth: {
    totalDevices: number;
    activeBeacons: number;
    lowBatteryAlerts: number;
    gatewaysOnline: number;
    gatewaysTotal: number;
    spectrumCompliance: string;
  };
  guardianAdoption: {
    totalGuardians: number;
    multiChildLinkRatio: string;
    averageVerificationTimeDays: number;
    pushSmsDeliveryRate: string;
  };
  auditCompliance: {
    totalAuditEvents: number;
    tamperProofChecksumsVerified: boolean;
    popiaDataResidency: string;
    dbeEmisSyncStatus: string;
    lastIntegrityVerification: string;
  };
  operationalAlerts: ExecutiveOperationalAlert[];
  strategicKpis: StrategicKpiItem[];
  timestamp: string;
}

export interface FounderValidationResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    auditEventLogged?: boolean;
    evidence: Record<string, any>;
  }[];
}

// ----------------------------------------------------
// GT012 GPS TRACKER PROTOCOL & TELEMETRY CONTRACTS
// ----------------------------------------------------

export type GT012DeviceHealthStatus = 
  | 'ONLINE' 
  | 'OFFLINE' 
  | 'LOW_BATTERY' 
  | 'POOR_SIGNAL' 
  | 'UNKNOWN';

export type GT012AlarmClassification = 
  | 'DEVICE_HEALTH_ALERT' 
  | 'SAFETY_ALERT' 
  | 'EMERGENCY_CANDIDATE' 
  | 'CRITICAL_EMERGENCY';

export type GT012AlarmType = 
  | 'SOS_PANIC' 
  | 'LOW_BATTERY_WARNING' 
  | 'GEOFENCE_EXIT' 
  | 'GEOFENCE_ENTER' 
  | 'POWER_CUT' 
  | 'VIBRATION_SHOCK' 
  | 'TAMPER_SENSOR' 
  | 'OVERSPEED' 
  | 'NORMAL_STATUS';

export interface GT012DeviceTelemetryRecord {
  id: string;
  deviceId: string;
  terminalIdentifier: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  batteryLevel: number;
  voltage: number;
  gsmSignal: number;
  gpsValidity: boolean;
  satelliteCount: number;
  mcc?: number;
  mnc?: number;
  lac?: number;
  cellId?: number;
  source: 'GT012_GPS' | 'GT012_ALARM' | 'GT012_HEARTBEAT' | 'SIMULATED_GT012';
  isSimulated?: boolean;
}

export interface GT012DeviceHealthRecord {
  deviceId: string;
  terminalIdentifier: string;
  lastHeartbeatAt: string;
  lastLocationAt: string;
  connectivityStatus: GT012DeviceHealthStatus;
  batteryStatus: 'NORMAL' | 'LOW' | 'CRITICAL' | 'CHARGING';
  batteryPercentage: number;
  signalStatus: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_SIGNAL';
  signalDbm: number;
  defenseStatus: 'ARMED' | 'DISARMED';
}

// ====================================================
// ITIS AUTHORITATIVE GPS DEVICE REGISTRY & LEARNER LINKING
// ====================================================

export type ItisDeviceState = 
  | 'UNREGISTERED' 
  | 'INVENTORY'
  | 'REGISTERED'
  | 'PROVISIONING' 
  | 'ACTIVE' 
  | 'ASSIGNED'
  | 'SUSPENDED' 
  | 'LOST' 
  | 'STOLEN'
  | 'REPLACED'
  | 'RETIRED' 
  | 'FAULT';

export type ItisDeviceActivationStatus = 
  | 'ACTIVATED' 
  | 'PENDING_ACTIVATION' 
  | 'DEACTIVATED';

export type ItisDeviceCalculatedHealthState = 
  | 'ONLINE'
  | 'DEGRADED'
  | 'OFFLINE'
  | 'STALE'
  | 'SUSPENDED'
  | 'RETIRED';

export interface DeviceHealthThresholdConfig {
  onlineThresholdSeconds: number;
  staleThresholdSeconds: number;
  degradedBatteryThreshold: number;
  degradedAccuracyMetersThreshold: number;
}

export const DEFAULT_DEVICE_HEALTH_CONFIG: DeviceHealthThresholdConfig = {
  onlineThresholdSeconds: 180,
  staleThresholdSeconds: 900,
  degradedBatteryThreshold: 20,
  degradedAccuracyMetersThreshold: 50
};

export type ItisDeviceProtocolType = 
  | 'GT012' 
  | 'CONCOX' 
  | 'TOPIN' 
  | 'SIMULATED_JSON' 
  | 'SIMULATED'
  | 'CUSTOM_BINARY' 
  | 'LORAWAN' 
  | 'BLE_BEACON';

export type ItisDeviceConnectionStatus = 
  | 'ONLINE' 
  | 'OFFLINE' 
  | 'STANDBY' 
  | 'STALE'
  | 'DISCONNECTED';

export type ItisDeviceBatteryHealth = 
  | 'NORMAL' 
  | 'LOW' 
  | 'CRITICAL' 
  | 'CHARGING';

export type UnassignReason = 
  | 'LEARNER_LEFT_SCHOOL' 
  | 'DEVICE_REPLACEMENT' 
  | 'MAINTENANCE_REQUIRED' 
  | 'DEVICE_RETIRED' 
  | 'LOST_DEVICE' 
  | 'UPGRADE' 
  | 'ADMIN_REASSIGNMENT';

export interface ItisDeviceRecord {
  itisDeviceId: string;
  trackerDeviceId: string; // Supported hardware identifier (Serial, MAC, or protocol ID)
  hardwareSerialNumber?: string;
  serialNumber?: string;
  imei?: string; // Authoritative IMEI where supported by hardware/protocol
  simIdentifier?: string; // Authoritative ICCID where appropriate
  iccid?: string;
  phoneNumber?: string; // SIM phone number
  protocolType: ItisDeviceProtocolType;
  manufacturer?: string;
  deviceModel: string;
  deviceStatus: ItisDeviceState;
  activationStatus: ItisDeviceActivationStatus;
  calculatedHealthState?: ItisDeviceCalculatedHealthState;
  assignedLearnerId?: string | null;
  assignedLearnerName?: string;
  assignedLearnerEmis?: string;
  assignedSchoolId?: string | null;
  assignedSchoolName?: string;
  assignedTechnicianId?: string;
  lastKnownLocation?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    addressDescription?: string;
    timestamp?: string;
    speed?: number;
    heading?: number;
    altitude?: number;
  };
  lastTelemetryTimestamp?: string;
  lastCommunicationTimestamp?: string;
  lastHeartbeatTimestamp?: string;
  lastPacketSequence?: number;
  networkStatus?: 'CONNECTED' | 'ROAMING' | 'SEARCHING' | 'DISCONNECTED' | 'STANDBY';
  signalStatus?: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'NO_SIGNAL';
  signalDbm?: number;
  batteryStatus: {
    percentage: number;
    voltage?: number;
    healthStatus: ItisDeviceBatteryHealth;
    chargingState?: boolean;
  };
  connectionStatus: ItisDeviceConnectionStatus;
  healthClassification?: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'UNPROVISIONED';
  firmwareVersion: string;
  hardwareRevision?: string;
  hardwareVersion?: string;
  procurementDate?: string;
  procurementBatch?: string;
  supplier?: string;
  replacementForDeviceId?: string;
  replacedByDeviceId?: string;
  registeredAt: string;
  activatedAt?: string;
  updatedAt: string;
  provisionedAt?: string;
  provisionedByUserId?: string;
  provisionedByUserName?: string;
}

export interface ProcureDevicePayload {
  trackerDeviceId: string;
  serialNumber?: string;
  hardwareSerialNumber?: string;
  imei?: string;
  protocolType?: ItisDeviceProtocolType | string;
  protocol?: string;
  deviceModel?: string;
  model?: string;
  manufacturer?: string;
  simIdentifier?: string;
  iccid?: string;
  phoneNumber?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  hardwareVersion?: string;
  supplier?: string;
  procurementBatch?: string;
  procurementDate?: string;
  initialBatteryPercentage?: number;
  assignedSchoolId?: string;
  initialStatus?: 'INVENTORY' | 'REGISTERED';
}

export interface ReplaceDevicePayload {
  oldDeviceId: string;
  newDeviceId: string;
  learnerId: string;
  reason?: string;
  notes?: string;
}

export interface DeviceHealthSummary {
  deviceId: string;
  trackerDeviceId: string;
  deviceStatus: ItisDeviceState;
  healthState: ItisDeviceCalculatedHealthState;
  calculatedHealthState: ItisDeviceCalculatedHealthState;
  connectionStatus: ItisDeviceConnectionStatus;
  lastConnectionStatus?: ItisDeviceConnectionStatus;
  lastTelemetryTimestamp?: string;
  lastHeartbeatTimestamp?: string;
  lastPacketSequence?: number;
  batteryPercentage: number;
  batteryLevel?: number;
  batteryHealth: ItisDeviceBatteryHealth;
  batteryVoltage?: number;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp?: string;
  };
  lastGpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    timestamp?: string;
  };
  networkStatus?: string;
  reasons: string[];
  evaluatedAt: string;
}

export interface DeviceLifecycleTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    auditEventLogged?: boolean;
    evidence: Record<string, any>;
  }[];
}

export interface RegisterDevicePayload {
  trackerDeviceId?: string;
  serialNumber?: string;
  hardwareSerialNumber?: string;
  imei?: string;
  protocolType?: ItisDeviceProtocolType | string;
  protocol?: string;
  deviceModel?: string;
  model?: string;
  manufacturer?: string;
  simIdentifier?: string;
  iccid?: string;
  phoneNumber?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  initialBatteryPercentage?: number;
  assignedSchoolId?: string;
}

export interface DeviceAssignmentHistoryRecord {
  id: string;
  deviceId: string;
  trackerDeviceId: string;
  learnerId: string;
  learnerEmisId: string;
  learnerName: string;
  schoolId?: string;
  schoolName?: string;
  assignedAt: string;
  assignedByUserId: string;
  assignedByUserName: string;
  assignedByUserRole: string;
  unassignedAt?: string | null;
  unassignedByUserId?: string;
  unassignedByUserName?: string;
  unassignReason?: UnassignReason | string;
  notes?: string;
  status: 'ACTIVE' | 'TERMINATED' | 'TRANSFERRED';
}

export interface GuardianAuthorizedDeviceView {
  deviceId: string;
  trackerDeviceId: string;
  learnerId: string;
  learnerName: string;
  learnerEmis: string;
  deviceStatus: ItisDeviceState;
  connectionStatus: ItisDeviceConnectionStatus;
  batteryPercentage: number;
  batteryHealth: ItisDeviceBatteryHealth;
  approvedLocation?: {
    latitude: number;
    longitude: number;
    addressDescription?: string;
    lastReportedAt?: string;
    isVerified: boolean;
  };
  lastTelemetryAt?: string;
  activeAlertCount: number;
  isEmergencyAlertActive: boolean;
}

export interface ProvisionDevicePayload {
  trackerDeviceId: string;
  protocolType: ItisDeviceProtocolType;
  deviceModel: string;
  imei?: string;
  simIdentifier?: string;
  firmwareVersion?: string;
  hardwareRevision?: string;
  initialBatteryPercentage?: number;
}

export interface AssignDeviceToLearnerPayload {
  deviceId: string;
  learnerId: string;
  notes?: string;
  forceReassignIfOccupied?: boolean;
}

export interface ReassignDevicePayload {
  oldDeviceId?: string;
  newDeviceId: string;
  learnerId: string;
  unassignReason: UnassignReason | string;
  notes?: string;
}

export interface DeviceRegistryValidationResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    auditEventLogged?: boolean;
    evidence: Record<string, any>;
  }[];
}

// ==============================================================================
// PROMPT 8: GPS TELEMETRY SIMULATOR & PROTOCOL PACKET TESTING
// ==============================================================================

export type TelemetrySimulationDiagnosticCode =
  | 'PACKET_RECEIVED'
  | 'PACKET_VALID'
  | 'DEVICE_IDENTIFIED'
  | 'DEVICE_AUTHORIZED'
  | 'TELEMETRY_NORMALIZED'
  | 'SIMULATION_SUCCESS'
  | 'PACKET_REJECTED'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_NOT_REGISTERED'
  | 'DEVICE_SUSPENDED'
  | 'DEVICE_RETIRED'
  | 'INVALID_COORDINATES'
  | 'MALFORMED_PACKET'
  | 'CRC_INVALID'
  | 'UNSUPPORTED_PACKET'
  | 'DUPLICATE_PACKET'
  | 'ACCESS_DENIED'
  | 'TELEMETRY_PROCESSING_ERROR';

export interface TelemetrySimulationRequest {
  rawPacket: string; // Hex string (e.g. "7878...0D0A") or JSON string
  protocolFormat?: 'GT012' | 'SIMULATED_TEST_PROTOCOL' | 'AUTO';
  targetDeviceId?: string; // Optional override or context tracker ID
  notes?: string;
}

export interface TelemetrySimulationResult {
  status: 'SIMULATION_SUCCESS' | 'PACKET_REJECTED' | 'ACCESS_DENIED';
  diagnosticCode: TelemetrySimulationDiagnosticCode;
  protocolName: string;
  packetType: 'LOGIN' | 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'STATUS' | 'UNKNOWN';
  deviceIdentifier?: string;
  itisDeviceId?: string;
  deviceRegistryStatus?: ItisDeviceState | 'NOT_FOUND' | 'INVALID';
  isDuplicate?: boolean;
  duplicateFingerprint?: string;
  validationResult: {
    validFraming: boolean;
    validCrc: boolean;
    validCoordinates: boolean;
    validBattery: boolean;
    validSpeed: boolean;
    validHeading: boolean;
    validTimestamp: boolean;
    reason?: string;
  };
  extractedLocation?: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    altitude?: number;
    isRealTime?: boolean;
    satellites?: number;
  };
  extractedBattery?: {
    percentage: number;
    voltageLevel?: number;
    charging?: boolean;
  };
  extractedEvent?: {
    eventType: string;
    sosActive: boolean;
    alarmType?: string | null;
  };
  processingTimestamp: string;
  requiresAck?: boolean;
  ackHex?: string;
  error?: string;
}

export interface TelemetrySimulatorTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    evidence?: Record<string, any>;
  }[];
}

// ==============================================================================
// PROMPT 9: REAL GPS TELEMETRY INGESTION GATEWAY & TRANSPORT ARCHITECTURE
// ==============================================================================

export type TelemetryTransportType = 'SIMULATOR' | 'TCP' | 'UDP' | 'HTTP';

export interface TelemetryEnvelope {
  transportType: TelemetryTransportType;
  rawPacket: string; // Hex string for binary packets or stringified payload
  receivedAt: string;
  remoteAddress?: string;
  deviceIdentifier?: string; // Optional target device ID from transport metadata
  protocol?: string; // 'GT012' | 'SIMULATED_TEST_PROTOCOL' | 'AUTO'
  packetMetadata?: Record<string, any>;
}

export interface TelemetryIngestionResult {
  accepted: boolean;
  status: 'INGESTED' | 'REJECTED' | 'QUARANTINED' | 'ACCESS_DENIED';
  diagnosticCode: TelemetrySimulationDiagnosticCode;
  deviceId?: string;
  itisDeviceId?: string;
  deviceRegistryStatus?: ItisDeviceState | 'NOT_FOUND' | 'INVALID';
  protocol: string;
  packetType: 'LOGIN' | 'HEARTBEAT' | 'LOCATION' | 'ALARM' | 'STATUS' | 'UNKNOWN';
  telemetry?: {
    latitude?: number;
    longitude?: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
    altitude?: number;
    satellites?: number;
    isRealTime?: boolean;
    batteryPercentage?: number;
    voltageLevel?: number;
    sosActive?: boolean;
    alarmType?: string | null;
  };
  ackRequired: boolean;
  ackPayload?: string; // Downlink ACK hex representation (e.g. 10-byte Concox ACK)
  duplicate: boolean;
  duplicateFingerprint?: string;
  quarantined: boolean;
  validationResult: {
    validFraming: boolean;
    validCrc: boolean;
    validCoordinates: boolean;
    validBattery: boolean;
    validSpeed: boolean;
    validHeading: boolean;
    validTimestamp: boolean;
    reason?: string;
  };
  errorCode?: string;
  error?: string;
  receivedAt: string;
  processedAt: string;
  transportType: TelemetryTransportType;
  remoteAddress?: string;
  persistedRecordId?: string;
  latestLocationUpdated?: boolean;
}

export interface AuthoritativeTelemetryRecord {
  id: string; // Authoritative Telemetry ID (e.g. TEL-...)
  deviceId: string; // Authoritative ITIS Device ID (e.g. DEV-ZA-GT012-...)
  trackerDeviceId: string; // Physical Hardware Tracking Identifier (Serial / IMEI / Terminal ID)
  learnerId?: string | null; // Assigned Learner ID if mapped
  schoolId?: string | null; // School ID if learner is enrolled
  timestamp: string; // Timestamp recorded on GPS hardware
  latitude: number;
  longitude: number;
  accuracyMeters?: number;
  speedKmh?: number;
  heading?: number;
  altitudeMeters?: number;
  batteryLevel?: number;
  batteryVoltage?: number;
  protocol: string; // GT012, SIMULATED, etc.
  packetType: 'LOCATION' | 'ALARM' | 'HEARTBEAT' | 'LOGIN' | 'STATUS' | 'UNKNOWN';
  packetSerialNumber?: number;
  ingestedAt: string; // Pipeline ingestion timestamp
  transportSource: TelemetryTransportType;
  validationStatus: 'VALIDATED' | 'VALID';
  rawPacketFingerprint?: string; // SHA-256 diagnostic fingerprint for deduplication / verification
  isSos?: boolean;
  alarmType?: string | null;
  satellites?: number;
}

export interface AuthoritativeLatestLocationRecord {
  deviceId: string;
  trackerDeviceId: string;
  learnerId: string | null;
  schoolId: string | null;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh: number;
  heading: number;
  altitudeMeters?: number;
  batteryLevel: number;
  batteryVoltage?: number;
  timestamp: string;
  ingestedAt: string;
  protocol: string;
  packetType: string;
  connectionStatus: ItisDeviceConnectionStatus;
  healthState: ItisDeviceCalculatedHealthState;
  isSos: boolean;
  alarmType?: string | null;
  satellites?: number;
}

export interface TelemetryHistoryQueryOptions {
  deviceId?: string;
  trackerDeviceId?: string;
  learnerId?: string;
  schoolId?: string;
  startTime?: string;
  endTime?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  offset?: number;
  order?: 'ASC' | 'DESC';
}

export interface TelemetryPersistenceTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    evidence?: Record<string, any>;
  }[];
}

export interface TelemetryGatewayStatus {
  gatewayStatus: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
  enabledTransports: TelemetryTransportType[];
  telemetryServerEnabled: boolean;
  simulatorEnabled: boolean;
  tcpReady: boolean;
  udpReady: boolean;
  tcpStatus: 'ACTIVE' | 'READY_DISABLED' | 'ERROR';
  udpStatus: 'ACTIVE' | 'READY_DISABLED' | 'ERROR';
  processingPipelineStatus: 'HEALTHY' | 'DEGRADED' | 'ERROR';
  activeProtocols: string[];
  metrics: {
    totalIngested: number;
    totalAccepted: number;
    totalRejected: number;
    totalDuplicates: number;
    totalQuarantined: number;
    lastIngestionTimestamp: string | null;
  };
  serverEnvironment: {
    nodeEnv: string;
    isContainerized: boolean;
    configuredTcpPort: number;
    configuredUdpPort: number;
    networkNotice: string;
  };
}

export interface TelemetryGatewayTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    evidence?: Record<string, any>;
  }[];
}

// ----------------------------------------------------
// LIVE GPS LOCATION SERVICE & MAP DATA API
// ----------------------------------------------------

export interface MapLocationPoint {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: string;
  speedKmh?: number;
  heading?: number;
  altitudeMeters?: number;
}

export interface MapDeviceLatestLocation {
  deviceId: string;
  trackerDeviceId: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedKmh: number;
  heading: number;
  batteryLevel: number;
  batteryVoltage?: number;
  timestamp: string;
  isSos: boolean;
  alarmType?: string;
  satellites?: number;
  status: 'ONLINE' | 'STANDBY' | 'OFFLINE' | 'SUSPENDED';
  isStale: boolean;
  staleMinutes: number;
  geoJson: {
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number]; // [lng, lat]
    };
    properties: Record<string, any>;
  };
}

export interface MapLearnerCurrentLocation {
  learnerId: string;
  officialIdentifierMasked: string;
  firstName: string;
  lastNameInitial: string;
  schoolId: string;
  schoolName: string;
  deviceId?: string;
  trackerDeviceId?: string;
  location: MapLocationPoint | null;
  batteryLevel?: number;
  isSos: boolean;
  geofenceStatus: 'INSIDE_SAFE_ZONE' | 'OUTSIDE_SAFE_ZONE' | 'UNKNOWN';
  distanceToSchoolMeters?: number;
  lastSeenAt?: string;
  isLive: boolean;
  accessAuthorized: boolean;
  geoJson?: {
    type: 'Feature';
    geometry: {
      type: 'Point';
      coordinates: [number, number];
    };
    properties: Record<string, any>;
  };
}

export interface MapLocationHistoryResponse {
  subjectType: 'LEARNER' | 'DEVICE';
  subjectId: string;
  dateRange: {
    startTime: string;
    endTime: string;
  };
  totalPoints: number;
  points: Array<MapLocationPoint & {
    id: string;
    isSos: boolean;
    batteryLevel?: number;
  }>;
  pathGeoJson: {
    type: 'Feature';
    geometry: {
      type: 'LineString';
      coordinates: [number, number][]; // [lng, lat]
    };
    properties: {
      pointCount: number;
      startTime: string;
      endTime: string;
      maxSpeedKmh: number;
    };
  };
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface IncidentTacticalLocationContext {
  incidentId: string;
  status: string;
  severity: string;
  incidentLocation: {
    lat: number;
    lng: number;
    address?: string;
    timestamp: string;
  };
  learner: {
    id: string;
    firstName: string;
    lastNameInitial: string;
    schoolId: string;
    currentLocation: MapLocationPoint | null;
    distanceToIncidentMeters?: number;
  } | null;
  tacticalVectors: {
    distanceMeters: number;
    bearingDegrees: number;
    estimatedInterceptEtaMinutes: number;
    targetSpeedKmh: number;
    targetHeadingDegrees: number;
  } | null;
  assignedResponder: {
    id: string;
    name: string;
    callsign: string;
    unitType: string;
    vehicleId?: string;
    currentLocation: {
      lat: number;
      lng: number;
      lastUpdated: string;
    } | null;
    distanceToIncidentMeters?: number;
    etaMinutes?: number;
  } | null;
  nearbyResponders: Array<{
    id: string;
    callsign: string;
    unitType: string;
    lat: number;
    lng: number;
    distanceMeters: number;
    status: string;
  }>;
  geofences: {
    schoolGeofence: {
      schoolId: string;
      name: string;
      centerLat: number;
      centerLng: number;
      radiusMeters: number;
      learnerInside: boolean;
    } | null;
  };
  deviceTelemetry: {
    deviceId: string;
    batteryLevel: number;
    signalRssi?: number;
    lastPing: string;
    isOnline: boolean;
  } | null;
}

export interface DeviceHealthStatus {
  deviceId: string;
  trackerDeviceId: string;
  serialNumber: string;
  status: 'ACTIVE' | 'ASSIGNED' | 'STANDBY' | 'SUSPENDED' | 'MAINTENANCE' | 'OFFLINE';
  batteryPercentage: number;
  voltage: number;
  batteryStatus: 'NORMAL' | 'LOW' | 'CRITICAL';
  satellites: number;
  gpsFixStatus: 'STRONG_3D' | 'WEAK_2D' | 'NO_FIX';
  signalStrengthDbm: number;
  signalQuality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
  lastPingAt: string;
  isOnline: boolean;
  packetRatePerMinute: number;
  assignedLearnerId: string | null;
  firmwareVersion: string;
  hardwareModel: string;
}

export interface MapPollUpdateResponse {
  serverTimestamp: string;
  cursor: string;
  deviceUpdates: MapDeviceLatestLocation[];
  responderUpdates: Array<{
    id: string;
    callsign: string;
    lat: number;
    lng: number;
    updatedAt: string;
    status: string;
  }>;
  hasMore: boolean;
}

export interface LiveLocationTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    evidence?: Record<string, any>;
  }[];
}

// ----------------------------------------------------
// GPS TELEMETRY INCIDENT DETECTION & SAFETY AUTOMATION
// ----------------------------------------------------
export type SafetyAutomationEventType = 
  | 'DEVICE_OFFLINE'
  | 'PROLONGED_SILENCE'
  | 'UNEXPECTED_ROUTE_DEVIATION'
  | 'GEOFENCE_EXIT'
  | 'GEOFENCE_ENTRY'
  | 'UNUSUAL_STATIONARY'
  | 'TRACKER_TAMPER'
  | 'LOW_BATTERY'
  | 'EMERGENCY_SOS';

export type SafetyRuleSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_SOS';

export interface SafetyRuleThresholds {
  offlineSilenceSeconds?: number;
  prolongedSilenceSeconds?: number;
  routeDeviationMeters?: number;
  geofenceBufferMeters?: number;
  stationaryMinutes?: number;
  lowBatteryPercentage?: number;
  tamperFlagsSupported?: boolean;
  requireSosConfirmation?: boolean;
  [key: string]: any;
}

export interface SafetyRuleConfig {
  ruleId: string;
  eventType: SafetyAutomationEventType;
  name: string;
  description: string;
  enabled: boolean;
  severity: SafetyRuleSeverity;
  cooldownSeconds: number;
  thresholds: SafetyRuleThresholds;
  autoEscalateToIncident: boolean;
  autoEscalateSeverity?: SafetyRuleSeverity;
  suppressionWindowSeconds?: number;
  applicableSchoolIds?: string[];
}

export interface SafetyAlertRecord {
  id: string;
  ruleId: string;
  eventType: SafetyAutomationEventType;
  title: string;
  description: string;
  severity: SafetyRuleSeverity;
  status: 'PENDING_REVIEW' | 'CORRELATED_TO_INCIDENT' | 'ESCALATED' | 'DISMISSED' | 'RESOLVED';
  deviceId: string;
  trackerDeviceId: string;
  learnerId?: string | null;
  learnerName?: string;
  schoolId?: string | null;
  schoolName?: string;
  guardianName?: string;
  guardianMobile?: string;
  location?: {
    lat: number;
    lng: number;
    accuracyMeters?: number;
    addressDescription?: string;
    speedKmh?: number;
  };
  telemetrySnapshot: {
    timestamp: string;
    batteryLevel?: number;
    speedKmh?: number;
    heading?: number;
    satellites?: number;
    isSos?: boolean;
    alarmType?: string | null;
    tamperAlert?: boolean;
    rawPacketFingerprint?: string;
  };
  correlatedIncidentId?: string | null;
  escalatedIncidentId?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
  dismissReason?: string | null;
  suppressedDuplicatesCount: number;
  lastTriggeredAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface SafetyAutomationEngineConfig {
  globalEnabled: boolean;
  rules: SafetyRuleConfig[];
  suppressionPolicy: {
    defaultCooldownSeconds: number;
    maxSuppressionWindowSeconds: number;
  };
  incidentCorrelationWindowMinutes: number;
  dispatchPolicy: {
    autoDispatchRealServices: false;
    humanAuthorizationRequired: true;
  };
}

export interface SafetyAutomationEvaluationResult {
  evaluated: boolean;
  alertsTriggered: SafetyAlertRecord[];
  alertsSuppressed: Array<{
    ruleId: string;
    eventType: SafetyAutomationEventType;
    deviceId: string;
    reason: string;
  }>;
  correlatedIncidents: Array<{
    alertId: string;
    incidentId: string;
    learnerId: string;
    notesAppended: string;
  }>;
  escalatedIncidents: Array<{
    alertId: string;
    incidentId: string;
    severity: IncidentSeverity;
  }>;
}

export interface SafetyAutomationTestSuiteResult {
  suiteId: string;
  timestamp: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  allPassed: boolean;
  results: {
    id: string;
    name: string;
    requirement: string;
    expected: string;
    actual: string;
    status: 'PASS' | 'FAIL';
    evidence?: Record<string, any>;
  }[];
}






