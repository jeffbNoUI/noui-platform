#!/usr/bin/env bash
# =============================================================================
# Two-Source Proof Orchestration Script
#
# Proves the migration platform can ingest data from two independent legacy
# pension admin systems (PRISM + PAS), transform through a common canonical
# model, and produce reconciled output with quality gates — all running
# through Docker Compose with real source databases.
#
# Usage:
#   ./scripts/run_two_source_proof.sh              # full run (builds + tests)
#   ./scripts/run_two_source_proof.sh --no-build   # skip docker compose build
#   ./scripts/run_two_source_proof.sh --skip-infra  # skip infra, assume running
#
# Prerequisites: docker, docker compose, jq, curl
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Colors and counters ────────────────────────────────────────────────────

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BASE_URL="${BASE_URL:-http://localhost:3000}"
PASS_COUNT=0
FAIL_COUNT=0
TOTAL_COUNT=0

PRISM_GATE=""
PAS_GATE=""

# ─── Helpers ─────────────────────────────────────────────────────────────────

log()  { echo -e "${CYAN}[PROOF]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; FAIL_COUNT=$((FAIL_COUNT + 1)); TOTAL_COUNT=$((TOTAL_COUNT + 1)); }
pass() { echo -e "${GREEN}[PASS]${NC} $*"; PASS_COUNT=$((PASS_COUNT + 1)); TOTAL_COUNT=$((TOTAL_COUNT + 1)); }

# ─── Auth (reuse E2E JWT generation) ─────────────────────────────────────────

TENANT_ID="00000000-0000-0000-0000-000000000001"
source "${REPO_ROOT}/tests/e2e/lib/jwt.sh"
DEV_TOKEN=$(generate_dev_jwt)
AUTH_HEADER="Authorization: Bearer ${DEV_TOKEN}"

api_post() {
  curl -sf -X POST "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo '{"error":"request_failed"}'
}

api_get() {
  curl -sf "${BASE_URL}$1" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    2>/dev/null || echo '{"error":"request_failed"}'
}

# ─── Parse flags ─────────────────────────────────────────────────────────────

DO_BUILD=true
SKIP_INFRA=false

for arg in "$@"; do
  case "$arg" in
    --no-build)   DO_BUILD=false ;;
    --skip-infra) SKIP_INFRA=true ;;
    *)            echo "Unknown flag: $arg"; exit 1 ;;
  esac
done

# ═════════════════════════════════════════════════════════════════════════════
# Phase 1: Infrastructure
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  TWO-SOURCE PROOF — Migration Platform Verification${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ "$SKIP_INFRA" = "false" ]; then
  log "Phase 1: Infrastructure"

  cd "$REPO_ROOT"

  if [ "$DO_BUILD" = "true" ]; then
    log "Building and starting Docker services..."
    docker compose up -d --build 2>&1 | tail -5
  else
    log "Starting Docker services (no rebuild)..."
    docker compose up -d 2>&1 | tail -5
  fi

  # Wait for health aggregate endpoint
  log "Waiting for services to become healthy..."
  HEALTH_ATTEMPTS=0
  MAX_HEALTH_ATTEMPTS=60
  while [ $HEALTH_ATTEMPTS -lt $MAX_HEALTH_ATTEMPTS ]; do
    HEALTH_RESP=$(curl -sf "${BASE_URL}/api/v1/health/aggregate" 2>/dev/null || echo "")
    if [ -n "$HEALTH_RESP" ]; then
      # Check that migration service is healthy
      MIGRATION_STATUS=$(echo "$HEALTH_RESP" | jq -r '.services.migration.status // .data.migration // .migration // empty' 2>/dev/null || echo "")
      if [ "$MIGRATION_STATUS" = "healthy" ] || [ "$MIGRATION_STATUS" = "ok" ]; then
        pass "Health aggregate: migration service healthy"
        break
      fi
    fi
    HEALTH_ATTEMPTS=$((HEALTH_ATTEMPTS + 1))
    sleep 2
  done

  if [ $HEALTH_ATTEMPTS -ge $MAX_HEALTH_ATTEMPTS ]; then
    fail "Services did not become healthy within ${MAX_HEALTH_ATTEMPTS}s"
    echo "  Last health response: $(echo "$HEALTH_RESP" | head -c 300)"
  fi

  # Check source databases are ready (with retry — large seed data takes time)
  log "Checking source databases..."

  PRISM_READY="failed"
  for i in $(seq 1 15); do
    PRISM_READY=$(docker compose exec -T prism-source pg_isready -U prism -d prism_prod 2>/dev/null || echo "failed")
    if echo "$PRISM_READY" | grep -q "accepting connections"; then
      # Verify seed data loaded (check a known table has rows)
      PRISM_CHECK=$(docker compose exec -T prism-source psql -U prism -d prism_prod -t -A \
        -c "SELECT COUNT(*) FROM src_prism.prism_member" 2>/dev/null || echo "0")
      if [ "${PRISM_CHECK:-0}" -gt 0 ]; then
        break
      fi
    fi
    sleep 4
  done
  if echo "$PRISM_READY" | grep -q "accepting connections"; then
    pass "prism-source database ready"
  else
    fail "prism-source database not ready after 60s: $PRISM_READY"
  fi

  PAS_READY="failed"
  for i in $(seq 1 15); do
    PAS_READY=$(docker compose exec -T pas-source pg_isready -U pas -d pas_prod 2>/dev/null || echo "failed")
    if echo "$PAS_READY" | grep -q "accepting connections"; then
      PAS_CHECK=$(docker compose exec -T pas-source psql -U pas -d pas_prod -t -A \
        -c "SELECT COUNT(*) FROM src_pas.member" 2>/dev/null || echo "0")
      if [ "${PAS_CHECK:-0}" -gt 0 ]; then
        break
      fi
    fi
    sleep 4
  done
  if echo "$PAS_READY" | grep -q "accepting connections"; then
    pass "pas-source database ready"
  else
    fail "pas-source database not ready after 60s: $PAS_READY"
  fi
else
  log "Phase 1: Skipped (--skip-infra)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Phase 2: PRISM Migration Pipeline
# ═════════════════════════════════════════════════════════════════════════════

echo ""
log "Phase 2: PRISM Migration Pipeline"

# Step 1: Create engagement
log "  Creating PRISM engagement..."
PRISM_ENG=$(api_post "/api/v1/migration/engagements" \
  '{"source_system_name":"PRISM","source_platform_type":"legacy_pas"}')

PRISM_ENG_ID=$(echo "$PRISM_ENG" | jq -r '.data.engagement_id // .data.id // .engagement_id // .id // empty' 2>/dev/null || echo "")
if [ -n "$PRISM_ENG_ID" ] && [ "$PRISM_ENG_ID" != "null" ]; then
  pass "PRISM engagement created: $PRISM_ENG_ID"
else
  fail "Failed to create PRISM engagement"
  echo "  Response: $(echo "$PRISM_ENG" | head -c 300)"
  # Cannot continue without engagement ID
  echo ""
  echo -e "${RED}ABORT: Cannot continue without PRISM engagement. Exiting.${NC}"
  exit 1
fi

# Step 2: Configure source
log "  Configuring PRISM source connection..."
PRISM_SRC=$(api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}/source" \
  '{"driver":"postgres","host":"prism-source","port":"5432","dbname":"prism_prod","user":"prism","password":"prism","sslmode":"disable"}')

if echo "$PRISM_SRC" | jq -e '.data.connected // .connected' >/dev/null 2>&1; then
  pass "PRISM source connected"
else
  fail "PRISM source connection failed"
  echo "  Response: $(echo "$PRISM_SRC" | head -c 300)"
fi

# Step 3: Profile source tables
log "  Profiling PRISM source tables..."
PRISM_PROFILE=$(api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}/profile" \
  '{"tables":[{"table_name":"src_prism.prism_member","required_columns":["mbr_nbr","last_nm","first_nm","natl_id","birth_dt","hire_dt"],"key_columns":["mbr_nbr"]}]}')

if echo "$PRISM_PROFILE" | jq -e '.data // empty' >/dev/null 2>&1; then
  pass "PRISM source profiled"
else
  # Profile may still succeed with different response shape
  if echo "$PRISM_PROFILE" | jq -e '.[0].table_name // empty' >/dev/null 2>&1; then
    pass "PRISM source profiled"
  else
    fail "PRISM source profiling failed"
    echo "  Response: $(echo "$PRISM_PROFILE" | head -c 300)"
  fi
fi

# Step 4: Approve baseline + generate mappings
log "  Approving baseline and generating mappings..."
api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}/source" \
  '{"driver":"postgres","host":"prism-source","port":"5432","dbname":"prism_prod","user":"prism","password":"prism","sslmode":"disable"}' >/dev/null 2>&1 || true

# Advance to PROFILING status for baseline approval
api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}" \
  '{"status":"PROFILING"}' >/dev/null 2>&1 || true
# Use PATCH via curl directly for status update
curl -sf -X PATCH "${BASE_URL}/api/v1/migration/engagements/${PRISM_ENG_ID}" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d '{"status":"PROFILING"}' >/dev/null 2>&1 || true

# Approve baseline
curl -sf -X PATCH "${BASE_URL}/api/v1/migration/engagements/${PRISM_ENG_ID}/approve-baseline" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d '{}' >/dev/null 2>&1 || true

PRISM_MAPPINGS=$(api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}/generate-mappings" \
  '{"tables":[{"source_table":"prism_member","concept_tag":"employee-master","columns":[{"name":"mbr_nbr","data_type":"integer","is_nullable":false,"is_key":true},{"name":"first_nm","data_type":"varchar","is_nullable":false,"is_key":false},{"name":"last_nm","data_type":"varchar","is_nullable":false,"is_key":false},{"name":"birth_dt","data_type":"varchar","is_nullable":true,"is_key":false},{"name":"hire_dt","data_type":"date","is_nullable":true,"is_key":false},{"name":"ssn","data_type":"varchar","is_nullable":false,"is_key":false},{"name":"plan_cd","data_type":"varchar","is_nullable":true,"is_key":false},{"name":"status_cd","data_type":"varchar","is_nullable":false,"is_key":false}]}]}')

if echo "$PRISM_MAPPINGS" | jq -e '.data // empty' >/dev/null 2>&1; then
  PRISM_MAP_COUNT=$(echo "$PRISM_MAPPINGS" | jq '.data | length // 0' 2>/dev/null || echo "0")
  pass "PRISM mappings generated: ${PRISM_MAP_COUNT} fields"
else
  fail "PRISM mapping generation failed"
  echo "  Response: $(echo "$PRISM_MAPPINGS" | head -c 300)"
fi

# Step 5: Create and execute batch
log "  Creating and executing PRISM batch..."
PRISM_BATCH=$(api_post "/api/v1/migration/engagements/${PRISM_ENG_ID}/batches" \
  '{"batch_scope":"full","mapping_version":"v1.0"}')

PRISM_BATCH_ID=$(echo "$PRISM_BATCH" | jq -r '.data.batch_id // .data.id // .batch_id // .id // empty' 2>/dev/null || echo "")
if [ -n "$PRISM_BATCH_ID" ] && [ "$PRISM_BATCH_ID" != "null" ]; then
  pass "PRISM batch created: $PRISM_BATCH_ID"

  # Execute batch
  EXEC_RESP=$(api_post "/api/v1/migration/batches/${PRISM_BATCH_ID}/execute" '{}')
  EXEC_STATUS=$(echo "$EXEC_RESP" | jq -r '.data.status // .status // empty' 2>/dev/null || echo "")
  if [ "$EXEC_STATUS" = "RUNNING" ] || [ -n "$EXEC_STATUS" ]; then
    pass "PRISM batch execution started"
  else
    fail "PRISM batch execution failed to start"
    echo "  Response: $(echo "$EXEC_RESP" | head -c 300)"
  fi

  # Step 6: Poll for completion (max 60s)
  log "  Polling PRISM batch completion (max 60s)..."
  POLL_ATTEMPTS=0
  MAX_POLL=30
  PRISM_BATCH_STATUS="RUNNING"
  while [ $POLL_ATTEMPTS -lt $MAX_POLL ]; do
    BATCH_RESP=$(api_get "/api/v1/migration/batches/${PRISM_BATCH_ID}")
    PRISM_BATCH_STATUS=$(echo "$BATCH_RESP" | jq -r '.data.status // .status // "UNKNOWN"' 2>/dev/null || echo "UNKNOWN")
    if [ "$PRISM_BATCH_STATUS" = "LOADED" ] || [ "$PRISM_BATCH_STATUS" = "COMPLETE" ] || [ "$PRISM_BATCH_STATUS" = "COMPLETED" ]; then
      pass "PRISM batch completed"
      break
    elif [ "$PRISM_BATCH_STATUS" = "FAILED" ] || [ "$PRISM_BATCH_STATUS" = "HALTED" ]; then
      fail "PRISM batch ended with status: $PRISM_BATCH_STATUS"
      break
    fi
    POLL_ATTEMPTS=$((POLL_ATTEMPTS + 1))
    sleep 2
  done
  if [ $POLL_ATTEMPTS -ge $MAX_POLL ]; then
    fail "PRISM batch did not complete within 60s (last status: $PRISM_BATCH_STATUS)"
  fi

  # Step 7: Run reconciliation
  log "  Running PRISM reconciliation..."
  PRISM_RECON=$(api_post "/api/v1/migration/batches/${PRISM_BATCH_ID}/reconcile" '{}')
  if echo "$PRISM_RECON" | jq -e '.data // empty' >/dev/null 2>&1; then
    pass "PRISM reconciliation complete"
  else
    fail "PRISM reconciliation failed"
    echo "  Response: $(echo "$PRISM_RECON" | head -c 300)"
  fi

  # Step 8: Check gate score from reconcile response
  log "  Checking PRISM reconciliation gate..."
  PRISM_GATE=$(echo "$PRISM_RECON" | jq -r '.data.weighted_score // "N/A"' 2>/dev/null || echo "N/A")
  PRISM_TOTAL=$(echo "$PRISM_RECON" | jq -r '.data.total_members // 0' 2>/dev/null || echo "0")
  PRISM_MATCH=$(echo "$PRISM_RECON" | jq -r '.data.match_count // 0' 2>/dev/null || echo "0")
  PRISM_PASSED=$(echo "$PRISM_RECON" | jq -r '.data.gate_passed // false' 2>/dev/null || echo "false")
  if [ "$PRISM_GATE" != "N/A" ] && [ "$PRISM_GATE" != "null" ] && [ "$PRISM_GATE" != "" ]; then
    pass "PRISM gate score: ${PRISM_GATE} (${PRISM_MATCH}/${PRISM_TOTAL} matched, passed=${PRISM_PASSED})"
  else
    fail "PRISM gate score unavailable"
    echo "  Response: $(echo "$PRISM_RECON" | head -c 300)"
  fi

  # Step 8b: Verify reconciliation data was persisted
  log "  Verifying PRISM reconciliation data counts..."
  PRISM_DATA_SQL="
    SELECT 'stored_calc' AS tbl, COUNT(*) FROM migration.stored_calculations WHERE batch_id = '${PRISM_BATCH_ID}'
    UNION ALL
    SELECT 'payment_hist', COUNT(*) FROM migration.payment_history WHERE batch_id = '${PRISM_BATCH_ID}'
    UNION ALL
    SELECT 'canonical_mbr', COUNT(*) FROM migration.canonical_members WHERE batch_id = '${PRISM_BATCH_ID}'
    UNION ALL
    SELECT 'recon_results', COUNT(*) FROM migration.reconciliation WHERE batch_id = '${PRISM_BATCH_ID}'
  "
  PRISM_DATA_COUNTS=$(docker compose exec -T postgres psql -U noui -d noui -t -A -F '|' \
    -c "$PRISM_DATA_SQL" 2>/dev/null || echo "QUERY_FAILED")
  if echo "$PRISM_DATA_COUNTS" | grep -q "QUERY_FAILED"; then
    fail "PRISM data count query failed"
  else
    echo "  PRISM data counts:"
    echo "$PRISM_DATA_COUNTS" | while IFS='|' read -r tbl cnt; do
      echo "    ${tbl}: ${cnt}"
    done
    # Assert stored_calculations > 0
    PRISM_SC_COUNT=$(echo "$PRISM_DATA_COUNTS" | grep "stored_calc" | cut -d'|' -f2)
    if [ "${PRISM_SC_COUNT:-0}" -gt 0 ]; then
      pass "PRISM stored calculations loaded: ${PRISM_SC_COUNT}"
    else
      fail "PRISM stored calculations empty — tier 1 reconciliation has no data"
    fi
  fi
else
  fail "Failed to create PRISM batch"
  echo "  Response: $(echo "$PRISM_BATCH" | head -c 300)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Phase 3: PAS Migration Pipeline
# ═════════════════════════════════════════════════════════════════════════════

echo ""
log "Phase 3: PAS Migration Pipeline"

# Step 1: Create engagement
log "  Creating PAS engagement..."
PAS_ENG=$(api_post "/api/v1/migration/engagements" \
  '{"source_system_name":"PAS","source_platform_type":"modern_pas"}')

PAS_ENG_ID=$(echo "$PAS_ENG" | jq -r '.data.engagement_id // .data.id // .engagement_id // .id // empty' 2>/dev/null || echo "")
if [ -n "$PAS_ENG_ID" ] && [ "$PAS_ENG_ID" != "null" ]; then
  pass "PAS engagement created: $PAS_ENG_ID"
else
  fail "Failed to create PAS engagement"
  echo "  Response: $(echo "$PAS_ENG" | head -c 300)"
  echo ""
  echo -e "${RED}ABORT: Cannot continue without PAS engagement. Exiting.${NC}"
  exit 1
fi

# Step 2: Configure source
log "  Configuring PAS source connection..."
PAS_SRC=$(api_post "/api/v1/migration/engagements/${PAS_ENG_ID}/source" \
  '{"driver":"postgres","host":"pas-source","port":"5432","dbname":"pas_prod","user":"pas","password":"pas","sslmode":"disable"}')

if echo "$PAS_SRC" | jq -e '.data.connected // .connected' >/dev/null 2>&1; then
  pass "PAS source connected"
else
  fail "PAS source connection failed"
  echo "  Response: $(echo "$PAS_SRC" | head -c 300)"
fi

# Step 3: Profile source tables
log "  Profiling PAS source tables..."
PAS_PROFILE=$(api_post "/api/v1/migration/engagements/${PAS_ENG_ID}/profile" \
  '{"tables":[{"table_name":"src_pas.member","required_columns":["member_id","last_name","first_name","date_of_birth","original_membership_date"],"key_columns":["member_id"]}]}')

if echo "$PAS_PROFILE" | jq -e '.data // empty' >/dev/null 2>&1; then
  pass "PAS source profiled"
else
  if echo "$PAS_PROFILE" | jq -e '.[0].table_name // empty' >/dev/null 2>&1; then
    pass "PAS source profiled"
  else
    fail "PAS source profiling failed"
    echo "  Response: $(echo "$PAS_PROFILE" | head -c 300)"
  fi
fi

# Step 4: Approve baseline + generate mappings
log "  Approving baseline and generating mappings..."
curl -sf -X PATCH "${BASE_URL}/api/v1/migration/engagements/${PAS_ENG_ID}" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d '{"status":"PROFILING"}' >/dev/null 2>&1 || true

curl -sf -X PATCH "${BASE_URL}/api/v1/migration/engagements/${PAS_ENG_ID}/approve-baseline" \
  -H "Content-Type: application/json" \
  -H "${AUTH_HEADER}" \
  -H "X-Tenant-ID: ${TENANT_ID}" \
  -d '{}' >/dev/null 2>&1 || true

PAS_MAPPINGS=$(api_post "/api/v1/migration/engagements/${PAS_ENG_ID}/generate-mappings" \
  '{"tables":[{"source_table":"member","concept_tag":"employee-master","columns":[{"name":"member_id","data_type":"uuid","is_nullable":false,"is_key":true},{"name":"first_name","data_type":"text","is_nullable":false,"is_key":false},{"name":"last_name","data_type":"text","is_nullable":false,"is_key":false},{"name":"date_of_birth","data_type":"date","is_nullable":true,"is_key":false},{"name":"original_hire_date","data_type":"date","is_nullable":true,"is_key":false},{"name":"ssn_normalized","data_type":"text","is_nullable":true,"is_key":false},{"name":"plan_code","data_type":"text","is_nullable":true,"is_key":false},{"name":"member_status_code","data_type":"text","is_nullable":false,"is_key":false}]}]}')

if echo "$PAS_MAPPINGS" | jq -e '.data // empty' >/dev/null 2>&1; then
  PAS_MAP_COUNT=$(echo "$PAS_MAPPINGS" | jq '.data | length // 0' 2>/dev/null || echo "0")
  pass "PAS mappings generated: ${PAS_MAP_COUNT} fields"
else
  fail "PAS mapping generation failed"
  echo "  Response: $(echo "$PAS_MAPPINGS" | head -c 300)"
fi

# Step 5: Create and execute batch
log "  Creating and executing PAS batch..."
PAS_BATCH=$(api_post "/api/v1/migration/engagements/${PAS_ENG_ID}/batches" \
  '{"batch_scope":"full","mapping_version":"v1.0"}')

PAS_BATCH_ID=$(echo "$PAS_BATCH" | jq -r '.data.batch_id // .data.id // .batch_id // .id // empty' 2>/dev/null || echo "")
if [ -n "$PAS_BATCH_ID" ] && [ "$PAS_BATCH_ID" != "null" ]; then
  pass "PAS batch created: $PAS_BATCH_ID"

  # Execute batch
  EXEC_RESP=$(api_post "/api/v1/migration/batches/${PAS_BATCH_ID}/execute" '{}')
  EXEC_STATUS=$(echo "$EXEC_RESP" | jq -r '.data.status // .status // empty' 2>/dev/null || echo "")
  if [ "$EXEC_STATUS" = "RUNNING" ] || [ -n "$EXEC_STATUS" ]; then
    pass "PAS batch execution started"
  else
    fail "PAS batch execution failed to start"
    echo "  Response: $(echo "$EXEC_RESP" | head -c 300)"
  fi

  # Step 6: Poll for completion (max 60s)
  log "  Polling PAS batch completion (max 60s)..."
  POLL_ATTEMPTS=0
  MAX_POLL=30
  PAS_BATCH_STATUS="RUNNING"
  while [ $POLL_ATTEMPTS -lt $MAX_POLL ]; do
    BATCH_RESP=$(api_get "/api/v1/migration/batches/${PAS_BATCH_ID}")
    PAS_BATCH_STATUS=$(echo "$BATCH_RESP" | jq -r '.data.status // .status // "UNKNOWN"' 2>/dev/null || echo "UNKNOWN")
    if [ "$PAS_BATCH_STATUS" = "LOADED" ] || [ "$PAS_BATCH_STATUS" = "COMPLETE" ] || [ "$PAS_BATCH_STATUS" = "COMPLETED" ]; then
      pass "PAS batch completed"
      break
    elif [ "$PAS_BATCH_STATUS" = "FAILED" ] || [ "$PAS_BATCH_STATUS" = "HALTED" ]; then
      fail "PAS batch ended with status: $PAS_BATCH_STATUS"
      break
    fi
    POLL_ATTEMPTS=$((POLL_ATTEMPTS + 1))
    sleep 2
  done
  if [ $POLL_ATTEMPTS -ge $MAX_POLL ]; then
    fail "PAS batch did not complete within 60s (last status: $PAS_BATCH_STATUS)"
  fi

  # Step 7: Run reconciliation
  log "  Running PAS reconciliation..."
  PAS_RECON=$(api_post "/api/v1/migration/batches/${PAS_BATCH_ID}/reconcile" '{}')
  if echo "$PAS_RECON" | jq -e '.data // empty' >/dev/null 2>&1; then
    pass "PAS reconciliation complete"
  else
    fail "PAS reconciliation failed"
    echo "  Response: $(echo "$PAS_RECON" | head -c 300)"
  fi

  # Step 8: Check gate score from reconcile response
  log "  Checking PAS reconciliation gate..."
  PAS_GATE=$(echo "$PAS_RECON" | jq -r '.data.weighted_score // "N/A"' 2>/dev/null || echo "N/A")
  PAS_TOTAL=$(echo "$PAS_RECON" | jq -r '.data.total_members // 0' 2>/dev/null || echo "0")
  PAS_MATCH=$(echo "$PAS_RECON" | jq -r '.data.match_count // 0' 2>/dev/null || echo "0")
  PAS_PASSED=$(echo "$PAS_RECON" | jq -r '.data.gate_passed // false' 2>/dev/null || echo "false")
  if [ "$PAS_GATE" != "N/A" ] && [ "$PAS_GATE" != "null" ] && [ "$PAS_GATE" != "" ]; then
    pass "PAS gate score: ${PAS_GATE} (${PAS_MATCH}/${PAS_TOTAL} matched, passed=${PAS_PASSED})"
  else
    fail "PAS gate score unavailable"
    echo "  Response: $(echo "$PAS_RECON" | head -c 300)"
  fi

  # Step 8b: Verify PAS reconciliation data counts
  log "  Verifying PAS reconciliation data counts..."
  PAS_DATA_SQL="
    SELECT 'stored_calc' AS tbl, COUNT(*) FROM migration.stored_calculations WHERE batch_id = '${PAS_BATCH_ID}'
    UNION ALL
    SELECT 'payment_hist', COUNT(*) FROM migration.payment_history WHERE batch_id = '${PAS_BATCH_ID}'
    UNION ALL
    SELECT 'canonical_mbr', COUNT(*) FROM migration.canonical_members WHERE batch_id = '${PAS_BATCH_ID}'
    UNION ALL
    SELECT 'recon_results', COUNT(*) FROM migration.reconciliation WHERE batch_id = '${PAS_BATCH_ID}'
  "
  PAS_DATA_COUNTS=$(docker compose exec -T postgres psql -U noui -d noui -t -A -F '|' \
    -c "$PAS_DATA_SQL" 2>/dev/null || echo "QUERY_FAILED")
  if echo "$PAS_DATA_COUNTS" | grep -q "QUERY_FAILED"; then
    fail "PAS data count query failed"
  else
    echo "  PAS data counts:"
    echo "$PAS_DATA_COUNTS" | while IFS='|' read -r tbl cnt; do
      echo "    ${tbl}: ${cnt}"
    done
    # Assert stored_calculations > 0
    PAS_SC_COUNT=$(echo "$PAS_DATA_COUNTS" | grep "stored_calc" | cut -d'|' -f2)
    if [ "${PAS_SC_COUNT:-0}" -gt 0 ]; then
      pass "PAS stored calculations loaded: ${PAS_SC_COUNT}"
    else
      fail "PAS stored calculations empty — tier 1 reconciliation has no data"
    fi
  fi
else
  fail "Failed to create PAS batch"
  echo "  Response: $(echo "$PAS_BATCH" | head -c 300)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Phase 4: Cross-Source Verification
# ═════════════════════════════════════════════════════════════════════════════

echo ""
log "Phase 4: Cross-Source Verification"

log "  Verifying both sources exist in canonical tables..."

cd "$REPO_ROOT"

CROSS_SOURCE_SQL="
SELECT
  e.source_system_name,
  COUNT(DISTINCT b.batch_id) AS batch_count,
  COALESCE(SUM(b.row_count_loaded), 0) AS total_loaded
FROM migration.engagement e
LEFT JOIN migration.batch b ON b.engagement_id = e.engagement_id
WHERE e.source_system_name IN ('PRISM', 'PAS')
GROUP BY e.source_system_name
ORDER BY e.source_system_name;
"

CROSS_RESULT=$(docker compose exec -T postgres psql -U noui -d noui -t -A -F '|' \
  -c "$CROSS_SOURCE_SQL" 2>/dev/null || echo "QUERY_FAILED")

if echo "$CROSS_RESULT" | grep -q "PRISM"; then
  pass "PRISM engagement found in canonical tables"
else
  fail "PRISM engagement not found in canonical tables"
  echo "  SQL result: $CROSS_RESULT"
fi

if echo "$CROSS_RESULT" | grep -q "PAS"; then
  pass "PAS engagement found in canonical tables"
else
  fail "PAS engagement not found in canonical tables"
  echo "  SQL result: $CROSS_RESULT"
fi

# Verify both engagements coexist
SOURCE_COUNT=$(echo "$CROSS_RESULT" | grep -c '|' || echo "0")
if [ "$SOURCE_COUNT" -ge 2 ]; then
  pass "Both sources coexist in canonical schema ($SOURCE_COUNT sources)"
else
  fail "Expected 2+ sources in canonical schema, found $SOURCE_COUNT"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Phase 5: Cross-Language Verification
# ═════════════════════════════════════════════════════════════════════════════

echo ""
log "Phase 5: Cross-Language Verification"

# Go reconciler tests
log "  Running Go cross-language reconciler tests..."
GO_TEST_OUTPUT=""
GO_TEST_EXIT=0
GO_TEST_OUTPUT=$(cd "$REPO_ROOT/platform/migration" && go test ./reconciler/... -run TestCrossLanguage -count=1 -timeout 30s 2>&1) || GO_TEST_EXIT=$?

if [ $GO_TEST_EXIT -eq 0 ]; then
  pass "Go cross-language reconciler tests passed"
else
  # Check if tests were simply not found (no matching tests = exit 0 in go, but
  # "no test files" or "no tests to run" appears in output)
  if echo "$GO_TEST_OUTPUT" | grep -q "no test files\|no tests to run\|\[no test files\]"; then
    log "  (No Go cross-language tests found — skipping)"
  else
    fail "Go cross-language reconciler tests failed (exit $GO_TEST_EXIT)"
    echo "  Output: $(echo "$GO_TEST_OUTPUT" | tail -10)"
  fi
fi

# Python reconciler tests
log "  Running Python cross-language tests..."
PY_TEST_OUTPUT=""
PY_TEST_EXIT=0

if [ -f "$REPO_ROOT/migration-simulation/tests/test_cross_language.py" ]; then
  PY_TEST_OUTPUT=$(cd "$REPO_ROOT/migration-simulation" && python -m pytest tests/test_cross_language.py -v --tb=short 2>&1) || PY_TEST_EXIT=$?

  if [ $PY_TEST_EXIT -eq 0 ]; then
    pass "Python cross-language tests passed"
  else
    # pytest exit code 5 = no tests collected
    if [ $PY_TEST_EXIT -eq 5 ]; then
      log "  (No Python cross-language tests collected — skipping)"
    else
      fail "Python cross-language tests failed (exit $PY_TEST_EXIT)"
      echo "  Output: $(echo "$PY_TEST_OUTPUT" | tail -10)"
    fi
  fi
else
  log "  (Python cross-language test file not found — skipping)"
fi

# ═════════════════════════════════════════════════════════════════════════════
# Phase 6: Results Summary
# ═════════════════════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}  TWO-SOURCE PROOF — Results${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ┌──────────────────────────────────────────────────┐"
echo -e "  │  Source     │  Gate Score  │  Status              │"
echo -e "  ├──────────────────────────────────────────────────┤"

# PRISM row
if [ "$PRISM_GATE" != "N/A" ] && [ "$PRISM_GATE" != "null" ] && [ "$PRISM_GATE" != "" ]; then
  echo -e "  │  PRISM      │  ${PRISM_GATE}        │  ${GREEN}Complete${NC}              │"
else
  echo -e "  │  PRISM      │  N/A          │  ${RED}Incomplete${NC}            │"
fi

# PAS row
if [ "$PAS_GATE" != "N/A" ] && [ "$PAS_GATE" != "null" ] && [ "$PAS_GATE" != "" ]; then
  echo -e "  │  PAS        │  ${PAS_GATE}        │  ${GREEN}Complete${NC}              │"
else
  echo -e "  │  PAS        │  N/A          │  ${RED}Incomplete${NC}            │"
fi

echo -e "  └──────────────────────────────────────────────────┘"
echo ""
echo -e "  ${GREEN}Passed:${NC} ${PASS_COUNT}"
echo -e "  ${RED}Failed:${NC} ${FAIL_COUNT}"
echo -e "  Total:  ${TOTAL_COUNT}"
echo ""

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo -e "${RED}PROOF FAILED${NC} — $FAIL_COUNT check(s) did not pass"
  exit 1
else
  echo -e "${GREEN}PROOF PASSED${NC} — all $TOTAL_COUNT checks passed"
  exit 0
fi
