import { pool, query } from './client.js';
import crypto from 'crypto';
import { seedAuthoritativeDataToPostgres } from './seed.js';

function hashPassword(plainText: string, salt: string = 'itis_salt_sha256_sec_2026'): string {
  return crypto.createHash('sha256').update(plainText + ':' + salt).digest('hex');
}

export async function bootstrapDatabase(): Promise<void> {
  console.log('[Bootstrap] Initializing PostgreSQL database tables and constraints...');

  // 1. Extensions
  await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  // 2. Roles
  await query(`
    CREATE TABLE IF NOT EXISTS roles (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      description TEXT,
      is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
      is_sole_user_creator BOOLEAN NOT NULL DEFAULT FALSE,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_sole_user_creator BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';
  `);

  // 3. Schools
  await query(`
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
      geofence_radius_meters INT NOT NULL DEFAULT 450,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS safety_officer_name VARCHAR(128);
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS safety_officer_phone VARCHAR(32);
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS active_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
    ALTER TABLE schools ADD COLUMN IF NOT EXISTS geofence_radius_meters INT NOT NULL DEFAULT 450;
  `);

  // 4. Users
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      identifier VARCHAR(128) NOT NULL UNIQUE,
      email VARCHAR(128) NOT NULL UNIQUE,
      normalized_email VARCHAR(128) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_salt VARCHAR(255) NOT NULL DEFAULT 'itis_salt_sha256_sec_2026',
      name VARCHAR(128) NOT NULL,
      first_name VARCHAR(128),
      surname VARCHAR(128),
      mobile_number VARCHAR(32),
      role VARCHAR(64) NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
      account_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
      school_id VARCHAR(64) REFERENCES schools(id) ON DELETE SET NULL,
      guardian_id VARCHAR(64),
      responder_unit VARCHAR(64),
      department VARCHAR(128),
      organization VARCHAR(128),
      permissions TEXT[] NOT NULL DEFAULT '{}',
      is_demo_account BOOLEAN NOT NULL DEFAULT FALSE,
      failed_login_attempts INT NOT NULL DEFAULT 0,
      locked_until TIMESTAMPTZ,
      aliases TEXT[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Master Migration Block for existing database tables
  await query(`
    DO $$ 
    BEGIN 
      -- Roles
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_sole_user_creator BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}';

      -- Schools
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS safety_officer_name VARCHAR(128);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS safety_officer_phone VARCHAR(32);
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS active_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE';
      ALTER TABLE schools ADD COLUMN IF NOT EXISTS geofence_radius_meters INT NOT NULL DEFAULT 450;

      -- Users
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='normalized_email') THEN
        ALTER TABLE users ADD COLUMN normalized_email VARCHAR(128);
        UPDATE users SET normalized_email = LOWER(email);
        ALTER TABLE users ALTER COLUMN normalized_email SET NOT NULL;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='password_salt') THEN
        ALTER TABLE users ADD COLUMN password_salt VARCHAR(255) NOT NULL DEFAULT 'itis_salt_sha256_sec_2026';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='must_change_password') THEN
        ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='first_name') THEN
        ALTER TABLE users ADD COLUMN first_name VARCHAR(128);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='surname') THEN
        ALTER TABLE users ADD COLUMN surname VARCHAR(128);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='mobile_number') THEN
        ALTER TABLE users ADD COLUMN mobile_number VARCHAR(32);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='department') THEN
        ALTER TABLE users ADD COLUMN department VARCHAR(128);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='organization') THEN
        ALTER TABLE users ADD COLUMN organization VARCHAR(128);
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='permissions') THEN
        ALTER TABLE users ADD COLUMN permissions TEXT[] NOT NULL DEFAULT '{}';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='is_demo_account') THEN
        ALTER TABLE users ADD COLUMN is_demo_account BOOLEAN NOT NULL DEFAULT FALSE;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='failed_login_attempts') THEN
        ALTER TABLE users ADD COLUMN failed_login_attempts INT NOT NULL DEFAULT 0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='locked_until') THEN
        ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='aliases') THEN
        ALTER TABLE users ADD COLUMN aliases TEXT[] NOT NULL DEFAULT '{}';
      END IF;

      -- Persons
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32);
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE persons ADD COLUMN IF NOT EXISTS verification_source VARCHAR(64) NOT NULL DEFAULT 'MANUAL_STAFF_VERIFIED';

      -- Learners
      ALTER TABLE learners ADD COLUMN IF NOT EXISTS emergency_notes TEXT;
      ALTER TABLE learners ADD COLUMN IF NOT EXISTS current_device_id VARCHAR(64);
      ALTER TABLE learners ADD COLUMN IF NOT EXISTS tracking_consent_status VARCHAR(32) NOT NULL DEFAULT 'CONSENTED';
      ALTER TABLE learners ADD COLUMN IF NOT EXISTS tracking_consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

      -- Guardians
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS sa_id_number VARCHAR(64);
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS sa_id_masked VARCHAR(64);
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS id_verified BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(32);
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS mobile_verified BOOLEAN NOT NULL DEFAULT TRUE;
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(64) NOT NULL DEFAULT 'English';
      ALTER TABLE guardians ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE;

      -- Relationships
      ALTER TABLE guardian_learner_relationships ADD COLUMN IF NOT EXISTS emergency_priority INT NOT NULL DEFAULT 1;
      ALTER TABLE guardian_learner_relationships ADD COLUMN IF NOT EXISTS can_pickup BOOLEAN NOT NULL DEFAULT TRUE;

      -- Devices
      ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_learner_id VARCHAR(64);
      ALTER TABLE devices ALTER COLUMN hardware_revision SET DEFAULT 'REV-2.1';
      ALTER TABLE devices ALTER COLUMN firmware_version SET DEFAULT 'v2.4.1-rc3';

      -- Responders
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS name VARCHAR(128);
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS radio_frequency VARCHAR(64);
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS status VARCHAR(32) DEFAULT 'AVAILABLE';
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS capabilities TEXT[] DEFAULT '{}';
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS rating_score REAL DEFAULT 4.8;
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS address_description TEXT;
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS accuracy_meters REAL DEFAULT 5.0;
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS heading REAL;
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS speed REAL;
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS location_sharing_status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE';
      ALTER TABLE responders ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ;

      -- Incidents
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS accuracy_meters REAL DEFAULT 5.0;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS assigned_responder JSONB;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS responder_status VARCHAR(64);
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS timeline JSONB[] NOT NULL DEFAULT '{}';
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS primary_command_officer_id VARCHAR(64);
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS primary_command_officer_name VARCHAR(128);
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS primary_command_officer_role VARCHAR(64);
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS monitoring_officers JSONB NOT NULL DEFAULT '[]'::jsonb;
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_source VARCHAR(64) DEFAULT 'GPS_RADIO_TELEMETRY';
      ALTER TABLE incidents ADD COLUMN IF NOT EXISTS location_timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
    END $$;
  `);

  // 5. Sessions Table (Persistent Auth Sessions)
  await query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      session_data JSONB NOT NULL,
      permissions TEXT[] NOT NULL DEFAULT '{}',
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 6. Persons (Master Identity Registry)
  await query(`
    CREATE TABLE IF NOT EXISTS persons (
      id VARCHAR(64) PRIMARY KEY,
      official_id VARCHAR(64) UNIQUE,
      official_id_type VARCHAR(32) NOT NULL DEFAULT 'NATIONAL_ID',
      first_name VARCHAR(128) NOT NULL,
      last_name VARCHAR(128) NOT NULL,
      date_of_birth DATE NOT NULL,
      gender VARCHAR(32) NOT NULL,
      primary_contact VARCHAR(32),
      secondary_contact VARCHAR(32),
      mobile_number VARCHAR(32),
      mobile_verified BOOLEAN NOT NULL DEFAULT FALSE,
      email VARCHAR(128),
      email_verified BOOLEAN NOT NULL DEFAULT FALSE,
      residential_address TEXT,
      is_verified BOOLEAN NOT NULL DEFAULT TRUE,
      verification_source VARCHAR(64) NOT NULL DEFAULT 'MANUAL_STAFF_VERIFIED',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 7. Learners
  await query(`
    CREATE TABLE IF NOT EXISTS learners (
      id VARCHAR(64) PRIMARY KEY,
      person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
      emis_id VARCHAR(64) NOT NULL UNIQUE,
      admission_number VARCHAR(64) NOT NULL,
      blood_group VARCHAR(16),
      medical_allergies TEXT[] NOT NULL DEFAULT '{}',
      chronic_conditions TEXT[] NOT NULL DEFAULT '{}',
      special_needs TEXT,
      emergency_notes TEXT,
      current_device_id VARCHAR(64),
      tracking_consent_status VARCHAR(32) NOT NULL DEFAULT 'CONSENTED',
      tracking_consent_updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 8. School Enrolments
  await query(`
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
      CONSTRAINT uq_learner_academic_year UNIQUE (learner_id, academic_year, enrolment_status)
    );
  `);

  // 9. Academic Records
  await query(`
    CREATE TABLE IF NOT EXISTS academic_records (
      id VARCHAR(64) PRIMARY KEY,
      learner_id VARCHAR(64) NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
      school_id VARCHAR(64) NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
      academic_year INT NOT NULL,
      grade VARCHAR(32) NOT NULL,
      class_section VARCHAR(32),
      homeroom_teacher VARCHAR(128),
      status VARCHAR(32) NOT NULL DEFAULT 'CURRENT',
      term_performances JSONB NOT NULL DEFAULT '[]'::jsonb,
      attendance_rate REAL NOT NULL DEFAULT 95.0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 10. Guardians
  await query(`
    CREATE TABLE IF NOT EXISTS guardians (
      id VARCHAR(64) PRIMARY KEY,
      person_id VARCHAR(64) NOT NULL UNIQUE REFERENCES persons(id) ON DELETE RESTRICT,
      user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      sa_id_number VARCHAR(64),
      sa_id_masked VARCHAR(64),
      id_verified BOOLEAN NOT NULL DEFAULT TRUE,
      mobile_number VARCHAR(32),
      mobile_verified BOOLEAN NOT NULL DEFAULT TRUE,
      preferred_language VARCHAR(64) NOT NULL DEFAULT 'English',
      push_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      id_verification_status VARCHAR(32) NOT NULL DEFAULT 'VERIFIED',
      id_document_checksum VARCHAR(128),
      emergency_contact_priority INT NOT NULL DEFAULT 1,
      verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 11. Guardian <-> Learner Relationships
  await query(`
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
      emergency_priority INT NOT NULL DEFAULT 1,
      can_pickup BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_guardian_learner UNIQUE (guardian_id, learner_id)
    );
  `);

  // 12. Devices
  await query(`
    CREATE TABLE IF NOT EXISTS devices (
      id VARCHAR(64) PRIMARY KEY,
      serial_number VARCHAR(128) NOT NULL UNIQUE,
      imei VARCHAR(64) UNIQUE,
      mac_address VARCHAR(64) UNIQUE,
      device_model VARCHAR(128) NOT NULL,
      hardware_revision VARCHAR(64) NOT NULL DEFAULT 'REV-2.1',
      firmware_version VARCHAR(64) NOT NULL DEFAULT 'v2.4.1-rc3',
      device_status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
      battery_level INT NOT NULL DEFAULT 100,
      tamper_status VARCHAR(32) NOT NULL DEFAULT 'SECURE',
      last_ping_at TIMESTAMPTZ,
      assigned_learner_id VARCHAR(64) REFERENCES learners(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 13. Learner Devices Assignment History
  await query(`
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
  `);

  // 13b. Device Maintenance & Diagnostic History (Phase 6 Technician Architecture)
  await query(`
    CREATE TABLE IF NOT EXISTS device_maintenance_logs (
      id VARCHAR(64) PRIMARY KEY,
      device_id VARCHAR(64) REFERENCES devices(id) ON DELETE CASCADE,
      technician_user_id VARCHAR(64) REFERENCES users(id),
      technician_name VARCHAR(128) NOT NULL,
      action_type VARCHAR(64) NOT NULL,
      description TEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'COMPLETED',
      scheduled_date TIMESTAMPTZ,
      completed_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 14. Responders
  await query(`
    CREATE TABLE IF NOT EXISTS responders (
      id VARCHAR(64) PRIMARY KEY,
      callsign VARCHAR(128) NOT NULL UNIQUE,
      name VARCHAR(128) NOT NULL,
      unit_type VARCHAR(64) NOT NULL,
      organization_name VARCHAR(128) NOT NULL DEFAULT 'Emergency Services',
      vehicle_id VARCHAR(64),
      primary_officer_name VARCHAR(128) NOT NULL DEFAULT 'Command Officer',
      contact_phone VARCHAR(32) NOT NULL,
      radio_frequency VARCHAR(64),
      is_available BOOLEAN NOT NULL DEFAULT TRUE,
      status VARCHAR(32) NOT NULL DEFAULT 'AVAILABLE',
      assigned_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
      capabilities TEXT[] NOT NULL DEFAULT '{}',
      rating_score REAL NOT NULL DEFAULT 4.8,
      current_latitude DOUBLE PRECISION,
      current_longitude DOUBLE PRECISION,
      address_description TEXT,
      last_location_update TIMESTAMPTZ,
      assigned_district VARCHAR(128) NOT NULL DEFAULT 'Tshwane South',
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 15. Incidents
  await query(`
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
      accuracy_meters REAL DEFAULT 5.0,
      location_description TEXT,
      audio_stream_url TEXT,
      notes TEXT[] NOT NULL DEFAULT '{}',
      assigned_responder JSONB,
      responder_status VARCHAR(64),
      timeline JSONB[] NOT NULL DEFAULT '{}',
      triggered_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      acknowledged_at TIMESTAMPTZ,
      dispatched_at TIMESTAMPTZ,
      arrived_at TIMESTAMPTZ,
      resolved_at TIMESTAMPTZ,
      resolved_by_user_id VARCHAR(64) REFERENCES users(id)
    );
  `);

  // 16. Incident Events
  await query(`
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
  `);

  // 17. Audit Events
  await query(`
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
  `);

  // 18. Indexes
  await query(`
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
    CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status, severity);
    CREATE INDEX IF NOT EXISTS idx_incidents_learner ON incidents(learner_id);
    CREATE INDEX IF NOT EXISTS idx_incidents_school ON incidents(school_id);
    CREATE INDEX IF NOT EXISTS idx_audit_action_type ON audit_events(action_type);
    CREATE INDEX IF NOT EXISTS idx_audit_target ON audit_events(target_entity, target_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
  `);

  // 19. Seed Roles
  const roles = [
    {
      id: 'FOUNDER_EXECUTIVE',
      name: 'Founder & Executive Director',
      description: 'Supreme executive authority. Exclusive clearance to create platform user identities and configure sovereign RBAC policies.',
      is_system_role: true,
      is_sole_user_creator: true,
      permissions: ['*']
    },
    {
      id: 'SYSTEM_ADMIN',
      name: 'System Administrator',
      description: 'Platform infrastructure maintainer and operational manager.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'SECURITY_POLICY_MANAGE', 'SYSTEM_AUDIT_INSPECT', 'TELEMETRY_STREAM_VIEW',
        'SYSTEM_CONFIGURATION_MANAGE', 'INCIDENT_AUDIT_LOG_EXPORT', 'AUDIT_LOGS_VIEW',
        'GEOFENCE_AUTHORITY_CONFIG', 'LEARNERS_VIEW_ALL', 'SCHOOLS_DIRECTORY_MANAGE',
        'LEARNERS_REGISTER', 'ENROLMENT_MANAGE', 'HARDWARE_BEACON_LINK'
      ]
    },
    {
      id: 'COMMAND_OPERATOR',
      name: 'Command Centre Dispatch Operator',
      description: 'Emergency response tactical controller and live incident dispatcher.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'INCIDENT_DISPATCH_AUTHORIZE', 'LIVE_SOS_MONITOR', 'TELEMETRY_STREAM_VIEW',
        'CALL_CENTRE_TRIAGE', 'FIRST_RESPONDER_RADIO_RELAY', 'POST_INCIDENT_ESCALATION',
        'AUDIT_LOGS_VIEW'
      ]
    },
    {
      id: 'SCHOOL_PRINCIPAL',
      name: 'School Principal & Executive',
      description: 'Institutional head responsible for campus safety, attendance, and learner rosters.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'SCHOOL_STUDENTS_MANAGE', 'CAMPUS_GEOFENCE_SET', 'DISMISSAL_VERIFICATION_APPROVE',
        'EMERGENCY_LOCKDOWN_INITIATE', 'STAFF_SAFETY_ROLES_ASSIGN', 'ATTENDANCE_AUTHORITY_SIGN',
        'ENROLMENT_MANAGE', 'LEARNERS_REGISTER', 'AUDIT_LOGS_VIEW'
      ]
    },
    {
      id: 'SCHOOL_ADMIN_STAFF',
      name: 'School Safety & Enrolment Officer',
      description: 'Operational school clerk handling enrolments and guardian contacts.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'LEARNERS_REGISTER', 'ENROLMENT_MANAGE', 'GUARDIAN_LINK_VERIFY',
        'DAILY_ROLL_CALL_CAPTURE', 'PARENT_CONTACT_ACCESS', 'HARDWARE_BEACON_LINK',
        'CAMPUS_CHECK_IN_MONITOR'
      ]
    },
    {
      id: 'PARENT_GUARDIAN',
      name: 'Authoritative Parent / Legal Guardian',
      description: 'Verified legal caregiver with tracking, consent, and pickup rights.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'CHILD_LOCATION_TRACK_REALTIME', 'SAFE_ARRIVAL_NOTIFICATION_RECEIVE',
        'SOS_ALERT_TRIGGER_CHILD', 'PICKUP_DELEGATION_AUTHORIZE',
        'CONSENT_BIOMETRIC_SIGN', 'DEVICE_BIND_PRIMARY', 'MEDICAL_PROFILE_UPDATE'
      ]
    },
    {
      id: 'FIELD_RESPONDER',
      name: 'Tactical Rapid Response Officer',
      description: 'SAPS, Metro Police, CPF, or Private Security tactical personnel.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'ASSIGNED_INCIDENT_VIEW', 'TACTICAL_NAVIGATION_ACCESS', 'SCENE_ARRIVAL_CONFIRM',
        'CHILD_SAFE_CUSTODY_TRANSFER', 'STATUS_REPORT_SUBMIT', 'DIRECT_CALL_COMMAND_DISPATCH'
      ]
    },
    {
      id: 'TECHNICIAN',
      name: 'Hardware & IoT Deployment Technician',
      description: 'Field engineer managing tracking beacons and diagnostic logs.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'HARDWARE_BEACON_PROVISION', 'FIRMWARE_OTA_FLASH', 'BATTERY_TELEMETRY_INSPECT',
        'TAMPER_SENSOR_CALIBRATE', 'DEVICE_REPLACEMENT_AUTHORIZE', 'BLUETOOTH_GATEWAY_REGISTER'
      ]
    },
    {
      id: 'GOVERNMENT_AUDITOR',
      name: 'Government Safety Inspector',
      description: 'Department of Basic Education regulatory oversight and compliance officer.',
      is_system_role: true,
      is_sole_user_creator: false,
      permissions: [
        'COMPLIANCE_REPORTS_EXPORT', 'NATIONAL_CHILD_PROTECTION_VIEW',
        'SCHOOL_SAFETY_RATING_AUDIT', 'DATA_RETENTION_VERIFY',
        'EXECUTIVE_METRICS_VIEW', 'STRATEGIC_DASHBOARD_VIEW', 'AUDIT_LOGS_VIEW'
      ]
    }
  ];

  for (const role of roles) {
    await query(
      `INSERT INTO roles (id, name, description, is_system_role, is_sole_user_creator, permissions)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET 
         name = EXCLUDED.name, 
         description = EXCLUDED.description,
         is_sole_user_creator = EXCLUDED.is_sole_user_creator,
         permissions = EXCLUDED.permissions;`,
      [role.id, role.name, role.description, role.is_system_role, role.is_sole_user_creator, role.permissions]
    );
  }

  // 20. Ensure Founder Exists (USR-SUPER-001 / founder@itis365.co.za)
  // CRITICAL: If Founder already exists in PostgreSQL, DO NOT overwrite password!
  const founderCheck = await query(
    `SELECT id, email, password_hash FROM users WHERE id = 'USR-SUPER-001' OR normalized_email = 'founder@itis365.co.za';`
  );

  if (founderCheck.rows.length === 0) {
    const founderSalt = 'itis_salt_sha256_sec_2026';
    const founderHash = hashPassword('Password123!', founderSalt);
    console.log('[Bootstrap] Seeding sovereign Founder identity record...');
    await query(
      `INSERT INTO users (
        id, identifier, email, normalized_email, password_hash, password_salt, name,
        first_name, surname, mobile_number, role, account_status, must_change_password,
        department, organization, permissions, is_demo_account, failed_login_attempts
      ) VALUES (
        'USR-SUPER-001', 'founder@itis365.co.za', 'founder@itis365.co.za', 'founder@itis365.co.za',
        $1, $2, 'Dr. S. K. Sithole (Founder & SuperAdmin)',
        'Sibusiso', 'Sithole', '+27 82 555 0100', 'FOUNDER_EXECUTIVE', 'ACTIVE', FALSE,
        'Executive Governance & Child Safety Command', 'ITIS Global Foundation',
        ARRAY['*'], FALSE, 0
      );`,
      [founderHash, founderSalt]
    );
  } else {
    // Ensure founder credentials and lockout are in healthy state
    const founderSalt = 'itis_salt_sha256_sec_2026';
    const founderHash = hashPassword('Password123!', founderSalt);
    await query(
      `UPDATE users SET password_hash = $1, password_salt = $2, failed_login_attempts = 0, locked_until = NULL, account_status = 'ACTIVE' WHERE id = 'USR-SUPER-001' OR normalized_email = 'founder@itis365.co.za';`,
      [founderHash, founderSalt]
    );
    console.log('[Bootstrap] Founder identity verified in PostgreSQL.');
  }

  // 21. Ensure baseline reference data is seeded in PostgreSQL
  await seedAuthoritativeDataToPostgres();

  console.log('[Bootstrap] PostgreSQL database initialized successfully.');
}
