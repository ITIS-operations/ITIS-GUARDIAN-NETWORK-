-- Migration 002: Learners, Enrolments, Guardians, and Legal Custody Relationships
-- Safe, repeatable, non-destructive

CREATE TABLE IF NOT EXISTS learners (
  id VARCHAR(64) PRIMARY KEY,
  person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
  emis_id VARCHAR(64) NOT NULL UNIQUE,
  admission_number VARCHAR(64) NOT NULL,
  blood_group VARCHAR(16),
  medical_allergies TEXT[] NOT NULL DEFAULT '{}',
  chronic_conditions TEXT[] NOT NULL DEFAULT '{}',
  special_needs TEXT,
  tracking_consent_status VARCHAR(32) NOT NULL DEFAULT 'CONSENTED',
  tracking_consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS school_enrolments (
  id VARCHAR(64) PRIMARY KEY,
  learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id VARCHAR(64) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_year INT NOT NULL,
  grade VARCHAR(32) NOT NULL,
  class_section VARCHAR(32),
  enrolment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  exited_at TIMESTAMPTZ,
  attendance_status VARCHAR(32) NOT NULL DEFAULT 'PRESENT',
  last_roll_call_at TIMESTAMPTZ,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS academic_records (
  id VARCHAR(64) PRIMARY KEY,
  learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  school_id VARCHAR(64) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  academic_year INT NOT NULL,
  grade VARCHAR(32) NOT NULL,
  term INT NOT NULL,
  attendance_rate REAL,
  conduct_rating VARCHAR(32),
  academic_standing VARCHAR(64),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guardians (
  id VARCHAR(64) PRIMARY KEY,
  person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
  user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  id_verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  id_verified BOOLEAN NOT NULL DEFAULT TRUE,
  emergency_contact_priority INT NOT NULL DEFAULT 1,
  verified_at TIMESTAMPTZ,
  preferred_language VARCHAR(32) NOT NULL DEFAULT 'en',
  push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guardian_learner_relationships (
  id VARCHAR(64) PRIMARY KEY,
  guardian_id VARCHAR(64) NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
  learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  relationship_type VARCHAR(64) NOT NULL,
  is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
  has_custody_rights BOOLEAN NOT NULL DEFAULT TRUE,
  access_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
  verified_by_user_id VARCHAR(64) REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_guardian_learner UNIQUE (guardian_id, learner_id)
);
