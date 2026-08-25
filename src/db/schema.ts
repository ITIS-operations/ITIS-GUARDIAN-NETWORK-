import { pgTable, varchar, text, boolean, timestamp, doublePrecision, integer, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Roles & Permissions
export const roles = pgTable('roles', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 128 }).notNull(),
  description: text('description'),
  isSystemRole: boolean('is_system_role').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable('permissions', {
  id: varchar('id', { length: 64 }).primaryKey(),
  category: varchar('category', { length: 64 }).notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable('role_permissions', {
  roleId: varchar('role_id', { length: 64 }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionId: varchar('permission_id', { length: 64 }).notNull().references(() => permissions.id, { onDelete: 'cascade' }),
});

// 2. Schools
export const schools = pgTable('schools', {
  id: varchar('id', { length: 64 }).primaryKey(),
  emisCode: varchar('emis_code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  province: varchar('province', { length: 64 }).notNull(),
  district: varchar('district', { length: 128 }).notNull(),
  principalName: varchar('principal_name', { length: 128 }).notNull(),
  contactPhone: varchar('contact_phone', { length: 32 }).notNull(),
  contactEmail: varchar('contact_email', { length: 128 }).notNull(),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  address: text('address'),
  safetyOfficerName: varchar('safety_officer_name', { length: 128 }),
  safetyOfficerPhone: varchar('safety_officer_phone', { length: 32 }),
  activeStatus: varchar('active_status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 3. Users
export const users = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(),
  identifier: varchar('identifier', { length: 128 }).notNull().unique(),
  email: varchar('email', { length: 128 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  name: varchar('name', { length: 128 }).notNull(),
  role: varchar('role', { length: 64 }).notNull().references(() => roles.id),
  accountStatus: varchar('account_status', { length: 32 }).notNull().default('ACTIVE'),
  schoolId: varchar('school_id', { length: 64 }).references(() => schools.id, { onDelete: 'set null' }),
  guardianId: varchar('guardian_id', { length: 64 }),
  responderUnit: varchar('responder_unit', { length: 64 }),
  phone: varchar('phone', { length: 32 }),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 4. Persons
export const persons = pgTable('persons', {
  id: varchar('id', { length: 64 }).primaryKey(),
  officialId: varchar('official_id', { length: 64 }).unique(),
  officialIdType: varchar('official_id_type', { length: 32 }).notNull().default('NATIONAL_ID'),
  firstName: varchar('first_name', { length: 128 }).notNull(),
  lastName: varchar('last_name', { length: 128 }).notNull(),
  dateOfBirth: varchar('date_of_birth', { length: 32 }).notNull(),
  gender: varchar('gender', { length: 32 }).notNull(),
  primaryContact: varchar('primary_contact', { length: 32 }),
  secondaryContact: varchar('secondary_contact', { length: 32 }),
  email: varchar('email', { length: 128 }),
  residentialAddress: text('residential_address'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 5. Learners
export const learners = pgTable('learners', {
  id: varchar('id', { length: 64 }).primaryKey(),
  personId: varchar('person_id', { length: 64 }).notNull().unique().references(() => persons.id),
  emisId: varchar('emis_id', { length: 64 }).notNull().unique(),
  admissionNumber: varchar('admission_number', { length: 64 }).notNull(),
  bloodGroup: varchar('blood_group', { length: 16 }),
  medicalAllergies: text('medical_allergies').array(),
  chronicConditions: text('chronic_conditions').array(),
  specialNeeds: text('special_needs'),
  trackingConsentStatus: varchar('tracking_consent_status', { length: 32 }).notNull().default('CONSENTED'),
  trackingConsentUpdatedAt: timestamp('tracking_consent_updated_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 6. School Enrolments
export const schoolEnrolments = pgTable('school_enrolments', {
  id: varchar('id', { length: 64 }).primaryKey(),
  learnerId: varchar('learner_id', { length: 64 }).notNull().references(() => learners.id, { onDelete: 'cascade' }),
  schoolId: varchar('school_id', { length: 64 }).notNull().references(() => schools.id),
  academicYear: integer('academic_year').notNull(),
  grade: varchar('grade', { length: 32 }).notNull(),
  classSection: varchar('class_section', { length: 32 }),
  enrolmentStatus: varchar('enrolment_status', { length: 32 }).notNull().default('ACTIVE'),
  enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
  exitedAt: timestamp('exited_at', { withTimezone: true }),
});

// 7. Guardians
export const guardians = pgTable('guardians', {
  id: varchar('id', { length: 64 }).primaryKey(),
  personId: varchar('person_id', { length: 64 }).notNull().unique().references(() => persons.id),
  userId: varchar('user_id', { length: 64 }).references(() => users.id, { onDelete: 'set null' }),
  idVerificationStatus: varchar('id_verification_status', { length: 32 }).notNull().default('VERIFIED'),
  idDocumentChecksum: varchar('id_document_checksum', { length: 128 }),
  emergencyContactPriority: integer('emergency_contact_priority').notNull().default(1),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 8. Guardian Learner Relationships
export const guardianLearnerRelationships = pgTable('guardian_learner_relationships', {
  id: varchar('id', { length: 64 }).primaryKey(),
  guardianId: varchar('guardian_id', { length: 64 }).notNull().references(() => guardians.id, { onDelete: 'cascade' }),
  learnerId: varchar('learner_id', { length: 64 }).notNull().references(() => learners.id, { onDelete: 'cascade' }),
  relationshipType: varchar('relationship_type', { length: 64 }).notNull(),
  isPrimaryContact: boolean('is_primary_contact').notNull().default(false),
  hasCustodyRights: boolean('has_custody_rights').notNull().default(true),
  accessStatus: varchar('access_status', { length: 32 }).notNull().default('ACTIVE'),
  verificationStatus: varchar('verification_status', { length: 32 }).notNull().default('VERIFIED'),
  verifiedByUserId: varchar('verified_by_user_id', { length: 64 }).references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// 9. Devices & Assets
export const devices = pgTable('devices', {
  id: varchar('id', { length: 64 }).primaryKey(),
  serialNumber: varchar('serial_number', { length: 128 }).notNull().unique(),
  imei: varchar('imei', { length: 64 }).unique(),
  macAddress: varchar('mac_address', { length: 64 }).unique(),
  deviceModel: varchar('device_model', { length: 128 }).notNull(),
  hardwareRevision: varchar('hardware_revision', { length: 64 }).notNull(),
  firmwareVersion: varchar('firmware_version', { length: 64 }).notNull(),
  deviceStatus: varchar('device_status', { length: 32 }).notNull().default('ACTIVE'),
  batteryLevel: integer('battery_level').notNull().default(100),
  tamperStatus: varchar('tamper_status', { length: 32 }).notNull().default('SECURE'),
  lastPingAt: timestamp('last_ping_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const learnerDevices = pgTable('learner_devices', {
  id: varchar('id', { length: 64 }).primaryKey(),
  deviceId: varchar('device_id', { length: 64 }).notNull().references(() => devices.id),
  learnerId: varchar('learner_id', { length: 64 }).notNull().references(() => learners.id),
  assignmentStatus: varchar('assignment_status', { length: 32 }).notNull().default('ACTIVE'),
  assignedByUserId: varchar('assigned_by_user_id', { length: 64 }).references(() => users.id),
  assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  unassignedAt: timestamp('unassigned_at', { withTimezone: true }),
  assignmentNotes: text('assignment_notes'),
});

// 10. Audit Events
export const auditEvents = pgTable('audit_events', {
  id: varchar('id', { length: 64 }).primaryKey(),
  actionType: varchar('action_type', { length: 128 }).notNull(),
  actorUserId: varchar('actor_user_id', { length: 64 }).notNull(),
  actorName: varchar('actor_name', { length: 128 }).notNull(),
  actorRole: varchar('actor_role', { length: 64 }).notNull(),
  targetEntity: varchar('target_entity', { length: 64 }).notNull(),
  targetId: varchar('target_id', { length: 64 }).notNull(),
  details: jsonb('details').notNull().default({}),
  ipAddress: varchar('ip_address', { length: 64 }),
  userAgent: text('user_agent'),
  checksum: varchar('checksum', { length: 128 }).notNull(),
  previousChecksum: varchar('previous_checksum', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ one }) => ({
  school: one(schools, {
    fields: [users.schoolId],
    references: [schools.id],
  }),
}));

export const learnersRelations = relations(learners, ({ one, many }) => ({
  person: one(persons, {
    fields: [learners.personId],
    references: [persons.id],
  }),
  enrolments: many(schoolEnrolments),
  guardianRelationships: many(guardianLearnerRelationships),
}));

export const guardiansRelations = relations(guardians, ({ one, many }) => ({
  person: one(persons, {
    fields: [guardians.personId],
    references: [persons.id],
  }),
  learnerRelationships: many(guardianLearnerRelationships),
}));
