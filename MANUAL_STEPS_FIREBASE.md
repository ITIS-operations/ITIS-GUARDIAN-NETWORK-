# ITIS Guardian Network — Manual Steps & Human Decisions Required

**Date of Audit:** 2026-10-06  
**Auditor Role:** Senior Application-Security Engineer  
**Purpose:** Action items that cannot be performed programmatically and require human administrative, business, cloud console, or legal review.

---

## 1. Firebase Console & Cloud Configuration
- [ ] **Authorized Domains Review:** Log in to the [Firebase Console](https://console.firebase.google.com/) for project `charismatic-catfish-b46tg`. Navigate to **Authentication > Settings > Authorized domains** and ensure only production and designated development hostnames are allowlisted.
- [ ] **OAuth Consent Screen Verification:** In Google Cloud Console, review the OAuth 2.0 Consent Screen branding, support email, and user privacy policy links to ensure official ITIS institutional branding.
- [ ] **Billing & Quota Safeguards:** Under **Billing**, configure budget alerts on Firebase and Google Cloud to prevent Denial-of-Wallet resource exhaustion.

## 2. Production Credential Management
- [ ] **Environment Segregation:** Separate the development Firebase project (`charismatic-catfish-b46tg`) from the production deployment. Create an isolated production Firebase project with independent API keys and security rules.
- [ ] **Admin Service Account Provisioning:** Generate and securely store a private Service Account Key for server-side token verification with Firebase Admin SDK. Store the credentials as a secret environment variable on your backend host (`FIREBASE_SERVICE_ACCOUNT_JSON`), never checked into Git.

## 3. Google Account Ownership & Founder Policy
- [ ] **Founder Governance Policy:** Confirm whether sovereign SuperAdmin / Founder credentials must strictly prohibit 3P Google OAuth login, requiring physical possession of hardware-based TOTP 2FA.
- [ ] **Official Email Domain Enforcement:** If Google Sign-In is retained for educational staff or emergency responders, configure Google Cloud Identity / Workspace restrictions to allow only verified institutional domain names (e.g. `@dbe.gov.za`, `@saps.gov.za`).

## 4. Legal & Privacy Decisions
- [ ] **POPIA Compliance Review:** Submit the technical data access matrix in `FIREBASE_PRIVACY_AUDIT.md` to institutional legal counsel and the Information Officer to verify compliance with POPIA Section 14 and Section 35 (Protection of Special Personal Information and Children's Information).
- [ ] **Data Residency Confirmation:** Verify in the Google Cloud Console that Firestore database `ai-studio-itis365safety-c553b824-a3f5-4877-99b4-3098ed799281` is provisioned in `europe-west1` (or local South African region `africa-south1` if required by national data sovereignty mandates).

## 5. Security & Deployment Sign-Off
- [ ] **External Penetration Testing:** Schedule an external penetration test targeting OAuth token exchange endpoints and socket transport interfaces prior to national deployment.
- [ ] **Production Deployment Go/No-Go:** Secure formal stakeholder sign-off from the Sovereign Founder and Technical Advisory Board before enabling Firebase-based authentication in production environments.
