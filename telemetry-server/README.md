# ITIS Dedicated GPS Telemetry Server

Independent, deployment-ready GPS Telemetry Server package for the **Integrated Transport & Information System (ITIS) Guardian Network**.

This package provides persistent, streaming tracker connectivity over TCP and UDP protocols while reusing the authoritative `TelemetryGatewayEngine` pipeline without duplicating business logic.

---

## 1. Package Architecture

```
telemetry-server/
├── .env.example                  # Safe configuration documentation (no secrets)
├── Dockerfile                    # Multi-stage production container build (non-root)
├── docker-compose.example.yml    # Reference compose file for VPS / Dedicated VM
├── package.json                  # Standalone package dependencies and scripts
├── tsconfig.json                 # TypeScript build configuration
├── README.md                     # Architecture and operational documentation
└── src/
    ├── index.ts                  # Master runtime entry point
    ├── config/
    │   └── serverConfig.ts       # Network ports & hardened boundary limits
    ├── transport/
    │   ├── tcpAdapter.ts         # Persistent TCP streaming adapter
    │   ├── udpAdapter.ts         # Controlled UDP datagram adapter
    │   └── types.ts              # Transport definitions & metric counters
    ├── connection/
    │   └── connectionManager.ts  # Connection lifecycle, idle timeouts, device map
    ├── security/
    │   └── securityIsolation.ts  # Rate limits, packet size guards, quarantine log
    ├── protocols/
    │   └── protocolAdapter.ts    # Streaming framing slicer (GT012, ASCII, JSON)
    ├── gateway/
    │   └── telemetryGatewayBridge.ts # Direct authoritative TelemetryGatewayEngine bridge
    ├── health/
    │   └── healthServer.ts       # Safe HTTP status endpoint (zero credentials)
    ├── lifecycle/
    │   └── shutdownManager.ts    # Graceful shutdown (SIGTERM/SIGINT) coordinator
    └── tests/
        └── acceptanceTests.ts    # 9-point automated acceptance suite
```

---

## 2. Ports & Network Configuration

All default ports are unprivileged:

| Service | Protocol | Default Port | Description |
| :--- | :--- | :--- | :--- |
| **Tracker Stream** | TCP | `5023` | Persistent socket connection for GPS trackers (Concox GT012, etc.) |
| **Tracker Datagram** | UDP | `5024` | Low-overhead UDP telemetry ingestion |
| **Health & Diagnostics** | HTTP | `8092` | Internal sanitized health probe (`/health`, `/diagnostics`) |

---

## 3. Security & Boundary Controls

1. **Connection Limits**: Rejects socket attempts when active connections reach `MAX_CONNECTIONS` (default: 500).
2. **Packet Size Enforcement**: Drops/isolates any packet frame exceeding `MAX_PACKET_SIZE_BYTES` (default: 2048 bytes).
3. **Sliding Window Rate Limiter**: Caps inbound rate to `RATE_LIMIT_PACKETS_PER_SEC` (default: 10/sec per IP/connection).
4. **Idle Timeout**: Automatically evicts and closes inactive sockets silent for longer than `IDLE_TIMEOUT_MS` (default: 180s).
5. **Zero-Crash Quarantine**: Malformed frames (bad CRC, framing errors) are isolated into a ring buffer without throwing or crashing the daemon.
6. **Authoritative Ingestion Pipeline**: Every packet passes full framing validation, CRC verification, device registry validation, lifecycle verification, and physical speed/geofence checks.
7. **Downlink ACK Specificity**: GT012 trackers receive authoritative 10-byte binary ACKs; ASCII trackers receive `*ACK` responses; JSON receives JSON acknowledgments.

---

## 4. Local Development & Testing

Run all 9 acceptance criteria:

```bash
npm run test --prefix telemetry-server
```

Or execute directly with tsx:

```bash
npx tsx telemetry-server/src/tests/acceptanceTests.ts
```

Start the runtime daemon locally:

```bash
npx tsx telemetry-server/src/index.ts
```

---

## 5. Docker Deployment

### Building the image:
```bash
docker build -t itis/telemetry-server:1.0.0 telemetry-server/
```

### Running with Docker Compose:
```bash
docker compose -f telemetry-server/docker-compose.example.yml up -d
```

### Health Check:
```bash
curl http://localhost:8092/health
```

Sample sanitized response:
```json
{
  "status": "HEALTHY",
  "runtimeState": "RUNNING",
  "uptimeSeconds": 120,
  "connections": {
    "active": 4,
    "peak": 12,
    "maxAllowed": 500
  },
  "packets": {
    "total": 542,
    "accepted": 540,
    "rejected": 2,
    "quarantined": 1
  },
  "security": {
    "limitsEnforced": true,
    "zeroSecretsExposed": true
  }
}
```
