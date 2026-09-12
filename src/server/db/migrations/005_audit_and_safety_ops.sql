-- Migration 005: Cryptographic Audit Events, Notifications, Safety Ops, and Performance Indexes
-- Safe, repeatable, non-destructive

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(64) PRIMARY KEY,
  action_type VARCHAR(128) NOT NULL,
  actor_user_id VARCHAR(64) NOT NULL,
  actor_name VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  target_entity VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  user_agent TEXT,
  checksum VARCHAR(128) NOT NULL,
  previous_checksum VARCHAR(128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  recipient_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(32) NOT NULL DEFAULT 'PUSH',
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  notification_type VARCHAR(64) NOT NULL,
  incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS safety_events (
  id VARCHAR(64) PRIMARY KEY,
  learner_id VARCHAR(64) REFERENCES learners(id) ON DELETE SET NULL,
  school_id VARCHAR(64) REFERENCES schools(id) ON DELETE SET NULL,
  device_id VARCHAR(64) REFERENCES devices(id) ON DELETE SET NULL,
  event_type VARCHAR(64) NOT NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'INFO',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS operational_records (
  id VARCHAR(64) PRIMARY KEY,
  record_type VARCHAR(64) NOT NULL,
  source VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Operational Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_normalized_email ON users(normalized_email);
CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_schools_emis ON schools(emis_code);
CREATE INDEX IF NOT EXISTS idx_persons_official_id ON persons(official_id);
CREATE INDEX IF NOT EXISTS idx_persons_email ON persons(email);

CREATE INDEX IF NOT EXISTS idx_learners_person_id ON learners(person_id);
CREATE INDEX IF NOT EXISTS idx_learners_emis_id ON learners(emis_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_school ON school_enrolments(school_id, enrolment_status);
CREATE INDEX IF NOT EXISTS idx_enrolments_learner ON school_enrolments(learner_id);

CREATE INDEX IF NOT EXISTS idx_guardians_person ON guardians(person_id);
CREATE INDEX IF NOT EXISTS idx_glr_guardian ON guardian_learner_relationships(guardian_id);
CREATE INDEX IF NOT EXISTS idx_glr_learner ON guardian_learner_relationships(learner_id);

CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(device_status);

CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_learner ON incidents(learner_id);
CREATE INDEX IF NOT EXISTS idx_incidents_school ON incidents(school_id);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident ON incident_events(incident_id);

CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_events(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_learner_time ON telemetry(learner_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_school_time ON telemetry(school_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read);
