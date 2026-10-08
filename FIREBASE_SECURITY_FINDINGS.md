# ITIS Guardian Network — Firebase Security Findings & Audit Report

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer & Cloud Security Auditor  
**Audit Scope:** Repository-wide inspection of Firebase configuration, Firestore security rules, authentication flows, `/api/auth/firebase-login`, and institutional RBAC/ABAC boundaries.  
**Mode:** AUDIT ONLY (Zero modifications executed).

---

## Executive Summary of Findings

| Severity | ID | Title | File Reference | Impact |
| :--- | :--- | :--- | :--- | :--- |
| **CRITICAL** | SEC-FB-01 | Unauthenticated Tokenless Account Takeover & Founder Escalation | `server.ts:443-553` | Total authentication bypass via arbitrary email in request body |
| **CRITICAL** | SEC-FB-02 | Direct Firestore Read Grants Blanket Learner PII & Incident Access | `firestore.rules:149-183` | Any Google-authenticated user can list all learners and emergency SOS coordinates |
| **HIGH** | SEC-FB-03 | Bypass of Approved Founder Activation, Password, and TOTP MFA Journey | `server.ts:453-472`, `AuthScreen.tsx:120` | Nullifies mandatory Founder activation token and 6-digit MFA controls |
| **HIGH** | SEC-FB-04 | Disconnected Dual Source of Truth (PostgreSQL vs Firestore) | `server.ts`, `src/firebase.ts`, `AuthScreen.tsx` | State divergence; suspensions in PostgreSQL do not invalidate Firestore access |
| **MEDIUM** | SEC-FB-05 | Operational System Administrator Permitted to List All Platform Users | `server.ts:786-797` | Violates least-privilege requirement that admins do not see user lists |
| **MEDIUM** | SEC-FB-06 | Client-Side Logout Fails to Terminate Firebase Session | `src/App.tsx:189-200` | Shared terminal account retention vulnerability |
| **LOW** | SEC-FB-07 | Firestore "Dirty Dozen" Suite Consists of Synthetic Mock Assertions | `firestore.rules.test.ts:150-168` | False sense of test verification; tests do not execute against emulator |
| **INFORMATIONAL**| SEC-FB-08 | Blueprint Schema Drift on Unmatched Collections | `firestore.rules` vs `firebase-blueprint.json`| `/guardians`, `/relationships`, `/devices` omitted from rules (default denied) |

---

## Detailed Vulnerability Dossiers

### 1. SEC-FB-01: Unauthenticated Tokenless Account Takeover & Founder Escalation
- **Severity:** CRITICAL
- **File:** `server.ts`
- **Approximate Location:** Lines 443–553 (`app.post('/api/auth/firebase-login', ...)`)
- **What the code currently does:**
  The endpoint accepts a JSON body containing `{ email, name, uid }`. It extracts `req.body.email`, normalises it, and performs a database lookup via `repository.users.findByEmailOrAlias(cleanEmail)`. If `cleanEmail === 'bravomtho@gmail.com'`, it automatically assigns or upgrades the user to `FOUNDER_EXECUTIVE` and issues a sovereign session token. If the email matches an existing school principal, responder, or system administrator, it issues a session token for that account.
  **The endpoint completely ignores the Firebase `idToken`** and performs **zero cryptographic verification** against Firebase or Google public keys.
- **Why it matters:**
  This is a full authentication bypass. Any client or script can spoof any registered user's email address in the body of an unauthenticated HTTP POST request and instantly receive a valid ITIS sovereign session token.
- **Exploit scenario:**
  An adversary executes the following request:
  ```bash
  curl -X POST https://ais-dev-f2qo4bwnsgg374sk6vetdz-278573159362.europe-west1.run.app/api/auth/firebase-login \
    -H "Content-Type: application/json" \
    -d '{"email": "bravomtho@gmail.com", "name": "Attacker", "uid": "fake-uid"}'
  ```
  The server responds with HTTP 200 containing:
  - `role: "FOUNDER_EXECUTIVE"`
  - `token: "tok_itis_..."`
  - Unrestricted sovereign permissions (`PLATFORM_GOVERNANCE_MANAGE`, `USER_CREATE`, etc.).
  The adversary now has full SuperAdmin governance over the platform without ever touching Google OAuth, entering a password, or supplying an MFA code.
- **Recommended correction:**
  1. Integrate the Firebase Admin SDK on the backend to cryptographically verify the Firebase ID token:
     ```ts
     const decodedToken = await admin.auth().verifyIdToken(idToken);
     const verifiedEmail = decodedToken.email;
     if (!decodedToken.email_verified) throw new Error("Email unverified");
     ```
  2. Verify project ID (`charismatic-catfish-b46tg`), issuer, audience, and expiration.
  3. Under no circumstances should Founder/SuperAdmin access be issued via Google Sign-In; see SEC-FB-03.
- **Affects Existing Founder Flow:** Correcting this restores integrity to the approved Founder flow.
- **Requires Decision:** No technical ambiguity; mandatory security patch.

---

### 2. SEC-FB-02: Direct Firestore Read Grants Blanket Learner PII & Emergency Incident Access
- **Severity:** CRITICAL
- **File:** `firestore.rules`
- **Approximate Location:** Lines 149–183
- **What the code currently does:**
  In `firestore.rules`:
  ```javascript
  match /learners/{learnerId} {
    allow get: if isSignedIn() && isValidId(learnerId);
    allow list: if isSignedIn();
  }
  match /incidents/{incidentId} {
    allow get: if isSignedIn() && isValidId(incidentId);
    allow list: if isSignedIn();
  }
  ```
- **Why it matters:**
  `isSignedIn()` only verifies that the caller has signed into ANY Firebase account (such as a random disposable Gmail account).
  There are NO institutional school scoping checks, NO legal custody relationship checks (`isGuardianLinkedToLearner`), and NO responder assignment checks (`isIncidentAssignedToResponder`).
- **Exploit scenario:**
  An attacker signs into the app using a personal Google account via `signInWithPopup`. In the browser console, using the initialized Firebase client SDK, they run:
  ```javascript
  import { getDocs, collection } from 'firebase/firestore';
  const learners = await getDocs(collection(db, 'learners'));
  const incidents = await getDocs(collection(db, 'incidents'));
  ```
  The attacker extracts full learner identities (names, admission numbers, beacon IDs) and real-time distress incidents with exact GPS coordinates.
- **Recommended correction:**
  Because the ITIS architecture is server-authoritative and queries PostgreSQL via Express, direct client-side reads of child PII and emergency telemetry from Firestore should be disabled (`allow read: if false;`) or mediated strictly through authenticated backend services.
- **Affects Existing Founder Flow:** No impact on Founder flow.
- **Requires Decision:** Yes — institutional decision on whether Firestore should ever hold learner PII directly or serve solely as a real-time notification trigger without sensitive payload data.

---

### 3. SEC-FB-03: Bypass of Approved Founder Activation, Password, and TOTP MFA Journey
- **Severity:** HIGH
- **File:** `server.ts` (lines 453–472), `src/components/AuthScreen.tsx` (line 120)
- **What the code currently does:**
  The Firebase integration introduced an alternate authentication route where signing in with `bravomtho@gmail.com` directly yields a `FOUNDER_EXECUTIVE` session.
  This bypasses the mandatory, approved ITIS Founder activation journey:
  `Founder Setup → Activation Token → Create Password → MFA Setup → 6-Digit Authenticator Code → Verify & Activate → Sign In → SuperAdmin Portal`.
- **Why it matters:**
  Directly violates the platform specification:
  *"The existing Founder activation/login journey is APPROVED and must remain unchanged... Firebase Google Sign-In must NOT silently replace, bypass, weaken or shorten this Founder journey."*
- **Exploit scenario:**
  If the Google account is compromised (or spoofed via SEC-FB-01), the attacker bypasses the hardware-based 6-digit TOTP MFA requirement entirely.
- **Recommended correction:**
  Strictly isolate Founder authentication from external 3P OAuth. Google Sign-In should be restricted to `PARENT_GUARDIAN` and general public registrations. Founder accounts must authenticate exclusively through the sovereign password + TOTP MFA pipeline.
- **Affects Existing Founder Flow:** Restores and preserves the approved Founder journey.
- **Requires Decision:** Yes — Founder / Governance Council confirmation of administrative authentication policy.

---

### 4. SEC-FB-04: Disconnected Dual Source of Truth (PostgreSQL vs Firestore)
- **Severity:** HIGH
- **File:** `server.ts`, `src/firebase.ts`, `src/components/AuthScreen.tsx`
- **What the code currently does:**
  When a user signs in with Google, `AuthScreen.tsx` writes a user document to Firestore `/users/{uid}`, while `server.ts` maintains users, guardians, learners, and incidents exclusively in PostgreSQL. The backend never synchronizes data with Firestore, nor does it read from Firestore.
- **Why it matters:**
  If an administrator deactivates or suspends a user in PostgreSQL, their Firestore user record remains `ACTIVE`. If child data is present in Firestore, the suspended user retains read access through Firebase SDK.
- **Exploit scenario:**
  A rogue employee is terminated and their status in PostgreSQL set to `SUSPENDED`. Because Firestore has no synchronization hook, their Firebase session token remains valid to query Firestore.
- **Recommended correction:**
  Establish PostgreSQL as the sole authoritative database. If Firestore is used for notifications or live presence, updates must be emitted server-side via transactional outbox or change-data-capture with automatic revocation propagation.
- **Affects Existing Founder Flow:** No.
- **Requires Decision:** Yes — Architectural confirmation of primary database responsibilities.

---

### 5. SEC-FB-05: Operational System Administrator Permitted to List All Platform Users
- **Severity:** MEDIUM
- **File:** `server.ts`
- **Approximate Location:** Lines 786–797 (`app.get('/api/users', ...)`)
- **What the code currently does:**
  ```typescript
  if (user.role !== 'FOUNDER_EXECUTIVE' && user.role !== 'SYSTEM_ADMIN') {
    return res.status(403).json({ error: 'ACCESS DENIED: Insufficient clearance to list platform identities.' });
  }
  const users = await repository.users.findAll();
  res.json(users);
  ```
- **Why it matters:**
  Section 10 of the security specification explicitly states:
  *"SYSTEM ADMINISTRATOR DOES NOT NEED TO SEE THE LIST OF SYSTEM USERS. Only report whether the current implementation respects it."*
  Line 789 explicitly allows `SYSTEM_ADMIN` to query and view all platform user identities.
- **Exploit scenario:**
  An operational admin account is compromised; the attacker extracts the entire directory of platform users, phone numbers, and email addresses.
- **Recommended correction:**
  Restrict `GET /api/users` clearance guard to `user.role === 'FOUNDER_EXECUTIVE'`.
- **Affects Existing Founder Flow:** No.
- **Requires Decision:** Yes — Administrative role definition confirmation.

---

### 6. SEC-FB-06: Client-Side Logout Fails to Terminate Firebase Session
- **Severity:** MEDIUM
- **File:** `src/App.tsx`
- **Approximate Location:** Lines 189–200 (`handleLogout`)
- **What the code currently does:**
  `handleLogout` clears the local token and calls `api.logout()`, which revokes the session in PostgreSQL. It does not invoke `signOut(auth)` from the Firebase Authentication SDK.
- **Why it matters:**
  On a shared workstation (e.g. school administrative computer or responder desk), Firebase Auth retains the user's Google session in IndexedDB. Clicking "Sign in with Google" re-authenticates the previous user without re-prompting for credentials.
- **Exploit scenario:**
  A staff member logs out on a shared PC. A student or visitor clicks "Sign in with Google" and is automatically re-authenticated into the previous user's profile.
- **Recommended correction:**
  Invoke `await signOut(auth)` inside `handleLogout`.
- **Affects Existing Founder Flow:** No.
- **Requires Decision:** No — standard session teardown hygiene.

---

### 7. SEC-FB-07: Firestore "Dirty Dozen" Suite Consists of Synthetic Mock Assertions
- **Severity:** LOW
- **File:** `firestore.rules.test.ts`
- **Approximate Location:** Lines 150–168
- **What the code currently does:**
  The test runner defines 12 payload objects and executes:
  ```typescript
  export function runDirtyDozenAssertions() {
    const results = DIRTY_DOZEN_TESTS.map(test => ({
      id: test.id,
      name: test.name,
      target: test.targetPath,
      passed: true,
      outcome: test.expectedOutcome
    }));
    return { total: results.length, passed: results.length, results };
  }
  ```
- **Why it matters:**
  This function does not execute against the Firestore Security Rules Emulator. It unconditionally returns 12/12 PASSED regardless of rule logic.
- **Exploit scenario:**
  Vulnerable or broken rules can be committed to source control while the test suite reports 100% pass rate.
- **Recommended correction:**
  Implement emulator-based unit tests using `@firebase/rules-unit-testing`.
- **Affects Existing Founder Flow:** No.
- **Requires Decision:** No.

---

### 8. SEC-FB-08: Blueprint Schema Drift on Unmatched Collections
- **Severity:** INFORMATIONAL
- **File:** `firestore.rules` vs `firebase-blueprint.json`
- **What the code currently does:**
  `firebase-blueprint.json` defines paths `/guardians/{guardianId}`, `/relationships/{relationshipId}`, and `/devices/{deviceId}`.
  `firestore.rules` has match blocks for `/test`, `/admins`, `/users`, `/schools`, `/learners`, `/incidents`, and `/audit_events`, but omits `/guardians`, `/relationships`, and `/devices`.
- **Why it matters:**
  While the omitted collections are safely blocked by the default-deny rule, this indicates schema documentation drift.
- **Recommended correction:**
  Align blueprint definitions with active rules or document omitted collections as intentionally server-only.
- **Affects Existing Founder Flow:** No.
- **Requires Decision:** No.
