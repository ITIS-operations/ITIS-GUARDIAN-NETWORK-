-- ==============================================================================
-- ITIS GUARDIAN NETWORK — ENTERPRISE POSTGRESQL PRODUCTION DDL
-- Target Scale: 3,000,000+ Enrolled Learners, 5,000,000+ Guardians, 25,000+ Schools
-- Design Principle: Capture-Once Normalized Core, Immutable Event Streams, Strict Foreign Keys
-- ==============================================================================

-- Enable UUID & Cryptographic Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clean Namespace Schema (Optional, defaults to public)
-- CREATE SCHEMA IF NOT EXISTS itis_core;
-- SET search_path TO itis_core, public;

-- ------------------------------------------------------------------------------
-- 1. ACCESS CONTROL & USER MANAGEMENT (RBAC / ABAC)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(64) PRIMARY KEY,
    category VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(64) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS schools (
    id VARCHAR(64) PRIMARY KEY,
    emis_code VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    province VARCHAR(64) NOT NULL,
    district VARCHAR(128) NOT NULL,
    principal_name VARCHAR(128) NOT NULL,
    contact_phone VARCHAR(32) NOT NULL,
    contact_email VARCHAR(128) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    address TEXT,
    safety_officer_name VARCHAR(128),
    safety_officer_phone VARCHAR(32),
    active_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    identifier VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(128) NOT NULL,
    role VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    school_id VARCHAR(64) REFERENCES schools(id) ON DELETE SET NULL,
    guardian_id VARCHAR(64),
    responder_unit VARCHAR(64),
    phone VARCHAR(32),
    mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 2. CAPTURE-ONCE HUMAN IDENTITIES & MASTER REGISTRIES
-- ------------------------------------------------------------------------------

-- Master Person Table (Eliminates duplication across Guardian, Learner, Staff)
CREATE TABLE IF NOT EXISTS persons (
    id VARCHAR(64) PRIMARY KEY,
    official_id VARCHAR(64) UNIQUE, -- South African ID / Passport Number
    official_id_type VARCHAR(32) NOT NULL DEFAULT 'NATIONAL_ID', -- NATIONAL_ID, PASSPORT, BIRTH_CERTIFICATE
    first_name VARCHAR(128) NOT NULL,
    last_name VARCHAR(128) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(32) NOT NULL,
    primary_contact VARCHAR(32),
    secondary_contact VARCHAR(32),
    email VARCHAR(128),
    residential_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learners (
    id VARCHAR(64) PRIMARY KEY,
    person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
    emis_id VARCHAR(64) NOT NULL UNIQUE, -- Government / Provincial EMIS Unique Learner Code
    admission_number VARCHAR(64) NOT NULL,
    blood_group VARCHAR(16),
    medical_allergies TEXT[],
    chronic_conditions TEXT[],
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
    enrolment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, TRANSFERRED, GRADUATED, SUSPENDED
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    exited_at TIMESTAMPTZ,
    CONSTRAINT uq_learner_academic_year UNIQUE (learner_id, academic_year, enrolment_status)
);

CREATE TABLE IF NOT EXISTS guardians (
    id VARCHAR(64) PRIMARY KEY,
    person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    id_verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED', -- PENDING, VERIFIED, REJECTED
    id_document_checksum VARCHAR(128),
    emergency_contact_priority INT NOT NULL DEFAULT 1,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- M:N Guardian <-> Learner Relationship Matrix
CREATE TABLE IF NOT EXISTS guardian_learner_relationships (
    id VARCHAR(64) PRIMARY KEY,
    guardian_id VARCHAR(64) NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
    relationship_type VARCHAR(64) NOT NULL, -- MOTHER, FATHER, LEGAL_GUARDIAN, FOSTER_PARENT, SIBLING
    is_primary_contact BOOLEAN NOT NULL DEFAULT FALSE,
    has_custody_rights BOOLEAN NOT NULL DEFAULT TRUE,
    access_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, REVOKED, DISPUTED
    verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
    verified_by_user_id VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_guardian_learner UNIQUE (guardian_id, learner_id)
);

-- ------------------------------------------------------------------------------
-- 3. HARDWARE DEVICES & ASSET INVENTORY
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(64) PRIMARY KEY,
    serial_number VARCHAR(128) NOT NULL UNIQUE,
    imei VARCHAR(64) UNIQUE,
    mac_address VARCHAR(64) UNIQUE,
    device_model VARCHAR(128) NOT NULL,
    hardware_revision VARCHAR(64) NOT NULL,
    firmware_version VARCHAR(64) NOT NULL,
    device_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, UNASSIGNED, MAINTENANCE, DECOMMISSIONED
    battery_level INT NOT NULL DEFAULT 100,
    tamper_status VARCHAR(32) NOT NULL DEFAULT 'SECURE', -- SECURE, TAMPER_DETECTED
    last_ping_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS learner_devices (
    id VARCHAR(64) PRIMARY KEY,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE RESTRICT,
    learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE RESTRICT,
    assignment_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, RETURNED, REPLACED
    assigned_by_user_id VARCHAR(64) REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    unassigned_at TIMESTAMPTZ,
    assignment_notes TEXT
);

-- ------------------------------------------------------------------------------
-- 4. EMERGENCY DISPATCH, INCIDENTS & TACTICAL RESPONSE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS responders (
    id VARCHAR(64) PRIMARY KEY,
    callsign VARCHAR(128) NOT NULL UNIQUE,
    unit_type VARCHAR(64) NOT NULL, -- SAPS, METRO_POLICE, PRIVATE_SECURITY, MEDICAL_EMS, CPF
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
    severity VARCHAR(32) NOT NULL DEFAULT 'CRITICAL', -- CRITICAL, HIGH, MEDIUM, LOW
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, DISPATCHED, RESOLVED, FALSE_ALARM
    trigger_type VARCHAR(64) NOT NULL DEFAULT 'HARDWARE_SOS', -- HARDWARE_SOS, MOBILE_PANIC, GEOFENCE_BREACH, BIOMETRIC_ANOMALY, AI_SENTINEL
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
    event_type VARCHAR(64) NOT NULL, -- TRIGGERED, ACKNOWLEDGED, DISPATCHED, ARRIVED, ESCALATED, RESOLVED
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
    operational_state VARCHAR(32) NOT NULL DEFAULT 'PENDING_ACCEPTANCE', -- PENDING_ACCEPTANCE, ACCEPTED, EN_ROUTE, ARRIVED, SCENE_SECURED, DECLINED
    eta_minutes INT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    decline_reason TEXT,
    outcome_summary TEXT
);

-- ------------------------------------------------------------------------------
-- 5. HIGH-SCALE TELEMETRY & AUDIT TRAILS
-- ------------------------------------------------------------------------------

-- Telemetry table (Can be partitioned by Range on timestamp in high-volume environments)
CREATE TABLE IF NOT EXISTS telemetry (
    id BIGSERIAL,
    device_id VARCHAR(64) NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    learner_id VARCHAR(64) REFERENCES learners(id) ON DELETE SET NULL,
    school_id VARCHAR(64) REFERENCES schools(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy_meters REAL,
    speed_kmh REAL,
    battery_level INT,
    heart_rate_bpm INT,
    temperature_celsius REAL,
    tamper_flag BOOLEAN NOT NULL DEFAULT FALSE,
    geofence_status VARCHAR(32) NOT NULL DEFAULT 'SAFE_ZONE',
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

-- Initial Partition Examples (Automated in production via pg_partman)
CREATE TABLE IF NOT EXISTS telemetry_default PARTITION OF telemetry DEFAULT;

-- Cryptographically Chained Audit Events
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
    channel VARCHAR(32) NOT NULL DEFAULT 'PUSH', -- PUSH, SMS, EMAIL, IN_APP
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    notification_type VARCHAR(64) NOT NULL, -- EMERGENCY, ATTENDANCE, SAFETY_ALERT, SYSTEM
    incident_id VARCHAR(64) REFERENCES incidents(id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 6. PERFORMANCE & OPERATIONAL INDEXES (FOR 3,000,000+ SCALE)
-- ------------------------------------------------------------------------------

-- Users & Auth
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_identifier ON users(identifier);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id) WHERE school_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_guardian_id ON users(guardian_id) WHERE guardian_id IS NOT NULL;

-- Schools
CREATE INDEX IF NOT EXISTS idx_schools_emis ON schools(emis_code);
CREATE INDEX IF NOT EXISTS idx_schools_province_district ON schools(province, district);
CREATE INDEX IF NOT EXISTS idx_schools_name_trgm ON schools USING gin (name gin_trgm_ops);

-- Persons & Identifiers
CREATE INDEX IF NOT EXISTS idx_persons_official_id ON persons(official_id);
CREATE INDEX IF NOT EXISTS idx_persons_name ON persons(last_name, first_name);

-- Learners & Enrolments
CREATE INDEX IF NOT EXISTS idx_learners_person_id ON learners(person_id);
CREATE INDEX IF NOT EXISTS idx_learners_emis_id ON learners(emis_id);
CREATE INDEX IF NOT EXISTS idx_enrolments_school_status ON school_enrolments(school_id, enrolment_status);
CREATE INDEX IF NOT EXISTS idx_enrolments_learner_academic ON school_enrolments(learner_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_enrolments_grade ON school_enrolments(grade);

-- Guardians & Relationships
CREATE INDEX IF NOT EXISTS idx_guardians_person_id ON guardians(person_id);
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_glr_guardian_id ON guardian_learner_relationships(guardian_id);
CREATE INDEX IF NOT EXISTS idx_glr_learner_id ON guardian_learner_relationships(learner_id);
CREATE INDEX IF NOT EXISTS idx_glr_access_status ON guardian_learner_relationships(access_status);

-- Devices
CREATE INDEX IF NOT EXISTS idx_devices_serial ON devices(serial_number);
CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(device_status);
CREATE INDEX IF NOT EXISTS idx_learner_devices_learner ON learner_devices(learner_id, assignment_status);
CREATE INDEX IF NOT EXISTS idx_learner_devices_device ON learner_devices(device_id, assignment_status);

-- Responders & Tactical Units
CREATE INDEX IF NOT EXISTS idx_responders_callsign ON responders(callsign);
CREATE INDEX IF NOT EXISTS idx_responders_available ON responders(is_available, assigned_district);

-- Incidents & Tactical Operations
CREATE INDEX IF NOT EXISTS idx_incidents_status_severity ON incidents(status, severity);
CREATE INDEX IF NOT EXISTS idx_incidents_school_id ON incidents(school_id);
CREATE INDEX IF NOT EXISTS idx_incidents_learner_id ON incidents(learner_id);
CREATE INDEX IF NOT EXISTS idx_incidents_triggered_at ON incidents(triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_incident_events_incident_id ON incident_events(incident_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_dispatches_incident_id ON dispatches(incident_id);
CREATE INDEX IF NOT EXISTS idx_responder_assignments_incident ON responder_assignments(incident_id, operational_state);
CREATE INDEX IF NOT EXISTS idx_responder_assignments_responder ON responder_assignments(responder_id, operational_state);

-- Telemetry (BRIN index for timestamp ordering across millions of rows)
CREATE INDEX IF NOT EXISTS idx_telemetry_recorded_at_brin ON telemetry USING brin(recorded_at);
CREATE INDEX IF NOT EXISTS idx_telemetry_device_time ON telemetry(device_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_learner_time ON telemetry(learner_id, recorded_at DESC);

-- Audit Events
CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_events(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_entity, target_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_checksum ON audit_events(checksum);

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_user_id, is_read);
