# Member Context Hub — POC Scope Addition

## What We're Adding

The Member Context Hub is a CSR-oriented entry point into NoUI that demonstrates the platform understands how a pension office actually operates — not just case processing, but phone calls, walk-ins, and rapid member lookups. It reuses the existing component library and backend APIs, adding a new layout shell and a member search capability.

## Demo Narrative

The demo gains a powerful second act:

**Act 1 (existing):** "Here's how your analyst processes a retirement case." Walk through the four demo cases via the queue-driven task workspace. Shows composition, calculation transparency, data quality.

**Act 2 (new):** "Now your front desk gets a call. 'Hi, I'm Robert Martinez, I have a question about my retirement.'" CSR types the name, selects from results, and lands on the Member Context Hub. Cards show: open retirement application (in progress), recent salary update, benefit estimate, service credit summary. CSR answers the question in 30 seconds without opening a case or navigating menus. Then: "Let's say Jennifer Kim calls next — look how the cards adapt. No open tasks, but the scenario modeler card is prominent because she's approaching eligibility." This is the "our system has six screens for this" moment from the UX success criteria — but now from the CSR's perspective.

**Act 3 (existing):** Data quality findings, operational patterns, test suite.

---

## Incremental Build Requirements

### What Already Exists (No Additional Work)

These planned deliverables serve the Hub with zero modification:

| Planned Item | Hub Usage |
|---|---|
| MemberBanner component (Day 6) | Zone 1 of the Hub — identical component |
| AlertBar component (Day 6) | Zone 1 — same alerts surface in Hub context |
| All backend member APIs (Day 4) | Hub cards call the same endpoints |
| Eligibility/benefit/scenario APIs (Day 5) | BenefitEstimate and ScenarioModeler cards |
| EmploymentTimeline, SalaryTable, etc. (Days 6-7) | Cards expand into these components on tap |
| Composition engine logic (Day 8) | Hub card composition uses same Tier 1+2 pattern |

### What's New (Incremental Work)

#### Backend Additions

**1. Member Search Endpoint** — Add to Day 4 (Data Connector)
```
GET /api/v1/members/search?q={query}&limit=10
```
- Search by: last name, first name, member ID, or last 4 of SSN
- Returns: array of matching members with minimal context (name, ID, tier badge, status, department)
- Implementation: SQL `LIKE` query against MEMBER_MASTER with index on LAST_NM, MBR_ID
- Estimated effort: 2-3 hours (simple query endpoint, follows existing patterns)

**2. Member Context Summary Endpoint** — Add to Day 5 (Intelligence Service)
```
GET /api/v1/members/{id}/context
```
- Aggregates: open work items (from CASE_HIST), recent transactions (last 10 from TRANSACTION_LOG), active flags (DRO present, data quality findings, approaching eligibility milestones)
- Returns: structured context object that drives Hub card ordering and badge content
- Implementation: joins across CASE_HIST, TRANSACTION_LOG, DRO_MASTER, plus eligibility rule evaluation
- Estimated effort: 3-4 hours (aggregation query + flag evaluation logic)

**3. Hub Composition Endpoint** — Add to Day 5 (Intelligence Service)
```
POST /api/v1/composition/hub
```
- Input: member ID
- Fetches member context, evaluates Tier 1 (base cards) + Tier 2 (situational card ordering/visibility)
- Returns: ordered array of card definitions with parameters (which cards, what order, badges, expanded/collapsed)
- Composition rules:
  - If open tasks exist → OpenTasks card first, highlighted
  - If DRO present → DRO card appears (hidden for non-DRO members)
  - If member is deceased → survivor workflow card replaces benefit estimate
  - If member is non-vested → refund eligibility card surfaces
  - If member approaching Rule of 75/85 → scenario modeler card promoted
  - Default order: OpenTasks, RecentActivity, BenefitEstimate, ServiceCredit, Contributions, BeneficiaryInfo, Contact, Documents
- Estimated effort: 4-5 hours (composition logic mirrors task workspace composition)

#### Frontend Additions

**4. MemberSearch Component** — Add to Day 6 (Foundation)
- Search bar with debounced typeahead
- Results dropdown showing matching members with tier color-coding
- Selection navigates to Member Context Hub
- Empty state, loading state, no-results state
- Keyboard navigable (accessibility)
- Estimated effort: 3-4 hours

**5. MemberContextHub Layout Shell** — New, Day 8
- Three-zone layout: Zone 1 (MemberBanner + AlertBar), Zone 2 (card grid), Zone 3 (quick actions)
- Card grid: responsive, 2-column on desktop, single column on tablet
- Each card is a summary view with tap-to-expand into the full component
- Back-to-search navigation
- Estimated effort: 4-5 hours

**6. NavigationCard Component** — New, Day 8
- Reusable card container with: title, icon, badge (count/status), summary content area, tap target
- Summary content is card-type-specific but follows a consistent layout pattern
- Cards that expand open a slide-over or modal with the full component (e.g., tapping ServiceCredit card shows the full ServiceCreditSummary component)
- Estimated effort: 2-3 hours (generic container, card content is the existing components)

**7. Hub Card Content Adapters** — New, Day 8
- Thin adapter layer that maps existing component data into card summary format
- OpenTasksCard: list of work items with type, stage, age (data from /context endpoint)
- RecentActivityCard: timeline of last 5 events (data from /context endpoint)
- BenefitEstimateCard: most recent estimate amount + retirement date used (data from /benefit/calculate)
- ServiceCreditCard: total years (earned + purchased breakdown) (data from /service-credit)
- ContributionsCard: current balance, year-to-date contributions (data from /contributions)
- BeneficiaryCard: primary beneficiary name + relationship (data from /beneficiaries)
- ContactCard: address + phone on file (data from /members/{id})
- DROCard (conditional): status + alternate payee name (data from /dro)
- Estimated effort: 4-5 hours (each adapter is small; volume is the cost)

**8. QuickActions Panel** — New, Day 8
- Fixed panel at bottom or side of Hub
- Actions: Log Interaction, Request Estimate, Update Contact Info, Schedule Callback
- Each action creates a work item or opens a minimal data collection form
- For POC: actions can create placeholder work items (full workflow not required)
- Estimated effort: 2-3 hours

#### Composition Validation (New Capability)

**9. Composition Validator** — Add to Day 8
- Deterministic checker that runs after every composition (both task workspace and Hub)
- Rule set from the Roles & Workspace Architecture document Section 5.2
- On violation: log the error, fall back to Tier 1+2 composition, surface indicator to user
- For POC: validate the four demo cases in both task workspace and Hub contexts
- Estimated effort: 3-4 hours

#### Demo Integration

**10. Hub Demo Sequence** — Add to Day 14
- Pre-stage: all four demo members accessible via search
- Scripted demo flow: search for Robert Martinez → Hub shows open retirement application card + benefit estimate + leave payout indicator → tap benefit estimate → shows the same transparent calculation as the task workspace
- Search for Jennifer Kim → Hub shows no open tasks, scenario modeler card promoted, service credit shows purchased service callout
- Transition: "These two views — the task workspace and the member hub — are the same platform, the same data, the same calculations. What changes is how the system presents work based on who's using it."
- Estimated effort: 2-3 hours (scripting + verification, no new code)

---

## Updated Day-Level Schedule

Changes to existing plan shown in **bold**. Existing deliverables are unchanged.

### Day 4: Data Connector Service
- Steps 4.1-4.6 unchanged
- **Step 4.5a: Member Search API** — `GET /api/v1/members/search` with name/ID/SSN search
- Step 4.7 verification: **add search verification — search for each demo case by name, ID, and last-4 SSN**

### Day 5: Intelligence Service
- Steps 5.1-5.7 unchanged
- **Step 5.7a: Member Context Summary API** — `GET /api/v1/members/{id}/context`
- **Step 5.7b: Hub Composition API** — `POST /api/v1/composition/hub`
- Step 5.8 verification: **add Hub composition verification — confirm correct card sets for each demo case**

### Day 6: Foundation + Core Components
- All existing deliverables unchanged
- **Add: MemberSearch component** (search bar with typeahead results)
- **Add: Application shell includes Hub route alongside queue route** (two entry points from main navigation)

### Days 7: Calculation + Analysis Components
- Unchanged. All components built here are reused by Hub cards.

### Day 8: Workspace Composition + Integration
- All existing deliverables remain the priority
- **Add: MemberContextHub layout shell**
- **Add: NavigationCard component**
- **Add: Hub card content adapters** (thin wrappers around existing components)
- **Add: QuickActions panel** (placeholder actions for POC)
- **Add: Composition validator** (deterministic check on all compositions)
- Verification: **existing 4 demo cases must render correctly in BOTH task workspace AND Hub**
- Verification: **Hub cards must appear/hide correctly (no DRO card for non-DRO members, etc.)**

### Days 9-12: Unchanged
- Data quality, operational learning, testing all proceed as planned

### Day 13: Visual Polish
- Existing deliverables unchanged
- **Add: Hub visual consistency with task workspace design system**
- **Add: Card transitions (expand/collapse, staggered entry)**

### Day 14: Demo Environment
- Existing deliverables unchanged
- **Add: Hub demo sequence** — scripted CSR walkthrough for Robert Martinez and Jennifer Kim
- **Add: Static fallback demo** — show composed Hub vs. fallback Hub (all cards, default order)

### Day 15: Rehearsal
- Existing deliverables unchanged
- **Add: Practice the Act 1 → Act 2 → Act 3 transition**
- **Add: Prepare for "what about phone calls?" question** — the Hub IS the answer

---

## Effort Estimate

| Category | Items | Estimated Hours |
|---|---|---|
| Backend (search, context, hub composition) | 3 endpoints | 9-12 hours |
| Frontend (search, hub shell, cards, quick actions) | 5 components | 15-20 hours |
| Composition validator | 1 system | 3-4 hours |
| Demo integration | Scripting + verification | 2-3 hours |
| **Total incremental** | | **29-39 hours** |

This represents roughly **2-2.5 additional days of effort** spread across the existing 15-day schedule. It does not extend the timeline because the work slots into days that already have related deliverables. The primary risk is Day 8 becoming overloaded — if composition engine + Hub shell + card adapters + validator exceed capacity, the card adapters (item 7) are the easiest to simplify. Each adapter can start as a minimal text summary and gain richer formatting during Day 13 polish.

---

## Scope Boundaries

### In Scope for POC
- Member search by name, ID, last-4 SSN
- Hub layout with navigation cards for all four demo case members
- Tier 1 + Tier 2 card composition (deterministic + rule-based)
- Card-to-component drill-down (tap card → see full component)
- Quick action buttons (create placeholder work items)
- Composition validation (deterministic check + fallback)
- Static fallback Hub (all cards, default order) for degradation demo

### Out of Scope for POC (Post-POC Roadmap)
- Tier 3 (AI) card composition — card ordering is Tier 1+2 only in POC
- Call logging with duration and topic tracking — quick action creates a placeholder
- Integration with phone system (CTI / screen pop) — manual search only
- Document viewer within Hub — card shows document count, not contents
- Print-friendly Hub summary for members — post-POC counselor feature
- Interaction history across multiple calls — post-POC operational learning feature
- Hub telemetry for composition drift detection — requires production volume

---

## Verification Criteria

The Hub is demo-ready when ALL of the following pass:

1. **Search works** — searching "Martinez" returns Robert Martinez (Case 1/4); searching "Kim" returns Jennifer Kim (Case 2); searching "Washington" returns David Washington (Case 3)
2. **Cards compose correctly per member:**
   - Robert Martinez (Case 1): open retirement task card (first position), benefit estimate card shows ~$5,597/month (75% J&S), leave payout indicator visible, beneficiary card shows Elena
   - Jennifer Kim (Case 2): no open tasks, scenario modeler card promoted, service credit shows purchased service callout (3 years purchased, excluded from eligibility), benefit estimate shows early retirement reduction
   - David Washington (Case 3): 60-month AMS window noted in benefit card, Rule of 85 status visible, early retirement reduction shown
   - Robert Martinez DRO (Case 4): DRO card visible with Patricia listed, marital fraction shown, all other cards same as Case 1
3. **Wrong cards don't appear** — no DRO card for Cases 1-3, no leave payout indicator for Case 3
4. **Drill-down works** — tapping any card opens the full component with correct data
5. **Fallback works** — with AI/composition service simulated as unavailable, Hub renders all cards in default order with degradation indicator
6. **Composition validator catches errors** — simulated incorrect composition (e.g., inject DRO card for non-DRO member) triggers validation failure and automatic fallback
7. **Transition between Task Workspace and Hub** — same member data, same calculations, different presentation. Navigate from Hub to the task workspace for the same member's open retirement case.
