# Copy Blockers & Implementation Boundaries

This document details strings, labels, and architectural couplings that could not or should not be casually altered without risking system breakage, regulatory non-compliance, or UI layout overflow.

---

## 1. Strings Tied Directly to Application Logic & Schemas
The following identifiers and strings directly govern database enum keys, state machines, API routing, or conditional switches. They were deliberately preserved in their canonical programmatic forms:

1. **User Role Enums (`UserRole`):**
   - Values: `'FOUNDER_EXECUTIVE'`, `'SYSTEM_ADMIN'`, `'SCHOOL_PRINCIPAL'`, `'SCHOOL_ADMIN_STAFF'`, `'COMMAND_OPERATOR'`, `'FIELD_RESPONDER'`, `'TECHNICIAN'`, `'GOVERNMENT_AUDITOR'`, `'PARENT_GUARDIAN'`.
   - *Impact:* Modifying these strings would break PostgreSQL role-based authorization gates, session validation, and database queries.
2. **Account Status Enums (`AccountStatus`):**
   - Values: `'ACTIVE'`, `'SUSPENDED'`, `'DISABLED'`.
   - *Impact:* Used in database lookup, API authorization checks, and access tokens.
3. **Caregiver Relationship Enum (`RelationshipType`):**
   - Values: `'AUTHORIZED_CAREGIVER'`, `'LEGAL_GUARDIAN'`, `'MOTHER'`, `'FATHER'`, `'GRANDPARENT'`, `'FOSTER_PARENT'`, `'SIBLING_ADULT'`, `'OTHER'`.
   - *Impact:* While the UI label was updated to "Authorised caregiver", the `<option value="AUTHORIZED_CAREGIVER">` value remains untouched to prevent breaking database insertion and validation schemas.
4. **Responder Unit Category Codes (`ResponderCategory`):**
   - Values: `'SAPS'`, `'METRO_POLICE'`, `'PARAMEDIC_EMS'`, `'PRIVATE_SECURITY'`, `'COMMUNITY_CPF'`, `'SCHOOL_SECURITY'`.
   - *Impact:* Governs database classification and dispatch telemetry protocols.
5. **Incident Lifecycle States:**
   - Values: `'QUEUED'`, `'CLAIMED'`, `'EN_ROUTE'`, `'ON_SCENE'`, `'RESOLVED'`.
   - *Impact:* State-machine transitions in both the frontend responder view and backend dispatch ledger.

---

## 2. Form Behaviour & Validation Blockers
1. **Password Policy Minimum Length (12 Characters):**
   - Wording indicates "Must be at least 12 characters with uppercase, lowercase, number, and special character."
   - *Blocker:* Shortening or softening this text without modifying the server-side validator regex (`/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,}$/`) in `dbStore.ts` would cause user frustration and failed form submissions.
2. **South African ID Number Validation (13 Digits Luhn Check):**
   - Help text indicates 13-digit national ID requirement. Modifying this prompt must align with backend validation in `AuthoritativeEnrolmentModal.tsx`.

---

## 3. Layout Overflow & Component Constraint Risks
1. **Compact Table Headers (`UserManagementView.tsx`, `AdminPortal.tsx`):**
   - Columns are constrained in responsive mobile viewports (`py-3.5 px-4`). Excessively long strings in table headers (e.g. expanding "Scope" to "Institutional and Jurisdictional Geographic Scope") will trigger horizontal scrolling and layout breakage.
2. **First Responder Badge Callouts (`ResponderView.tsx`):**
   - Badges like `ON DUTY`, `CRITICAL EMERGENCY ASSIGNMENT`, and `TETRA OK` are fixed-width inline flex elements. Applying verbose descriptions causes badge wrapping and misaligns tactical telemetry indicators.

---

## 4. Unsupported Claims Requiring Owner Confirmation
1. **DHA National Population Register (NPR) Direct Real-Time Gateway:**
   - Mentioned in enrolment flow descriptions. If live direct government database link is not provisioned, wording must be adjusted to "Verified School Identity Verification".
2. **Direct Dispatch of State Police (SAPS) Vehicles:**
   - Mentioned in tactical dispatch cards. If state police dispatch is strictly human-telephonic liaison rather than automated API telemetry dispatch, copy must state "Liaison with SAPS District Command".
