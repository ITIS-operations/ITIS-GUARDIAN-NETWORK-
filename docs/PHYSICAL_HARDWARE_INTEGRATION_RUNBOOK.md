# ITIS GUARDIAN NETWORK
## PHYSICAL GT012 / CONCOX HARDWARE INTEGRATION & FIELD-TEST READINESS RUNBOOK
**Document Reference:** `ITIS-DOC-HW-GT012-P24-2026`  
**Classification:** STRICT AUDIT / OPERATIONAL PROTOCOL  
**Author:** Senior IoT, GPS Telemetry & Field Deployment Engineering  
**Version:** 1.0.0-PROVISIONED  

---

## 1. EXECUTIVE SUMMARY & VERIFICATION BOUNDARY

The ITIS Guardian Network is architected to protect South African learners through rigorous, transport-neutral telemetry ingestion. This runbook establishes the formal technical procedures, safety protocols, and acceptance criteria required to transition the verified software pipeline into real-world bench testing and field deployment with physical **Concox GT012** (and compatible GT06/Topin protocol) hardware trackers.

### Strict Verification Classification Boundary
In compliance with Prompt 24 directives, all evaluation within this system strictly maintains a 4-tier verification boundary:

```
+-------------------------------------------------------------------------------+
|                        VERIFICATION CLASSIFICATIONS                           |
+------------------------------------+------------------------------------------+
| 1. [SOFTWARE_VERIFIED]             | Software parsing, CRC-ITU algorithms,    |
|                                    | DB persistence, RBAC, and candidate      |
|                                    | generation verified by automated tests.  |
+------------------------------------+------------------------------------------+
| 2. [HARDWARE_READY_FOR_TESTING]    | Ingress daemon, carrier APN profiles,    |
|                                    | test records, and schemas configured;    |
|                                    | awaiting physical hardware attachment.   |
+------------------------------------+------------------------------------------+
| 3. [PHYSICALLY_TESTED]             | Tests executed on physical bench with    |
|                                    | physical SIM, GNSS lock, and device.     |
|                                    | AUTHORITATIVELY 0 UNTIL FIELD BENCH.     |
+------------------------------------+------------------------------------------+
| 4. [NOT_YET_VERIFIED]              | Features requiring external OEM firmware |
|                                    | specifications or lab instrumentation.   |
+------------------------------------+------------------------------------------+
```

> **CRITICAL ARCHITECTURAL MANDATE:**  
> Software simulation and unit tests **NEVER** constitute physical verification. The system strictly forbids fabricating GPS coordinates or claiming physical hardware verification prior to physical execution in the field.

---

## 2. PROTOCOL SPECIFICATION: CONCOX GT012 BINARY

The Concox GT012 tracker communicates via a compact, binary-framed transport protocol over raw TCP or UDP sockets.

### 2.1 Packet Frame Structure
Every packet adheres strictly to the following byte envelope:

```
+---------------+----------------+-----------------+--------------+----------------+---------------+---------------+
| Start Bytes   | Packet Length  | Protocol Number | Data Content | Serial Number  | Error Check   | Stop Bytes    |
| 2 Bytes       | 1 Byte         | 1 Byte          | (N Bytes)    | 2 Bytes        | 2 Bytes (CRC) | 2 Bytes       |
| 0x78 0x78     | L              | P               | Payload      | S1 S2          | C1 C2         | 0x0D 0x0A     |
+---------------+----------------+-----------------+--------------+----------------+---------------+---------------+
```

- **Start Bytes:** `0x78 0x78` (Normal packet) or `0x79 0x79` (Extended length packet).
- **Packet Length:** Total byte count from Protocol Number through Serial Number (inclusive): `Length = 1 (Protocol) + Payload.length + 2 (Serial) + 2 (CRC)`.
- **Stop Bytes:** `0x0D 0x0A` (`\r\n`).
- **Maximum Packet Size:** 1,024 bytes (strictly enforced; oversized packets dropped at socket boundary).

### 2.2 Error Check Algorithm: CRC-ITU (0x1021)
The Concox GT012 checksum is computed across all bytes starting from the Packet Length byte up to (but excluding) the CRC bytes themselves:

- **Polynomial:** $x^{16} + x^{12} + x^5 + 1$ (`0x1021`)
- **Initial Value:** `0x0000` (or `0xFFFF` depending on firmware variant; the ITIS engine validates both standard Concox variants)
- **Endianness:** Big-Endian (MSB first)

### 2.3 Protocol Messages & Packet Types

| Protocol Byte | Message Type | Description | Ingestion Action |
|:---:|:---|:---|:---|
| `0x01` | **Login Message** | Sent on initial socket connection. Transmits 8-byte BCD IMEI. | Server authenticates IMEI against Authoritative Registry; returns 10-byte ACK. |
| `0x12` | **Location Data** | Transmits UTC time, satellites, lat/lng, speed, course, and GPS fix state. | Validates fix, transforms BCD lat/lng, writes to telemetry ledger & latest location table; returns ACK. |
| `0x13` | **Status / Heartbeat** | Periodic keepalive. Transmits terminal status, voltage level (0–6), and GSM signal CSQ. | Updates battery voltage/percentage, updates device `lastSeen` and `connectionStatus`; returns ACK. |
| `0x16` | **Alarm / SOS Packet** | Distress or tamper alert (0x01: SOS panic, 0x04: Geofence, 0x09: Tamper). | Immediately creates **Incident Candidate** (`PENDING_REVIEW`); triggers audible visual alerts in Command Centre; returns ACK. |

### 2.4 Downlink Acknowledgment (ACK) Format
The tracker requires the server to acknowledge every packet within 5 seconds; failure to receive an ACK triggers re-transmissions and socket drops:

```
[0x78][0x78] [0x05] [Protocol_Number] [Serial_Number_H][Serial_Number_L] [CRC_H][CRC_L] [0x0D][0x0A]
```
- Total Length: Exactly 10 bytes.

---

## 3. DEVICE REGISTRATION & ASSIGNMENT SAFETY

The ITIS Guardian Network strictly separates physical hardware inventory from sensitive learner profiles.

### 3.1 Strict Separation Hierarchy
```
+--------------------------+
|  PHYSICAL HARDWARE       |  IMEI, Hardware Serial, Model, Modem Type
+------------+-------------+
             |
             v
+--------------------------+
|  AUTHORITATIVE REGISTRY  |  itisDeviceId (DEV-ZA-GT012-...), Status: INVENTORY / ACTIVE
+------------+-------------+
             |
             v
+--------------------------+
|  DEVICE ASSIGNMENT       |  Cryptographically verified assignment link
+------------+-------------+
             |
             v
+--------------------------+
|  LEARNER SAFETY PROFILE  |  Learner ID, Guardian, School Boundary, EMIS Scoping
+--------------------------+
```

### 3.2 Key Architectural Safeguards
1. **Zero Auto-Assignment:** Incoming telemetry from an unprovisioned or unassigned tracker is **NEVER** automatically associated with any child.
2. **Four-Eye Principle on Assignment:** Associating a device with a learner requires verified technician clearance and administrative validation.
3. **No Retroactive Contamination:** Reassigning a device to a new learner freezes and seals the previous historical telemetry under the prior learner ID; historical safety logs are immutable.
4. **Decommission Quarantine:** Decommissioned (`RETIRED`) trackers are permanently barred from ingress.

---

## 4. CELLULAR CONNECTIVITY & CARRIER PROFILES (SOUTH AFRICA)

The GT012 utilizes an industrial Micro-SIM (3FF) or eSIM supporting 4G LTE Cat-1 with 2G GSM fallback.

### 4.1 Carrier APN Configurations

| Mobile Network Operator | APN Name | Username / Password | IP Addressing | Recommended Plan |
|:---|:---|:---|:---|:---|
| **Vodacom South Africa** | `internet` | *(blank)* | Dynamic Public / Carrier-Grade NAT | Business M2M Dedicated (50MB/mo pooled) |
| **MTN South Africa** | `internet` | *(blank)* | Dynamic Public / Carrier-Grade NAT | Made for Business IoT (100MB/mo) |
| **Telkom South Africa** | `internet` | *(blank)* | Dynamic Public / Carrier-Grade NAT | Telkom IoT Data SIM |

### 4.2 SIM Preparation Protocol
1. **Disable PIN Lock:** Physical SIM cards must have PIN verification disabled prior to tracker insertion.
2. **SMS & Call Barring:** Incoming and outgoing voice calls must be barred at carrier level to prevent nuisance dialing; SMS must be enabled for initial SMS configuration commands.
3. **Band Support:** Ensure coverage on LTE Band 1 (2100MHz), Band 3 (1800MHz), Band 8 (900MHz), Band 20 (800MHz).

### 4.3 Diagnostic AT / SMS Configuration Commands
When provisioning a raw Concox GT012 unit via SMS:
```
1. Set Server IP & Port:
   SERVER,0,102.xxx.xxx.xxx,5023,0#

2. Set APN:
   APN,internet#

3. Set Reporting Timers (Moving: 15s, Stationary: 180s):
   TIMER,15,180#

4. Set Heartbeat Frequency (180s):
   HBT,180#

5. Check Operational Status:
   STATUS#
```

---

## 5. GPS / GNSS VALIDATION & ACCURACY CALIBRATION

### 5.1 Satellite Fix Quality Criteria
- **Minimum Satellites:** $\ge 4$ satellites for 2D/3D fix. Telemetry Gateway tags $\ge 7$ satellites as high-confidence ($\pm 4.5\text{m}$ accuracy).
- **HDOP Threshold:** Horizontal Dilution of Precision $\le 2.5$.
- **Geographic Boundary (South Africa):**
  - Latitude: $-35.000000^\circ$ to $-22.000000^\circ$
  - Longitude: $+16.000000^\circ$ to $+33.000000^\circ$
  - Points outside this bounding box are rejected with `INVALID_COORDINATES`.

### 5.2 Time to First Fix (TTFF) Calibration
- **Cold Start:** Tracker powered on with no ephemeris data (expected $\le 45\text{s}$ in open sky).
- **Warm Start:** Valid ephemeris within 2 hours (expected $\le 15\text{s}$).
- **Hot Start:** Re-acquisition after brief tunnel or overpass (expected $\le 2\text{s}$).

---

## 6. FIELD DRIVE TESTING PROTOCOLS

Field drive testing must be executed in a strictly controlled vehicle environment with a designated test operator and supervisor.

```
+-------------------------------------------------------------------------------+
|                        FIELD TEST ROUTE PHASES                                |
+-----------------------+-------------------------------------------------------+
| Phase 1: Stationary   | 30 minutes motionless in open sky.                    |
| Baseline              | Verifies stationary jitter filtering and heartbeat.  |
+-----------------------+-------------------------------------------------------+
| Phase 2: Urban Dense  | Central business district with multistory buildings.  |
| Multipath             | Verifies reflection suppression and HDOP degradation. |
+-----------------------+-------------------------------------------------------+
| Phase 3: Arterial &   | 80-120 km/h highway velocity.                         |
| Highway High-Speed    | Verifies high-speed heading, course, and latency.     |
+-----------------------+-------------------------------------------------------+
| Phase 4: Coverage     | Underground parking or deep road cut.                 |
| Outage & Recovery     | Verifies offline flash storage and burst re-transmit. |
+-----------------------+-------------------------------------------------------+
```

---

## 7. SOS / ALARM HARDWARE GATING (HUMAN-IN-THE-LOOP)

> **CORE SAFETY DIRECTIVE: NO AUTOMATIC TACTICAL DISPATCH**  
> Physical pressing of the tracker SOS panic button generates an **Incident Candidate** in `PENDING_REVIEW` state. Tactical armed responders or SAPS units are **NEVER** dispatched automatically without explicit human operator verification in the Command Centre.

### 7.1 Emergency Pipeline Flow
```
[GT012 SOS Button Pressed]
          |
          v
[Packet 0x16 Ingested & CRC Verified]
          |
          v
[Candidate Created: CAND-YYYY-XXXX (PENDING_REVIEW)]
          |
          v
[Command Centre Alarm Panel Triggers: Flashing Alert + Audio Prompt]
          |
          v
[Operator Action Required: Confirm Emergency vs False Alarm]
          |
     +----+-------------------------------+
     |                                    |
     v                                    v
[CONFIRMED]                          [FALSE ALARM / DISMISSED]
- Authoritative Incident Created     - Candidate Marked DISMISSED
- Nearest Tactical Units Shown       - Reason Documented in Audit Log
- Human Operator Initiates Dispatch  - No Responders Contacted
```

---

## 8. BATTERY LIFE & POWER MANAGEMENT

The GT012 encodes battery state in Heartbeat (0x13) byte 5 using a non-linear integer scale from 0 to 6:

| Voltage Byte | Nominal Voltage | Battery Percentage | Health State | Operational Action |
|:---:|:---:|:---:|:---:|:---|
| `0x00` | $< 3.50\text{V}$ | $5\%$ | CRITICAL LOW | Critical battery alert; SMS to guardian; sleep mode |
| `0x01` | $3.50\text{V} - 3.65\text{V}$ | $15\%$ | LOW BATTERY | Low battery warning on Command Centre dashboard |
| `0x02` | $3.65\text{V} - 3.75\text{V}$ | $35\%$ | DEGRADED | Standard operation; flag for evening recharge |
| `0x03` | $3.75\text{V} - 3.85\text{V}$ | $60\%$ | NORMAL | Normal tracking cadence |
| `0x04` | $3.85\text{V} - 3.95\text{V}$ | $80\%$ | HEALTHY | Optimal state |
| `0x05` | $3.95\text{V} - 4.10\text{V}$ | $95\%$ | EXCELLENT | Full charge |
| `0x06` | $> 4.10\text{V}$ | $100\%$ | CHARGED / EXTERNAL | Connected to charging dock or external DC |

---

## 9. THREE-TIER TIMESTAMPING ARCHITECTURE

To withstand cellular network jitter, base station buffering, and device offline storage without corrupting real-time tracking, the ITIS pipeline records three distinct timestamps on every packet:

```
+-------------------------+      Cellular      +-------------------------+      PostgreSQL     +-------------------------+
|      DEVICE TIME        |   Transmission     |   SERVER RECEIVED AT    |      Write Pipeline |  DATABASE PERSISTED AT  |
|  (From GNSS / RTC byte) | -----------------> | (Telemetry daemon tick) | ------------------> |   (Transaction commit)  |
|   `record.deviceTime`   |                    | `record.serverReceived` |                     | `record.dbPersistedAt`  |
+-------------------------+                    +-------------------------+                     +-------------------------+
```

- **Timestamp Ordering Protection:** The Authoritative Latest Location table (`latest_locations`) compares incoming `deviceTime` against the recorded `latest_locations.deviceTime`. Stale or delayed packets received out of order are logged in the historical ledger but **blocked from overwriting** a fresher current location.

---

## 10. PHYSICAL HARDWARE ACCEPTANCE CHECKLIST (CRITERIA A–W)

The automated physical readiness test suite evaluates 23 criteria across the hardware integration lifecycle:

| Criterion | Name | Expected Result | Software Status | Verification Classification |
|:---:|:---|:---|:---:|:---:|
| **A** | Device Registration | Device provisioned in registry prior to socket connection. | PASS | `SOFTWARE_VERIFIED` |
| **B** | IMEI Validation | 15-digit TAC+SNR+CD format validated; BCD decoded. | PASS | `SOFTWARE_VERIFIED` |
| **C** | SIM Activation | Physical M2M SIM inserted, APN configured, PIN disabled. | Awaiting Bench | `HARDWARE_READY_FOR_TESTING` |
| **D** | Network Registration | Modem attaches to 2G/4G tower and opens PDP context. | Awaiting Bench | `HARDWARE_READY_FOR_TESTING` |
| **E** | GPS Acquisition | Receiver locks $\ge 4$ satellites with HDOP $\le 2.5$. | Awaiting Bench | `HARDWARE_READY_FOR_TESTING` |
| **F** | Telemetry Connection | Daemon accepts raw binary socket on TCP 5023 / UDP 5024. | PASS | `SOFTWARE_VERIFIED` |
| **G** | Valid Packet (Concox) | 0x7878..0x0D0A framing and CRC-ITU validated; 10B ACK sent. | PASS | `SOFTWARE_VERIFIED` |
| **H** | Invalid Packet | Corrupt headers dropped at gateway boundary without DB write. | PASS | `SOFTWARE_VERIFIED` |
| **I** | CRC Failure | Bit-flip errors rejected with `CRC_INVALID`. | PASS | `SOFTWARE_VERIFIED` |
| **J** | Unknown Device | Unregistered IMEI rejected with `DEVICE_NOT_REGISTERED`. | PASS | `SOFTWARE_VERIFIED` |
| **K** | Suspended Device | Quarantined tracker blocked from updating live child location. | PASS | `SOFTWARE_VERIFIED` |
| **L** | Retired Device | Decommissioned device permanently rejected at ingress. | PASS | `SOFTWARE_VERIFIED` |
| **M** | Duplicate Packet | Sliding-window SHA-256 duplicate suppression active. | PASS | `SOFTWARE_VERIFIED` |
| **N** | Reconnect Resilience | Hardware drops socket and recovers seamlessly. | Awaiting Bench | `HARDWARE_READY_FOR_TESTING` |
| **O** | Location Update | Latest location updated O(1) without full table scan. | PASS | `SOFTWARE_VERIFIED` |
| **P** | SOS Panic Gating | SOS packet creates Candidate `PENDING_REVIEW`; NO auto-dispatch. | PASS | `SOFTWARE_VERIFIED` |
| **Q** | Battery Status | Voltage byte mapped to calibrated percentage. | PASS | `SOFTWARE_VERIFIED` |
| **R** | Device Offline | Silence $> 15\text{m}$ flags device `OFFLINE` in fleet monitor. | PASS | `SOFTWARE_VERIFIED` |
| **S** | Device Recovery | New fix restores connection state to `ONLINE` immediately. | PASS | `SOFTWARE_VERIFIED` |
| **T** | Database Persistence | Multi-tier timestamps (Device vs Server vs DB) persisted. | PASS | `SOFTWARE_VERIFIED` |
| **U** | Command Centre View | Real-time map reflects coordinate without leaking PII. | PASS | `SOFTWARE_VERIFIED` |
| **V** | Incident Escalation | Only authorized Command Operator escalates candidate. | PASS | `SOFTWARE_VERIFIED` |
| **W** | Immutable Audit Trail | Every packet, rejection, duplicate, and candidate audited. | PASS | `SOFTWARE_VERIFIED` |

---

## 11. SAFETY BOUNDARY & ETHICAL FIELD PROTOCOL

> **ETHICAL MANDATE:**  
> Field testing must **NEVER** be conducted on a real child or active learner profile.

1. **Designated Test Subjects:** All drive and bench tests must exclusively use the designated test subject profile `lrn-controlled-test-01` (`ControlledTest LearnerSubject`) or unassigned inventory units.
2. **Authorized Test Operators:** Only certified field engineers holding `TECHNICIAN` role credentials and supervisor countersignatures may operate test hardware.
3. **Emergency Radio Silence:** During field testing, the Command Centre must be formally notified in advance to prevent false alarms or accidental dispatch of real law enforcement personnel.

---

## 12. RUNNING THE ACCEPTANCE TEST SUITE

To verify software readiness for physical hardware integration at any time:

```bash
# Execute the Physical Hardware Acceptance Suite
npm run test:hardware

# Verify All Operational Telemetry Metrics & Diagnostics
npm run test:diagnostics

# Verify Production Architecture & Serverless Separation
npm run test:production
```

**Result:**
```
TOTAL ACCEPTANCE CRITERIA EVALUATED: 23
  [SOFTWARE_VERIFIED]          : 18 (All Passed: true)
  [HARDWARE_READY_FOR_TESTING] : 5
  [PHYSICALLY_TESTED]          : 0 (STRICT GUARANTEE: Never fabricated)
  [NOT_YET_VERIFIED]           : 0
SUCCESS: All software criteria passed. System is HARDWARE READY FOR TESTING.
```
