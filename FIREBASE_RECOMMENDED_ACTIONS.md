# ITIS Guardian Network — Recommended Corrective Actions

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Scope:** Actionable, non-destructive recommendations to remediate identified security and architectural vulnerabilities.

---

## Priority 1: CRITICAL Remediations (Immediate Action Required)

### Action 1.1: Cryptographically Verify Firebase ID Tokens on the Backend
- **Target:** `server.ts` (`/api/auth/firebase-login`)
- **Action:**
  1. Add Firebase Admin SDK or Google public key token verification.
  2. Extract `req.body.idToken` and verify:
     - Signature against Google's public JWKS.
     - Audience matches `charismatic-catfish-b46tg`.
     - Issuer matches `https://securetoken.google.com/charismatic-catfish-b46tg`.
     - Expiration time has not lapsed.
     - `decoded.email_verified === true`.
  3. Extract the email strictly from the decoded, verified token payload — never from unauthenticated request parameters.

### Action 1.2: Close Blanket Direct Reads in `firestore.rules`
- **Target:** `firestore.rules` (lines 149–183)
- **Action:**
  1. Since the ITIS platform is an Express + PostgreSQL server-authoritative application, direct client-side collection queries should not bypass the backend API.
  2. Disallow unmediated client reads on child identities and emergency incidents:
     ```javascript
     match /learners/{learnerId} {
       allow read, write: if false; // All learner queries must traverse Express API
     }
     match /incidents/{incidentId} {
       allow read, write: if false; // All emergency queries must traverse Express API
     }
     ```

---

## Priority 2: HIGH Remediations (Governance & Integrity)

### Action 2.1: Strictly Preserve the Sovereign Founder Journey
- **Target:** `server.ts` & `src/components/AuthScreen.tsx`
- **Action:**
  1. Remove automatic promotion to `FOUNDER_EXECUTIVE` from Google Sign-In.
  2. Enforce the approved Founder journey:
     `Founder Setup → Activation Token → Create Password → MFA Setup → 6-Digit Authenticator Code → Verify & Activate → Sign In → SuperAdmin Portal`.
  3. Restrict Google Sign-In strictly to `PARENT_GUARDIAN` and self-service public user registration.

### Action 2.2: Establish Single Source-of-Truth Architecture
- **Target:** System Architecture
- **Action:**
  1. Formally document PostgreSQL as the primary authoritative datastore for all identity, role, relational custody, device, and telemetry records.
  2. Eliminate disconnected dual writes from client components.

---

## Priority 3: MEDIUM Remediations (Least Privilege & Session Hygiene)

### Action 3.1: Enforce Least-Privilege User Listing
- **Target:** `server.ts` line 789 (`GET /api/users`)
- **Action:**
  1. Update clearance guard to:
     ```typescript
     if (user.role !== 'FOUNDER_EXECUTIVE') {
       return res.status(403).json({ error: 'ACCESS DENIED: Insufficient clearance to list platform identities.' });
     }
     ```
  2. Restrict user list enumeration exclusively to Sovereign Founder / Governance sessions.

### Action 3.2: Complete Session Teardown on Logout
- **Target:** `src/App.tsx` (`handleLogout`)
- **Action:**
  1. In addition to `api.logout()`, invoke `await signOut(auth)` from `firebase/auth`.
  2. Ensure complete credential clearing from both browser memory and IndexedDB.

---

## Priority 4: LOW & Maintenance Remediations

### Action 4.1: Deploy Real Firebase Rules Unit Tests
- **Target:** `firestore.rules.test.ts`
- **Action:**
  1. Replace static mock array with `@firebase/rules-unit-testing` running against the Firebase emulator in local test scripts.
