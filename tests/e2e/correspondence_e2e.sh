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

BASE_URL="${BASE_URL:-http://localhost:3000}"
TENANT_ID="00000000-0000-0000-0000-000000000001"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

# ─── Colors ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Helpers ──────────────────────────────────────────────────────────────────

log_header() {
  echo -e "\n${CYAN}═══ $1 ═══${NC}"
}

assert_status() {
  local label="$1" expected="$2" actual="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$expected" = "$actual" ]; then
    echo -e "  ${GREEN}✓${NC} $label (HTTP $actual)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — expected HTTP $expected, got $actual"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_json_field() {
  local label="$1" json="$2" jq_expr="$3" expected="$4"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  local actual
  actual=$(echo "$json" | jq -r "$jq_expr" 2>/dev/null || echo "JQ_ERROR")
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $label = $actual"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — expected \"$expected\", got \"$actual\""
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_json_gte() {
  local label="$1" json="$2" jq_expr="$3" min_val="$4"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  local actual
  actual=$(echo "$json" | jq -r "$jq_expr" 2>/dev/null || echo "0")
  if [ "$actual" -ge "$min_val" ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} $label = $actual (>= $min_val)"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — expected >= $min_val, got \"$actual\""
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if echo "$haystack" | grep -q "$needle"; then
    echo -e "  ${GREEN}✓${NC} $label — contains \"$needle\""
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — does not contain \"$needle\""
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

wait_for_services() {
  echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
  local services=("correspondence" "crm")
  local endpoints=("/api/v1/correspondence/templates?limit=1" "/api/v1/crm/contacts?limit=1")
  for i in "${!services[@]}"; do
    local svc="${services[$i]}"
    local ep="${endpoints[$i]}"
    local attempts=0
    while [ $attempts -lt 30 ]; do
      if curl -sf "${BASE_URL}${ep}" -H "X-Tenant-ID: ${TENANT_ID}" > /dev/null 2>&1; then
        echo -e "  ${GREEN}✓${NC} ${svc} is ready"
        break
      fi
      attempts=$((attempts + 1))
      sleep 2
    done
    if [ $attempts -ge 30 ]; then
      echo -e "  ${RED}✗${NC} ${svc} did not become healthy after 60s"
      exit 1
    fi
  done
  echo ""
}

# ─── Parse flags ──────────────────────────────────────────────────────────────

if [[ "${1:-}" == "--wait" ]]; then
  wait_for_services
fi

echo -e "${CYAN}Correspondence Enrichment E2E Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 1: Schema Verification — stage_category column exists and templates load
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 1: Schema Verification"

RESPONSE=$(curl -sf -w "\n%{http_code}" \
  "${BASE_URL}/api/v1/correspondence/templates?stage_category=intake&limit=10" \
  -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

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

RESPONSE=$(curl -sf -w "\n%{http_code}" \
  -X POST "${BASE_URL}/api/v1/correspondence/generate" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d "$GENERATE_PAYLOAD" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "POST generate (INTAKE_ACK)" "201" "$HTTP_CODE"

# Extract the rendered body and check merge field substitution
RENDERED=$(echo "$BODY" | jq -r '.data.bodyRendered // empty')
assert_contains "Rendered body has member name" "$RENDERED" "Robert Martinez"
assert_contains "Rendered body has case number" "$RENDERED" "RET-2026-0147"

# Save correspondence ID for later tests
CORR_ID=$(echo "$BODY" | jq -r '.data.correspondenceId // empty')
echo -e "  ${YELLOW}→ Generated correspondence ID: ${CORR_ID}${NC}"

# Verify it appears in history
RESPONSE=$(curl -sf -w "\n%{http_code}" \
  "${BASE_URL}/api/v1/correspondence/history?member_id=10001&limit=10" \
  -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

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
  "channel": "CORRESPONDENCE",
  "interactionType": "LETTER_SENT",
  "direction": "OUTBOUND",
  "summary": "Sent INTAKE_ACK letter for case RET-2026-0147 (correspondence: ${CORR_ID})"
}
ENDJSON
)

RESPONSE=$(curl -sf -w "\n%{http_code}" \
  -X POST "${BASE_URL}/api/v1/crm/interactions" \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d "$CRM_PAYLOAD" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "POST CRM interaction (CORRESPONDENCE)" "201" "$HTTP_CODE"

# Extract interaction ID
INTERACTION_ID=$(echo "$BODY" | jq -r '.data.interactionId // empty')
echo -e "  ${YELLOW}→ CRM interaction ID: ${INTERACTION_ID}${NC}"

# Verify the interaction appears in CRM query by contact
RESPONSE=$(curl -sf -w "\n%{http_code}" \
  "${BASE_URL}/api/v1/crm/interactions?contact_id=00000000-0000-0000-1000-000000000001&limit=20" \
  -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

assert_status "GET CRM interactions for Robert Martinez" "200" "$HTTP_CODE"

# Find our specific interaction by channel
HAS_CORR=$(echo "$BODY" | jq '[.data[] | select(.channel == "CORRESPONDENCE")] | length')
assert_json_gte "CORRESPONDENCE interactions exist" "{\"count\": $HAS_CORR}" ".count" "1"

# ═══════════════════════════════════════════════════════════════════════════════
# TEST 4: Stage-Filtered Template Queries
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Test 4: Stage-Filtered Template Queries"

# Each stage should have at least 1 template
STAGES=("intake" "verify-employment" "eligibility" "election" "submit" "dro")

for stage in "${STAGES[@]}"; do
  RESPONSE=$(curl -sf -w "\n%{http_code}" \
    "${BASE_URL}/api/v1/correspondence/templates?stage_category=${stage}&limit=5" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | sed '$d')

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
RESPONSE=$(curl -sf -w "\n%{http_code}" \
  "${BASE_URL}/api/v1/correspondence/templates?limit=50" \
  -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

ALL_COUNT=$(echo "$BODY" | jq -r '.pagination.total // 0')
assert_status "GET all templates (unfiltered)" "200" "$HTTP_CODE"

# All templates = original 5 + 6 new = 11
assert_json_gte "Total template count" "$BODY" ".pagination.total" "11"

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "  ${GREEN}Passed:${NC} ${PASS_COUNT}"
echo -e "  ${RED}Failed:${NC} ${FAIL_COUNT}"
echo -e "  Total:  ${TOTAL_COUNT}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "\n${RED}FAIL${NC} — $FAIL_COUNT test(s) failed"
  exit 1
else
  echo -e "\n${GREEN}PASS${NC} — all $TOTAL_COUNT tests passed"
  exit 0
fi
