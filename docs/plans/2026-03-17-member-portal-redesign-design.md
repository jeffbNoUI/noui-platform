# Member Portal Redesign — Design Document

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Full reimagining of the member-facing self-service portal for defined benefit pension plans

---

## 1. Design Principles

- **Plan-agnostic**: All plan-specific details driven by configuration (plan profile), not hardcoded
- **NoUI / Institutional Warmth**: Same design system as staff portal — cream/sage/navy palette, Fraunces headings, generous spacing, contextual composition
- **Adaptive single portal**: One portal shell, content adapts to persona (Active, Inactive, Retiree, Beneficiary, Dual-role)
- **Guided + capable**: Guided wizard for most members, open calculator for power users. Tour + contextual help, not freeform AI chat
- **Transparency**: Every calculation shows its work — formula, inputs, intermediate steps
- **Deterministic**: All calculations via the Go rules engine. Portal never computes benefit amounts.
- **Member does the work, staff handles exceptions**: Self-service by default, staff review for sensitive changes and fiduciary steps
- **Accessibility-first**: WCAG 2.1 AA, 44px targets, 16px minimum text, no hover-only, no gestures, generous timing
- **Compassionate**: Death-related workflows designed with empathy — phone-first, gentle language, minimal burden

---

## 2. Personas

| Persona | Status | Primary Needs |
|---------|--------|---------------|
| **Active Member** | Employed, contributing | What-if calculator, contribution history, service credit tracking, initiate retirement |
| **Inactive Member (Vested)** | Left employment, 5+ years service | Deferred benefit vs. refund comparison, service purchase exploration |
| **Inactive Member (Not Vested)** | Left employment, <5 years service | Refund application |
| **Retiree** | Receiving monthly benefit | Payment history, 1099-R, benefit verification letters, direct deposit/withholding changes |
| **Beneficiary (Survivor)** | Receiving survivor pension | Payment history, 1099-R, manage benefit |
| **Beneficiary (Lump Sum)** | One-time death benefit | Claim status, payment confirmation, tax documents |
| **Dual Role** | Member + beneficiary of another member | Both sections visible with clear separation |

---

## 3. Information Architecture & Navigation

### Sidebar Navigation

| Section | Purpose | Persona Visibility |
|---------|---------|-------------------|
| **Home** | Adaptive dashboard landing | All |
| **My Profile** | Demographics, addresses, beneficiaries, employment history, contributions, service credit | All |
| **My Benefit** | Current benefit details, payment history, 1099-R, benefit verification letters, manage direct deposit/withholding | Retirees, Beneficiaries |
| **Plan My Retirement** | What-if calculator (guided + open), saved scenarios | Active, Inactive (vested) |
| **My Retirement Application** | Collaborative application flow, status tracker | Active (eligible or exploring) |
| **Documents** | Checklist-driven uploads, received documents, DROs, marriage certs | All |
| **Messages & Activity** | Activity tracker, secure messaging, full interaction history | All |
| **Preferences** | Communication (email/SMS/in-portal), accessibility, security | All |
| **Help** | Guided tour (re-launchable), contextual FAQ | All |

### Persona-Adaptive Dashboard

**Active Member**: Estimated monthly benefit (not account balance), action items, milestone timeline (vesting, Rule of N, normal retirement), quick link to calculator.

**Inactive Member (Vested)**: Vested status confirmation, deferred benefit vs. refund comparison, estimated deferred benefit at various ages, earliest eligibility date.

**Inactive Member (Not Vested)**: Refund amount, explanation of vesting requirements, re-employment information.

**Retiree**: Next payment amount and date (gross/deductions/net), recent payment history, quick links to 1099-R, benefit verification letter, manage direct deposit.

**Beneficiary (Survivor)**: Survivor benefit amount, recent payments, quick links.

**Dual Role**: Both sections with clear headings: "Your Membership" and "Your Survivor Benefit from [Name]".

---

## 4. Registration & Identity Verification

### Self-Registration Flow

1. Member creates a Clerk account (email + password)
2. Email verification
3. Identity matching screen: Last Name + Date of Birth + SSN last 4
4. Auto-match logic:
   - **Unique match**: Account linked immediately, member enters portal
   - **Ambiguous match**: PendingVerification record created, staff reviews within 2 business days
   - **No match**: Directed to contact staff by phone/email

### Beneficiary Registration Variant

Beneficiaries select "I am a beneficiary of a member" and provide:
- Their own name + DOB
- Member's last name + SSN last 4

Matches against the beneficiaries table via the member record.

### Security Controls on Verification

- 3 attempts per email per 24 hours, then locked to staff verification
- 5 failed attempts per IP per hour triggers temporary IP block
- All attempts logged (hashed SSN fragment, IP, user agent)
- Dev/staging bypass: SSN `0000` = no match, `9999` = ambiguous

---

## 5. Guided Tour & Contextual Help

### Guided Tour

Spotlight-and-tooltip pattern on first login. Not a modal overlay — the portal is visible but dimmed, one element highlighted at a time.

- 8 stops for active members, adapted per persona
- Keyboard navigable (Arrow keys, Tab, Escape to skip)
- Progress saved to preferences — resumes if interrupted
- Re-launchable from Help section
- Tour version tracked — bumping version triggers "What's New" mini-tour

### Contextual Help Panels

Every major section has a collapsible help panel (right side or bottom depending on screen size):
- Static, curated content from the knowledgebase service — not AI-generated
- Content adapts to member's tier/status (e.g., shows correct Rule of N for their tier)
- Expandable FAQ items for common questions
- Plan-specific terms defined via plan profile glossary

---

## 6. My Profile

### Sub-Tabs

Personal Info | Addresses | Beneficiaries | Employment | Contributions | Service Credit

### Field Edit Permissions (Plan-Configurable)

**Immediate edit** (save on submit, no review): phone, email, emergency contact, mailing address, residential address, tax withholding.

**Staff review** (change request with optional evidence): legal name, date of birth, gender, marital status, SSN, beneficiaries, direct deposit.

Staff-review fields show: current value, new value input, reason field, optional document upload, clear messaging that it requires review.

### Beneficiary Management

- Add, edit, remove beneficiaries — all go through staff review
- Allocation percentages must sum to 100% (UI-enforced before submission)
- Pending changes shown with status indicator
- Supporting documents can be attached (marriage certificate, birth certificate, divorce decree)

### Employment History

Read-only timeline with "Flag an Issue" on each entry.

### Contributions

Summary cards (employee, employer, total) + detailed annual history table. Flag capability.

### Service Credit

Breakdown by type (earned, purchased, military, leave) with totals for benefit calculation and eligibility. Contextual note explaining the difference. Link to calculator for service purchase exploration.

### Flag an Issue Flow

- Member selects "Flag Issue" next to any data point
- Form: current value (pre-filled), proposed correction, description, optional document upload
- Creates issue in Issues service with structured metadata (entity_type, entity_id, current_value, proposed_value, evidence_document_id)
- Staff sees impact assessment (how correction affects benefit calculation)
- Resolution: approve/reject/escalate with mandatory note to member
- Member notified per communication preferences

---

## 7. Plan My Retirement (What-If Calculator)

### Two Modes

**Guided Mode** — 5-step wizard:
1. When do you want to retire? (ASAP / specific age / specific date / not sure)
2. Service purchase? (no / add N years / show me the difference)
3. Salary assumptions? (same / modest growth / specific rate) — skipped for inactive members
4. Payment option preference? (maximum / J&S variants / show all compared)
5. Results — estimated monthly benefit with full formula breakdown, "What if you wait?" comparison, payment option table

"Not sure" option in Step 1 auto-generates 3 scenarios (earliest eligible, 5 years from now, normal retirement).

**Open Calculator Mode** — all parameters visible with sliders/inputs, results update in real time (500ms debounce). Includes:
- Retirement date (month/year selector)
- Age slider
- Service purchase years slider (constrained to plan maximum)
- Annual salary growth rate
- Payment option selector
- Beneficiary DOB (for J&S factor calculation)
- Eligibility warnings when selected date doesn't meet requirements

### Results Display

All results show:
- Monthly benefit amount (prominent)
- Eligibility type (early/normal)
- Reduction percentage and factor
- AMS (with window period)
- Full formula breakdown (AMS x multiplier x years = base, minus reduction, times J&S factor = final)
- "What if you wait?" comparison at multiple dates
- Payment option comparison table (you receive / survivor receives)
- Disclaimer: estimates only, subject to staff verification

### Saved Scenarios

- Up to 5 saved per member with custom labels
- Compare 2-3 scenarios side by side
- Stale detection via data_version hash — warns member when underlying data has changed
- "Recalculate Now" button to refresh with current data
- "Use for Application" bridges directly into retirement application (carries inputs)
- Starting an application from a stale scenario is blocked until recalculated

### Staleness Triggers

Salary record change, service credit change, beneficiary change, plan provision change, member status change. All configurable in plan profile.

### Calculation Contract

All calculations via existing intelligence service APIs:
- `POST /api/v1/benefit/calculate`
- `POST /api/v1/eligibility/evaluate`
- `POST /api/v1/benefit/options`
- `POST /api/v1/benefit/scenario`

Frontend never computes benefit amounts.

---

## 8. Inactive Member Experience

### Vested Inactive Members

Dashboard presents two options side by side:

**Option 1: Deferred Benefit** — leave contributions in the plan, receive monthly pension at retirement age. Shows estimated monthly benefit at various ages (earliest eligible through normal). Links to the what-if calculator (adapted: no salary growth step since salary is frozen).

**Option 2: Refund** — withdraw employee contributions + interest. Shows estimated refund amount. Clear warning: "This decision is permanent and cannot be undone."

Service purchase exploration available — inactive vested members may purchase prior public employment or military service.

### Not-Vested Inactive Members

Dashboard shows refund as the only option. Explains vesting requirements and re-employment path.

### Refund Application Flow

5 stages:
1. Verify your information
2. Upload required documents (fewer than retirement — typically just proof of identity)
3. Review refund amount with tax implications (mandatory 20% federal withholding, optional rollover to IRA)
4. Acknowledge and submit (double confirmation for irreversible decision)
5. Staff processing (member sees status)

### New Endpoint

`GET /api/v1/members/{id}/refund-estimate` — returns employee contributions + accrued interest total.

---

## 9. My Retirement Application (Collaborative Flow)

### Application States

Not Started -> In Progress -> Under Review -> Approved -> Complete

### Member Stages (5)

**Stage 1: Verify Your Information** — Review personal info, employment, beneficiaries. Each field has "Correct" or "Flag" button. All items must be confirmed or flagged to proceed. Flagged items create staff work items; application can proceed on non-blocking flags or pauses on critical ones.

**Stage 2: Upload Required Documents** — Dynamic checklist based on member situation (configurable via plan profile). Shows required, conditional, and optional documents. Members upload against specific checklist items. "I don't have a document — contact staff" fallback.

**Stage 3: Review Your Benefit Estimate** — System calculates benefit using verified data (or saved scenario inputs). Read-only display with full formula transparency. "Looks correct — continue" or "Something seems wrong" (creates flag).

**Stage 4: Select Your Payment Option** — Shows all available options with member amount and survivor amount. Contextual explanation of permanence and trade-offs. Beneficiary name and age displayed for context.

**Stage 5: Review & Submit** — Summary of all selections. Two acknowledgment checkboxes (estimate subject to verification, payment option is permanent). Submit button.

### Staff Stages (member sees status only)

After submission, member sees activity log of staff progress (verified employment, verified salary, documents reviewed, etc.) with estimated completion timeline. Staff can bounce back to member with a message and document request.

### Concurrent Data Changes

When a member changes data during an active application:
- Warning at point of change: "This may affect your application"
- After change is approved, affected stages are reset per configurable impact rules
- Member sees which stages need re-review and why
- Impact rules defined in plan profile (e.g., beneficiary_change resets payment_option stage)

### Integration

Maps to existing case management service (port 8088). New case type for member-initiated retirement. `POST /api/v1/cases/{id}/bounce` endpoint for staff-to-member handback.

---

## 10. My Benefit (Retirees & Beneficiaries)

### Sub-Tabs

Payments | Tax Documents | Benefit Details | Manage

### Payments Tab

- Next payment card: gross, deductions (federal tax, state tax), net deposit, bank and date
- Payment history table: monthly ledger going back to first payment

### Tax Documents Tab

- 1099-R forms by year, downloadable as PDF
- "Request paper copy" option

### Benefit Details Tab

- Permanent record of how benefit was calculated (from finalized case snapshot)
- Full formula breakdown: AMS, multiplier, service years, reduction, J&S factor
- Effective date, retirement type, payment option, named beneficiary

### Manage Tab

- **Direct deposit**: View current, change with re-authentication + 48-hour security hold + staff review + uploaded voided check
- **Tax withholding**: Change immediately (no staff review — member's own tax election)
- **Benefit verification letter**: Generate on demand via correspondence service, immediate PDF download
- **Address**: Update immediately

---

## 11. Beneficiary Experience & Death Workflow

### Death Notification

Phone is the primary path (not online). Portal provides a phone number with hours, plus an online notification form as secondary option.

Online flow: About the retiree (name, DOB, date of death) -> About you (name, relationship, contact info) -> Confirmation with reference number, next steps, document checklist, timeline.

### After Notification

1. Retiree account flagged, payments suspended
2. Staff creates survivor benefit case
3. Named beneficiaries notified by mail + email with portal invitation
4. If beneficiary already registered (dual role), portal updates automatically

### Survivor Benefit Application

Simplified tracker: Notify -> Documents -> Review -> Staff Review -> Payments Begin. Estimated survivor benefit shown based on retiree's payment option. Documents: death certificate, photo ID, marriage certificate (if spouse).

### Lump Sum Death Benefit

Shows benefit amount, allocation percentage, document requirements, payment method selection (check or direct deposit), claim status.

### Language Guidelines

- Use the person's name, not "deceased member"
- Lead with empathy: "We are sorry for your loss"
- Always provide phone number — don't force digital-only
- "passed away" not "died"
- Clear timelines — no open-ended waiting
- No automated status language ("Case closed") — use outcome language ("Benefit payments have begun")

---

## 12. Messages & Activity Tracker

### Activity Tracker

Unified view of all in-flight items organized by urgency:
- **Action Needed**: Items requiring member response (document requests, rejected changes, bounced-back application steps)
- **In Progress**: Items being processed (retirement application, pending beneficiary changes, data correction investigations)
- **Recently Completed**: Resolved items (approved changes, uploaded documents, completed reviews)

Aggregates from: Issues service (corrections, changes, verifications), Case management (applications), Document metadata.

### Secure Messages

Threaded conversations between member and staff. File attachments supported. Messages linked to activity items where relevant. New message badge in portal header.

### Interaction History

Full chronological record of ALL contact: phone calls, emails, in-person visits, portal messages, letters sent. Read-only for members. Pulled from CRM service. Filterable by type and date range.

### Notification Integration

Events trigger notifications per member's communication preferences:
- Action needed: in-portal + email + SMS (if opted in)
- Application updates: in-portal + email + SMS (if opted in)
- New messages: in-portal + email + SMS (if opted in)
- Document requests: in-portal + email + SMS (if opted in)
- Payment deposited: in-portal (email/SMS optional)
- Tax documents: in-portal + email

In-portal always on. Badge count reflects unread messages + action-needed items.

---

## 13. Documents

### My Checklist View

Dynamic checklist based on member situation (configurable per plan profile):
- **Outstanding**: documents needed, with context ("Needed for: Retirement Application"), accepted formats, upload button
- **Received**: uploaded documents with status

Checklist rules defined in plan profile (document type, required_when condition, applicable contexts, accepted formats, max size).

### All Documents View

Chronological archive: Documents You Uploaded, Documents From Us (statements, letters, 1099-Rs), DRO Court Orders.

DROs and marriage certificates viewable but not downloadable (security — may involve other parties). Member can request copies through Messages.

### Document Storage

Upload flow: Member uploads -> S3 quarantine -> virus scan (ClamAV/cloud-native) -> if clean: S3 staging -> ECM ingestion (async) -> portal stores ECM reference, deletes staging copy.

Portal stores metadata only (ECM document ID, type, upload date, status). Actual files live in ECM. Downloads via ECM signed URLs.

ECM integration via pluggable interface:
```typescript
interface ECMProvider {
  ingest(file: Buffer, metadata: DocumentMetadata): Promise<ECMDocumentRef>
  retrieve(ref: ECMDocumentRef): Promise<SignedURL>
  delete(ref: ECMDocumentRef): Promise<void>
}
```

Accepted file types: PDF, JPG, JPEG, PNG, TIFF, HEIC, DOC, DOCX, XLS, XLSX. Max 25MB. HEIC converted to JPEG server-side. Magic byte validation server-side.

Retention: managed by ECM per document type policy (life of member + 7 years for legal documents, 7 years for routine, 3 years for generated letters).

---

## 14. Preferences

### Communication Preferences

Matrix of notification types x channels (in-portal, email, SMS). In-portal always on. Email defaults on. SMS defaults off — explicit opt-in per category with phone number.

Legally required notifications (direct deposit change confirmation, application status changes, annual statement, payment suspension) cannot be turned off — shown as always-on with explanation.

SMS compliance (TCPA): explicit opt-in, confirmation text, STOP handling, frequency cap (3/day), no sensitive data in SMS content.

### Accessibility Settings

- Text size: Standard (16px) / Larger (18px) / Largest (20px)
- Contrast: Standard / High contrast (7:1 AAA)
- Reduce motion: minimize animations and transitions

Applied via CSS custom properties. Stored per-user in preferences.

### Security Settings

Delegates to Clerk built-in UI: password change, 2FA management, active sessions, sign out other sessions.

---

## 15. Staff-Side Work Queue

All member-initiated requests flow into a unified work queue in Staff Portal.

### Priority Assignment (Auto)

- **Red**: Identity verification, blocked applications — member can't proceed
- **Orange**: Retirement application stages — time-sensitive
- **Yellow**: Profile changes, data corrections — member waiting
- **Green**: Document reviews, routine changes — no one blocked

### Resolution Flow

Staff sees: member's request, current data, proposed change, evidence documents, impact assessment (for salary/service corrections: shows benefit impact). Resolution options: Approve / Reject (with mandatory note) / Escalate.

### Auto-Processed Items (No Staff Work Item)

- Benefit verification letter generation
- Tax withholding changes
- Address/phone/email updates

### Work Item Types

Identity verification, profile change (sensitive), beneficiary change, data correction, document review, direct deposit change, retirement application stage, refund application stage, survivor benefit claim, death benefit claim.

---

## 16. Security

### Member Data Exposure Controls

- Rate limiting on identity verification (3/email/24hr, 5/IP/hr)
- Financial changes (direct deposit) require re-authentication + 48-hour hold + staff review
- SSN: last 4 only ever displayed
- Bank accounts: last 4 only
- Session timeout: 30 minutes inactivity with 5-minute warning
- IP change during session triggers re-authentication
- Concurrent session limit: 3 per member
- All sessions visible in Security preferences

### Member Audit Trail

Every member action logged: authentication, profile views, profile changes, calculator usage (inputs + results), application actions, data flags, messages, preference changes.

Each entry includes: IP address, user agent, timestamp, action details.

Staff can query member portal activity from staff-side member dashboard. Members cannot see their own audit trail (Activity Tracker covers actionable items).

Audit entries are immutable, append-only. Logging is async (doesn't block member actions). Extends existing audit trail service.

Retention: 7 years for authentication, profile changes, financial actions, application actions. 3 years for views, calculator usage, messages, preferences.

### Anomaly Detection (Phase 2)

IP geolocation anomaly detection deferred. Current controls (48-hour financial hold, session visibility, re-auth) cover highest-risk scenarios.

---

## 17. Plan Configurability

### Plan Profile

Each deployment has a `plan_profile` configuration document (YAML/JSON) that drives all plan-specific behavior. The portal reads configuration; it contains no hardcoded plan specifics.

### Plan Profile Sections

- **identity**: plan name, administrator, contact info, logo
- **benefit_structure**: type, formula display, tiers, eligibility rules, payment options, early retirement reduction, service credit types
- **member_statuses**: status-to-persona mapping, available options per status
- **documents**: checklist rules (document type, required_when conditions, contexts, accepted formats)
- **field_permissions**: which fields are immediate-edit vs. staff-review
- **data_change_impacts**: trigger-to-stage-reset mapping for active applications
- **notifications**: available channels, defaults, legally required notifications
- **help_content**: glossary source, tour version, plan-specific term definitions
- **refund**: availability, what's included, withholding, rollover rules, early withdrawal penalty
- **death_benefits**: lump sum availability, survivor pension availability
- **notification_templates**: email/SMS/in-portal templates with merge fields

### What's Configurable vs. Coded

| Plan Profile (Config) | Intelligence Service (Go Code) |
|----------------------|-------------------------------|
| Labels, descriptions, display formatting | Actual calculations (AMS, benefit, reduction, J&S) |
| UI rules (field permissions, document checklists) | Eligibility evaluation logic |
| Help content, glossary terms | Formula execution |
| Notification templates and routing | Monetary arithmetic |
| Application stage impact rules | |

### Admin UI

No plan profile editor UI in this phase. Profile is a YAML/JSON file managed by developers. Self-service admin UI is a future product feature.

---

## 18. Backend Changes

### Existing Services — Extensions

**Data Access (8081):**
- `GET /api/v1/members/{id}/addresses` (new)
- `PUT /api/v1/members/{id}/addresses/{aid}` (new)
- `GET /api/v1/members/{id}/payments` (new, retirees)
- `GET /api/v1/members/{id}/tax-documents` (new, retirees)
- `GET /api/v1/members/{id}/refund-estimate` (new, inactive)

**Intelligence (8082):** No changes — existing calculate, eligibility, options, scenario endpoints.

**Case Management (8088):**
- `POST /api/v1/cases/{id}/bounce` (new — staff bounces to member)

**Correspondence (8085):** New template: `benefit_verification`.

**CRM (8083):** No changes.

**Issues (8092):** New issue types: `identity_verification`, `profile_change`, `beneficiary_change`, `data_correction`, `direct_deposit_change`, `document_review`. Structured `details` JSONB per type.
- `POST /api/v1/issues/{id}/documents` (new — upload document to issue)
- `GET /api/v1/issues/{id}/documents` (new)
- `GET /api/v1/documents/{id}/download` (new — signed URL)

### New Endpoints

**Scenarios** (lightweight, in data access or new micro):
- `POST /api/v1/scenarios` — save (max 5 per member)
- `GET /api/v1/scenarios?member_id=` — list
- `GET /api/v1/scenarios/{id}` — detail
- `DELETE /api/v1/scenarios/{id}` — delete

**Notifications** (new lightweight service or in existing):
- `GET /api/v1/notifications?member_id=` — unread
- `PATCH /api/v1/notifications/{id}/read` — mark read
- `POST /api/v1/notifications` — create (internal)

**Member Preferences:**
- `GET /api/v1/members/{id}/preferences`
- `PUT /api/v1/members/{id}/preferences`

### New Database Tables

1. `member_account_links` — Clerk user ID <-> pension member ID mapping
2. `member_preferences` — communication/accessibility preferences (JSONB)
3. `saved_scenarios` — what-if calculator saved scenarios
4. `notifications` — notification records with delivery status
5. `documents` — document metadata (ECM reference, type, status, linked entity)
6. `document_checklist_templates` — configurable per-plan requirements

### Extended Tables

- `issues` — new issue types enum, structured `details` JSONB
- `cases` — `bounced_to_member` status, `bounce_message` field

### Authentication

`member_account_links` table maps Clerk user ID to pension member ID. API middleware resolves identity on every request. All member endpoints enforce own-data-only access.

---

## 19. Notification Providers

### Architecture

Provider-agnostic interface:
```typescript
interface NotificationChannel {
  send(recipient: ContactInfo, template: string, data: Record<string, unknown>): Promise<DeliveryResult>
  checkStatus(deliveryId: string): Promise<DeliveryStatus>
}
```

Recommended initial providers: Resend or SendGrid (email), Twilio (SMS). Swappable via adapter pattern.

### Email Deliverability

Dedicated sending domain with SPF, DKIM, DMARC. Plain text alternatives. Onboarding prompt to add sender to contacts.

### SMS Compliance (TCPA)

Explicit opt-in, confirmation text, STOP handling (Twilio auto), frequency cap (3/day), no sensitive data in SMS. Opt-in record retained for compliance.

### Template Management

Templates in plan profile configuration with merge fields. Plan-configurable voice and branding.

---

## 20. Accessibility (Cross-Cutting)

### WCAG 2.1 AA Requirements

- Color contrast 4.5:1 (7:1 in high contrast mode)
- Full keyboard navigation with visible focus indicators
- Screen reader support: semantic HTML, ARIA labels, live regions
- Text resizable to 200% without clipping
- Target size 44x44px minimum
- No color-only information — icons + text alongside color
- Form errors described in text, linked to fields, announced by screen readers

### Demographic-Specific Design

- Body text minimum 16px, never smaller
- Line height 1.6 minimum
- No light/thin font weights — minimum font-medium
- Single click/tap only — no double-click, drag-and-drop, or gestures
- No hover-only information
- Persistent field labels (not placeholder-only)
- Generous spacing between interactive elements
- Confirmation on destructive actions
- Persistent sidebar on desktop (no hamburger)
- Breadcrumbs on every sub-page
- Explicit "Back" buttons
- Session timeout: 30 min with 5-min warning and extend option
- No auto-advancing content
- Chunked file upload for slow connections
- Calculator debounced at 500ms (not disorienting)

### Responsive Behavior

- Desktop (>=1024px): Sidebar + main + optional help panel
- Tablet (768-1023px): Collapsible sidebar, full-width content, help as modal
- Mobile (<768px): Bottom tab bar, stacked cards, simplified layouts
- Calculator: inputs stack above results on tablet/mobile, sliders become number inputs with increment/decrement

---

## 21. Testing Strategy

### Demo Accounts (8 personas)

| ID | Persona | Key Characteristics |
|----|---------|-------------------|
| 10001 | Active, near retirement | 24+ yrs, Tier 1, married, DRO, beneficiaries |
| 10002 | Active, early career | 8 yrs, Tier 2, purchased service |
| 10003 | Inactive, vested | 6 yrs, Tier 3, refund vs. deferred |
| 10004 | Inactive, not vested | 3 yrs, refund only |
| 10005 | Retiree | Retired 2023, 100% J&S, payment history |
| 10006 | Survivor beneficiary | Spouse, ongoing monthly payments |
| 10007 | Lump sum beneficiary | Child, $5K death benefit |
| 10008 | Dual role | Active member + survivor beneficiary |

### Dev Auth Extension

DevRoleSwitcher extended with persona-specific member logins. Identity verification bypass (compile-time gated, dev/staging only).

### Notification Testing

- Dev: emails to Mailhog/Mailpit, SMS to console + dev_sms_log table
- Staging: real providers, restricted allowlist

### Test Layers

| Layer | What | Tool |
|-------|------|------|
| Unit | Plan profile parsing, field permissions, staleness detection, notification routing | Vitest |
| Component | Each section renders per persona, form validation, tour steps | Vitest + Testing Library |
| Integration | API endpoints return correct member-scoped data, auth enforcement | Supertest |
| E2E | Full workflows per persona (registration, calculator, application, retiree self-service) | Playwright |
| Accessibility | WCAG 2.1 AA automated + manual | axe-core + keyboard/screen reader |

### Key E2E Scenarios

1. Full retirement application lifecycle (member submits -> staff reviews -> bounce back -> member responds -> staff certifies)
2. Data change during active application (beneficiary change resets payment option stage)
3. Inactive member refund application with rollover
4. Retiree direct deposit change with 48-hour hold
5. Beneficiary death notification and survivor claim
6. Registration with auto-match success, failure, and ambiguous match

---

## 22. Research Sources

Design informed by best practices from:
- [European Commission Pension Tracking System UX Guidelines (2025)](https://eur-lex.europa.eu/legal-content/EN/TXT/PDF/?uri=PI_COM:C(2025)9300)
- [NY State Comptroller Retirement Online — What-If Estimator](https://www.osc.ny.gov/retirement/members/estimate-your-pension)
- [CalSTRS Calculators — "What If" and "Why Wait"](https://www.calstrs.com/calculators)
- [Seattle SCERS Member Self-Service Portal](https://www.seattle.gov/retirement/retired-members/mss-portal)
- [UNJSPF Member Self-Service (MFA + Statement of Benefits)](https://www.unjspf.org/resources/about-member-self-service/)
- [Bentek Retiresweet — Guided Retiree Enrollment](https://mybentek.com/platform/retiree-administration/)
- [Benefitfocus — Connected Benefits Portal](https://www.benefitfocus.com/resources/blog/benefits-portals-entryways-connected-benefits-experience)
- [PMC — Older Adults' Portal Use Challenges](https://pmc.ncbi.nlm.nih.gov/articles/PMC7326638/)
- [Level Access — Web Accessibility for Older Adults](https://www.levelaccess.com/blog/ensuring-web-accessibility-for-older-adults/)
- [PA PSERS Member Self-Service Portal](https://www.pa.gov/agencies/psers/member-resources/mss-default)
