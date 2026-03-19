#!/usr/bin/env bash
# =============================================================================
# Correspondence Enrichment E2E Tests
# Exercises letter generation, CRM logging, and stage-filtered template queries
# against the live Docker stack.
#
# Prerequisites: docker compose up --build (with fresh volumes)
# Usage: ./tests/e2e/correspondence_e2e.sh [--wait]
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
    "correspondence:/api/v1/correspondence/templates?limit=1" \
    "crm:/api/v1/crm/contacts?limit=1"
fi

echo -e "${CYAN}Correspondence Enrichment E2E Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1: Schema Verification — stage_category column exists and templates load
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 1: Schema Verification"

RESPONSE=$(do_get "/api/v1/correspondence/templates?stage_category=intake&limit=10")
extract_http "$RESPONSE"

assert_status "GET templates?stage_category=intake" "200" "$HTTP_CODE"
assert_json_gte "Intake templates count" "$BODY" ".pagination.total" "2"

# Verify stageCategory field is populated on the first result
assert_json_field "First template has stageCategory" "$BODY" '.data[0].stageCategory' "intake"

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 2: Generate Letter with Merge Fields
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 2: Generate Letter with Merge Fields"

# Use INTAKE_ACK template (c0000000-0000-0000-0000-000000000006)
GENERATE_PAYLOAD=$(cat <<'ENDJSON'
{
  "templateId": "c0000000-0000-0000-0000-000000000006",
  "memberId": 10001,
  "caseId": "RET-2026-0147",
  "mergeData": {
    "member_name": "Robert Martinez",
    "application_date": "2026-03-05",
    "case_number": "RET-2026-0147"
  }
}
ENDJSON
)

RESPONSE=$(do_post "/api/v1/correspondence/generate" "$GENERATE_PAYLOAD")
extract_http "$RESPONSE"

assert_status "POST generate (INTAKE_ACK)" "201" "$HTTP_CODE"

# Extract the rendered body and check merge field substitution
RENDERED=$(echo "$BODY" | jq -r '.data.bodyRendered // empty' 2>/dev/null || echo "")
assert_contains "Rendered body has member name" "$RENDERED" "Robert Martinez"
assert_contains "Rendered body has case number" "$RENDERED" "RET-2026-0147"

# Save correspondence ID for later tests
CORR_ID=$(echo "$BODY" | jq -r '.data.correspondenceId // empty' 2>/dev/null || echo "")
echo -e "  ${YELLOW}→ Generated correspondence ID: ${CORR_ID}${NC}"

# Verify it appears in history
RESPONSE=$(do_get "/api/v1/correspondence/history?member_id=10001&limit=10")
extract_http "$RESPONSE"

assert_status "GET history for member 10001" "200" "$HTTP_CODE"
assert_json_gte "History has records" "$BODY" ".pagination.total" "1"

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 3: Correspondence → CRM Bridge
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 3: Correspondence → CRM Bridge"

# Create CRM interaction for the correspondence we just generated
# Robert Martinez contact_id = 00000000-0000-0000-1000-000000000001
CRM_PAYLOAD=$(cat <<ENDJSON
{
  "contactId": "00000000-0000-0000-1000-000000000001",
  "channel": "MAIL_OUTBOUND",
  "interactionType": "NOTIFICATION",
  "direction": "OUTBOUND",
  "summary": "Sent INTAKE_ACK letter for case RET-2026-0147 (correspondence: ${CORR_ID})"
}
ENDJSON
)

RESPONSE=$(do_post "/api/v1/crm/interactions" "$CRM_PAYLOAD")
extract_http "$RESPONSE"

assert_status "POST CRM interaction (CORRESPONDENCE)" "201" "$HTTP_CODE"

# Extract interaction ID
INTERACTION_ID=$(echo "$BODY" | jq -r '.data.interactionId // empty' 2>/dev/null || echo "")
echo -e "  ${YELLOW}→ CRM interaction ID: ${INTERACTION_ID}${NC}"

# Verify the interaction appears in CRM query by contact
RESPONSE=$(do_get "/api/v1/crm/interactions?contact_id=00000000-0000-0000-1000-000000000001&limit=20")
extract_http "$RESPONSE"

assert_status "GET CRM interactions for Robert Martinez" "200" "$HTTP_CODE"

# Find our specific interaction by channel
HAS_CORR=$(echo "$BODY" | jq '[.data[] | select(.channel == "MAIL_OUTBOUND" and .interactionType == "NOTIFICATION")] | length' 2>/dev/null || echo "0")
assert_json_gte "MAIL_OUTBOUND/NOTIFICATION interactions exist" "{\"count\": $HAS_CORR}" ".count" "1"

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4: Stage-Filtered Template Queries
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 4: Stage-Filtered Template Queries"

# Each stage should have at least 1 template
STAGES=("intake" "verify-employment" "eligibility" "election" "submit" "dro")

for stage in "${STAGES[@]}"; do
  RESPONSE=$(do_get "/api/v1/correspondence/templates?stage_category=${stage}&limit=5")
  extract_http "$RESPONSE"

  if [ "$HTTP_CODE" = "200" ]; then
    COUNT=$(echo "$BODY" | jq -r '.pagination.total // 0')
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    if [ "$COUNT" -ge 1 ] 2>/dev/null; then
      echo -e "  ${GREEN}✓${NC} stage=$stage → $COUNT template(s)"
      PASS_COUNT=$((PASS_COUNT + 1))
    else
      echo -e "  ${RED}✗${NC} stage=$stage → 0 templates (expected >= 1)"
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  else
    TOTAL_COUNT=$((TOTAL_COUNT + 1))
    echo -e "  ${RED}✗${NC} stage=$stage → HTTP $HTTP_CODE"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# Verify unfiltered query includes NULL stage templates (MISSING_DOC has no stage)
RESPONSE=$(do_get "/api/v1/correspondence/templates?limit=50")
extract_http "$RESPONSE"

assert_status "GET all templates (unfiltered)" "200" "$HTTP_CODE"

# All templates = original 5 + 6 new = 11
assert_json_gte "Total template count" "$BODY" ".pagination.total" "11"

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 5: Case-Scoped History (case_id = string)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 5: Case-Scoped History"

# The generate in Test 2 used caseId "RET-2026-0147" — it should be filterable
RESPONSE=$(do_get "/api/v1/correspondence/history?case_id=RET-2026-0147&limit=10")
extract_http "$RESPONSE"

assert_status "GET history?case_id=RET-2026-0147" "200" "$HTTP_CODE"
assert_json_gte "Case-filtered history has records" "$BODY" ".pagination.total" "1"

# Verify returned record has the right case ID
assert_json_field "First record caseId matches" "$BODY" '.data[0].caseId' "RET-2026-0147"

# Verify filtering a non-existent case returns 0 records
RESPONSE=$(do_get "/api/v1/correspondence/history?case_id=NONEXISTENT&limit=10")
extract_http "$RESPONSE"

assert_status "GET history?case_id=NONEXISTENT" "200" "$HTTP_CODE"
assert_json_field "Non-existent case returns 0 records" "$BODY" ".pagination.total" "0"

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print_summary
