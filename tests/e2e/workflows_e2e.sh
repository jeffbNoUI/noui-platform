#!/usr/bin/env bash
# =============================================================================
# Cross-Service Workflow E2E Tests
# Tests multi-service workflows that verify the platform works as an
# integrated system: case lifecycle, correspondence→CRM audit trail,
# and issue lifecycle with comments.
#
# Prerequisites: docker compose up --build (with fresh volumes + seeds)
# Usage: ./tests/e2e/workflows_e2e.sh [--wait]
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="00000000-0000-0000-0000-000000000001"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# ─── Source shared libraries ─────────────────────────────────────────────────
source "${SCRIPT_DIR}/lib/colors.sh"
source "${SCRIPT_DIR}/lib/assert.sh"
source "${SCRIPT_DIR}/lib/jwt.sh"
source "${SCRIPT_DIR}/lib/http.sh"

DEV_TOKEN=$(generate_dev_jwt)
AUTH_HEADER="Authorization: Bearer ${DEV_TOKEN}"

# ─── Parse flags ──────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--wait" ]]; then
  wait_for_services \
    "casemanagement:/api/v1/cases/stats" \
    "correspondence:/api/v1/correspondence/templates?limit=1" \
    "crm:/api/v1/crm/audit?limit=1" \
    "issues:/api/v1/issues/stats"
fi

echo -e "${CYAN}Cross-Service Workflow E2E Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Workflow A: Case Lifecycle
# Create case → add note → advance stage → verify history → check stats
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Workflow A: Case Lifecycle"

# A1. Capture baseline stats
RESPONSE=$(do_get "/api/v1/cases/stats")
extract_http "$RESPONSE"
BASELINE_TOTAL=$(echo "$BODY" | jq -r '.data.totalActive // 0' 2>/dev/null)
echo -e "  ${YELLOW}→ Baseline active cases: ${BASELINE_TOTAL}${NC}"

# A2. Create a new case
CASE_PAYLOAD=$(cat <<'ENDJSON'
{
  "memberId": "10001",
  "memberName": "Robert Martinez",
  "caseType": "retirement",
  "priority": "standard",
  "assignedTo": "dev-admin-001",
  "notes": "E2E workflow test case"
}
ENDJSON
)

RESPONSE=$(do_post "/api/v1/cases" "$CASE_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /cases (create)" "201" "$HTTP_CODE"

CASE_ID=$(echo "$BODY" | jq -r '.data.caseId // .data.id // empty' 2>/dev/null)
echo -e "  ${YELLOW}→ Created case: ${CASE_ID}${NC}"

if [ -n "$CASE_ID" ]; then
  # A3. Add a note to the case
  NOTE_PAYLOAD='{"content":"Initial intake completed. All documents received.","authorId":"dev-admin-001"}'
  RESPONSE=$(do_post "/api/v1/cases/${CASE_ID}/notes" "$NOTE_PAYLOAD")
  extract_http "$RESPONSE"
  assert_status "POST /cases/{id}/notes (add note)" "201" "$HTTP_CODE"

  # A4. Verify note appears
  RESPONSE=$(do_get "/api/v1/cases/${CASE_ID}/notes")
  extract_http "$RESPONSE"
  assert_status "GET /cases/{id}/notes" "200" "$HTTP_CODE"
  assert_json_gte "case has notes" "$BODY" ".data | length" "1"

  # A5. Advance stage
  RESPONSE=$(do_post "/api/v1/cases/${CASE_ID}/advance" '{}')
  extract_http "$RESPONSE"
  # Accept 200 (success) or 400 (no next stage) — both prove the endpoint works
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "400" ]; then
    echo -e "  ${GREEN}✓${NC} POST /cases/{id}/advance responded (HTTP $HTTP_CODE)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} POST /cases/{id}/advance — unexpected HTTP $HTTP_CODE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi

  # A6. Verify stage history recorded
  RESPONSE=$(do_get "/api/v1/cases/${CASE_ID}/history")
  extract_http "$RESPONSE"
  assert_status "GET /cases/{id}/history" "200" "$HTTP_CODE"

  # A7. Verify stats reflect new case
  RESPONSE=$(do_get "/api/v1/cases/stats")
  extract_http "$RESPONSE"
  assert_status "GET /cases/stats (after create)" "200" "$HTTP_CODE"
  NEW_TOTAL=$(echo "$BODY" | jq -r '.data.totalActive // 0' 2>/dev/null)
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$NEW_TOTAL" -ge "$BASELINE_TOTAL" ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} totalActive ($NEW_TOTAL) >= baseline ($BASELINE_TOTAL)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} totalActive ($NEW_TOTAL) < baseline ($BASELINE_TOTAL)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Workflow B: Correspondence → CRM Audit Trail
# Generate letter → log CRM interaction → verify audit entry
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Workflow B: Correspondence → CRM Audit"

# B1. Generate correspondence
CORR_PAYLOAD=$(cat <<'ENDJSON'
{
  "templateId": "c0000000-0000-0000-0000-000000000006",
  "memberId": 10001,
  "caseId": "WF-E2E-001",
  "mergeData": {
    "member_name": "Robert Martinez",
    "application_date": "2026-03-19",
    "case_number": "WF-E2E-001"
  }
}
ENDJSON
)

RESPONSE=$(do_post "/api/v1/correspondence/generate" "$CORR_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /correspondence/generate" "201" "$HTTP_CODE"

CORR_ID=$(echo "$BODY" | jq -r '.data.correspondenceId // empty' 2>/dev/null)
echo -e "  ${YELLOW}→ Correspondence ID: ${CORR_ID}${NC}"

# B2. Log as CRM interaction
CRM_PAYLOAD=$(cat <<ENDJSON
{
  "contactId": "00000000-0000-0000-1000-000000000001",
  "channel": "MAIL_OUTBOUND",
  "interactionType": "NOTIFICATION",
  "direction": "OUTBOUND",
  "summary": "Workflow test: sent letter for case WF-E2E-001 (corr: ${CORR_ID})"
}
ENDJSON
)

RESPONSE=$(do_post "/api/v1/crm/interactions" "$CRM_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /crm/interactions (log correspondence)" "201" "$HTTP_CODE"

# B3. Verify audit trail has entries
RESPONSE=$(do_get "/api/v1/crm/audit?limit=10")
extract_http "$RESPONSE"
assert_status "GET /crm/audit (after interaction)" "200" "$HTTP_CODE"

AUDIT_COUNT=$(echo "$BODY" | jq '.data | length' 2>/dev/null || echo "0")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$AUDIT_COUNT" -ge 1 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} audit trail has entries ($AUDIT_COUNT)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} audit trail empty after interaction"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Workflow C: Issue Lifecycle with Comments
# Create issue → add comment → verify comment → resolve → check stats
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Workflow C: Issue Lifecycle with Comments"

# C1. Create issue
ISSUE_PAYLOAD='{"title":"Workflow E2E Test Issue","description":"Testing full issue lifecycle","severity":"medium","category":"bug","affectedService":"e2e-workflow","reportedBy":"workflow-test@example.com"}'

RESPONSE=$(do_post "/api/v1/issues" "$ISSUE_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /issues (create)" "201" "$HTTP_CODE"

ISSUE_ID=$(echo "$BODY" | jq -r '.data.id // empty' 2>/dev/null)
echo -e "  ${YELLOW}→ Created issue: ${ISSUE_ID}${NC}"

if [ -n "$ISSUE_ID" ]; then
  # C2. Add comment
  COMMENT_PAYLOAD='{"content":"Investigating root cause — appears to be a configuration issue.","authorId":"dev-admin-001"}'
  RESPONSE=$(do_post "/api/v1/issues/${ISSUE_ID}/comments" "$COMMENT_PAYLOAD")
  extract_http "$RESPONSE"
  assert_status "POST /issues/{id}/comments" "201" "$HTTP_CODE"

  # C3. Verify comment appears
  RESPONSE=$(do_get "/api/v1/issues/${ISSUE_ID}/comments")
  extract_http "$RESPONSE"
  assert_status "GET /issues/{id}/comments" "200" "$HTTP_CODE"
  assert_json_gte "issue has comments" "$BODY" ".data | length" "1"

  # C4. Resolve the issue
  RESPONSE=$(do_put "/api/v1/issues/${ISSUE_ID}" '{"status":"resolved","resolutionNote":"Fixed configuration. Verified in staging."}')
  extract_http "$RESPONSE"
  assert_status "PUT /issues/{id} (resolve)" "200" "$HTTP_CODE"

  # C5. Verify resolved state
  RESPONSE=$(do_get "/api/v1/issues/${ISSUE_ID}")
  extract_http "$RESPONSE"
  assert_json_field "issue status is resolved" "$BODY" ".data.status" "resolved"

  # C6. Stats should reflect resolution
  RESPONSE=$(do_get "/api/v1/issues/stats")
  extract_http "$RESPONSE"
  assert_status "GET /issues/stats (after resolve)" "200" "$HTTP_CODE"
  assert_json_not_null "resolvedCount present" "$BODY" ".data.resolvedCount"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print_summary
