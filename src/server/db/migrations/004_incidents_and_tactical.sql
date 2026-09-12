-- Migration 004: Emergency Response, Responders, Incidents, and Tactical Dispatches
-- Safe, repeatable, non-destructive

CREATE TABLE IF NOT EXISTS responders (
  id VARCHAR(64) PRIMARY KEY,
  callsign VARCHAR(128) NOT NULL UNIQUE,
  unit_type VARCHAR(64) NOT NULL,
  organization_name VARCHAR(128) NOT NULL,
  vehicle_id VARCHAR(64),
  primary_officer_name VARCHAR(128) NOT NULL,
  contact_phone VARCHAR(32) NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  last_location_update TIMESTAMPTZ,
  assigned_district VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS incidents (
  id VARCHAR(64) PRIMARY KEY,
  learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  school_id VARCHAR(64) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  device_id VARCHAR(64) REFERENCES devices(id) ON DELETE SET NULL,
  severity VARCHAR(32) NOT NULL DEFAULT 'CRITICAL',
  status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  trigger_type VARCHAR(64) NOT NULL DEFAULT 'HARDWARE_SOS',
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_description TEXT,
  audio_stream_url TEXT,
  notes TEXT[] NOT NULL DEFAULT '{}',
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id VARCHAR(64) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS incident_events (
  id VARCHAR(64) PRIMARY KEY,
  incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  event_type VARCHAR(64) NOT NULL,
  actor_user_id VARCHAR(64) REFERENCES users(id),
  actor_name VARCHAR(128) NOT NULL,
  actor_role VARCHAR(64) NOT NULL,
  notes TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS dispatches (
  id VARCHAR(64) PRIMARY KEY,
  incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  authorized_by_user_id VARCHAR(64) NOT NULL REFERENCES users(id),
  priority VARCHAR(32) NOT NULL DEFAULT 'P1_IMMEDIATE',
  instructions TEXT,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS responder_assignments (
  id VARCHAR(64) PRIMARY KEY,
  dispatch_id VARCHAR(64) NOT NULL REFERENCES dispatches(id) ON DELETE CASCADE,
  incident_id VARCHAR(64) NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  responder_id VARCHAR(64) NOT NULL REFERENCES responders(id) ON DELETE RESTRICT,
  operational_state VARCHAR(32) NOT NULL DEFAULT 'PENDING_ACCEPTANCE',
  eta_minutes INT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  accepted_at TIMESTAMPTZ,
  arrived_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  decline_reason TEXT,
  outcome_summary TEXT
);
