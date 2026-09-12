# ITIS GUARDIAN NETWORK — PRODUCTION ARCHITECTURE & SYSTEM DEPLOYMENT SPECIFICATION

> **EXECUTIVE ARCHITECTURAL SUMMARY:**
> This document details the production topology, network segmentation, and service separation for the **ITIS Guardian Network National Child Safety Platform**.
> It clearly distinguishes between **[IMPLEMENTED]** components ready in the codebase, **[READY FOR INTEGRATION]** interfaces tested in simulation, and **[NOT YET DEPLOYED]** physical/cloud infrastructure.

---

## 1. System Topology Overview

```
                      +------------------------------------------+
                      |         FIELD: IOT HARDWARE              |
                      |   GT012 / Concox GPS Child Trackers      |
                      |   (Hardware SOS, Keepalive, Telemetry)   |
                      +------------------------------------------+
                                           |
                                  TCP / UDP (Port 5023/5024)
                                  Raw Framing & Checksums
                                           v
                      +------------------------------------------+
                      |       DEDICATED TELEMETRY SERVER         |
                      |          (Long-Running Daemon)           |
                      |   - TCP / UDP Transport Adapters         |
                      |   - Concox Framing & CRC Verification    |
                      |   - Rate Limiting & DoS Quarantine       |
                      |   - Downlink ACK Generation              |
                      |   - In-Memory Resilience Queue           |
                      +------------------------------------------+
                                           |
                     Internal Signed RPC / Direct DB Ingestion
                     (HMAC-SHA256 Service Authentication)
                                           v
+--------------------------------------------------------------------------------+
|                         AUTHORITATIVE DATA TIER                                |
|                PostgreSQL Production Multi-AZ Cluster                          |
|   - Master Schema (5 Versioned Deterministic Migrations)                       |
|   - Identity, Legal Custody, Enrolment, Incident Lifecycle, Telemetry          |
|   - Append-Only SHA-256 Cryptographic Audit Trail                              |
+--------------------------------------------------------------------------------+
                                           ^
                                           |
                           Authoritative SQL / Connection Pool
                                           |
+--------------------------------------------------------------------------------+
|                         APPLICATION & API TIER                                 |
|                       ITIS Core Engine & Web API                               |
|   - Session Management & Strict RBAC/ABAC Boundary Enforcement                 |
|   - POPIA Section 14 Privacy Filters & Identity Redaction                      |
|   - Tactical Dispatch Engine & Incident State Machine                          |
|   - Liveness Probe (/api/health/liveness) & Readiness Probe (/readyz)          |
|   - Correlation ID Tracing (X-Correlation-ID) & Structured Logging             |
+--------------------------------------------------------------------------------+
                                           ^
                                           |
                              HTTPS / WSS (Port 3000 / 443)
                                           |
+--------------------------------------------------------------------------------+
|                           CLIENT / PORTAL LAYER                                |
|   - Founder Sovereign Command Centre (Sovereign Executive Oversight)           |
|   - Provincial & District Command Consoles (EMIS-scoped Incident Dispatch)     |
|   - Parent / Guardian Portal (ABAC Legal Custody Scoped Child Dossiers)        |
|   - SAPS Tactical Responder App (Assigned-Incident Need-to-Know Routing)       |
|   - Hardware Technician Console (PII-Minimised Asset Diagnostic Fleet View)    |
+--------------------------------------------------------------------------------+
```

---

## 2. Component Status Classification

| Layer / Component | Implementation Status | Current Environment | Production Target |
| :--- | :---: | :--- | :--- |
| **Core Web Application & UI** | **[IMPLEMENTED]** | React 18 + Tailwind, port 3000 | Container Ingress / Cloud CDN |
| **RBAC/ABAC Security Engine** | **[IMPLEMENTED]** | Authoritative Matrix (SEC-01 - SEC-24) | High-availability API instances |
| **PostgreSQL Repository Abstraction** | **[IMPLEMENTED]** | `postgresRepository.ts` | Managed Cloud SQL / Aurora PostgreSQL |
| **Deterministic Migration Engine** | **[IMPLEMENTED]** | `schema_migrations` with 5 SQL files | Automated CI/CD pipeline |
| **Liveness & Readiness Probes** | **[IMPLEMENTED]** | `/api/health/liveness`, `/readyz` | Kubernetes / Cloud Run Probes |
| **Request Correlation & Redaction** | **[IMPLEMENTED]** | `logger.ts` & `correlationMiddleware` | Centralized SIEM / Cloud Logging |
| **Dedicated GPS Telemetry Server** | **[READY FOR INTEGRATION]** | Tested via acceptance suite (`gps:server`)| Dedicated VM / Container with static IP |
| **GT012 Concox Protocol Engine** | **[READY FOR INTEGRATION]** | Framing, CRC, ACK verified in code | Physical GPS Tracker bench verification |
| **Vercel Serverless Separation** | **[READY FOR INTEGRATION]** | API serverless-ready; GPS excluded | Decoupled serverless API + persistent GPS daemon |
| **Production PostgreSQL Instance** | **[NOT YET DEPLOYED]** | Local Dev Database | Multi-AZ Cloud SQL / Self-hosted PG 16+ |
| **Continuous WAL & PITR Storage** | **[NOT YET DEPLOYED]** | None (Specified in DR runbook) | Geo-redundant WORM Cloud Storage |
| **TLS 1.3 / SSL Termination** | **[NOT YET DEPLOYED]** | HTTP development port 3000 | Cloud Load Balancer with Managed TLS |
| **External SMS / Push Gateways** | **[NOT YET DEPLOYED]** | In-app notification queue | Twilio / Africa's Talking / FCM Gateway |
| **Physical GSM SIM Cards & APN** | **[NOT YET DEPLOYED]** | Simulated socket payloads | Vodacom / MTN IoT Private APN |

---

## 3. Telemetry and Web/API Traffic Separation

A fundamental architectural requirement is that raw GPS device telemetry traffic must **never** terminate on the web frontend or serverless edge routes.

### Web / API Application Tier
- **Protocol:** HTTPS / WSS
- **Host Environment:** Serverless (Vercel) or Containerized Microservice (Cloud Run, ECS, Kubernetes).
- **Traffic Pattern:** Request-response HTTP REST queries and WebSocket events for UI state.
- **Scaling Characteristic:** Auto-scales horizontally based on concurrent user requests.

### Dedicated GPS Telemetry Ingestion Tier
- **Protocol:** Raw TCP (Port 5023) and UDP (Port 5024).
- **Host Environment:** Dedicated long-running VM or Kubernetes StatefulSet / DaemonSet with a static public IP.
- **Traffic Pattern:** Persistent socket connections, binary Concox GT012 frames (login packets, periodic heartbeats, location reports, SOS panic alarm frames).
- **Scaling Characteristic:** Sized according to concurrent open socket file descriptors and IoT device density.
- **Security Isolation:**
  - Strict packet size limits (`MAX_PACKET_SIZE = 2048` bytes).
  - Rate limiting per IP (`MAX_PACKETS_PER_SEC = 10`).
  - Automatic isolation of malformed packets and unknown device IMEI quarantine.

---

## 4. Database Configuration & Startup Validation

### 4.1 Configuration Resolution Hierarchy
The application resolves database connections via the standard abstraction:
1. `DATABASE_URL` (Full connection URI: `postgres://user:pass@host:5432/dbname?sslmode=require`)
2. `POSTGRES_URL` / `POSTGRESQL_URL` (Cloud platform aliases)
3. Discrete connection parameters:
   - `PGHOST` or `SQL_HOST`
   - `PGDATABASE` or `SQL_DB_NAME`
   - `PGUSER` or `SQL_USER`
   - `PGPASSWORD` or `SQL_PASSWORD`
   - `PGPORT` or `SQL_PORT` (Default: 5432)

### 4.2 Fail-Closed Production Startup
When `NODE_ENV === 'production'`:
- The central validator `validateServerConfig()` strictly enforces that `DATABASE_URL` or discrete parameters are present.
- If missing or using an empty password over TCP, the process halts immediately with `PRODUCTION_CONFIG_FATAL`.
- **Zero Mock Fallback:** Under no circumstances does production startup fall back to simulated in-memory storage or generate fake user accounts.
- **Vercel Constraint:** If running in a Vercel serverless environment (`VERCEL=1`), attempting to start embedded TCP telemetry is blocked with an explicit error.

---

## 5. Database Migration Runbook

All database DDL is organized into deterministic, versioned migrations in `src/server/db/migrations/`:
- `001_core_schema.sql`: Extensions, system roles, permissions, schools, persons, users, sessions.
- `002_learners_and_guardians.sql`: Learners, enrolments, academic records, guardians, legal custody relationships.
- `003_devices_and_telemetry.sql`: Hardware devices, asset assignments, maintenance logs, authoritative telemetry.
- `004_incidents_and_tactical.sql`: Responders, incidents, incident events, dispatches, responder assignments.
- `005_audit_and_safety_ops.sql`: Cryptographic audit events, notifications, safety events, operational indexes.

### Initializing an Empty Production Database
To bring up a brand new, empty PostgreSQL instance:
```bash
# 1. Set environment variable to target PostgreSQL instance
export DATABASE_URL="postgres://itis_admin:StrongPassword@postgres.prod.internal:5432/itis_production?sslmode=require"

# 2. Check pending migration status
npm run db:status

# 3. Apply versioned migrations in transaction
npm run db:migrate

# 4. Verify system readiness
npm run test:production
```

---

## 6. Observability & Sensitive Data Sanitization

- **Request Correlation:** All incoming requests are stamped with a unique `X-Correlation-ID` header, enabling end-to-end trace correlation between Command Centre actions and database transactions.
- **Automatic PII & Credential Masking:** The centralized production logger (`src/server/logger.ts`) automatically intercepts and sanitizes:
  - Passwords and password hashes
  - Session tokens and Bearer headers
  - TOTP MFA secrets and backup recovery codes
  - Database connection strings containing passwords
  - Unnecessary child identifying biometric details
- **Health Probes:**
  - Liveness: `/api/health/liveness` returns 200 ALIVE without querying database.
  - Readiness: `/api/health/readiness` verifies database reachability without leaking internal paths or credentials.
