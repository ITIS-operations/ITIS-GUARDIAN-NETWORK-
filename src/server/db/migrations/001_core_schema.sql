-- Migration 001: Core Platform Schema (Extensions, Roles, Schools, Persons, Users, Sessions)
-- Safe, repeatable, non-destructive

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS roles (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT TRUE,
  is_sole_user_creator BOOLEAN NOT NULL DEFAULT FALSE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
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
  geofence_radius_meters INT NOT NULL DEFAULT 450,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS persons (
  id VARCHAR(64) PRIMARY KEY,
  official_id VARCHAR(64) UNIQUE,
  official_id_type VARCHAR(32) NOT NULL DEFAULT 'SA_ID',
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

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
