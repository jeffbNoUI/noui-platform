# COPERA — Employer & Related Domains: Business Functionality Reference

**Version:** 1.0 | **Date:** March 2026  
**Purpose:** Claude Code build reference. All rules and processes are COPERA-specific and authoritative.  
**Sources:** COPERA BPI v1.0 — Employer Reporting, Employer Portal, New Member Enrollment, Terminations, WARET, Customer Service, Payroll Processing · PRISM Key Initiatives RMD-006 · Key Initiatives Appendix C  
**Implementation target:** COPERA (Colorado PERA, ~600k members). For DERP plan provisions, consult separate DERP project knowledge documents.

---

## COPERA Plan Context (Read Before Building)

- COPERA has five employer **divisions**: State, School, Local Government, Judicial, DPS (Denver Public Schools). Many rules — especially WARET designation types and ORP eligibility — are division-specific.
- The legacy PAS is the **IBMi iSeries**. The current employer-facing portal is **STARS**. NoUI replaces both.
- COPERA employer contributions have three components beyond the normal rate: **AED** (Amortization Equalization Disbursement) and **SAED** (Supplemental AED). Both appear in contribution reporting and validation logic and are division-specific.
- **PERAChoice** is a DC plan option available to certain members at hire within a 60-day election window. New Member Enrollment must route PERAChoice-eligible members to the DC team. This is a COPERA-specific routing requirement.
- **Benefit estimates** are a high-volume COPERA activity. They share the eligibility and calculation rules used in service retirement and must be designed as reusable capabilities.

---

## Domain Map and Initiative Alignment

| Domain | Primary Initiative | Key Dependencies | Boundary — What It Excludes |
|---|---|---|---|
| Employer Portal | EN-EMPPORT | EN-EMPREPT, EN-EDQ, FN-IAM | Reporting workflow automation (EN-EMPREPT); contribution posting (EN-EMPPAY) |
| Employer Reporting | EN-EMPREPT | EN-EMPPORT, EN-EDQ, FN-DATA-ARCH | Portal UX (EN-EMPPORT); GL/posting (EN-EMPPAY, EN-FININT) |
| New Member Enrollment | EN-RECKEEP + EN-NME | EN-MDQ, EN-EMPPORT, DC team routing | Ongoing salary/status reporting (EN-EMPREPT); benefit calculations (EN-RET) |
| Terminations | EN-REFUND + EN-RECKEEP | EN-EMPREPT (final contribution), EN-RECKEEP | Retirement path (EN-RET); disability (EN-DISAB); DRO splits (EN-DRO) |
| WARET | OUT-WARET | EN-EMPREPT, EN-RECKEEP, FN-RULES-ENG | Downstream benefit adjustments, tax reporting (OUT-TAX) |
| Service Credit Purchase | EN-SCP | EN-RECKEEP, EN-EMPPAY (installments) | Benefit eligibility testing (EN-RET consumes SCP output as data) |
| Customer Service | EN-CRM + EN-OMNI | FN-CASEMGMT, FN-WORKFLOW, EN-MSGCTR | Case processing execution (workflow owns it); digital UX design (EN-UPAI, EN-MP) |

---

## 1. Employer Portal (EN-EMPPORT)

### Current State
**Legacy system:** STARS (Secure Transmission and Reporting System) — IBMi-backed. Key deficiencies: heavy reliance on paper/PDF forms, limited real-time validation, no dynamic workflows, file upload lags from IBMi backend, no role-based onboarding, employers use encrypted email for file exchange outside the portal.

### Role Model

| Role | Description | Key Capabilities |
|---|---|---|
| Super User | Designated per employer, full portal access | User setup, role assignment, password reset, access revocation — all actions audit-logged |
| Payroll Contact | Submits contribution files, resolves reporting exceptions | File upload, error correction, payment setup |
| HR Contact | Manages member demographic data and enrollment | New hire reporting, termination reporting, data corrections |
| Read-Only | Views status without submission rights | File status, member status, reports |
| COPERA Staff (mirrored) | COPERA staff can perform all employer actions at parity | Full portal capability for troubleshooting and support |

### Onboarding and Access Management
- Role-based onboarding modules tied to user roles (Payroll, HR) — historical materials retained for new users
- Annual review workflow: authorized contact confirms correct users still have access
- Super User grants/revokes access in real time with full audit trail
- Agency Directory integration: employer contact records and user access roles synchronized in real time
- COPERA staff can perform all employer portal actions at parity with employer users

### Contribution Submission UX
- File upload (text or Excel) with real-time format validation on upload
- Manual grid entry with full validation equivalent to file upload — row-level error feedback
- Visual progress tracker: processing status, estimated wait time, notification on validation completion
- **Partial posting:** valid records proceed; failed records held in correction queue with clear status
- Late interest payable directly through the contribution reporting workflow
- Credits/debits applicable by both COPERA and employer when applicable
- Multiple files per payroll period: system auto-merges for a single payment setup; upload history tracks each file individually and collectively

### Communication and Alerts
- Secure messaging: audit-tracked, threaded, linked to specific workflows or exceptions — visible to both employer and COPERA
- Structured exception responses within messages: Resolved / Needs More Info / Escalated
- Messages close automatically when the linked issue is resolved
- System-wide alert banners: deadlines, unresolved tasks, critical updates, policy changes
- Per-employer default communication method settable by authorized contact; each user maintains own preference
- File email exchange should be disabled — portal upload with confirmation replaces encrypted email attachment workflow

### Dashboard and Transparency
- Real-time submission history and status tracking
- Exception dashboard: categorized by status, age, and exception type
- COPERA role-based dashboard: Customer Service Team has read-only access to employer file and member-level status
- Usage analytics tracked to support portal configuration decisions
- Task-based navigation: groups functions by workflow (e.g., "Report a New Hire," "Submit Contributions") and guides users sequentially

### Gaps
- **GAP:** Agency Directory current state (system of record, data quality, sync frequency) not documented in BPI. Confirm before building real-time sync.
- **GAP:** Specific COPERA forms that are candidates for digitization are not enumerated. Form inventory session with COPERA staff needed before form modernization is scoped.
- **UNCLEAR:** NoUI Data Connector must be the integration point — not a direct IBMi connection from the portal layer. Confirm architecture boundary with connector team.

---

## 2. Employer Reporting (EN-EMPREPT)

### Overview
Employer Reporting is upstream of every downstream COPERA process. Member service credit, benefit calculations, financial reconciliation, and tax processing all depend on accuracy and timeliness of employer-submitted payroll data.

**Scale:** COPERA reviewed 5,531 salary reports in a recent measured period; 558 required employer follow-up (~10% rework rate).

### Contribution Categories

| Code | Description | Validation Notes |
|---|---|---|
| Employee contribution | Member's required contribution | Validate against expected rate by plan type, tier, salary |
| Employer contribution (normal) | Employer's matching contribution | Validate against employer rate by division |
| AED | Amortization Equalization Disbursement | Division-specific rate; validate against current AED schedule |
| SAED | Supplemental AED | Division-specific rate; validate against current SAED schedule |
| WARET / WARRC | Contributions for working retirees | Separate validation; retiree IC flag must be present |
| ORP | Optional Retirement Plan — higher education only | Distinct contribution path; ORP-specific validation required |

### Submission Lifecycle

| Stage | What Happens | Pain Point / Target |
|---|---|---|
| 1. Upload / Entry | File upload (text or Excel) or manual grid entry | Manual entry errors common; no front-end guidance on known error patterns |
| 2. Format Validation | Field lengths, required fields, numeric constraints | IBMi lag creates status blindness for employers |
| 3. Business Rule Validation | Rates by plan/tier/salary; enrollment check; retiree/IC differentiation | All exceptions require manual COPERA review before employer sees feedback |
| 4. Exception Handling | Failed records to exception queue; partial posting of valid records | Single bad record blocks entire file; exceptions handled via email threads |
| 5. Payment Setup | Configured after validation; blocked if discrepancies exceed threshold | Failed payment attempts not automatically escalated |
| 6. Payment Processing | ACH debit (COPERA-initiated) or wire transfer (employer-initiated) | Wire transfer requires manual deposit matching |
| 7. Correction / Replacement | Replace before processing; delete payment to replace after setup; correction files auto-merged if flagged | No structured correction workflow — currently email loops |
| 8. Posting / Reconciliation | Contributions posted to member records; versioned summary sheet generated | HAS year breakdown not displayed; recalculations are frequent |

### Business Rules for the Rules Engine

> **These are configurable rules — rates change by board action and legislation. Do not hardcode.**

- **Contribution rate validation:** employer-submitted rates must match the plan-type × tier × salary matrix by division
- **Enrollment validation at upload:** any SSN not matching an active member record must be flagged (not silently rejected). Distinguish: (a) unrecognized member, (b) wrong SSN, (c) member in wrong plan type
- **Retiree/IC differentiation:** detect whether a contribution record belongs to a working retiree (WARET path) or independent contractor. IC flag triggered by employer comment in payroll file
- **Salary spreading:** school employees may receive salary distributed over a period different from work performed. AMS calculation must account for spreading so the spread period does not inflate/deflate highest average salary
- **Partial posting:** file with validation failures must not block all valid records. Post valid records immediately; hold failed records in correction queue
- **Late contribution interest:** calculated against configurable rate tables by pay period. Minimum interest charges per employer. Accruals trackable and payable through portal
- **File replacement:** permitted any time before processing. After payment setup, employer must delete pending payment first. Correction files auto-merged if employer flags them

### Exception Workflow Requirements
- Exceptions categorized by status (unresolved, pending response, escalated), age, and type — visible to Employer Relations team
- Employer sees row-level error feedback with specific error codes and resolution instructions
- Employer can resolve individual record errors without resubmitting the entire file
- DC team (401k/457 exceptions) receives auto-routed exceptions based on contribution type — not manual email
- Held files released or rejected by ER staff via workflow toggle with reason codes; both employer and ER team notified
- Secure messages link to specific exception and payroll period; structured response options (Resolved, Needs More Info, Escalated)

### Gaps
- **GAP:** ORP-specific validation rules are not enumerated. Dedicated rules analysis session needed before ORP path is implemented.
- **GAP:** AED and SAED rate tables by division and effective date not in BPI. Must be retrieved from COPERA Finance before contribution rate validation rule is built.
- **UNCLEAR:** Specific payment setup discrepancy threshold value(s) not stated in BPI. COPERA staff must confirm.
- **UNCLEAR:** "Learning logic for recurring errors" (BPI Recommendation #1/#6/#7) is an AI-assisted pattern detection feature. Build configurable validation infrastructure first; AI-accelerated pattern learning is a later capability.

---

## 3. New Member Enrollment

### Overview
Enrollment creates the member record that all downstream processes depend on for the member's lifetime. Hire date determines benefit tier — it is effectively immutable without an audit-controlled override. ~20–30% of enrollments involve conflicting or duplicate records because both employer and member submitted independently.

### Enrollment Initiation Paths
- **Employer-initiated (~70–80%):** employer submits enrollment data via portal or contribution file. System sends automated notification to member to review and confirm demographic data electronically.
- **Member-initiated (~20–30%):** member submits enrollment form directly. System notifies employer to validate and confirm employment/eligibility data. Employer confirms, corrects, or flags discrepancies.
- **KBA Route (to be eliminated):** COPERA currently creates a shell account when contributions arrive with no enrollment record, then uses Knowledge-Based Authentication to reach the member. This is a process gap — eliminate by enforcing mandatory enrollment fields at contribution file submission.

### Required Enrollment Data

| Data Element | Criticality | Owner | Why It Matters |
|---|---|---|---|
| Hire Date | CRITICAL | Employer | Determines benefit tier and division. Cannot change without supervised override. |
| SSN | CRITICAL | Member / Employer | IRS identity, contribution records, duplicate detection, refund tax withholding (W-9) |
| Date of Birth | HIGH | Member | Age-based eligibility tests, PERAChoice window timing |
| Division / Plan Type | HIGH | Employer | Determines contribution rates, benefit formula, WARET limits, ORP eligibility |
| Personal Contact (email, address) | HIGH | Member | Work contact invalid at termination — personal contact required for post-employment correspondence |
| Employment Classification | HIGH | Employer | Determines pension eligibility (permanent vs. temporary, hours threshold, excluded positions) |
| PERAChoice Election Window | HIGH (if eligible) | Member / DC Team | 60-day window to elect DC plan. System must track window open/close and trigger DC team routing |
| Beneficiary Designation | MEDIUM | Member | Required for death benefit processing. Must be collectable after enrollment if not provided at enrollment |
| Gender | MEDIUM | Member | Actuarial purposes; ORP data research |

### Tier / Division Assignment
COPERA has five employer divisions with different benefit formulas. Both division and hire date determine the member's plan rules:
- **State Division:** CRS Title 24, Article 51
- **School Division:** includes K-12 and most higher education; ORP available to certain higher education positions
- **Local Government Division:** municipal employers affiliated with COPERA
- **Judicial Division:** judges and magistrates; separate benefit formula
- **DPS (Denver Public Schools):** separate benefit structure with DPS-specific provisions

**Critical:** if a member switches employers across divisions, service credit may transfer but governing rules for each period may differ. Re-hire/transfer enrollment requires a dedicated workflow distinct from new hire enrollment.

### Data Consistency Rules
- **Duplicate detection:** flag potential duplicates on SSN or name+DOB match before creating new record. Require administrative review before processing.
- **Conflict resolution:** when employer-submitted and member-submitted data disagree, do not auto-resolve. Place in resolution workflow with both parties notified. Data ownership: employer owns active employment data (salary, position, dates); member owns personal data (address, beneficiaries, contact preferences).
- **Mandatory fields:** SSN, hire date, plan/division code, and name are required — submissions without these must be blocked. System generates downloadable validation report for employer records.
- **W2 address cross-check:** system compares annual W2 address data against stored member addresses and flags inconsistencies.

### Gaps
- **GAP:** PERAChoice 60-day election window rules and eligible employer/position categories not fully enumerated in enrollment BPI. DC Team Processes BPI (in project knowledge) covers this — confirm handoff criteria before building PERAChoice routing trigger.
- **GAP:** Re-hire enrollment (returning member) — restoring prior service credit, checking refunded contributions, vesting continuity — documented only at high level. Dedicated re-hire workflow analysis needed.
- **UNCLEAR:** Employer vs. member data ownership policy has not been formally resolved by COPERA. Must be decided before field-level edit controls are built.
- **UNCLEAR:** Complete mandatory field set for employer enrollment submissions has not been published by COPERA. Formal field mapping session needed.

---

## 4. Terminations

### Overview
Termination begins when a member leaves covered employment and ends when their account is closed (refund/rollover) or placed in deferred status (vested member waiting for retirement age).

**Primary bottleneck:** Employer certification of last day worked. At any given time, ~75–100 COPERA termination cases are stalled because an employer has not yet submitted a certified termination date.

### Key Terms

| Term | Definition |
|---|---|
| Termination Certification | Employer confirmation of member's last day worked. Required before refund or rollover can be released. |
| ER Process | "Additional Employer Request" — outreach workflow when termination data is missing after refund form received |
| Pending Employer Certification | System status when refund form received but no termination certification on file |
| Refund | Return of employee contributions + accumulated interest to a terminated member |
| Rollover | Transfer of member's balance to another qualified plan |
| WARRC | Working After Retirement Retiree Contribution — deduction code for retirees returning to work |

### Process Stages
1. **Termination Report:** employer submits via STARS electronic file or paper Termination Certification form. Required fields: SSN, plan code, last day worked, final contribution amount. All required fields validated at import — failures go to Employer Data Exception queue with machine-readable error report.
2. **Certification Hold Logic:** if refund form received with no matching termination certification on file → system creates "Pending Employer Certification" status. Configurable countdown (currently 45 days). Automated reminders at defined intervals. Escalation to ER team before countdown expires. Auto-cancellation with member notification at expiry.
3. **Refund / Rollover Application:** member submits form. Requirements: signature, notarization, ACH info or financial institution certification (rollover), W-9. System blocks submission unless all mandatory fields pass real-time validation. Incomplete forms held with two 30-day outreach periods; no response → request canceled.
4. **Eligibility Check:** verify separation waiting period satisfied; confirm vesting (5 years); check for active disability application (blocks refund if disability application < 2 years old); check for active retirement application. For vested members taking refund: disclose pension forfeiture consequences and require signed acknowledgment.
5. **Calculation:** employee contributions + accumulated interest (compound interest, board-set rate, compounded annually on June 30). Mandatory 20% federal tax withholding for eligible rollover distributions. DRO deductions applied if applicable.
6. **Payment:** member elects direct payment or rollover. Payment locked N business days before disbursement — any subsequent change triggers approval workflow. ACH or check. Partial rollover supported (remainder refunded).

### Certification Hold — System Requirements
- Auto-create "Pending Employer Certification" status when refund form received with no termination date on file
- Configurable countdown (45-day default)
- Automated employer reminder schedule at configurable intervals
- Auto-escalation to ER team before countdown expires
- Auto-cancellation with member notification at countdown expiry
- Employer can submit termination date via portal ad-hoc (outside monthly file cycle) — auto-populates member record and releases hold
- All hold actions, reminders, escalations, and cancellations audit-logged with timestamps

### Special Cases
- **Retirees who re-enter employment and then terminate:** separate retired segment from active re-employment segment. Refund applies only to active-period contributions.
- **DRO on termination:** Legal team enters DRO refund info with alternate payee details. System blocks disbursement until DRO information is complete.
- **SSN mismatch:** disbursement blocked until resolved. All SSN maintenance actions audit-logged.
- **Pay-period vs. pay-date discrepancy:** cross-field edits at import flag mismatches immediately; failing rows to Employer Data Exception queue.
- **DPS Audit:** if a DPS Benefit Structure exists for a Refund/Rollover but no DPS Audit document is on file, a DPS Audit process is triggered before the refund can proceed.
- **PreRet:** if a disability application < 2 years old is on file when a refund is initiated, a PreRet workflow is triggered and the refund is held pending BSD Manager review.

### Gaps
- **GAP:** COPERA member contribution interest rate ("board-set rate") and effective date history not in BPI. Must be retrieved before refund calculator can be built.
- **GAP:** Specific COPERA statute citation and exceptions for the separation waiting period need confirmation.
- **UNCLEAR:** Whether the 45-day certification hold countdown will change in the modernized system — confirm with COPERA leadership before setting as default.
- **UNCLEAR:** Exact trigger conditions for PreRet process (disability application age threshold). Need formal rule documentation.

---

## 5. Working After Retirement (WARET / OUT-WARET)

### Overview
WARET governs how retired COPERA members may return to employment with a PERA-covered employer while receiving retirement benefits, or while suspending benefits in favor of re-employment. Non-disclosure of retiree status to an employer results in both the retiree and employer being liable for contributions.

### Annual Work Limits by Designation Type

| Designation Type | Annual Limit | Eligible Employers | Cap on Designated Retirees | Consecutive Year Limit |
|---|---|---|---|---|
| Standard (no designation) | 110 days OR 720 hours | All PERA employers | None — applies to all retirees automatically | None |
| 140-Day / 960-Hour | 140 days OR 960 hours | School and higher education employers | Up to 10 per district/campus; +1 per additional 1,000 students above threshold | 6 consecutive years, then 1-year break required |
| Critical Shortage | No day/hour cap | Eligible rural school districts, charter schools, BOCES | Varies by employer type; BOCES: up to 40 statewide (cap expires 2030) | 6 consecutive years, then 1-year break required |

**Day definition:** a "day" = more than 4 hours of work. 4 hours or fewer is tracked in hours only (does not count as a day toward the day limit).

**ORP Loophole:** retirees who selected the ORP in the 1990s and remained continuously employed are not subject to WARET limitations. Must be tracked per member and excluded from limit enforcement.

### Effective Month Rule
- Retirees may NOT work on the first business day of their effective month of retirement (the month benefits begin)
- Working any additional days in the effective month (beyond the first business day) → 5% per-day penalty applies to those days
- Working on the very first business day of the effective month → full benefit cancellation for that month (not a penalty reduction)

### Penalty Structure

| Violation Type | System Code | How Calculated | Who Pays |
|---|---|---|---|
| Days over annual limit | WARET Penalty | 5% of monthly benefit per day over the cap | Retiree only |
| Effective month work | WARET Penalty | 5% per day worked in effective month (excluding first business day cancellation) | Retiree only |
| Non-disclosure (retiree failed to notify employer) | WARPN | Both retiree and employer contribution amounts recovered from retiree's benefit | Retiree (both shares) |

Deductions split across months when a single month's deduction would exceed the net benefit available.

### PERACare Subsidy Interaction
- Retirees designated under Critical Shortage are **ineligible** for PERACare premium subsidy while designated
- When Critical Shortage designation submitted for a PERACare-enrolled retiree: (1) detect conflict, (2) generate subsidy impact letter giving retiree 30 days to respond, (3) auto-remove subsidy if no response or retiree confirms designation
- If retiree declines Critical Shortage to preserve PERACare → designation request canceled, employer notified

### Designation Processing
- **Forms:** CRITSHORTIN (Critical Shortage standard), CRITSHORTINB (Critical Shortage BOCES), 140DAYRETIN (140-day)
- System validates on submission: eligible employer type, valid PERA retiree, campus/district capacity not exceeded, consecutive year limit not exceeded
- Approval letter to employer lists approved retirees and remaining capacity
- Denial letter includes reason code (ineligible employer, missing hire date, capacity exceeded, etc.)
- All approved, denied, and expired designations archived with metadata, forms, and audit log

### Independent Contractor (IC) Detection
- Retiree providing services through a company they own, a family member owns, or their beneficiary owns → treated as working after retirement regardless of company structure
- Retirees working as ICs must submit Disclosure of Compensation form annually, distinguishing service compensation from product purchases or reimbursements
- System flags retirees receiving payments from PERA employers via 1099/W2 with no active designation on file
- Employer payroll submissions with IC comment trigger IC flag for review

### Annual Reconciliation
- **WARET Limit Worksheet:** submitted by retirees annually by March 31 if they exceeded the standard cap. Digital form with built-in validation and hour/day clarification tooltips.
- **Tax data reconciliation:** annual W2/1099 analysis cross-checks employer-reported payments against WARET tracking. Tax Data Mismatch Report flags retirees receiving payments without a proper employer report.
- **WARRC Monthly Report:** lists active retirees with WARRC deductions for the month, including IC contributions reported by ER team.

### Gaps
- **GAP:** CRS statute citations for WARET day/hour limits, effective month rule, and non-disclosure penalty not enumerated in BPI. Extract before coding rules.
- **GAP:** BPI advocates for legislative change from day-based to compensation-based limits — this is an open policy question. Implement current day/hour rules; design for future rules engine update if legislation changes.
- **UNCLEAR:** Whether the 6-year consecutive year limit applies equally to both 140-day and Critical Shortage paths, or only to Critical Shortage — confirm with COPERA Policy team.
- **UNCLEAR:** "Second retirement" pathway (member suspends, re-enters service, accumulates additional service credit, re-retires) not fully documented. Intersects EN-RET and EN-RECKEEP — needs dedicated process analysis.

---

## 6. Service Credit Purchase (EN-SCP)

> **NOTE: COPERA SCP BPI document (v1.0) was not available for analysis.** The following is based on the EN-SCP Key Initiatives Appendix C profile and general pension domain knowledge. Treat as an incomplete framework. Retrieve the SCP BPI before building SCP functionality.

### Confirmed Rules
- Purchased service credit is **included** in the benefit formula: credited service years × tier multiplier × HAS
- **EXCLUSION — Rule of 75/85:** purchased service NOT counted for eligibility test. Only earned service counts.
- **EXCLUSION — IPR:** purchased service NOT counted in IPR calculation
- **EXCLUSION — Vesting:** purchased service does NOT count toward the 5-year vesting requirement. Only earned service counts.
- Service type must be coded on the member record to enforce these exclusions. Each purchased service block requires: type code, service period start/end dates, service credit amount, and cost paid.

### Eligible Service Types (General Framework — Confirm from SCP BPI)
- Refunded prior PERA service: member redeposits prior contributions with interest
- Military service (USERRA): federal law governs makeup contributions for qualifying military leaves
- Prior public employment: service with another Colorado public employer before PERA affiliation
- Leave of absence: approved unpaid leave periods (plan-specific eligibility)
- PERAChoice transfer: member who initially elected DC plan and later transfers to DB plan

### Process Flow (Pending SCP BPI)
1. **Cost Quote:** system calculates cost using COPERA actuarial cost factor tables. Quote has expiration date — recalculation required after expiry.
2. **Eligibility Verification:** COPERA staff verify service period is eligible. Supporting documentation required.
3. **Cost Calculation:** cost factor applied to salary and age at purchase. Multiple cost factor tables exist based on tier and hire date window.
4. **Payment:** lump sum, direct rollover from qualified plan, or installment (confirm installment rules from SCP BPI). Partial payments may result in partial service credit.
5. **Record Update:** service credit added with correct type code and all three exclusion flags applied at record creation.

### Gaps
- **MAJOR GAP:** SCP BPI not available. This section is incomplete.
- **GAP:** Complete COPERA-eligible service type list not confirmed.
- **GAP:** COPERA installment payment rules not confirmed.
- **GAP:** Cost factor tables must be stored as versioned reference data, not hardcoded. Current tables and effective dates must be retrieved from COPERA.
- **UNCLEAR:** COPERA time limit (if any) within which a member must purchase eligible service.

---

## 7. Customer Service (EN-CRM + EN-OMNI)

### Overview
Customer Service is the convergence point for every other domain. Every exception, hold, and pending action generates potential member or employer contact.

**Current state:** COPERA uses Genesys for telephony. Agents navigate between Genesys, iSeries PAS, PERADocs, the Work Queue system, and email — no unified agent desktop. Member data lookups require manual PAS open after call connects.

### Unified Agent Desktop Requirements
- Single interface: telephony controls, member data, knowledge base, intake forms, case management — no toggling between systems
- Incoming call auto-opens member record when caller enters SSN or Employee ID via IVR
- Single session tab per member — system prevents duplicate tabs for the same member session
- All channel interactions (phone, secure message, email, workflow task) linked into a single conversation record per case

### Case Management and Routing
- Cases routed to agents based on configurable skill tags (e.g., "survivor benefits," "disability," "WARET," "contribution exception")
- Overflow routing: when primary agents unavailable → secondary skilled groups or voicemail queues automatically
- SLA due dates tagged on each work item; manager dashboard shows % on target, nearing breach, and breached; alerts before SLA breach
- Call transfer: carries associated case, workflow, and notes to the receiving agent; detects unavailability and returns to originating agent if needed
- Originating agent receives confirmation when escalated task is completed, rejected, or times out
- Duplicate inquiry detection: merges duplicate inquiries across channels referring to same member and topic — prevents parallel cases for the same issue
- Case association: system can link, split, or consolidate related cases and display linkages

### Note Capture and Communication
- Structured note template with required fields: date, call category, summary, outcome, next step — submission blocked if any required field is blank
- Call categories maintained centrally; granular wrap-up codes mapped to parent categories; authorized staff revises without coding
- Real-time call transcription and scoring against COPERA criteria; context-sensitive knowledge articles surfaced during live call
- Ad hoc, batch, and workflow-triggered correspondence with conditional paragraphs and delivery preference enforcement
- Outbound voicemail attempts logged with configurable threshold; auto-close or escalate when threshold reached

### Employer-Facing Customer Service
- Authorized agents can initiate employer outreach directly from case management, set follow-up reminders, and log correspondence history
- Role-based read-only dashboard for Customer Service Team: employer file status and member-level status without requiring ER team intermediary
- Employer portal customer service integrated with main case management — not a separate silo

### Self-Service and Deflection
- Members can book callbacks through the member portal
- Knowledge base articles and chatbots for common questions after hours
- English and Spanish required for member-facing screens and notifications
- Recording consent prompted during verification; calls where consent not granted are flagged

### Context the Workspace Must Surface by Inquiry Type

| Inquiry Topic | Workspace Must Surface |
|---|---|
| Contribution / payroll issue | Employer submission history, latest file status, unresolved exceptions, exception age, employer contact info |
| Enrollment / member record | Enrollment date, tier/division, duplicate flag, employer who submitted, PERAChoice election status |
| Termination / refund | Separation date, certification status, countdown remaining, vesting status, open refund application status |
| WARET compliance | Designation type and status, cumulative hours/days YTD, limit remaining, penalties applied, PERACare subsidy status |
| Service credit purchase | Purchased service balance, pending applications, cost factor used, invoice and payment status, exclusion flags |
| Benefit estimate | Eligibility tier, service credit totals (earned vs. purchased), best AMS period, estimated benefit ranges, reduction scenarios |
| Retirement application | Full retirement workspace (6-stage process — see service retirement process document) |
| Death / survivor | Retiree death date, payment option on file, last payment date, survivor identity and benefit entitlement, overpayment check status |

### CRM Entity Model
- **Customer** (member, retiree, employer contact, beneficiary) — has Contact History, Preferences, linked Cases
- **Case** — linked to Customer, has Category, SLA timer, Owner, Status, and full Interaction Log
- **Interaction** — single touchpoint (call, message, email, voicemail); has channel, timestamp, agent ID, transcript/notes, outcome
- **Task** — actionable follow-up from Interaction; has assignee, due date, SLA, and completion status

### Gaps
- **GAP:** Current Genesys configuration (IVR routing rules, queue structure, skill tagging) not documented in BPI. Needed before designing replacement routing rules — do not discard institutional knowledge embedded in current IVR.
- **GAP:** Knowledge base content (articles, scripts, talking points) not inventoried. COPERA must identify and provide source content before this can be built.
- **UNCLEAR:** Colorado recording consent requirements for pension plan call centers — one-party vs. two-party consent by call category. Needs legal confirmation before recording consent workflow is built.
- **UNCLEAR:** SLA target table by inquiry type referenced as configurable but no baseline values provided. COPERA must define the SLA table.

---

## 8. Cross-Domain Relationships

### Process Dependency Chain
- **Employer Reporting → New Member Enrollment:** contribution file with unrecognized SSN triggers enrollment validation and record creation workflow
- **New Member Enrollment → All Domains:** hire date (tier/division), SSN, and contact data set here are consumed by every subsequent process for the member's lifetime
- **Employer Reporting → Terminations:** final contribution receipt is a prerequisite for termination finalization; pay-date vs. pay-period discrepancies in the final report are the leading cause of termination processing delays
- **Terminations → Refund / SCP:** any in-progress service credit purchase must be resolved before refund account balance is calculated and disbursed
- **Employer Reporting → WARET:** working retirees appear in employer payroll submissions; hours/days worked feeds the WARET tracking system
- **WARET → Benefit Payroll:** penalty deductions (WARRC/WARPN) applied to monthly benefit payment — WARET is upstream of benefit payroll for working retirees
- **All Domains → Customer Service:** every exception, hold, and pending action in every domain is a potential inbound contact

### Employer as a Shared Entity
Employer participates in every domain — must be a first-class shared entity across all workspaces, not domain-siloed.

| Domain | Employer Role |
|---|---|
| Employer Portal | Primary user — submits all data, manages users, resolves exceptions |
| Employer Reporting | Data submitter — payroll files, correction files, payment remittance |
| New Member Enrollment | Enrollment initiator for new hires; confirms member-submitted data |
| Terminations | Certifies last day worked — the gateway action for the entire termination process |
| WARET | Submits designation requests, reports working retiree hours, receives compliance notifications |
| Customer Service | Receives outreach from ER team; may be the calling party for employer inquiries |

### Shared Data Elements

| Data Element | Domains That Consume It |
|---|---|
| Member SSN / ID | All domains — primary member lookup key |
| Hire Date | Enrollment (tier/division), Reporting (contribution rate), Terminations (contribution history), SCP (cost factor) |
| Division / Plan Type | Reporting (contribution rates, AED/SAED, ORP flag), Enrollment (benefit formula), WARET (designation eligibility, limit type) |
| Employment Status | Reporting (WARET flag for working retirees), Terminations (refund eligibility), WARET (designation eligibility) |
| Employer ID / Division Code | Reporting (submission routing), Enrollment (employer initiator), Terminations (certification sender), WARET (designation approver) |
| Service Credit (Earned vs. Purchased) | Terminations (vesting check), SCP (purchase base), Retirement (benefit calculation, Rule of 75/85 test) |
| Communication Preferences | Customer Service (channel selection), Terminations (notification), WARET (designation and PERACare letters) |

---

## 9. Master Gaps and Open Questions

### P1 — Must Resolve Before Rules Can Be Coded

| Domain | Open Question | Resolution Source |
|---|---|---|
| All | CRS statute citations for each domain's core rules — BPI documents reference processes but rarely cite specific statute sections | CRS Title 24, Article 51 — statutory research required domain by domain |
| Employer Reporting | AED and SAED rate tables by division and effective date | COPERA Finance / Actuarial team |
| Employer Reporting | Payment setup discrepancy threshold value(s) that block payment | COPERA Business Rules team |
| Terminations | Separation waiting period — exact COPERA statute citation and exceptions (certified leave of absence) | CRS Title 24 / COPERA Legal |
| Terminations | Member contribution interest rate (board-set) and rate history table | COPERA Finance / Board resolutions |

### P2 — Needed Before Implementation

| Domain | Open Question | Resolution Source |
|---|---|---|
| Enrollment | Complete mandatory field set for employer enrollment submissions | COPERA Business Rules / R&I team |
| Enrollment | PERAChoice 60-day window trigger criteria and eligible position/employer categories | COPERA DC Team BPI (in project knowledge) |
| WARET | CRS statute citations for day/hour limits, effective month rule, non-disclosure penalty | CRS Title 24 / COPERA Legal |
| WARET | Whether consecutive year limit applies equally to 140-day and Critical Shortage paths | COPERA Policy team |
| SCP | COPERA SCP BPI document — retrieve and analyze before building | PRISM project files |
| SCP | Complete eligible service type list; installment payment options; purchase time limits | SCP BPI / COPERA Benefits team |

### P3 — Needed Before Go-Live

| Domain | Open Question | Resolution Source |
|---|---|---|
| Customer Service | Colorado recording consent requirements for pension plan call centers | COPERA Legal |
| Customer Service | SLA target table by inquiry type | COPERA Operations |
| WARET | "Second retirement" process (suspend → re-enter → re-retire) | COPERA Benefits team |

### Missing Source Document

> **ACTION REQUIRED:** COPERA SCP BPI (v1.0) not analyzed. Section 6 (SCP) of this document is incomplete. Retrieve from PRISM project files, add to project knowledge, and produce an updated Section 6 before building SCP functionality.

---

## 10. Build Sequence

Build in dependency order — downstream domains must not start before their upstream data sources are stable.

- **Phase 1 (Foundation):** Employer Portal core (role management, file upload UX, secure messaging, Agency Directory sync) + New Member Enrollment (record creation, tier/division assignment, duplicate detection, PERAChoice routing trigger)
- **Phase 2 (Reporting Engine):** Employer Reporting validation engine (contribution rates by plan/tier/salary, exception routing, partial posting, payment setup, DC team auto-routing for 401k/457 exceptions)
- **Phase 3 (Event-Driven):** Terminations (certification hold workflow, separation wait enforcement, refund calculation, payment disbursement, DPS Audit path, PreRet hold)
- **Phase 4 (Compliance):** WARET (hour/day limit tracking, designation management, penalty calculation, PERACare subsidy interaction, IC detection, annual worksheet)
- **Phase 5 (Member Financial):** Service Credit Purchase (cost factor lookup, eligibility verification, purchase type coding with exclusion flags, payment tracking)
- **Phase 6 (Staff Platform):** Customer Service unified workspace (CRM entity model, case management, omnichannel routing, unified agent desktop composition)

---

## 11. Fiduciary Constraints (Apply to All Domains)

- **$0.00 tolerance:** refund calculations, contribution validations, penalty calculations, cost factor applications — all must be verifiable to the penny against hand calculations or authoritative source data
- **AI role:** rules configuration acceleration, workflow orchestration, exception triage pattern detection — NEVER calculation execution or benefit determination
- **Every calculation must trace** to a CRS statute section or COPERA Board resolution
- **Rules engine must support effective dating** — all rules can change by board action; historical rules must produce historically correct results for audit and corrections
- **Controlled terminology:** "AI-accelerated change management" (not "self-healing"), "AI-assisted" (not "AI calculated")
