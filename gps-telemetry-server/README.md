# ITIS GPS Telemetry Ingestion Server

**Authoritative, Modular, and Independent GPS Telemetry Infrastructure for the ITIS Guardian Network.**

---

## 1. What the ITIS GPS Telemetry Server Does

The **ITIS GPS Telemetry Server** is an independent, high-throughput network service designed to securely ingest, validate, decode, deduplicate, and normalize telemetry streams from physical GPS tracking devices (such as learner wearable trackers, smart tags, and vehicle beacons).

Key operational capabilities:
- **Multi-Transport Socket Ingestion:** Concurrently listens on raw **TCP** sockets (for persistent tracker sessions), **UDP** datagrams (for low-power reporting), and **HTTP/REST** endpoints (for webhooks and simulator streams).
- **Binary & ASCII Protocol Decoding:** Inspects incoming byte packets, decodes vendor-specific framing (e.g., GT012 binary protocol with CRC-ITU verification and login handshakes), and maps them to normalized telemetry objects.
- **Strict Anti-Fabrication Engine:** Adheres to zero-fabrication safety rules. Fields not provided by hardware (such as altitude, accuracy, or battery) remain strictly `undefined` or `null` rather than mocked.
- **Hardware Device Authentication:** Validates tracker IMEI and serial numbers against the authoritative device registry, enforcing lifecycle states (`ACTIVE`, `SUSPENDED`, `RETIRED`).
- **Deduplication & Emergency Escalation:** Correlates repeated distress/SOS packets within a sliding time window to prevent duplicate incident creation, automatically routing verified hardware distress signals into the central Command Centre unassigned queue.
- **Decoupled Architecture:** Runs completely standalone without requiring cloud accounts, external databases, or paid infrastructure during development.

---

## 2. Architecture

```
                                 PHYSICAL GPS TRACKERS / SIMULATORS
                                      │            │             │
                             TCP 5000 │   UDP 5001 │   HTTP 8080 │
                                      ▼            ▼             ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          NETWORK INGESTION & CONNECTION GUARD           │
                     │  - Max concurrent sockets (ConnectionGuard)             │
                     │  - Rate limiting per IP (IngestionRateLimiter)          │
                     │  - Idle connection sweeper (5-min timeout)              │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ Raw Packet Buffer
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          PROTOCOL REGISTRATION & IDENTIFICATION         │
                     │  - Magic byte / Header inspection                       │
                     │  - Checksum validation (CRC-ITU, XOR, etc.)             │
                     │  - Pluggable Protocol Registry (GT012, Simulator, etc.) │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ Decoded Packet
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │          DEVICE AUTHENTICATION & SESSION CACHE          │
                     │  - IMEI / Serial lookup against Device Registry         │
                     │  - State check: ACTIVE allowed; SUSPENDED/RETIRED dropped│
                     │  - Learner & School association resolution              │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ Validated Identity
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │           NORMALIZATION & SANITIZATION PIPELINE         │
                     │  - Latitude [-90, +90], Longitude [-180, +180] bounds  │
                     │  - Speed jump & tele-portation anomaly filter           │
                     │  - Circular / Polygon geofence evaluation               │
                     │  - Technical alarms & battery threshold evaluator       │
                     └────────────────────────────┬────────────────────────────┘
                                                  │ Normalized TelemetryEvent
                                                  ▼
                     ┌─────────────────────────────────────────────────────────┐
                     │           SOS DEDUPLICATION & EMERGENCY PIPELINE        │
                     │  - Evaluates active incidents for device/learner        │
                     │  - Retransmitted packets append breadcrumbs to incident │
                     │  - First-time activations route to Unassigned Queue     │
                     │  - Pluggable Guardian Notification Dispatch             │
                     └────────────────────────────┬────────────────────────────┘
                                                  │
                                 ┌────────────────┴────────────────┐
                                 ▼                                 ▼
                     ┌───────────────────────┐         ┌───────────────────────┐
                     │    STORAGE ADAPTER    │         │  ITIS CORE DISPATCH   │
                     │  - Memory Repository  │         │  - HTTP Webhook Push  │
                     │  - PostgreSQL Pool    │         │  - Command Centre API │
                     └───────────────────────┘         └───────────────────────┘
```

---

## 3. Local Development

The server is built with Node.js and TypeScript, supporting zero-dependency execution out of the box using in-memory repositories.

### Supported Platforms
- **Windows:** Native Command Prompt, PowerShell, or Windows Subsystem for Linux (WSL2).
- **Linux:** Any modern distribution (Debian, Ubuntu, Arch, Fedora, Alpine).
- **macOS:** Apple Silicon and Intel environments.
- **Docker:** Any container runtime (Docker Desktop, Podman, Rancher Desktop).

### Prerequisites
- Node.js 20.x or 22.x LTS
- npm 9.x or higher
- (Optional) Docker and Docker Compose (if testing containerized PostgreSQL)

### Quick Start (Memory Mode — Zero Dependencies)

1. **Enter Directory:**
   ```bash
   cd gps-telemetry-server
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create `.env` from the provided `.env.example`:
   ```bash
   cp .env.example .env
   ```
   *(By default, `TELEMETRY_STORAGE_MODE=memory` is used, requiring no database).*

4. **Launch Development Server:**
   ```bash
   npm run dev
   ```
   *The server will boot with active listeners on:*
   - HTTP Health & REST API: `http://localhost:8080`
   - TCP Tracker Listener: `0.0.0.0:5000`
   - UDP Tracker Listener: `0.0.0.0:5001`

5. **Run Integration Test Suite:**
   ```bash
   npm test
   ```
   *Executes all 8 comprehensive integration suites (GT012 protocol decoding, device registry, telemetry pipeline, emergency SOS deduplication, geofence, and alerts).*

---

## 4. Simulator Usage

The repository includes a built-in multi-device GPS telemetry and SOS hardware simulator (`src/simulator/deviceSimulator.ts`).

### Running the Simulator
In a separate terminal window, execute:
```bash
npm run simulate
```

### Simulator Behavior
- Simulates realistic pedestrian and transit routes in Tshwane / Pretoria around schools and transit corridors.
- Transmits periodic JSON or GT012 binary telemetry frames to `http://localhost:8080/api/v1/telemetry/ingest` or directly over TCP `localhost:5000`.
- Intermittently generates test geofence boundary exits and SOS panic signals to verify downstream emergency escalation.

### Environment Simulator Flags
In `.env`:
```env
ENABLE_DEV_SIMULATOR=true
SIMULATOR_DEVICE_COUNT=5
SIMULATOR_INTERVAL_MS=5000
```

---

## 5. Protocol Adapter Architecture

Hardware trackers vary widely in packet formats (binary, ASCII, hexadecimal). The server uses a strict **Adapter Pattern** defined by the `IDeviceProtocol` interface:

```typescript
export interface IDeviceProtocol<TPacket = unknown> {
  readonly protocolName: string;
  readonly defaultPort?: number;
  matches(packet: RawNetworkPacket): boolean;
  decode(packet: RawNetworkPacket): Promise<DecodedPacketResult<TPacket>>;
  normalize(decoded: DecodedPacketResult<TPacket>): TelemetryEvent;
  encodeAck?(command: DownstreamCommand, originalPacket?: DecodedPacketResult<TPacket>): Promise<Buffer | null>;
}
```

### Included Protocols:
1. **GT012 Tracker Protocol (`TrackerProtocolAdapter`):**
   - Binary framing with packet start flags (`0x78 0x78`), length byte, protocol numbers (`0x01` Login, `0x22` GPS Positioning, `0x13` Heartbeat/Status, `0x26` Alarm/SOS).
   - Validates 16-bit CRC-ITU checksums.
   - Generates authoritative 10-byte ACK responses to keep hardware sockets active.
2. **Simulated Protocol (`SimulatedTestProtocol`):**
   - JSON-encoded payload parser for testing, simulations, and third-party webhook relays.

### Adding a New Tracker Hardware Protocol:
1. Create `src/protocol/myVendorProtocol.ts` implementing `IDeviceProtocol`.
2. Register the class in `src/protocol/protocolRegistry.ts`:
   ```typescript
   this.register(new MyVendorProtocol());
   ```
3. No other changes to the ingestion server, database, or emergency pipeline are required.

---

## 6. PostgreSQL Configuration

When deploying for production, switch from in-memory mode to a dedicated PostgreSQL database.

### 1. Update Environment Variables
In your production `.env` file:
```env
TELEMETRY_STORAGE_MODE=postgresql

# Direct Connection String (Recommended for Cloud / Docker):
DATABASE_URL=postgresql://telemetry_svc:your_secure_password@localhost:5432/itis_telemetry

# OR Individual Parameters:
TELEMETRY_DB_HOST=localhost
TELEMETRY_DB_PORT=5432
TELEMETRY_DB_NAME=itis_telemetry
TELEMETRY_DB_USER=telemetry_svc
TELEMETRY_DB_PASSWORD=your_secure_password
TELEMETRY_DB_SSL=false
TELEMETRY_DB_POOL_MAX=25
```

### 2. Database Schema
When `TELEMETRY_STORAGE_MODE=postgresql` is activated, `PostgresTelemetryRepository` and `PostgresDeviceRepository` automatically create and index the required tables if they do not exist:
- `telemetry_devices`: Hardware inventory, device IMEI, registration status, assigned learner ID.
- `telemetry_events`: Time-series GPS coordinate breadcrumbs, speed, battery, GSM signal, alarm flags.
- `telemetry_alerts`: Critical alarms, geofence breaches, and SOS panic activations.

### Indexing & Optimization:
```sql
CREATE INDEX IF NOT EXISTS idx_telemetry_events_dev_time ON telemetry_events(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_events_alarm ON telemetry_events(alarm_type) WHERE alarm_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_telemetry_alerts_unresolved ON telemetry_alerts(status) WHERE status != 'RESOLVED';
```

---

## 7. Docker Deployment

A multi-stage `Dockerfile` and `docker-compose.yml` are provided in the repository for turnkey, reproducible deployments.

### Multi-Stage Dockerfile Highlights:
- **Build Stage:** Compiles TypeScript into `/app/dist` and prunes development dependencies.
- **Runtime Stage:** Runs on `node:20-alpine` as an unprivileged `node` user for defense-in-depth container security.
- **Health Check:** Includes automated `HEALTHCHECK` against `GET http://localhost:8080/health`.

### Running with Docker Compose:
```bash
docker compose up -d --build
```
This boots:
1. `itis-telemetry-server`: Exposing ports `8080` (HTTP), `5000` (TCP), and `5001` (UDP).
2. `itis-telemetry-db`: PostgreSQL 16 Alpine container with isolated network bridge and persistent volume `telemetry_pgdata`.

### Checking Health & Logs:
```bash
# Check service health status
docker compose ps

# View live telemetry ingestion logs
docker compose logs -f telemetry-server
```

---

## 8. Ubuntu Server / Dedicated VPS Deployment

For production deployments on an Ubuntu 22.04 / 24.04 LTS server:

### Step 1: System Provisioning & Node.js Setup
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl ufw git postgresql postgresql-contrib

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### Step 2: Configure Dedicated System User
```bash
sudo useradd -r -s /bin/false -d /opt/itis-telemetry itis-telemetry
sudo mkdir -p /opt/itis-telemetry
sudo chown -R itis-telemetry:itis-telemetry /opt/itis-telemetry
```

### Step 3: Deploy Application Code
```bash
cd /opt/itis-telemetry
# Deploy or clone repository
npm install --omit=dev
npm run build
```

### Step 4: Systemd Service Configuration
Create `/etc/systemd/system/itis-telemetry.service`:
```ini
[Unit]
Description=ITIS GPS Telemetry Ingestion Server
After=network.target postgresql.service

[Service]
Type=simple
User=itis-telemetry
Group=itis-telemetry
WorkingDirectory=/opt/itis-telemetry
EnvironmentFile=/opt/itis-telemetry/.env
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=5
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl daemon-reload
sudo systemctl enable itis-telemetry
sudo systemctl start itis-telemetry
sudo systemctl status itis-telemetry
```

### Step 5: Nginx Reverse Proxy for HTTPS (Administrative APIs)
Install Nginx and configure SSL (Certbot / Let's Encrypt) to proxy administrative traffic:
```nginx
server {
    server_name telemetry-api.itis.gov.za;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*Note: Hardware trackers connect directly to TCP port 5000 / UDP port 5001 (bypassing HTTP reverse proxies).*

---

## 9. Future Deployment Options & Hosting Compatibility

The ITIS GPS Telemetry Server can be deployed across a wide spectrum of environments:

1. **Self-Hosted Ubuntu VPS / Dedicated Server (Recommended Initial Step):**
   - Cost-effective (Hetzner, OVH, Linode, DigitalOcean, local South African data centers).
   - Full kernel access for raw TCP/UDP socket listeners and custom firewall configuration.
2. **Cloud Virtual Machines (GCP Compute Engine / AWS EC2 / Azure VM):**
   - Deploy as containerized workload or systemd service behind a Network Load Balancer (Layer 4 TCP/UDP passthrough).
3. **Container Orchestration (Kubernetes / GKE / AWS EKS):**
   - Deploy with `Service` type `LoadBalancer` using TCP and UDP protocol ports.

### Why Serverless Hosting (e.g. Vercel) is Incompatible for Raw GPS Telemetry
> **CRITICAL ARCHITECTURAL DISTINCTION:**
> Traditional serverless application platforms (like Vercel, AWS Lambda, or Netlify) are designed exclusively for stateless, short-lived HTTP request-response transactions. 
> 
> **GPS Trackers require persistent, stateful Layer 4 network connections:**
> - Embedded tracker microcontrollers establish persistent TCP sockets that remain connected for days, periodically sending 10-byte to 50-byte keepalive packets.
> - Trackers expect synchronous sub-second binary ACKs (such as the GT012 10-byte response).
> - Serverless platforms enforce aggressive execution timeouts (10 to 60 seconds), scale to zero when idle, and **do not permit arbitrary raw TCP or UDP port binding**.
> 
> Therefore, the GPS Telemetry Ingestion Server must run on persistent compute infrastructure (VPS, bare-metal server, or container runtime).

---

## 10. Security Requirements & Operational Governance

### 1. Firewall Configuration (UFW / Cloud Security Groups)
Restrict network ingress to only necessary ports:
```bash
# Allow SSH management
sudo ufw allow 22/tcp

# Allow Tracker Hardware Ingestion
sudo ufw allow 5000/tcp comment 'GPS Tracker TCP Ingest'
sudo ufw allow 5001/udp comment 'GPS Tracker UDP Ingest'

# Allow HTTPS (via Nginx reverse proxy)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct external access to internal ports
sudo ufw deny 8080/tcp comment 'Block direct HTTP access'
sudo ufw deny 5432/tcp comment 'Block direct PostgreSQL access'

sudo ufw enable
```

### 2. Device Authentication & Spoofing Prevention
- Inbound telemetry packets must present an IMEI registered with status `ACTIVE` in the Device Registry.
- Unregistered, suspended, or retired devices are immediately rejected and dropped at the authentication layer before reaching the business logic or database.
- Packet sizes exceeding `MAX_PACKET_SIZE_BYTES` (2048 bytes) are dropped instantly to prevent buffer-overflow attacks.

### 3. API & Upstream Authentication
- Administrative API endpoints (`/api/v1/telemetry/*`) require the `x-telemetry-api-key` header matching `ITIS_TELEMETRY_API_KEY`.
- Rate limiting enforces a maximum of 60 packets per minute per source IP (`RATE_LIMIT_MAX_PACKETS_PER_MINUTE`).

### 4. Database Security & Backup Strategy
- **Least Privilege:** The database user (`telemetry_svc`) only possesses CRUD privileges on `itis_telemetry` tables and cannot modify database roles or other schemas.
- **Automated Backup Strategy:**
  ```bash
  # Daily encrypted database dump
  pg_dump -U telemetry_svc -d itis_telemetry -Fc | gpg -c --passphrase "$BACKUP_PASSPHRASE" > /backups/telemetry_$(date +%Y%m%d).dump.gpg
  ```
- **Backup Retention:** Maintain 7 daily, 4 weekly, and 12 monthly encrypted snapshots off-site.

### 5. Monitoring & Log Rotation
- **Health Probing:** Configure external uptime monitors or systemd watchdogs against `GET http://localhost:8080/health`.
- **Log Rotation (`/etc/logrotate.d/itis-telemetry`):**
  ```
  /var/log/itis-telemetry/*.log {
      daily
      missingok
      rotate 14
      compress
      delaycompress
      notifempty
      create 0640 itis-telemetry itis-telemetry
  }
  ```
