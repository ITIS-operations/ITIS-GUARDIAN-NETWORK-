# ITIS GUARDIAN NETWORK — INFRASTRUCTURE, BACKUP & DISASTER RECOVERY SPECIFICATION

> **CRITICAL PRODUCTION ADVISORY:**
> This document specifies the required enterprise disaster recovery and backup architecture for the **ITIS Guardian Network National Child Safety Platform**.
> **Backups, geo-replication, and automated PITR do NOT currently exist in the active development sandbox.** They must be explicitly provisioned when deploying to production infrastructure (e.g., Cloud SQL, AWS Aurora, or dedicated managed PostgreSQL).

---

## 1. Objectives & Compliance Framework

The ITIS Guardian Network safeguards vulnerable school children across national educational jurisdictions. System downtime or data loss during an active child safety emergency presents unacceptable physical risk.

### Targets
| Objective | Target | Operational Rationale |
| :--- | :--- | :--- |
| **RPO (Recovery Point Objective)** | **< 1 minute** | Continuous Write-Ahead Log (WAL) streaming ensures zero loss of critical emergency SOS alerts and real-time learner tracking coordinates. |
| **RTO (Recovery Time Objective)** | **< 15 minutes** | Rapid automated failover or snapshot restoration ensures Emergency Command Centres and SAPS First Responders regain situational awareness swiftly. |
| **Compliance Retention** | **7 Years** | South African Protection of Personal Information Act (POPIA), Children's Act 38 of 2005, and National Child Protection Register legal audit requirements. |

---

## 2. Recommended Backup Architecture & Frequency

To guarantee point-in-time recovery without performance degradation on primary transaction processing, the following tiered strategy must be configured:

### 2.1 Continuous Write-Ahead Logging (WAL) & PITR
- **Mechanism:** Continuous WAL archiving to geo-redundant, write-once-read-many (WORM) cloud object storage (e.g., Google Cloud Storage Nearline/Coldline or AWS S3 Glacier Vault with object lock).
- **Archiving Interval:** Continuous (WAL segments archived immediately upon 16MB file rotation or every 60 seconds via `archive_timeout = 60s`).
- **Recovery Capability:** Granular Point-In-Time Recovery (PITR) to any second within the trailing 30-day window.

### 2.2 Daily Automated Physical Snapshots
- **Frequency:** Once daily at 01:30 SAST (UTC+2) during low-traffic maintenance window.
- **Method:** Storage-level snapshot or `pg_basebackup` with complete cluster data directory and tablespaces.
- **Retention:**
  - Daily snapshots retained for 90 days.
  - Weekly snapshots retained for 12 months.
  - Annual compliance archives retained for 7 years.

### 2.3 Hourly Logical Reference Exports
- **Frequency:** Every 1 hour.
- **Tool:** `pg_dump` in directory format with LZ4 compression, parallel workers, and table exclusion for transient metrics.
- **Scope:** Schema DDL, identity registries (`schools`, `persons`, `users`, `learners`, `guardians`, `guardian_learner_relationships`, `devices`), and tactical dispatch audits.

---

## 3. Data Recovery Safety & Anti-Duplication Guarantees

Accidental duplication during a restore operation in a child safety system can cause critical operational hazards (e.g., dual emergency alerts, split guardian custody records, orphaned biometric/ID hashes).

### 3.1 Idempotent Primary Keys & Authoritative Schemas
- **Deterministic Prefixed Identifiers:** All core entities use authoritative IDs:
  - Schools: `sch-` (e.g., `sch-001`) with unique EMIS code constraint (`schools.emis_code UNIQUE`).
  - Persons: `per-` (e.g., `per-g-001`, `per-l-001`) with unique National ID constraint (`persons.official_id UNIQUE`).
  - Learners: `lrn-` with unique EMIS ID (`learners.emis_id UNIQUE`) and Person FK (`learners.person_id UNIQUE`).
  - Guardians: `grd-` with Person FK (`guardians.person_id UNIQUE`).
  - Relationships: `guardian_learner_relationships` enforces composite uniqueness `UNIQUE(guardian_id, learner_id)`.
  - Devices: `dev-` with hardware IMEI and Serial Number constraints (`devices.serial_number UNIQUE`, `devices.imei UNIQUE`).
  - Incidents: `inc-` with deterministic lifecycle progression (`QUEUED` → `DISPATCHED` → `CLAIMED` → `RESOLVED`).
- **Database Restoration Constraint:** Replay procedures must execute within explicit transaction boundaries. Tables use `ON CONFLICT (id) DO UPDATE` or `ON CONFLICT (id) DO NOTHING` to prevent duplicate primary keys or split child dossiers.

### 3.2 Append-Only Cryptographic Audit Log Integrity
- Audit events in `audit_events` are append-only.
- Each audit record contains a SHA-256 `checksum` calculated over `(action_type + actor_user_id + target_entity + target_id + details + previous_checksum)`.
- Upon database recovery, an automated integrity audit runs:
  ```sql
  SELECT id, action_type, checksum, previous_checksum 
  FROM audit_events 
  ORDER BY created_at ASC;
  ```
  Any hash break or out-of-order replay is flagged immediately as an audit integrity violation.

---

## 4. Restoration Procedure (Runbook)

When initiating a restoration in production:

### Step 1: Quarantine & Traffic Isolation
1. Direct ingress reverse proxy (Nginx / Cloud Load Balancer) to display the authoritative maintenance/degraded service notice.
2. Terminate all active API and Dedicated GPS Server connections to avoid conflicting writes during database recovery:
   ```bash
   SELECT pg_terminate_backend(pid) 
   FROM pg_stat_activity 
   WHERE datname = 'itis_production' AND pid <> pg_backend_pid();
   ```

### Step 2: Target PITR Instance Provisioning
1. Restore base backup to a freshly provisioned PostgreSQL instance:
   ```bash
   # Example using pgBackRest or Cloud SQL Point-In-Time Restore
   gcloud sql instances clone itis-postgres-primary itis-postgres-recovery \
       --point-in-time="2026-09-12T14:30:00.000000Z"
   ```
2. Configure `recovery_target_time` to the second immediately preceding the corruption or outage event.

### Step 3: Integrity & Consistency Verification
Execute the verification suite before routing live traffic:
1. Verify foreign key and custody relationship integrity:
   ```sql
   -- Check for orphaned learner custody relationships
   SELECT count(*) FROM guardian_learner_relationships glr
   LEFT JOIN learners l ON glr.learner_id = l.id
   LEFT JOIN guardians g ON glr.guardian_id = g.id
   WHERE l.id IS NULL OR g.id IS NULL;
   -- Must return 0
   ```
2. Verify migration state using the migration runner:
   ```bash
   npm run db:status
   ```
3. Run the automated production readiness suite:
   ```bash
   npm run test:production
   ```

### Step 4: Traffic Cutover & Telemetry Drain
1. Update `DATABASE_URL` secret in Secret Manager / environment variables to point to restored instance.
2. Launch core API instances and execute `/api/health/readiness` check.
3. Start Dedicated GPS Telemetry Server (`npm run gps:server`). Buffered packets from the `TelemetryResilienceQueue` are drained into the database without duplication.
4. Restore external routing on Cloud Load Balancer.

---

## 5. Routine Disaster Recovery Testing Schedule

| Frequency | Drill Description | Validation Criteria |
| :--- | :--- | :--- |
| **Monthly** | Automated Synthetic Recovery | Automated CI/CD spin-up of latest backup snapshot on isolated instance; executes `npm run test:production` and `npm run test:security`. |
| **Quarterly** | Table-top & Simulated Primary Failover | Simulate primary database failure, trigger multi-AZ failover, measure RTO against 15-minute target. |
| **Biannual** | Full PITR Scenario Exercise | Restore data to state 4 hours prior, verify SHA-256 audit chain continuity and zero lost incident dossiers. |

---

## 6. Implementation Status Matrix

| Component | Architecture Defined | Production Provisioned | Verification Status |
| :--- | :---: | :---: | :--- |
| **PostgreSQL Schema & Tables** | **YES** | **NO** (Dev In-Memory/Local Postgres) | Schema verified via 5 versioned migrations |
| **Primary Key Deduplication** | **YES** | **YES** | Verified via test `PR-11` |
| **Cryptographic Audit Chaining** | **YES** | **YES** | Verified via test `SEC-14` |
| **Continuous WAL Archiving** | **YES** | **NO** | Requires Production Cloud SQL / Managed PG |
| **Automated Geo-Redundant S3/GCS** | **YES** | **NO** | Requires Production Cloud Storage Bucket |
| **PITR Recovery Testing** | **YES** | **NO** | Runbook specified above; await prod env |
