# Claims to Confirm: Regulatory, Accreditation, and Operational Review

This document isolates external, operational, legal, and partnership claims present across the user interface and platform documentation that require explicit stakeholder confirmation or verification.

---

## 1. Statutory & Government Affiliations
| Claim in Interface / Copy | Location / Context | Statutory Risk / Requirement | Verification Status |
| :--- | :--- | :--- | :--- |
| **"100% DHA & EMIS Linked"** | `SchoolPortal.tsx`, `LandingPage.tsx` | Implies direct live integration with the Department of Home Affairs (DHA) National Population Register and the Department of Basic Education (DBE) Education Management Information System (EMIS). | **Needs Owner Confirmation:** Confirm whether production operates an official API gateway to DHA/EMIS or whether records are validated institutionally by school clerks against verified documentation. |
| **"SAPS Tactical Responder Console / Immediate Armed Response Authorised"** | `ResponderView.tsx`, `AccessDenied.tsx` | Implies official South African Police Service (SAPS) dispatch authority or formal MOU. | **Needs Owner Confirmation:** Confirm whether formal SAPS provincial/national operational agreements are signed or whether this applies to private contracted security and CPF liaison units. |
| **"Department of Basic Education (DBE) National Pilot"** | `TrustSafetySection.tsx`, `ExecutiveGovernmentPortal.tsx` | References provincial and national government oversight mandates. | **Needs Owner Confirmation:** Confirm official pilot sign-off status with provincial education departments (e.g. GDE / WCED). |

---

## 2. Regulatory & Telecommunications Accreditations
| Claim in Interface / Copy | Location / Context | Regulatory Standard | Verification Status |
| :--- | :--- | :--- | :--- |
| **"ICASA Type-Approved Fleet Devices"** | `HardwareDiagnostics`, `TelemetryGatewayEngine` | Independent Communications Authority of South Africa (ICASA) Type Approval is mandatory for RF/GSM transmission hardware in South Africa. | **Needs Owner Confirmation:** Confirm ICASA Type Approval certificate numbers for Concox GT06/EV02, Queclink, and associated IoT beacons deployed in pilot schools. |
| **"POPIA Section 19 Certified Cryptographic Ledger"** | `TrustSafetySection.tsx`, `AdminPortal.tsx` | Protection of Personal Information Act (Act 4 of 2013). | **Needs Owner Confirmation:** Confirm statutory appointment and registration of the ITIS Information Officer with the Information Regulator of South Africa. |
| **"PSIRA Accreditation"** | `EnrolFirstResponderModal.tsx`, `ResponderView.tsx` | Private Security Industry Regulatory Authority (PSIRA) compliance for contracted private security responders. | **Needs Owner Confirmation:** Confirm that enrolled private security entities hold verified PSIRA business accreditation. |

---

## 3. SLA & Operational Telemetry Commitments
| Claim in Interface / Copy | Location / Context | Risk / Commitment | Verification Status |
| :--- | :--- | :--- | :--- |
| **"Sub-100ms GPS Ingestion at 50,000 Concurrent Concurrency"** | `TelemetryDiagnosticsDashboard.tsx`, `LandingPage.tsx` | Technical SLA claim for network latency and edge cluster capacity. | **Needs Owner Confirmation:** Confirm load-testing benchmark data supporting stated concurrency thresholds. |
| **"Guaranteed 3-Minute Rapid Response Corridor"** | `ResponderView.tsx`, `CommandCentre.tsx` | Operational response time expectation for active emergency incidents. | **Needs Owner Confirmation:** Soften to "Targeted rapid response radius" unless guaranteed under contractual security SLA. |
