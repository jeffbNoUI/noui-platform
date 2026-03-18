#!/usr/bin/env bash
# =============================================================================
# Services Hub Integration Tests
# Verifies all 7 Services Hub tab endpoints return valid data from seeded
# Docker Compose stack.
#
# Prerequisites: docker compose up --build (with fresh volumes + seeds)
# Usage: ./tests/e2e/services_hub_e2e.sh [--wait]
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
NC='\033[0m'

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

assert_json_not_null() {
  local label="$1" json="$2" jq_expr="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  local actual
  actual=$(echo "$json" | jq -r "$jq_expr" 2>/dev/null || echo "null")
  if [ "$actual" != "null" ] && [ "$actual" != "" ]; then
    echo -e "  ${GREEN}✓${NC} $label = $actual"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — got null/empty"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if echo "$haystack" | grep -qF "$needle"; then
    echo -e "  ${GREEN}✓${NC} $label — contains \"$needle\""
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $label — does not contain \"$needle\""
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

do_get() {
  curl -s -w "\n%{http_code}" \
    "${BASE_URL}$1" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000"
}

do_post() {
  curl -s -w "\n%{http_code}" \
    -X POST "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

do_put() {
  curl -s -w "\n%{http_code}" \
    -X PUT "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

extract_http() {
  local response="$1"
  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
  if [ -z "$HTTP_CODE" ] || ! [[ "$HTTP_CODE" =~ ^[0-9]+$ ]]; then
    HTTP_CODE="000"
    BODY=""
  fi
}

wait_for_services() {
  echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
  local endpoints=(
    "/api/v1/health/aggregate"
    "/api/v1/dq/score"
    "/api/v1/cases/stats"
    "/api/v1/issues/stats"
    "/api/v1/security/events/stats"
    "/api/v1/kb/rules"
    "/api/v1/crm/audit?limit=1"
  )
  local names=("healthagg" "dataquality" "casemanagement" "issues" "security" "knowledgebase" "crm")
  for i in "${!endpoints[@]}"; do
    local svc="${names[$i]}"
    local ep="${endpoints[$i]}"
    local attempts=0
    while [ $attempts -lt 30 ]; do
      local hc
      hc=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${ep}" -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo "000")
      if [ "$hc" = "200" ]; then
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

echo -e "${CYAN}Services Hub Integration Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Section 1: Health Tab (healthagg — port 8091)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 1: Health Tab"

RESPONSE=$(do_get "/api/v1/health/aggregate")
extract_http "$RESPONSE"

assert_status "GET /health/aggregate" "200" "$HTTP_CODE"

# Response must have overall status
assert_json_not_null "overall status present" "$BODY" ".overall"

# At least 8 platform services reporting
SVC_COUNT=$(echo "$BODY" | jq '.services | length' 2>/dev/null || echo "0")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$SVC_COUNT" -ge 8 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} service count = $SVC_COUNT (>= 8)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} service count = $SVC_COUNT, expected >= 8"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Each expected platform service should be present
for svc in dataaccess intelligence crm correspondence dataquality knowledgebase casemanagement preferences; do
  SVC_STATUS=$(echo "$BODY" | jq -r ".services.\"$svc\".status // \"missing\"" 2>/dev/null)
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$SVC_STATUS" = "ok" ] || [ "$SVC_STATUS" = "healthy" ]; then
    echo -e "  ${GREEN}✓${NC} $svc = $SVC_STATUS"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} $svc = $SVC_STATUS (expected ok/healthy)"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

# ═══════════════════════════════════════════════════════════════════════════════
# Section 2: Data Quality Tab (dataquality — port 8086)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 2: Data Quality Tab"

# DQ Score
RESPONSE=$(do_get "/api/v1/dq/score")
extract_http "$RESPONSE"
assert_status "GET /dq/score" "200" "$HTTP_CODE"
assert_json_not_null "overallScore present" "$BODY" ".data.overallScore"
assert_json_gte "totalChecks >= 1" "$BODY" ".data.totalChecks" "1"

# DQ Checks list
RESPONSE=$(do_get "/api/v1/dq/checks?limit=5")
extract_http "$RESPONSE"
assert_status "GET /dq/checks" "200" "$HTTP_CODE"
assert_json_gte "checks count >= 1" "$BODY" ".pagination.total" "1"

# DQ Issues list (seeded data)
RESPONSE=$(do_get "/api/v1/dq/issues?limit=5")
extract_http "$RESPONSE"
assert_status "GET /dq/issues" "200" "$HTTP_CODE"
DQ_ISSUE_COUNT=$(echo "$BODY" | jq -r '.pagination.total // 0' 2>/dev/null)
echo -e "  ${YELLOW}→ DQ issues in DB: ${DQ_ISSUE_COUNT}${NC}"

# If issues exist, test status update round-trip
if [ "$DQ_ISSUE_COUNT" -gt 0 ] 2>/dev/null; then
  FIRST_ISSUE_ID=$(echo "$BODY" | jq -r '.data[0].issueId' 2>/dev/null)
  ORIGINAL_STATUS=$(echo "$BODY" | jq -r '.data[0].status' 2>/dev/null)
  echo -e "  ${YELLOW}→ Testing PUT on issue ${FIRST_ISSUE_ID} (status: ${ORIGINAL_STATUS})${NC}"

  RESPONSE=$(do_put "/api/v1/dq/issues/${FIRST_ISSUE_ID}" '{"status":"acknowledged","resolutionNote":"E2E test"}')
  extract_http "$RESPONSE"
  assert_status "PUT /dq/issues/{id} update status" "200" "$HTTP_CODE"

  # Restore original status
  RESPONSE=$(do_put "/api/v1/dq/issues/${FIRST_ISSUE_ID}" "{\"status\":\"${ORIGINAL_STATUS}\",\"resolutionNote\":null}")
  extract_http "$RESPONSE"
  assert_status "PUT /dq/issues/{id} restore status" "200" "$HTTP_CODE"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Section 3: Audit Trail Tab (crm — port 8083)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 3: Audit Trail Tab"

# Unfiltered audit log
RESPONSE=$(do_get "/api/v1/crm/audit?limit=10")
extract_http "$RESPONSE"
assert_status "GET /crm/audit" "200" "$HTTP_CODE"

# Should have data array (may be empty if no CRM writes yet — still 200)
AUDIT_COUNT=$(echo "$BODY" | jq '.data | length' 2>/dev/null || echo "0")
echo -e "  ${YELLOW}→ Audit entries: ${AUDIT_COUNT}${NC}"

# Filter by entity_type (should return 200 even if 0 results)
RESPONSE=$(do_get "/api/v1/crm/audit?entity_type=contact&limit=5")
extract_http "$RESPONSE"
assert_status "GET /crm/audit?entity_type=contact" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Section 4: Metrics Tab (casemanagement — port 8088)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 4: Metrics Tab"

# Case stats
RESPONSE=$(do_get "/api/v1/cases/stats")
extract_http "$RESPONSE"
assert_status "GET /cases/stats" "200" "$HTTP_CODE"
assert_json_not_null "totalActive present" "$BODY" ".data.totalActive"

# SLA stats
RESPONSE=$(do_get "/api/v1/cases/stats/sla")
extract_http "$RESPONSE"
assert_status "GET /cases/stats/sla" "200" "$HTTP_CODE"
assert_json_not_null "onTrack present" "$BODY" ".data.onTrack"
assert_json_not_null "atRisk present" "$BODY" ".data.atRisk"
assert_json_not_null "overdue present" "$BODY" ".data.overdue"

# Volume stats
RESPONSE=$(do_get "/api/v1/cases/stats/volume?months=6")
extract_http "$RESPONSE"
assert_status "GET /cases/stats/volume" "200" "$HTTP_CODE"
assert_json_gte "months array has entries" "$BODY" ".data.months | length" "1"

# ═══════════════════════════════════════════════════════════════════════════════
# Section 5: Security Tab (security — port 8093)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 5: Security Tab"

# Event stats
RESPONSE=$(do_get "/api/v1/security/events/stats")
extract_http "$RESPONSE"
assert_status "GET /security/events/stats" "200" "$HTTP_CODE"
assert_json_not_null "activeUsers present" "$BODY" ".data.activeUsers"
assert_json_not_null "activeSessions present" "$BODY" ".data.activeSessions"

# Post a new security event
EVENT_PAYLOAD='{"eventType":"login_success","actorId":"00000000-0000-0000-0000-e2e000000001","actorEmail":"e2e-test@example.com","ipAddress":"10.0.0.99","userAgent":"E2E Test Runner","metadata":"{}"}'

RESPONSE=$(do_post "/api/v1/security/events" "$EVENT_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /security/events (login_success)" "201" "$HTTP_CODE"

# Read events back — use limit=50 to tolerate repeated runs
RESPONSE=$(do_get "/api/v1/security/events?limit=50")
extract_http "$RESPONSE"
assert_status "GET /security/events" "200" "$HTTP_CODE"
assert_json_gte "events count >= 1" "$BODY" ".pagination.total" "1"

# Verify our test event appears (filter by actorEmail)
HAS_E2E=$(echo "$BODY" | jq '[.data[] | select(.actorEmail == "e2e-test@example.com")] | length' 2>/dev/null || echo "0")
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$HAS_E2E" -ge 1 ] 2>/dev/null; then
  echo -e "  ${GREEN}✓${NC} posted event found in GET response"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} posted event not found in GET response"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Section 6: Issues Tab (issues — port 8092)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 6: Issues Tab"

# Issue stats
RESPONSE=$(do_get "/api/v1/issues/stats")
extract_http "$RESPONSE"
assert_status "GET /issues/stats" "200" "$HTTP_CODE"
assert_json_not_null "openCount present" "$BODY" ".data.openCount"

# Create a new issue
ISSUE_PAYLOAD='{"title":"E2E Test Issue","description":"Created by services_hub_e2e.sh","severity":"low","category":"enhancement","affectedService":"e2e-test","reportedBy":"e2e-test@example.com"}'

RESPONSE=$(do_post "/api/v1/issues" "$ISSUE_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /issues (create)" "201" "$HTTP_CODE"

# Extract the new issue ID
NEW_ISSUE_ID=$(echo "$BODY" | jq -r '.data.issueId // .data.id // empty' 2>/dev/null)
echo -e "  ${YELLOW}→ Created issue: ${NEW_ISSUE_ID}${NC}"

if [ -n "$NEW_ISSUE_ID" ]; then
  # Read it back by ID
  RESPONSE=$(do_get "/api/v1/issues/${NEW_ISSUE_ID}")
  extract_http "$RESPONSE"
  assert_status "GET /issues/{id} (read back)" "200" "$HTTP_CODE"
  assert_json_field "title matches" "$BODY" ".data.title" "E2E Test Issue"
  assert_json_field "status is open" "$BODY" ".data.status" "open"

  # Update status to resolved
  RESPONSE=$(do_put "/api/v1/issues/${NEW_ISSUE_ID}" '{"status":"resolved","resolutionNote":"Resolved by E2E test"}')
  extract_http "$RESPONSE"
  assert_status "PUT /issues/{id} (resolve)" "200" "$HTTP_CODE"

  # Verify update took effect
  RESPONSE=$(do_get "/api/v1/issues/${NEW_ISSUE_ID}")
  extract_http "$RESPONSE"
  assert_json_field "status updated to resolved" "$BODY" ".data.status" "resolved"

  # Filter by status — resolved issues should include ours
  RESPONSE=$(do_get "/api/v1/issues?status=resolved&limit=50")
  extract_http "$RESPONSE"
  assert_status "GET /issues?status=resolved" "200" "$HTTP_CODE"

  HAS_OUR_ISSUE=$(echo "$BODY" | jq "[.data[] | select(.title == \"E2E Test Issue\")] | length" 2>/dev/null || echo "0")
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  if [ "$HAS_OUR_ISSUE" -ge 1 ] 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC} created issue found in filtered results"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo -e "  ${RED}✗${NC} created issue not found in filtered results"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Section 7: Config Tab (knowledgebase — port 8087)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 7: Config Tab"

RESPONSE=$(do_get "/api/v1/kb/rules")
extract_http "$RESPONSE"
assert_status "GET /kb/rules" "200" "$HTTP_CODE"
assert_json_gte "rules count >= 1" "$BODY" ".data | length" "1"

# Verify first rule has required fields
assert_json_not_null "first rule has code" "$BODY" ".data[0].code"
assert_json_not_null "first rule has description" "$BODY" ".data[0].description"

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
