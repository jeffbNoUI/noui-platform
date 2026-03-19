#!/usr/bin/env bash
# =============================================================================
# Negative Path E2E Tests
# Verifies error responses: 401 (auth), 400 (validation), 404 (not found),
# and pagination edge cases across platform services.
#
# Prerequisites: docker compose up --build (with fresh volumes + seeds)
# Usage: ./tests/e2e/negative_paths_e2e.sh [--wait]
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
    "issues:/api/v1/issues/stats" \
    "security:/api/v1/security/events/stats" \
    "crm:/api/v1/crm/audit?limit=1" \
    "casemanagement:/api/v1/cases/stats"
fi

echo -e "${CYAN}Negative Path E2E Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Section 1: Authentication Failures (401)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 1: Auth Failures (401)"

# 1a. No Authorization header
RESPONSE=$(do_get_no_auth "/api/v1/issues/stats")
extract_http "$RESPONSE"
assert_status "GET /issues/stats (no auth)" "401" "$HTTP_CODE"

RESPONSE=$(do_get_no_auth "/api/v1/security/events/stats")
extract_http "$RESPONSE"
assert_status "GET /security/events/stats (no auth)" "401" "$HTTP_CODE"

RESPONSE=$(do_get_no_auth "/api/v1/cases/stats")
extract_http "$RESPONSE"
assert_status "GET /cases/stats (no auth)" "401" "$HTTP_CODE"

# 1b. Malformed token
RESPONSE=$(do_get_with_auth "Bearer garbage-not-a-jwt" "/api/v1/issues/stats")
extract_http "$RESPONSE"
assert_status "GET /issues/stats (malformed token)" "401" "$HTTP_CODE"

# 1c. Expired token
EXPIRED_TOKEN=$(generate_expired_jwt)
RESPONSE=$(do_get_with_auth "Bearer ${EXPIRED_TOKEN}" "/api/v1/issues/stats")
extract_http "$RESPONSE"
assert_status "GET /issues/stats (expired token)" "401" "$HTTP_CODE"

RESPONSE=$(do_get_with_auth "Bearer ${EXPIRED_TOKEN}" "/api/v1/crm/audit?limit=1")
extract_http "$RESPONSE"
assert_status "GET /crm/audit (expired token)" "401" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Section 2: Validation Failures (400)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 2: Validation Failures (400)"

# 2a. POST /issues with empty body
RESPONSE=$(do_post "/api/v1/issues" '{}')
extract_http "$RESPONSE"
assert_status "POST /issues (empty body)" "400" "$HTTP_CODE"
assert_json_field "error code is INVALID_REQUEST" "$BODY" ".error.code" "INVALID_REQUEST"

# 2b. POST /issues with title exceeding 500 chars
LONG_TITLE=$(printf 'X%.0s' $(seq 1 501))
RESPONSE=$(do_post "/api/v1/issues" "{\"title\":\"${LONG_TITLE}\",\"reportedBy\":\"test@example.com\"}")
extract_http "$RESPONSE"
assert_status "POST /issues (title too long)" "400" "$HTTP_CODE"

# 2c. POST /crm/contacts missing required fields
RESPONSE=$(do_post "/api/v1/crm/contacts" '{"primaryEmail":"test@example.com"}')
extract_http "$RESPONSE"
assert_status "POST /crm/contacts (missing required)" "400" "$HTTP_CODE"
assert_json_field "error code is INVALID_REQUEST" "$BODY" ".error.code" "INVALID_REQUEST"

# 2d. POST /security/events with missing required fields
RESPONSE=$(do_post "/api/v1/security/events" '{}')
extract_http "$RESPONSE"
assert_status "POST /security/events (empty body)" "400" "$HTTP_CODE"

# 2e. GET /members/search without q param
RESPONSE=$(do_get "/api/v1/members/search")
extract_http "$RESPONSE"
assert_status "GET /members/search (no q param)" "400" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Section 3: Not Found (404)
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 3: Not Found (404)"

# 3a. Non-existent issue
RESPONSE=$(do_get "/api/v1/issues/999999")
extract_http "$RESPONSE"
assert_status "GET /issues/999999 (not found)" "404" "$HTTP_CODE"

# 3b. Non-existent CRM contact
RESPONSE=$(do_get "/api/v1/crm/contacts/00000000-0000-0000-0000-000000099999")
extract_http "$RESPONSE"
assert_status "GET /crm/contacts/{bad-id} (not found)" "404" "$HTTP_CODE"

# 3c. Non-existent member
RESPONSE=$(do_get "/api/v1/members/99999")
extract_http "$RESPONSE"
assert_status "GET /members/99999 (not found)" "404" "$HTTP_CODE"

# 3d. Non-existent case
RESPONSE=$(do_get "/api/v1/cases/00000000-0000-0000-0000-000000099999")
extract_http "$RESPONSE"
assert_status "GET /cases/{bad-id} (not found)" "404" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Section 4: Pagination Edge Cases
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Section 4: Pagination Edge Cases"

# 4a. limit=0 should be clamped to 1 (returns 200 with data)
RESPONSE=$(do_get "/api/v1/issues?limit=0")
extract_http "$RESPONSE"
assert_status "GET /issues?limit=0 (clamped)" "200" "$HTTP_CODE"

# 4b. Large offset beyond data — should return 200 with empty data
RESPONSE=$(do_get "/api/v1/issues?offset=999999")
extract_http "$RESPONSE"
assert_status "GET /issues?offset=999999 (beyond)" "200" "$HTTP_CODE"
assert_json_field "empty data array" "$BODY" ".data | length" "0"

# 4c. Large offset on CRM contacts
RESPONSE=$(do_get "/api/v1/crm/contacts?q=test&offset=999999")
extract_http "$RESPONSE"
assert_status "GET /crm/contacts?offset=999999 (beyond)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════════

print_summary
