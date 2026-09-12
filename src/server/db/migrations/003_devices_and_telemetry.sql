-- Migration 003: Devices, Asset Inventory, Assignments, and Telemetry Engine
-- Safe, repeatable, non-destructive

CREATE TABLE IF NOT EXISTS devices (
  id VARCHAR(64) PRIMARY KEY,
  serial_number VARCHAR(128) NOT NULL UNIQUE,
  imei VARCHAR(64) UNIQUE,
  mac_address VARCHAR(64) UNIQUE,
  device_model VARCHAR(128) NOT NULL,
  hardware_revision VARCHAR(64) NOT NULL,
  firmware_version VARCHAR(64) NOT NULL,
  device_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  battery_level INT NOT NULL DEFAULT 100,
  tamper_status VARCHAR(32) NOT NULL DEFAULT 'SECURE',
  last_ping_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learner_devices (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
  learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
  assignment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
  assigned_by_user_id VARCHAR(64) REFERENCES users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMPTZ,
  assignment_notes TEXT
);

CREATE TABLE IF NOT EXISTS device_maintenance_logs (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  technician_user_id VARCHAR(64) REFERENCES users(id),
  action_type VARCHAR(64) NOT NULL,
  notes TEXT,
  previous_status VARCHAR(32),
  new_status VARCHAR(32),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS telemetry (
  id VARCHAR(64) PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  tracker_device_id VARCHAR(64),
  learner_id VARCHAR(64),
  school_id VARCHAR(64),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy_meters REAL,
  speed_kmh REAL,
  heading REAL,
  altitude_meters REAL,
  battery_level REAL,
  battery_voltage REAL,
  protocol VARCHAR(32) NOT NULL DEFAULT 'GT012',
  packet_type VARCHAR(32) NOT NULL DEFAULT 'LOCATION',
  packet_serial_number INT,
  transport_source VARCHAR(32) NOT NULL DEFAULT 'TCP',
  validation_status VARCHAR(32) NOT NULL DEFAULT 'VALIDATED',
  raw_packet_fingerprint VARCHAR(128),
  is_sos BOOLEAN NOT NULL DEFAULT FALSE,
  alarm_type VARCHAR(64),
  satellites INT,
  recorded_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
