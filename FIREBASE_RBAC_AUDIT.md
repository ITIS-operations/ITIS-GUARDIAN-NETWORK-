# ITIS Guardian Network — Firebase RBAC & Authorization Audit

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Scope:** Core authorization authority, role delegation, client data manipulation resistance, and role isolation audit.

---

## 1. Who Actually Authorizes Users?

### Question A: Does Firebase merely authenticate identity?
- **Finding:** **YES, with architectural flaws.**
- **Detail:** Firebase Authentication verifies the Google OAuth identity on the client. However, because `/api/auth/firebase-login` does not verify the Firebase ID token server-side, Firebase does not even effectively authenticate identity to the backend; the backend trusts the client's self-reported email string.

### Question B: Does ITIS independently determine user attributes?
- **Finding:** **YES in PostgreSQL; NO in Firestore.**
- **Detail:**
  - In PostgreSQL (`server.ts`), once an email is accepted, ITIS independently loads the user's role, account status, school affiliation, guardian link, and permissions from PostgreSQL `users` and `roles` tables.
  - In Firestore (`firestore.rules`), rules evaluate static schema constraints, but do not consult PostgreSQL.

### Question C: Can a Firebase user manipulate their own role?
- **Finding:**
  - **Via ITIS Express API:** Indirectly YES, through email spoofing. If an attacker inputs an existing administrator's email, the server binds that role. If creating a brand new account, the server hardcodes `PARENT_GUARDIAN` (or `FOUNDER_EXECUTIVE` if email is `bravomtho@gmail.com`).
  - **Via Firestore Directly:** YES. Under `firestore.rules`, an authenticated user creating their document at `/users/{uid}` can supply any role in `['PARENT_GUARDIAN', 'SCHOOL_PRINCIPAL', 'SCHOOL_ADMIN_STAFF', 'COMMAND_OPERATOR', 'FIELD_RESPONDER', 'TECHNICIAN', 'GOVERNMENT_AUDITOR']`. Only `SYSTEM_ADMIN` and `FOUNDER_EXECUTIVE` are blocked by the rule.

### Question D: Can a Firebase user manipulate their Firebase UID mapping?
- **Finding:** **IRRELEVANT TO BACKEND AUTHORIZATION.**
- **Detail:** The backend does not use Firebase UID for authorization. All permissions, sessions, and relationships are bound to the PostgreSQL `user_id` resolved via email.

### Question E: Can a Firebase user supply a different ITIS user ID?
- **Finding:** **NO in Express API; YES in Firestore.**
- **Detail:**
  - In Express, user ID is assigned from PostgreSQL and stored in the session record.
  - In Firestore, the user specifies their own document ID (`userId`).

### Question F: Can a Firebase user supply a different school ID?
- **Finding:**
  - In Express: Handled server-side from PostgreSQL `users.school_id`.
  - In Firestore: Under `firestore.rules` lines 130–135, a user updating `/users/{uid}` can modify their `schoolId` field directly.

### Question G: Can a Firebase user supply a different guardian ID?
- **Finding:**
  - In Express: Handled server-side from PostgreSQL `guardians` table.
  - In Firestore: Allowed under `affectedKeys().hasOnly(['name', 'phone', 'schoolId', 'guardianId', 'updatedAt'])`.

### Question H: Can a Firebase user supply a responder unit?
- **Finding:** **NO in Express API.** Responder units are queried strictly from PostgreSQL `users.responder_unit`.

### Question I: Can a Firebase user become privileged roles merely by changing client-side data?
- **Finding:**
  - **FOUNDER_EXECUTIVE:** YES, by sending `{"email": "bravomtho@gmail.com"}` or `{"email": "founder@itis365.co.za"}` in the POST payload to `/api/auth/firebase-login`.
  - **SYSTEM_ADMIN:** YES, by sending an existing system admin's email in the payload.
  - **SCHOOL_PRINCIPAL / RESPONDER:** YES, by sending that user's email in the payload.

---

## 2. Independent Role Isolation Audit

| Role | Authentication Method | Permitted Portal | Permitted Data Scope | Administrative Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **FOUNDER_EXECUTIVE** | Password / Token *(Compromised by Firebase bypass)* | Executive Audit & All Portals | National / Sovereign | Sole user creation, security policy modification, responder enrolment |
| **SYSTEM_ADMIN** | Password via PostgreSQL | Admin Portal | Operational entities (Schools, Learners, Guardians, Devices) | Operational registry updates; **currently can view all system users (VIOLATION)** |
| **COMMAND_OPERATOR** | Password via PostgreSQL | Command Centre | 24/7 National incidents, live telemetry, dispatch logs | Incident dispatch, prioritization, responder coordination |
| **SCHOOL_PRINCIPAL** | Password via PostgreSQL | School Portal | Assigned school only (`schoolId`) | Student enrolments, campus check-ins, school guardian contacts |
| **PARENT_GUARDIAN** | Password or Google Sign-In | Guardian Hub | Verified children only (`guardianId`) | View child telemetry, report emergency, update custody details |
| **FIELD_RESPONDER** | Password via PostgreSQL | Responder Tactical | Assigned incidents only | Accept dispatch, report on-scene arrival, resolve incident |
| **TECHNICIAN** | Password via PostgreSQL | Technician Portal | Fleet telemetry & hardware health | Diagnostics, maintenance logs, sensor calibration (PII masked) |
| **GOVERNMENT_AUDITOR**| Password via PostgreSQL | Executive Audit | Aggregated national metrics & audit trail | Read-only compliance review, DBE governance exports |

---

## 3. System Administrator User Visibility Compliance Check

- **Requirement:** *"SYSTEM ADMINISTRATOR DOES NOT NEED TO SEE THE LIST OF SYSTEM USERS. Do not change it. Only report whether the current implementation respects it."*
- **Audit Result:** **NON-COMPLIANT (VIOLATION).**
- **Evidence:** `server.ts` lines 786–797:
  ```typescript
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      if (user.role !== 'FOUNDER_EXECUTIVE' && user.role !== 'SYSTEM_ADMIN') {
        return res.status(403).json({ error: 'ACCESS DENIED: Insufficient clearance to list platform identities.' });
      }
      const users = await repository.users.findAll();
      res.json(users);
  ```
  The endpoint explicitly permits `SYSTEM_ADMIN` to retrieve the complete list of system users from PostgreSQL.

---

## 4. Firebase Admin Bootstrap Audit (`bravomtho@gmail.com`)

1. **Hardcoding:** The email `bravomtho@gmail.com` is explicitly hardcoded in:
   - `server.ts:454`
   - `src/components/AuthScreen.tsx:120`
   - `firestore.rules:30`
   - `DRAFT_firestore.rules:30`
   - `security_spec.md:5`
2. **Privilege Assignment:**
   - In `server.ts`, if `cleanEmail === 'bravomtho@gmail.com'`, the user is provisioned or upgraded to `FOUNDER_EXECUTIVE` with unrestricted governance permissions.
   - In `firestore.rules`, `request.auth.token.email == 'bravomtho@gmail.com' && request.auth.token.email_verified == true` grants `isAdmin()` status.
3. **Risks:**
   - Because `server.ts` does not cryptographically verify the Firebase ID token, any client can claim `email: "bravomtho@gmail.com"` and immediately acquire full sovereign Founder control.
