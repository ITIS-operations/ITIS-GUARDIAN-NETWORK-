# Copy Inventory: South African English & Sentence-Case Review

This document catalogues all user-facing wording and typographical adjustments made across the ITIS Guardian Network codebase.

In strict compliance with the audit guidelines:
- **Zero code identifiers, API paths, state variables, or database schemas were modified.**
- **South African English (SAE)** conventions were systematically applied: *authorised*, *organisation*, *organisational*, *enrol*, *enrolment*, *synchronised*, *centre*, *programme*, *minimisation*.
- **Sentence case** was applied across headings, buttons, navigation items, and descriptions, reserving ALL CAPS exclusively for brand names, acronyms (SAPS, POPIA, DHA, EMIS, GPS, SOS), or established UI status badges (e.g. `ACTIVE`, `SUSPENDED`).

---

## 1. `src/components/Header.tsx`
- **Before:** `PORTAL ACCESS`
- **After:** `Portal access`
- **Before:** `NATIONAL COMMAND`
- **After:** `National command`
- **Before:** `PUBLIC DIRECTORY`
- **After:** `Public directory`
- **Before:** `SYSTEM OVERVIEW`
- **After:** `System overview`

---

## 2. `src/components/PublicNavigationDrawer.tsx`
- **Before:** `SYSTEM NAVIGATION`
- **After:** `System navigation`
- **Before:** `EXPLORE NETWORK`
- **After:** `Explore network`
- **Before:** `GOVERNANCE & TRUST`
- **After:** `Governance & trust`
- **Before:** `OPERATIONAL PORTALS`
- **After:** `Operational portals`
- **Before:** `DIRECT ACCESS`
- **After:** `Direct access`

---

## 3. `src/components/Footer.tsx`
- **Before:** `NATIONAL NETWORK`
- **After:** `National network`
- **Before:** `STATUTORY COMPLIANCE`
- **After:** `Statutory compliance`
- **Before:** `OPERATIONAL HUBS`
- **After:** `Operational hubs`
- **Before:** `CONNECT`
- **After:** `Connect`
- **Before:** `All Rights Reserved.`
- **After:** `All rights reserved.`

---

## 4. `src/components/LandingPage.tsx`
- **Before:** `SOVEREIGN CHILD SAFETY & FLEET TELEMETRY INFRASTRUCTURE`
- **After:** `Sovereign child safety & fleet telemetry infrastructure`
- **Before:** `ENTER SECURE PORTAL`
- **After:** `Enter secure portal`
- **Before:** `LEARN MORE`
- **After:** `Explore system architecture`
- **Before:** `HARDWARE READINESS`
- **After:** `Hardware readiness`
- **Before:** `FIELD TELEMETRY`
- **After:** `Field telemetry`
- **Before:** `SYSTEM TRUST`
- **After:** `System trust`
- **Before:** `REQUEST PILOT ONBOARDING`
- **After:** `Request pilot onboarding`
- **Before:** `ACCESS AUTHORIZED PORTAL`
- **After:** `Access authorised portal`

---

## 5. `src/components/TrustSafetySection.tsx`
- **Before:** `ENTERPRISE DATA GOVERNANCE`
- **After:** `Enterprise data governance`
- **Before:** `POPIA & STATUTORY PRIVACY ENFORCEMENT`
- **After:** `POPIA & statutory privacy enforcement`
- **Before:** `Data minimization principles...`
- **After:** `Data minimisation principles...`
- **Before:** `...unauthorized external disclosure.`
- **After:** `...unauthorised external disclosure.`

---

## 6. `src/components/AuthScreen.tsx`
- **Before:** `AUTHORITATIVE SOVEREIGN AUTHENTICATION`
- **After:** `Authoritative sovereign authentication`
- **Before:** `SECURE SIGN IN`
- **After:** `Secure sign in`
- **Before:** `AUTHENTICATING CREDENTIALS...`
- **After:** `Authenticating credentials...`

---

## 7. `src/components/RbacSecurityConsole.tsx`
- **Before:** `ROLE-BASED ACCESS CONTROL (RBAC) CONSOLE`
- **After:** `Role-based access control (RBAC) console`
- **Before:** `AUTHORIZATION MATRIX`
- **After:** `Authorisation matrix`
- **Before:** `SECURITY ENFORCEMENT DIRECTIVES`
- **After:** `Security enforcement directives`

---

## 8. `src/components/AuthoritativeEnrolmentModal.tsx`
- **Before:** `AUTHORITATIVE LEARNER ENROLLMENT`
- **After:** `Authoritative learner enrolment`
- **Before:** `INITIAL ENROLLMENT DETAILS`
- **After:** `Initial enrolment details`
- **Before:** `Authorized Caregiver` (option label)
- **After:** `Authorised caregiver` (data value `AUTHORIZED_CAREGIVER` unchanged)
- **Before:** `Authorized for Campus Pickup`
- **After:** `Authorised for campus pickup`

---

## 9. `src/components/NewsCareersSection.tsx`
- **Before:** `BUILD THE FUTURE OF LEARNER SAFETY.`
- **After:** `Build the future of learner safety.`
- **Before:** `...statutory data protection (POPIA), and organizational support.`
- **After:** `...statutory data protection (POPIA), and organisational support.`
- **Before:** `mailto:...Talent%20Inquiry...`
- **After:** `mailto:...Talent%20Enquiry...`

---

## 10. `src/components/UserManagementView.tsx`
- **Before:** `<span>CREATE USER</span>`
- **After:** `<span>Create user</span>`
- **Before:** `<span>ENROL FIRST RESPONDER</span>`
- **After:** `<span>Enrol first responder</span>`
- **Before:** `Search users by name, email, role, or organization...`
- **After:** `Search users by name, email, role, or organisation...`
- **Before:** `<th ...>User Details</th>`
- **After:** `<th ...>User details</th>`
- **Before:** `<th ...>Authoritative Role</th>`
- **After:** `<th ...>Authoritative role</th>`
- **Before:** `<th ...>Organization / Scope</th>`
- **After:** `<th ...>Organisation / scope</th>`
- **Before:** `<th ...>Assigned Portal</th>`
- **After:** `<th ...>Assigned portal</th>`
- **Before:** `<th ...>Account Status</th>`
- **After:** `<th ...>Account status</th>`

---

## 11. `src/components/CreateUserModal.tsx`
- **Before:** `<span>Organization / Department (Optional)</span>`
- **After:** `<span>Organisation / department (optional)</span>`
- **Before:** `<option value="ACTIVE">ACTIVE (Authorized to Sign In)</option>`
- **After:** `<option value="ACTIVE">ACTIVE (Authorised to sign in)</option>`

---

## 12. `src/components/EnrolFirstResponderModal.tsx`
- **Before:** `<span>{isSubmitting ? 'Enrolling Unit...' : 'Authorize & Enrol Responder'}</span>`
- **After:** `<span>{isSubmitting ? 'Enrolling Unit...' : 'Authorise & enrol responder'}</span>`

---

## 13. `src/components/GuardianDashboard.tsx`
- **Before:** `...school arrival confirmations, and authorized emergency coordination.`
- **After:** `...school arrival confirmations, and authorised emergency coordination.`

---

## 14. `src/components/ExecutiveGovernmentPortal.tsx`
- **Before:** `Aggregate Metrics → Authorized Cluster Detail → Operational Record (With POPIA PII Minimization)`
- **After:** `Aggregate Metrics → Authorised Cluster Detail → Operational Record (With POPIA PII Minimisation)`
- **Before:** `24/7 Command Centre controller. Authorized to verify SOS triggers...`
- **After:** `24/7 Command Centre controller. Authorised to verify SOS triggers...`

---

## 15. `src/components/SchoolPortal.tsx`
- **Before:** `<span ...>Authorized Guardians</span>`
- **After:** `<span ...>Authorised Guardians</span>`

---

## 16. `src/components/ResponderView.tsx`
- **Before:** `...National Child Protection Mandate • Authorized Dispatch Terminal`
- **After:** `...National Child Protection Mandate • Authorised dispatch terminal`
- **Before:** `...assignments from the National 24/7 Command Centre. Your unit location and readiness are synchronized in real-time.`
- **After:** `...assignments from the National 24/7 Command Centre. Your unit location and readiness are synchronised in real-time.`
- **Before:** `Immediate Armed Response Authorized`
- **After:** `Immediate armed response authorised`

---

## 17. `src/components/AdminPortal.tsx`
- **Before:** `...role delegation, onboarding transaction, and unauthorized access attempt is cryptographically chained.`
- **After:** `...role delegation, onboarding transaction, and unauthorised access attempt is cryptographically chained.`

---

## 18. `src/components/TelemetryDiagnosticsDashboard.tsx`
- **Before:** `...diagnostic logs for authorized ITIS personnel.`
- **After:** `...diagnostic logs for authorised ITIS personnel.`

---

## 19. `src/components/AccessDenied.tsx`
- **Before:** `default: return 'Authorized Dashboard';`
- **After:** `default: return 'Authorised Dashboard';`

---

## 20. `src/components/LearnerSmartIdModal.tsx`
- **Before:** `Scan with any authorized scanner or camera to verify this learner's active institutional status.`
- **After:** `Scan with any authorised scanner or camera to verify this learner's active institutional status.`

---

## 21. `src/components/SchoolDetailModal.tsx`
- **Before:** `No authorized First Responders currently reporting active coordinates within this district perimeter.`
- **After:** `No authorised First Responders currently reporting active coordinates within this district perimeter.`

---

## 22. `src/services/api.ts`
- **Before:** `throw new Error('You do not have permission to create learner enrollments.');`
- **After:** `throw new Error('You do not have permission to create learner enrolments.');`
