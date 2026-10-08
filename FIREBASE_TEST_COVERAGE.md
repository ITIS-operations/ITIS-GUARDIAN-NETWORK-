# ITIS Guardian Network — Firebase Test Coverage & Verification Audit

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Scope:** Execution and detailed analysis of test suites, including `firestore.rules.test.ts`, acceptance tests, security test runners, and build verification.

---

## 1. Regression Verification Results (Actual Execution)

| Test Command | Purpose | Result | Total / Passed | Observations |
| :--- | :--- | :--- | :--- | :--- |
| `npm run lint` (`tsc --noEmit`) | TypeScript static type verification | **PASS** | 0 errors | All types resolve cleanly |
| `npm test` | Telemetry Server Acceptance Suite | **PASS** | 9 / 9 (100%) | TCP/UDP listeners and isolation verified |
| `npm run test:security` | Security, ABAC, POPIA & Resilience Suite | **PASS** | 24 / 24 (100%) | PostgreSQL ABAC & session guards pass |
| `npm run build` | Vite client & esbuild Node server build | **PASS** | Built in 10.01s | Production bundles emit without syntax errors |
| `npx tsx firestore.rules.test.ts`| "Dirty Dozen" Firestore Test Runner | **PASS (SYNTHETIC)** | 12 / 12 (100%) | Executes mock array, NOT emulator |

---

## 2. Deep Dive: Firestore "Dirty Dozen" Coverage Analysis

The file `firestore.rules.test.ts` defines 12 test assertions.

### Execution Analysis
In `firestore.rules.test.ts` lines 150–168:
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
**CRITICAL TEST AUDIT FINDING:** This runner does not deploy rules to a local emulator, does not compile the AST, and does not evaluate rules logic against actual Firestore security rule semantics. It returns `{ passed: true }` statically.

---

## 3. Rule Analysis: What the 12 Scenarios Actually Protect in `firestore.rules`

| ID | Test Scenario | Meaningfully Protects Production? | Only Tests Validation Logic? | Real Vulnerability Under Active Rules? |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-DD-01** | Unauthenticated Read on `/users/{id}` | **YES** | Rule check | Blocked by `isSignedIn()` |
| **SEC-DD-02** | Identity Spoofing Profile Creation | **YES** | Rule check | Blocked by `isOwner(userId)` |
| **SEC-DD-03** | Privilege Escalation to `SYSTEM_ADMIN` | **YES** | Rule check | Blocked by `incoming().role != 'SYSTEM_ADMIN'` |
| **SEC-DD-04** | Denial of Wallet Junk ID (>128 chars) | **YES** | Rule check | Blocked by `isValidId()` (size <= 128) |
| **SEC-DD-05** | Shadow Field Injection in Profile | **YES** | Schema check | Blocked by `keys().hasOnly(...)` |
| **SEC-DD-06** | Unauthenticated Learner Creation | **YES** | Rule check | Blocked by `isSignedIn()` |
| **SEC-DD-07** | Cross-Tenant Learner Modification | **NO (FAILS IN REALITY)** | False assumption | **FAIL IN ACTIVE RULES:** Rule allows any signed-in user to update `enrolmentStatus`! |
| **SEC-DD-08** | Immutable Timestamp Alteration | **YES** | Schema check | Blocked by `incoming().createdAt == existing().createdAt` |
| **SEC-DD-09** | Audit Trail Tamper Attack | **YES** | Immutability | Blocked by `allow update, delete: if false;` |
| **SEC-DD-10** | Premature Incident Closure Without Assignment | **NO (FAILS IN REALITY)** | False assumption | **FAIL IN ACTIVE RULES:** Rule allows any signed-in user to update `status`! |
| **SEC-DD-11** | Oversized Payload Resource Exhaustion | **YES** | Schema check | Blocked by `data.description.size() <= 500` |
| **SEC-DD-12** | Blanket List Scraping on Users Collection | **YES** | Rule check | Blocked by `resource.data.id == request.auth.uid` |

---

## 4. Critical Missing Test Scenarios

The following high-risk attack scenarios are completely missing from `firestore.rules.test.ts`:

1. **Scraping All Learner Records as Authenticated User:**
   - Operation: `LIST /learners`
   - Actor: Any signed-in Google user.
   - Result under active rules: **PERMITTED (CRITICAL LEAK).**
2. **Scraping Real-Time Emergency Incidents & Coordinates:**
   - Operation: `LIST /incidents`
   - Actor: Any signed-in Google user.
   - Result under active rules: **PERMITTED (CRITICAL LEAK).**
3. **Self-Assigning Privileged Role in Firestore (Non-Admin):**
   - Operation: `CREATE /users/{uid}` with `role: "COMMAND_OPERATOR"` or `"SCHOOL_PRINCIPAL"`.
   - Result under active rules: **PERMITTED.**
4. **Tokenless Server-Side Account Takeover:**
   - Operation: `POST /api/auth/firebase-login` with spoofed email.
   - Result under active backend: **PERMITTED (CRITICAL BYPASS).**
