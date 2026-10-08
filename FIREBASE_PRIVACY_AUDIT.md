# ITIS Guardian Network — Child Privacy & Location Data Audit

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Scope:** Technical evaluation of access controls governing sensitive learner, guardian, location, and incident information across both PostgreSQL/Express APIs and Firestore.

---

## 1. Technical Data Access Matrix

| Data Category | Authoritative Access (PostgreSQL / Express API) | Direct Firestore Access (`firestore.rules`) | Technical Risk / Exposure |
| :--- | :--- | :--- | :--- |
| **Learner Location (GPS Real-time)** | Linked Guardians (`isGuardianLinkedToLearner`), Enrolled School Staff, Assigned Responders, Command Operators via `/api/telemetry/*` | None currently defined in rules (not stored in Firestore) | Safe in Express; risk if telemetry is pushed to Firestore without ABAC |
| **Learner Geofence Boundaries** | Enrolled School Staff & Command Operators via `/api/schools/:id` | Readable if School doc is read | Open to any signed-in user via `/schools/{id}` in Firestore |
| **Incident Emergency Location** | Assigned Responders, Command Operators, Linked Guardians via `/api/incidents/*` | **ALL signed-in Firebase users** via `/incidents/{id}` | **CRITICAL EXPOSURE**: Direct Firestore query returns distress GPS coordinates |
| **Learner Identification (Name, EMIS, ID)** | Linked Guardians, Enrolled School Staff, Command Operators | **ALL signed-in Firebase users** via `/learners/{id}` | **CRITICAL EXPOSURE**: Any signed-in user can list full student registry |
| **Medical & Allergy Details** | Enrolled School Staff, Linked Guardians, Assigned Medical Responders | Masked in standard learner profile; detailed records stored in PostgreSQL | Protected in PostgreSQL; omitted from Firestore schema |
| **Guardian Contact & Identity Info** | Linked School Staff, Verified Guardians (own profile only) | User profile readable only by self or admin (`/users/{uid}`) | Protected in Firestore users collection |
| **Beacon / Hardware Tracker IDs** | Technicians (PII masked), School Administrators, Guardians | **ALL signed-in Firebase users** via `/learners/{id}` | Tracking beacon serials exposed via Firestore learner document |

---

## 2. Who Can Access Each Category? (Technical Trace)

### Category A: Learner Identification & Beacon IDs
- **Through Express API:** Access is mediated through `GET /api/learners`.
  - Founders: Full national directory.
  - System Admins: Full operational directory.
  - School Principals: Filtered strictly to learners with `school_id == req.user.schoolId`.
  - Parents/Guardians: Filtered strictly to children linked in `guardian_learner_relationships`.
- **Through Firestore:** Access is governed by `firestore.rules` line 149–153:
  ```javascript
  match /learners/{learnerId} {
    allow get: if isSignedIn() && isValidId(learnerId);
    allow list: if isSignedIn();
  }
  ```
  **Finding:** Any user authenticated with Google can call `getDocs(collection(db, 'learners'))` directly from client code and receive all learner records.

### Category B: Incident Emergency SOS & GPS Coordinates
- **Through Express API:** Access is mediated through `GET /api/incidents`.
  - Command Operators & Founders: All active incidents.
  - Field Responders: Strictly incidents assigned to their unit (`assigned_responder_id`).
  - School Principals: Incidents linked to learners enrolled at their school.
  - Parents/Guardians: Incidents linked to their verified children.
- **Through Firestore:** Access is governed by `firestore.rules` line 168–171:
  ```javascript
  match /incidents/{incidentId} {
    allow get: if isSignedIn() && isValidId(incidentId);
    allow list: if isSignedIn();
  }
  ```
  **Finding:** Any authenticated Firebase user can query `/incidents` directly and retrieve real-time emergency incidents, distress descriptions, and coordinates.

---

## 3. Cross-User and Cross-School Exposure Analysis

1. **Cross-School Learner Exposure:**
   - In Express / PostgreSQL: **PROTECTED.** Institutional boundary enforcement (`isLearnerEnrolledInSchool`) prevents School A from browsing School B learners.
   - In Firestore: **EXPOSED.** No school scoping exists in `firestore.rules`.
2. **Cross-Guardian Learner Exposure:**
   - In Express / PostgreSQL: **PROTECTED.** ABAC rule (`isGuardianLinkedToLearner`) prevents Guardian A from accessing records for Learner B.
   - In Firestore: **EXPOSED.** `allow list: if isSignedIn();` permits any guardian to read all learners.
3. **Cross-Responder Tactical Exposure:**
   - In Express / PostgreSQL: **PROTECTED.** Tactical dispatch check (`isIncidentAssignedToResponder`) bars responders from browsing unassigned emergencies.
   - In Firestore: **EXPOSED.** Unassigned responders can query all incidents directly.

---

## 4. Separation of Technical Findings from Legal Conclusions

- **Technical Observation:** Direct client-side Firestore access rules allow read operations on learner identities and emergency incident coordinates for any authenticated Google user without relational ownership or institutional scoping.
- **Legal Compliance Boundary:** Whether this access model meets the statutory obligations of the Protection of Personal Information Act (POPIA Section 14 / Section 35 regarding personal information of children) or the South African Child Care Act is a legal and regulatory determination that must be reviewed by institutional legal counsel.
