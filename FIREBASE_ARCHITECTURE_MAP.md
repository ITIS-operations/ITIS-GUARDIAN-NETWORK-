# ITIS Guardian Network — Firebase & ITIS Architecture Map

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Scope:** Architectural relationship between Firebase Authentication, Firestore, Express API Gateway, and PostgreSQL.

---

## 1. Intended vs Implemented Architecture

```
                       [CLIENT BROWSER]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
     [Google Sign-In Popup]         [Direct Firestore SDK]
               │                             │
               ▼                             ▼
      (Firebase Identity)              (Direct Reads)
         (JWT / UID)                 [firestore.rules]
               │                             │
               ▼                             ▼
       /api/auth/firebase-login         /learners (UNRESTRICTED READ)
       [Express Backend]               /incidents (UNRESTRICTED READ)
               │                       /users (OWNER OR ADMIN)
               ▼
     [PostgreSQL Lookups]
     - users table lookup by email
     - guardian resolution
     - role extraction
               │
               ▼
      [ITIS Sovereign Session]
      - Token: tok_itis_...
      - Stored in active_sessions
               │
               ▼
      [Authoritative RBAC Engine]
      - Role: FOUNDER_EXECUTIVE / PARENT_GUARDIAN / etc.
      - Permissions list
               │
               ▼
      [Authoritative ABAC Gates]
      - isGuardianLinkedToLearner
      - isLearnerEnrolledInSchool
      - isIncidentAssignedToResponder
               │
               ▼
      [ITIS Protected Portals / Express Routes]
      - School Portal, Guardian Hub, Command Centre, etc.
```

---

## 2. Component-by-Component Trace

### Step 1: Firebase Authentication (Client Side)
- **Component:** `src/firebase.ts` & `src/components/AuthScreen.tsx`
- **Mechanism:** `signInWithPopup(auth, googleProvider)` opens Google OAuth consent dialog.
- **Result:** Returns `UserCredential` with:
  - `user.uid` (Firebase UID string)
  - `user.email` (Google account email)
  - `user.displayName`
  - `idToken` (Google RS256 signed JWT via `getIdToken()`)

### Step 2: Firestore Direct Touchpoint (Client Side)
- **Component:** `src/components/AuthScreen.tsx` (Lines 114–132)
- **Mechanism:** The client writes directly to Firestore document `/users/{uid}` with:
  - `id: cred.user.uid`
  - `email: cred.user.email`
  - `role: 'FOUNDER_EXECUTIVE'` (if email is `bravomtho@gmail.com`) or `'PARENT_GUARDIAN'`
  - `accountStatus: 'ACTIVE'`
- **Architectural Isolation:** This write is isolated to Firestore. Neither Express nor PostgreSQL ever reads or subscribes to this document.

### Step 3: ITIS Firebase Login Endpoint (API Boundary)
- **Component:** `server.ts` (Lines 443–553: `POST /api/auth/firebase-login`)
- **Mechanism:** Client transmits `{ email, name, uid, idToken }` as an unauthenticated JSON payload.
- **Processing:**
  1. The server **extracts `req.body.email`** and ignores `idToken`.
  2. Queries PostgreSQL via `repository.users.findByEmailOrAlias(cleanEmail)`.
  3. If user does not exist: Creates record in PostgreSQL `users` table. If `email === 'bravomtho@gmail.com'`, role is forced to `FOUNDER_EXECUTIVE`; otherwise `PARENT_GUARDIAN`.
  4. If user exists: Retrieves existing record from PostgreSQL.
  5. Generates a cryptographically random ITIS sovereign session token (`tok_itis_...`).
  6. Stores session record in PostgreSQL `active_sessions` table with associated RBAC permissions.
  7. Returns session token and user profile to client.

### Step 4: ITIS Authoritative Session
- **Component:** `server.ts` Session Middleware (Lines 135–175) & `src/services/api.ts`
- **Mechanism:** Client passes `Authorization: Bearer tok_itis_...` on subsequent API calls.
- **Validation:** Express queries PostgreSQL / cache for `active_sessions.token`. If valid, binds `req.user` to the request context.

### Step 5: Authoritative RBAC & Scope Evaluation
- **Component:** `src/server/rbacEngine.ts`
- **Evaluation:** Evaluates `req.user.role` and specific permissions (`LEARNERS_VIEW_ALL`, `ENROLMENT_MANAGE`, etc.) against `AUTHORITATIVE_ROLE_MATRIX`.

### Step 6: Authoritative ABAC Boundary Checks
- **Component:** `server.ts` (Lines 208–261)
- **Evaluation:** Direct SQL parameterised queries:
  - `isGuardianLinkedToLearner(guardianId, learnerId)`: Queries `guardian_learner_relationships`.
  - `isLearnerEnrolledInSchool(learnerId, schoolId)`: Queries `school_enrolments`.
  - `isIncidentAssignedToResponder(incidentId, unit, id)`: Queries `incidents`.

---

## 3. Bypass Analysis: Can Firebase Identities Bypass This Chain?

### Bypass Path 1: Direct Firestore Data Access (ACTIVE VULNERABILITY)
- **Bypass Description:** A Firebase user can completely bypass Express, PostgreSQL, RBAC, and ABAC by using the Firebase client SDK directly against Firestore.
- **Affected Data:**
  - `/learners/{learnerId}`: Open to all signed-in Firebase users (`allow list: if isSignedIn();`).
  - `/incidents/{incidentId}`: Open to all signed-in Firebase users (`allow list: if isSignedIn();`).
- **Chain Broken At:** Step 3 onwards. The client talks directly to Google Cloud Firestore, entirely outside the ITIS Express and PostgreSQL authorization pipeline.

### Bypass Path 2: Tokenless Email Spoofing into Sovereign Session (ACTIVE VULNERABILITY)
- **Bypass Description:** Because `/api/auth/firebase-login` does not cryptographically verify the Firebase ID token, any client can send an arbitrary email address in the request body.
- **Chain Broken At:** Step 1 & 2. The client does not even need to authenticate with Firebase to obtain an ITIS session under any existing email address.
