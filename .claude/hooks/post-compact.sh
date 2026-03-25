#!/bin/bash
# PostCompact hook — re-inject critical rules after context compression
#
# Populated from noui-platform CLAUDE.md during harness install.

cat <<'CONTEXT'
## Critical Rules (re-injected after context compression)

**Non-Negotiable Constraints:**
- connector/ has ZERO dependencies on platform/ or domains/. It discovers schemas by signal, not by name.
- platform/ services do NOT import from connector/. They are separate Go modules.
- domains/ contains data and rules only — no Go services.
- frontend/ calls platform services via REST APIs. It does not import Go code.
- Each Go service has its own go.mod. Module path pattern: github.com/noui/platform/{service}
- AI does NOT execute business calculations or make fiduciary determinations.
- The deterministic path for any function that produces a number, eligibility determination, or dollar amount: Certified Rule Definition (YAML) → Deterministic Go Code → Auditable Output with full calculation trace. No AI model is in this path.
- Every API endpoint goes through auth middleware. No endpoint exempt except /healthz, /health, /ready, /metrics.
- Tenant/member identity comes from JWT claims, never from headers. X-Tenant-ID header is stripped by auth middleware.
- CORS origin must never be *. Always use CORS_ORIGIN env var with explicit allowed origins.
- All Go services use log/slog. Never import "log" in platform services.

**Code Rules:**
- Every benefit calculation must match hand-calculated expected results to the penny ($0.00 tolerance).
- Never round intermediate calculations — carry full precision, round only the final monthly benefit.
- Hand calculations in domains/pension/demo-cases/ are the test oracle. If code disagrees, the code is wrong.
- Never adjust expected values to match code output.
- Use big.Rat or scaled integers for monetary arithmetic in Go — never float64.
- All monetary values are JSON strings with exactly 2 decimal places ("10639.45" not 10639.45).
- Percentages are string decimals ("0.03" = 3%).
- Purchased service credit counts toward BENEFIT CALCULATION but NOT toward Rule of 75, Rule of 85, or IPR.
- JWT validation must check: signature, algorithm (alg: HS256), expiration (exp), and required claims (tenant_id, role).
- Middleware order: CORS → Auth → Logging → Handler.
- Any code wrapping http.ResponseWriter must also implement http.Flusher.

**Persona Review Rule:**
- Before finalizing any plan that touches UI, data model, API routes, or permission logic:
  run persona review against `config/rubrics/persona-review.json`
- Spawn 4 reviewers independently: T1 Staff, T2 Member, T2 Employer, T2 Vendor (each sees ONLY its own rubric)
- Reconcile with fixed priority: T1 > T2. Within T2, conflicts flagged for human resolution.
- Do NOT exit plan mode with unresolved blockers

**Worktree Rules:**
- Check `git worktree list` if unsure of current location
- Never commit to master/main directly — feature branches only
- Clean up merged worktrees before starting new work
- Every session ends with clean working tree — no uncommitted changes

**Session Rules:**
- After PR merge, delete feature branch (local + remote)
- Never use `git stash`
CONTEXT
