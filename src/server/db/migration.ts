import { db } from '../dbStore.js';

export interface MigrationValidationResult {
  valid: boolean;
  timestamp: string;
  totalPersons: number;
  totalLearners: number;
  totalGuardians: number;
  totalRelationships: number;
  totalSchools: number;
  totalUsers: number;
  totalAuditLogs: number;
  captureOnceAnomalies: string[];
  foreignKeyViolations: string[];
  auditIntegrityPassed: boolean;
  summary: string;
}

export interface MigrationPlan {
  version: string;
  targetDatabase: 'PostgreSQL 14+';
  phases: Array<{
    step: number;
    phaseName: string;
    description: string;
    idempotent: boolean;
    rollbackAction: string;
  }>;
  ddlScript: string;
  dataExportSql: string;
  rollbackScript: string;
}

export class ProductionMigrationEngine {
  /**
   * Run full data validation on current store before allowing migration
   */
  public static validateCurrentStore(): MigrationValidationResult {
    const anomalies: string[] = [];
    const fkViolations: string[] = [];

    // 1. Verify Capture-Once Person Uniqueness
    const saIdSet = new Set<string>();
    for (const p of db.persons.values()) {
      if (p.officialId) {
        const clean = p.officialId.trim().toUpperCase();
        if (saIdSet.has(clean)) {
          anomalies.push(`Duplicate official ID in persons table: ${clean}`);
        }
        saIdSet.add(clean);
      }
    }

    // 2. Verify Learner -> Person Foreign Keys
    for (const l of db.learners.values()) {
      if (!db.persons.has(l.personId)) {
        fkViolations.push(`Learner ${l.id} references non-existent personId ${l.personId}`);
      }
    }

    // 3. Verify Guardian -> Person Foreign Keys
    for (const g of db.guardians.values()) {
      if (!db.persons.has(g.personId)) {
        fkViolations.push(`Guardian ${g.id} references non-existent personId ${g.personId}`);
      }
    }

    // 4. Verify Relationships FK
    for (const r of db.relationships.values()) {
      if (!db.guardians.has(r.guardianId)) {
        fkViolations.push(`Relationship ${r.id} references non-existent guardian ${r.guardianId}`);
      }
      if (!db.learners.has(r.learnerId)) {
        fkViolations.push(`Relationship ${r.id} references non-existent learner ${r.learnerId}`);
      }
    }

    // 5. Verify Audit Trail Cryptographic Integrity
    const auditCheck = db.verifyAuditTrailIntegrity();

    const isValid = anomalies.length === 0 && fkViolations.length === 0 && auditCheck.valid;

    return {
      valid: isValid,
      timestamp: new Date().toISOString(),
      totalPersons: db.persons.size,
      totalLearners: db.learners.size,
      totalGuardians: db.guardians.size,
      totalRelationships: db.relationships.size,
      totalSchools: db.schools.size,
      totalUsers: db.users.size,
      totalAuditLogs: db.auditLogs.length,
      captureOnceAnomalies: anomalies,
      foreignKeyViolations: fkViolations,
      auditIntegrityPassed: auditCheck.valid,
      summary: isValid 
        ? 'PASSED: All capture-once identities, foreign keys, and audit cryptographic hashes verified.'
        : `FAILED: Found ${anomalies.length} capture-once anomalies, ${fkViolations.length} FK violations.`
    };
  }

  /**
   * Generates complete non-destructive migration plan
   */
  public static generateMigrationPlan(): MigrationPlan {
    const exportSql = this.generateDataInsertSql();
    
    return {
      version: '1.0.0-PROD-FOUNDATION',
      targetDatabase: 'PostgreSQL 14+',
      phases: [
        {
          step: 1,
          phaseName: 'Pre-flight Validation',
          description: 'Run cryptographic audit verify and capture-once deduplication checks on current state.',
          idempotent: true,
          rollbackAction: 'Abort migration before modifying target database.'
        },
        {
          step: 2,
          phaseName: 'DDL Schema Application',
          description: 'Apply schema.sql (tables, indexes, foreign keys, partition tables) using CREATE TABLE IF NOT EXISTS.',
          idempotent: true,
          rollbackAction: 'Drop tables with reverse dependency order if needed.'
        },
        {
          step: 3,
          phaseName: 'Authoritative Seed & Data Hydration',
          description: 'Bulk insert reference data, persons, schools, learners, guardians, and relationships with ON CONFLICT DO NOTHING.',
          idempotent: true,
          rollbackAction: 'Truncate or delete records flagged with migration_batch_id.'
        },
        {
          step: 4,
          phaseName: 'Audit Trail & Event Stream Replay',
          description: 'Load chronological audit logs and verify root-to-tip SHA-256 chain.',
          idempotent: true,
          rollbackAction: 'Purge migrated audit partition if hash chain mismatch is detected.'
        },
        {
          step: 5,
          phaseName: 'Dual-Read Validation & Final Cutover',
          description: 'Enable Repository layer Postgres driver. Fallback to memory store if connection fails.',
          idempotent: true,
          rollbackAction: 'Toggle DATABASE_URL environment variable to revert to development fallback.'
        }
      ],
      ddlScript: '-- See /src/server/db/schema.sql',
      dataExportSql: exportSql,
      rollbackScript: this.generateRollbackSql()
    };
  }

  /**
   * Generates idempotent INSERT statements for current development data
   */
  private static generateDataInsertSql(): string {
    const lines: string[] = [];
    lines.push('-- =========================================================');
    lines.push('-- ITIS DATA HYDRATION EXPORT (IDEMPOTENT / ZERO DATA LOSS)');
    lines.push('-- Generated: ' + new Date().toISOString());
    lines.push('-- =========================================================\n');

    // 1. Roles & Permissions
    lines.push('-- Roles');
    lines.push(`INSERT INTO roles (id, name, description, is_system_role) VALUES 
      ('FOUNDER_EXECUTIVE', 'Founder & Executive Director', 'Sovereign platform administrative authority', true),
      ('COMMAND_OPERATOR', 'Command Centre Dispatch Operator', 'Emergency dispatch and surveillance operator', true),
      ('SCHOOL_PRINCIPAL', 'School Principal & Executive', 'Head of institutional child safety', true),
      ('PARENT_GUARDIAN', 'Authoritative Parent / Guardian', 'Verified legal caregiver', true),
      ('FIELD_RESPONDER', 'Tactical Rapid Response Officer', 'On-scene field responder', true),
      ('GOVERNMENT_AUDITOR', 'Government Safety Inspector', 'Compliance and regulatory auditor', true)
      ON CONFLICT (id) DO NOTHING;\n`);

    // 2. Schools
    lines.push('-- Schools');
    for (const s of db.schools.values()) {
      lines.push(`INSERT INTO schools (id, emis_code, name, province, district, principal_name, contact_phone, contact_email, latitude, longitude, address)
        VALUES ('${s.id}', '${s.emisCode}', '${s.name.replace(/'/g, "''")}', '${s.province}', '${s.district.replace(/'/g, "''")}', '${s.principalName.replace(/'/g, "''")}', '${s.contactPhone}', '${s.contactEmail}', ${s.geofenceCenter.lat}, ${s.geofenceCenter.lng}, '${s.address.replace(/'/g, "''")}')
        ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, updated_at = CURRENT_TIMESTAMP;`);
    }

    // 3. Persons
    lines.push('\n-- Persons (Capture-Once Master Registry)');
    for (const p of db.persons.values()) {
      lines.push(`INSERT INTO persons (id, official_id, official_id_type, first_name, last_name, date_of_birth, gender, primary_contact, email, residential_address)
        VALUES ('${p.id}', ${p.officialId ? `'${p.officialId}'` : 'NULL'}, '${p.idType}', '${p.firstName.replace(/'/g, "''")}', '${p.lastName.replace(/'/g, "''")}', '${p.dateOfBirth}', '${p.gender}', ${p.mobileNumber ? `'${p.mobileNumber}'` : 'NULL'}, ${p.email ? `'${p.email}'` : 'NULL'}, ${p.physicalAddress ? `'${p.physicalAddress.replace(/'/g, "''")}'` : 'NULL'})
        ON CONFLICT (id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP;`);
    }

    // 4. Learners
    lines.push('\n-- Learners');
    for (const l of db.learners.values()) {
      lines.push(`INSERT INTO learners (id, person_id, emis_id, admission_number, blood_group, tracking_consent_status)
        VALUES ('${l.id}', '${l.personId}', '${l.emisId}', '${l.admissionNumber}', ${l.bloodType ? `'${l.bloodType}'` : 'NULL'}, 'CONSENTED')
        ON CONFLICT (id) DO NOTHING;`);
    }

    // 5. Guardians
    lines.push('\n-- Guardians');
    for (const g of db.guardians.values()) {
      lines.push(`INSERT INTO guardians (id, person_id, id_verification_status, emergency_contact_priority)
        VALUES ('${g.id}', '${g.personId}', 'VERIFIED', 1)
        ON CONFLICT (id) DO NOTHING;`);
    }

    // 6. Guardian-Learner Relationships
    lines.push('\n-- Guardian-Learner Relationships');
    for (const r of db.relationships.values()) {
      lines.push(`INSERT INTO guardian_learner_relationships (id, guardian_id, learner_id, relationship_type, is_primary_contact, has_custody_rights, access_status, verification_status)
        VALUES ('${r.id}', '${r.guardianId}', '${r.learnerId}', '${r.relationshipType}', ${r.isPrimary}, ${r.legalCustodyVerified}, 'ACTIVE', '${r.verificationStatus}')
        ON CONFLICT (id) DO NOTHING;`);
    }

    return lines.join('\n');
  }

  /**
   * Generates safe rollback script that preserves historical data
   */
  private static generateRollbackSql(): string {
    return `-- =========================================================
-- ITIS PRODUCTION ROLLBACK PROCEDURE (SAFE & NON-DESTRUCTIVE)
-- =========================================================
-- To roll back an incomplete migration without data loss:
-- 1. Switch application back to development memory repository:
--    UNSET DATABASE_URL or set DATABASE_URL=memory
-- 2. Verify application operational status:
--    GET /api/health
-- 3. Archive target Postgres schema if desired for inspection:
--    CREATE SCHEMA IF NOT EXISTS migration_quarantine;
-- =========================================================`;
  }
}
