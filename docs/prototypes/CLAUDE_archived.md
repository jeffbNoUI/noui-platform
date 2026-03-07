# CLAUDE.md — NoUI DERP POC

## Project Overview

This is the NoUI proof of concept targeting the Denver Employees Retirement Plan (DERP). You are building a pension administration platform that dynamically composes workspaces based on member data, business rules, and process context.

**POC Scope Clarification:** The POC demonstrates the **Retirement Application** process — the workflow where a member applies to retire, the system determines eligibility, calculates the benefit, and presents payment options. This is distinct from **Retiree Payroll** (ongoing monthly payments, tax withholding, deductions), which is a separate process not included in the POC.

Read BUILD_PLAN.md for the step-by-step execution plan.
Read BUILD_HISTORY.md before making changes — it tracks every decision and serves as the backtrack reference.
Read SESSION_BRIEF.md for current build context, corrections to apply, and Day 1-2 specifics.
Read CLAUDE_CODE_PROTOCOL.md for session discipline — commit conventions, test-first enforcement, red-flag patterns.
Read derp-business-rules-inventory.docx as the authoritative source for all 52 business rules with RMC citations.
Read rules/definitions/ for the DERP plan provisions that the rules engine must implement.
Read demo-cases/ for the four demonstration cases with hand-calculated expected results.

## Governing Principles

This project is governed by the **NoUI Architecture Decisions & Governing Principles** document (noui-architecture-decisions.docx). The following principles are non-negotiable and take precedence over all other guidance.

### Principle 1: AI Does Not Execute Business Rules

Business rules, benefit calculations, eligibility determinations, and any function that produces a number, a yes/no decision, or a dollar amount must be implemented as deterministic, auditable, version-controlled code executing certified rule configurations. AI must never execute business rules, perform benefit calculations, or make eligibility determinations.

AI serves three roles:
1. **Rules Configuration Accelerator** — AI reads governing documents and drafts rule configurations. Humans certify.
2. **Orchestration and Presentation** — AI learns task patterns from transactions to orchestrate work and compose context-sensitive workspaces. AI decides what to show; the rules engine decides what the numbers are.
3. **Learning and Migration** — AI analyzes legacy data structures and workflows to accelerate migration. AI proposes; humans approve.

### Principle 2: Trust Through Transparency, Not Automation

The system earns trust by showing its work, not by automating approvals. The POC operates exclusively in Phase 1 (Transparent):
- Every calculation displays its formula, inputs, intermediate steps, and result
- Every output is presented for human verification
- No calculation, correction, or decision is made without human visibility
- Automation of approvals is a future capability requiring demonstrated accuracy over time

### Principle 3: Rules Changes Follow Full SDLC

Rule definitions are governed artifacts. The lifecycle for any rule change:
1. AI reads source document, identifies affected rules, drafts proposed changes
2. Human SMEs review against actual source document language
3. System generates regression tests from reviewed definitions
4. Full regression suite executes; failures are defects, never auto-resolved
5. Human certifies the complete package (rules + tests + results)
6. Approved changes deploy on their effective date; prior rules preserved

No rule reaches production without human approval.

### Principle 4: Source of Truth

Business rules come from governing documents only (statutes, board policies, actuarial valuations). The legacy database tells us where data lives, not what the rules are. Historical transactions are a validation oracle — they confirm our rules match legacy behavior — but they are never the source of rules. AI learns operational patterns from transactions (task flow, data access sequences) to inform orchestration, not rules.

## Critical Rules

### Calculation Accuracy
- Every benefit calculation must match hand-calculated expected results TO THE PENNY
- Never round intermediate calculations — carry full precision, round only the final monthly benefit to cents
- The hand calculations in demo-cases/ are the test oracle. If your code disagrees with the hand calculation, your code is wrong until proven otherwise.

### Rule Sourcing
- Business rules come from the Revised Municipal Code and DERP governing documents ONLY
- The legacy database tells us WHERE data lives, not WHAT the rules are
- Every rule definition must include a source_reference citing the governing document section
- Historical transactions validate our rules — they are NOT the source of rules

### Auditability
- Update BUILD_HISTORY.md after every significant step: files created, decisions made, issues encountered, resolutions
- Every calculation function must log its inputs, formula applied, and output
- Every rule evaluation must be traceable to the governing document provision
- Every test must document what it validates and why

### Service Purchase Exclusion (CRITICAL)
- Purchased service credit counts toward BENEFIT CALCULATION (increases the benefit amount)
- Purchased service credit does NOT count toward Rule of 75, Rule of 85, or IPR
- This distinction is tested explicitly in Case 2 (Jennifer Kim)
- Get this wrong and the entire demo loses credibility

### Leave Payout (CRITICAL)
- Only members hired BEFORE January 1, 2010 with sick/vacation leave (not PTO) qualify
- The payout amount is added to the FINAL MONTH of salary
- This boosts the AMS only if the final months are within the highest consecutive window
- This is tested explicitly in Case 1 (Robert Martinez)

## Controlled Terminology

When writing code comments, documentation, demo scripts, or any user-facing text:

**Do NOT use:**
- "Self-healing" → Use "AI-accelerated change management"
- "Auto-resolved" → Use "Proposed correction (awaiting review)"
- "AI calculated the benefit" → Use "The rules engine calculated the benefit"
- "The system automatically..." (for rules/calcs) → Use "The system identifies and presents..." or "prepares for review..."
- "The AI knows your rules" → Use "The rules engine is configured with your plan provisions"

**Do use:**
- "Deterministic rules engine executing certified plan provisions"
- "AI accelerates rule configuration; humans certify and approve"
- "AI composes the workspace to show the right information for each situation"
- "The system shows its work. Every calculation is transparent and verifiable."

## Development Workflow

### Before Starting Any Task
1. Read BUILD_HISTORY.md for current state
2. Read BUILD_PLAN.md for what comes next
3. Read SESSION_BRIEF.md for corrections and current context
4. Read CLAUDE_CODE_PROTOCOL.md for session discipline requirements
5. Understand what you're building and WHY before writing code
6. Verify the task aligns with governing principles

### After Completing Any Task
1. Run all existing tests — nothing should break
2. Update BUILD_HISTORY.md with what was done, any decisions made, any issues
3. Commit with a descriptive message referencing the build plan step

### When Something Breaks
1. Document the failure in BUILD_HISTORY.md
2. Diagnose the root cause
3. Fix it
4. Add a test that would have caught this failure
5. Document the resolution in BUILD_HISTORY.md

## Technology Stack

### Backend (Go)
- Go 1.22+
- Standard library for HTTP, JSON, testing
- lib/pq for PostgreSQL
- Minimal external dependencies
- Each service is a standalone binary in its own directory under services/
- Use `go mod init` per service

### Frontend (React)
- React 18+ with TypeScript (strict mode)
- Vite for build tooling
- Tailwind CSS for styling
- shadcn/ui for component primitives
- React Query (TanStack Query) for API data fetching
- No separate CSS files — all styling via Tailwind utility classes

### Database
- PostgreSQL 16
- Legacy schema in database/schema/ (simulates a messy real-world database)
- Seed data generated by Python scripts in database/seed/
- Clean domain model schema (future — for migration target)

### Infrastructure
- Docker for containerization
- Kubernetes via Helm charts in infrastructure/helm/
- Services communicate via Kubernetes ClusterIP services
- Frontend exposed via Ingress or NodePort

## API Conventions

### Request/Response Format
```json
// Success response
{
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "timestamp": "2026-02-18T12:00:00Z"
  }
}

// Error response
{
  "error": {
    "code": "MEMBER_NOT_FOUND",
    "message": "No member found with ID 12345",
    "request_id": "uuid"
  }
}
```

### Endpoint Naming
- GET /api/v1/members/{id}
- GET /api/v1/members/{id}/employment
- GET /api/v1/members/{id}/salary
- POST /api/v1/eligibility/evaluate
- POST /api/v1/benefit/calculate
- POST /api/v1/benefit/options
- POST /api/v1/benefit/scenario
- POST /api/v1/dro/calculate
- POST /api/v1/composition/evaluate

### Health Checks
Every service exposes GET /healthz returning 200 with:
```json
{"status": "ok", "service": "connector", "version": "0.1.0"}
```

## Testing Strategy

### Calculation Tests
- Generated from rule definitions
- Cover: standard case, boundary conditions (at threshold, one below, one above), interactions between rules
- Each test documents: inputs, applicable rule, expected output, source reference
- The four demo cases are the mandatory acceptance tests

### Integration Tests
- Exercise the full API chain: connector → intelligence → workspace
- Verify data flows correctly between services
- Test with realistic member profiles

### Composition Tests
- Verify correct components appear for each member situation
- Verify incorrect components do NOT appear
- Test all four demo cases produce the expected workspace layout

## File Naming Conventions

### Go Files
- Package names: lowercase, single word (api, rules, models, connector)
- File names: snake_case.go (benefit_calculator.go, eligibility_evaluator.go)
- Test files: snake_case_test.go

### TypeScript/React Files
- Components: PascalCase.tsx (MemberBanner.tsx, BenefitCalculationPanel.tsx)
- Hooks: camelCase.ts (useMember.ts, useBenefitCalculation.ts)
- Types: PascalCase.ts (Member.ts, BenefitCalculation.ts)
- Utils: camelCase.ts (formatCurrency.ts, calculateAMS.ts)

### YAML/Config Files
- kebab-case.yaml (tier-1-rules.yaml, service-retirement-process.yaml)

## DERP Quick Reference

| Provision | Tier 1 | Tier 2 | Tier 3 |
|-----------|--------|--------|--------|
| Hire Date | Before Sept 1, 2004 | Sept 1, 2004 - June 30, 2011 | On/after July 1, 2011 |
| Multiplier | 2.0% | 1.5% | 1.5% |
| AMS Window | 36 consecutive months | 36 consecutive months | 60 consecutive months |
| Rule of N | 75 (min age 55) | 75 (min age 55) | 85 (min age 60) |
| Early Ret Age | 55 | 55 | 60 |
| Reduction | **3%/yr under 65** | **3%/yr under 65** | 6%/yr under 65 |
| Leave Payout | If hired <2010 | If hired <2010 | No (hired >2010) |
| Death Benefit (Normal) | $5,000 | $5,000 | $5,000 |
| Death Benefit (Early) | $5K - $250/yr under 65 | $5K - $250/yr under 65 | $5K - $500/yr under 65 |

Vesting: 5 years all tiers
Employee contribution: 8.45%
Employer contribution: 17.95% (updated from 11% — per DERP Handbook Jan 2024)
Normal retirement: Age 65, 5 years service, all tiers

**CRITICAL:** Early retirement reduction for Tiers 1 & 2 is 3% per year, NOT 6%. Verified against DERP Active Member Handbook (p.17), DERP website, and FAQ. See CRITICAL-001-resolution.md.
