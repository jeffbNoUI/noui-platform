#!/usr/bin/env bash
# =============================================================================
# Migration Service E2E Tests
# Tests the full migration lifecycle through Docker nginx:
#   engagement → source config → profile → mappings → batch → reconciliation
#
# Prerequisites: docker compose up --build (with fresh volumes + seeds)
# Usage: ./tests/e2e/migration_e2e.sh [--wait]
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
    "migration:/api/v1/migration/dashboard/summary"
fi

echo -e "${CYAN}Migration Service E2E Tests${NC}"
echo -e "${CYAN}Base URL: ${BASE_URL}${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 1: Dashboard & System Health
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 1: Dashboard & System Health"

RESPONSE=$(do_get "/api/v1/migration/dashboard/summary")
extract_http "$RESPONSE"
assert_status "GET /migration/dashboard/summary" "200" "$HTTP_CODE"

RESPONSE=$(do_get "/api/v1/migration/dashboard/system-health")
extract_http "$RESPONSE"
assert_status "GET /migration/dashboard/system-health" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 2: Engagement Lifecycle
# Create → list → get → update
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 2: Engagement Lifecycle"

ENGAGEMENT_NAME="E2E-Legacy-PAS-$(date +%s)"
ENGAGEMENT_PAYLOAD=$(cat <<EOF
{
  "source_system_name": "${ENGAGEMENT_NAME}"
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements" "$ENGAGEMENT_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /migration/engagements (create)" "201" "$HTTP_CODE"

# Extract engagement ID
ENGAGEMENT_ID=$(echo "$BODY" | jq -r '.data.id // .data.engagement_id // .id // .engagement_id // empty' 2>/dev/null || echo "")
if [ -z "$ENGAGEMENT_ID" ] || [ "$ENGAGEMENT_ID" = "null" ]; then
  # Try alternate response shapes
  ENGAGEMENT_ID=$(echo "$BODY" | jq -r 'if type == "object" then (.id // .engagement_id // empty) else empty end' 2>/dev/null || echo "")
fi

TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ -n "$ENGAGEMENT_ID" ] && [ "$ENGAGEMENT_ID" != "null" ]; then
  echo -e "  ${GREEN}✓${NC} engagement created: ${ENGAGEMENT_ID}"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} failed to extract engagement ID from response"
  echo "  Response body: $(echo "$BODY" | head -c 200)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  # Can't continue without engagement ID
  print_summary
fi

# List engagements
RESPONSE=$(do_get "/api/v1/migration/engagements")
extract_http "$RESPONSE"
assert_status "GET /migration/engagements (list)" "200" "$HTTP_CODE"

# Get specific engagement
RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}")
extract_http "$RESPONSE"
assert_status "GET /migration/engagements/:id" "200" "$HTTP_CODE"

# Update engagement status (PATCH) — DISCOVERY → PROFILING (valid forward transition)
UPDATE_PAYLOAD='{"status": "PROFILING"}'
RESPONSE=$(do_patch "/api/v1/migration/engagements/${ENGAGEMENT_ID}" "$UPDATE_PAYLOAD")
extract_http "$RESPONSE"
assert_status "PATCH /migration/engagements/:id (status → PROFILING)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 3: Source Configuration
# Configure source → discover tables
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 3: Source Configuration"

SOURCE_PAYLOAD=$(cat <<EOF
{
  "driver": "postgres",
  "host": "postgres",
  "port": "5432",
  "dbname": "noui",
  "user": "noui",
  "password": "noui"
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/source" "$SOURCE_PAYLOAD")
extract_http "$RESPONSE"
assert_status "POST /migration/engagements/:id/source (configure)" "200" "$HTTP_CODE"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/source/tables")
extract_http "$RESPONSE"
assert_status "GET /migration/engagements/:id/source/tables" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 4: Quality Profiling
# Run profile → list profiles → approve baseline
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 4: Quality Profiling"

PROFILE_PAYLOAD='{"tables": [{"table_name": "member_master", "schema_name": "public"}, {"table_name": "salary_hist", "schema_name": "public"}]}'

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/profile" "$PROFILE_PAYLOAD")
extract_http "$RESPONSE"
# Profile might return 200 or 201
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
  echo -e "  ${GREEN}✓${NC} POST /migration/profile (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} POST /migration/profile — expected 200/201/202, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/profiles")
extract_http "$RESPONSE"
assert_status "GET /migration/profiles (list)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 5: Field Mappings
# Generate mappings → list → verify count
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 5: Approve Baseline + Field Mappings"

# Approve quality baseline (required before generate-mappings)
RESPONSE=$(do_patch "/api/v1/migration/engagements/${ENGAGEMENT_ID}/approve-baseline" "{}")
extract_http "$RESPONSE"
assert_status "PATCH /migration/approve-baseline" "200" "$HTTP_CODE"

# Generate mappings with table/column details
MAPPING_PAYLOAD=$(cat <<EOF
{
  "tables": [
    {
      "source_table": "member_master",
      "concept_tag": "employee-master",
      "columns": [
        {"name": "member_id", "data_type": "integer", "is_nullable": false, "is_key": true},
        {"name": "first_name", "data_type": "varchar", "is_nullable": false, "is_key": false},
        {"name": "last_name", "data_type": "varchar", "is_nullable": false, "is_key": false},
        {"name": "dob", "data_type": "date", "is_nullable": true, "is_key": false},
        {"name": "hire_date", "data_type": "date", "is_nullable": true, "is_key": false},
        {"name": "ssn", "data_type": "varchar", "is_nullable": false, "is_key": false},
        {"name": "plan_code", "data_type": "varchar", "is_nullable": true, "is_key": false},
        {"name": "status", "data_type": "varchar", "is_nullable": false, "is_key": false}
      ]
    }
  ]
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/generate-mappings" "$MAPPING_PAYLOAD")
extract_http "$RESPONSE"
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
  echo -e "  ${GREEN}✓${NC} POST /migration/generate-mappings (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} POST /migration/generate-mappings — expected 200/201/202, got $HTTP_CODE"
  echo "  Response: $(echo "$BODY" | head -c 200)"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/mappings")
extract_http "$RESPONSE"
assert_status "GET /migration/mappings (list)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 6: Batches
# Create batch → list → get batch
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 6: Batches"

BATCH_PAYLOAD=$(cat <<EOF
{
  "batch_scope": "ACTIVE_MEMBERS",
  "mapping_version": "v1.0"
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/batches" "$BATCH_PAYLOAD")
extract_http "$RESPONSE"
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ] || [ "$HTTP_CODE" = "202" ]; then
  echo -e "  ${GREEN}✓${NC} POST /migration/batches (create) (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))

  BATCH_ID=$(echo "$BODY" | jq -r '.data.id // .data.batch_id // .id // .batch_id // empty' 2>/dev/null || echo "")
else
  echo -e "  ${RED}✗${NC} POST /migration/batches — expected 200/201/202, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
  BATCH_ID=""
fi

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/batches")
extract_http "$RESPONSE"
assert_status "GET /migration/batches (list)" "200" "$HTTP_CODE"

if [ -n "$BATCH_ID" ] && [ "$BATCH_ID" != "null" ]; then
  RESPONSE=$(do_get "/api/v1/migration/batches/${BATCH_ID}")
  extract_http "$RESPONSE"
  assert_status "GET /migration/batches/:id" "200" "$HTTP_CODE"
fi

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 7: Reconciliation
# Get reconciliation → get summary → get by tier
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 7: Reconciliation"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/reconciliation")
extract_http "$RESPONSE"
assert_status "GET /migration/reconciliation" "200" "$HTTP_CODE"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/reconciliation/summary")
extract_http "$RESPONSE"
assert_status "GET /migration/reconciliation/summary" "200" "$HTTP_CODE"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/reconciliation/tier/1")
extract_http "$RESPONSE"
assert_status "GET /migration/reconciliation/tier/1" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 8: Risks
# Create → list → cleanup
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 8: Risks"

RISK_PAYLOAD=$(cat <<EOF
{
  "severity": "P2",
  "description": "E2E Test Risk — data quality gap in member records",
  "evidence": "Detected during E2E profiling phase",
  "mitigation": "Review and correct source records before next batch"
}
EOF
)

RESPONSE=$(do_post "/api/v1/migration/engagements/${ENGAGEMENT_ID}/risks" "$RISK_PAYLOAD")
extract_http "$RESPONSE"
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo -e "  ${GREEN}✓${NC} POST /migration/risks (create) (HTTP $HTTP_CODE)"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} POST /migration/risks — expected 200/201, got $HTTP_CODE"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

RESPONSE=$(do_get "/api/v1/migration/risks?engagement_id=${ENGAGEMENT_ID}")
extract_http "$RESPONSE"
assert_status "GET /migration/risks (list)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 9: Events
# List events for the engagement
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 9: Events"

RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/events?limit=20")
extract_http "$RESPONSE"
assert_status "GET /migration/events (list)" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Phase 10: Coverage Report & Mapping Specification
# Target-anchored profiling and auditable mapping artifact
# ═══════════════════════════════════════════════════════════════════════════════

log_header "Phase 10: Coverage Report & Mapping Spec"

# Coverage report — target-anchored canonical field satisfaction
RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/coverage-report")
extract_http "$RESPONSE"
assert_status "GET /migration/coverage-report" "200" "$HTTP_CODE"

# Verify coverage report structure
TOTAL_CANONICAL=$(echo "$HTTP_BODY" | jq -r '.data.total_canonical // 0')
TOTAL_COUNT=$((TOTAL_COUNT + 1))
if [ "$TOTAL_CANONICAL" -gt "0" ]; then
  echo -e "  ${GREEN}✓${NC} Coverage report: ${TOTAL_CANONICAL} canonical fields assessed"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo -e "  ${RED}✗${NC} Coverage report: total_canonical = 0, expected >0"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# Mapping specification document — auditable artifact
RESPONSE=$(do_get "/api/v1/migration/engagements/${ENGAGEMENT_ID}/reports/mapping-spec")
extract_http "$RESPONSE"
assert_status "GET /migration/reports/mapping-spec" "200" "$HTTP_CODE"

# ═══════════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════════

print_summary
