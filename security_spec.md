# Security Specification: ITIS Guardian Network Firestore Security

## 1. Data Invariants
1. **User Identity Boundary**: A user document at `/users/{userId}` can only be created or modified if `request.auth.uid == userId`.
2. **Role & Privilege Escalation Prevention**: Users cannot self-assign `role: "FOUNDER_EXECUTIVE"` or `role: "SYSTEM_ADMIN"`. Admin verification requires an authoritative record in `/admins/{uid}` managed exclusively server-side. Sovereign Founder access is restricted exclusively to the approved Founder activation, password, and TOTP MFA journey.
3. **Immutability of Cryptographic & Audit Trails**: `createdAt`, `checksum`, and `id` cannot be modified on update.
4. **Relational Custody Invariant**: An incident alert or guardian relationship write must explicitly match an authenticated identity or verified authority.
5. **No Blanket Reads**: Public or unauthenticated queries on `/users`, `/learners`, `/guardians`, or `/incidents` are completely denied.
6. **Strict Field Validations**: All string fields are constrained in size (`<= 128` or `<= 500`) to prevent denial-of-wallet resource exhaustion.
7. **Action-Based Incident Lifecycle**: Responders cannot resolve an incident without claiming it or altering unpermitted fields.

---

## 2. The "Dirty Dozen" Payloads

1. **Payload 1: Unauthenticated Read Attack**
   - Target: `GET /users/victim-user-123`
   - Actor: `Unauthenticated (request.auth == null)`
   - Expected: `PERMISSION_DENIED`

2. **Payload 2: Identity Spoofing Profile Creation**
   - Target: `SET /users/target-user-456`
   - Actor: `request.auth.uid = attacker-789`
   - Body: `{"id": "target-user-456", "email": "spoof@attacker.com", "name": "Attacker", "role": "PARENT_GUARDIAN"}`
   - Expected: `PERMISSION_DENIED`

3. **Payload 3: Privilege Escalation to System Admin**
   - Target: `UPDATE /users/attacker-789`
   - Actor: `request.auth.uid = attacker-789`
   - Body: `{"role": "SYSTEM_ADMIN"}`
   - Expected: `PERMISSION_DENIED`

4. **Payload 4: Denial of Wallet Junk ID Injection**
   - Target: `SET /users/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` (150 chars)
   - Actor: `request.auth.uid = A...A`
   - Expected: `PERMISSION_DENIED` (ID exceeds 128 characters)

5. **Payload 5: Shadow Field Injection in Profile**
   - Target: `SET /users/user-123`
   - Actor: `request.auth.uid = user-123`
   - Body: `{"id": "user-123", "email": "test@test.com", "name": "Test", "role": "PARENT_GUARDIAN", "accountStatus": "ACTIVE", "createdAt": "2026-10-04", "updatedAt": "2026-10-04", "superAdminAccessGranted": true}`
   - Expected: `PERMISSION_DENIED` (Shadow key rejected)

6. **Payload 6: Unauthenticated Learner Creation**
   - Target: `SET /learners/lrn-rogue-001`
   - Actor: `Unauthenticated`
   - Body: `{"id": "lrn-rogue-001", "firstName": "Rogue", "lastName": "Data"}`
   - Expected: `PERMISSION_DENIED`

7. **Payload 7: Cross-Tenant Learner Modification**
   - Target: `UPDATE /learners/lrn-school-a-01`
   - Actor: `User belonging to School B (or unauthorized guardian)`
   - Body: `{"enrolmentStatus": "TRANSFERRED"}`
   - Expected: `PERMISSION_DENIED`

8. **Payload 8: Immutable Timestamp Alteration**
   - Target: `UPDATE /users/user-123`
   - Actor: `request.auth.uid = user-123`
   - Body: `{"createdAt": "1999-01-01T00:00:00Z"}`
   - Expected: `PERMISSION_DENIED`

9. **Payload 9: Audit Trail Tamper Attack**
   - Target: `UPDATE /audit_events/evt-999`
   - Actor: `SYSTEM_ADMIN or any user`
   - Body: `{"checksum": "forged-hash-val"}`
   - Expected: `PERMISSION_DENIED` (Audit events are strictly append-only; update is blocked)

10. **Payload 10: Premature Incident Closure Without Assignment**
    - Target: `UPDATE /incidents/inc-404`
    - Actor: `Unassigned Field Responder`
    - Body: `{"status": "RESOLVED"}`
    - Expected: `PERMISSION_DENIED`

11. **Payload 11: Oversized Payload Resource Exhaustion**
    - Target: `SET /incidents/inc-bomb-01`
    - Actor: `request.auth.uid = reporter-01`
    - Body: `{"description": "A".repeat(50000)}` (50KB string in 500 char max field)
    - Expected: `PERMISSION_DENIED`

12. **Payload 12: Blanket List Scraping on Users Collection**
    - Target: `LIST /users`
    - Actor: `Regular PARENT_GUARDIAN`
    - Query: `db.collection('users').get()`
    - Expected: `PERMISSION_DENIED` (Blanket list without targeted ownership constraint is barred)
