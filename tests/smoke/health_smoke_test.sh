#!/usr/bin/env bash
# Health Dashboard E2E Smoke Test
# Usage: bash tests/smoke/health_smoke_test.sh
# Requires: docker compose, curl, jq
#
# Boots the full Docker Compose stack, verifies the health aggregation
# dashboard works end-to-end, tests failure detection, and cleans up.
# CI-ready: exit 0 on pass, exit 1 on fail.
set -euo pipefail

HEALTHAGG_URL="http://localhost:8091"
TIMEOUT=120
POLL_INTERVAL=5
PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

cleanup() {
  echo ""
  echo "=== Cleanup ==="
  docker compose down --remove-orphans 2>/dev/null || true
}
trap cleanup EXIT

# ─── Phase 1: Boot ───────────────────────────────────────────────────────────
echo "=== Health Dashboard E2E Smoke Test ==="
echo ""
echo "--- Phase 1: Boot ---"
docker compose up -d --build 2>&1 | tail -5

# ─── Phase 2: Wait for healthagg ─────────────────────────────────────────────
echo ""
echo "--- Phase 2: Wait for healthagg ---"
elapsed=0
while true; do
  if curl -sf "${HEALTHAGG_URL}/healthz" > /dev/null 2>&1; then
    echo "  healthagg reachable after ${elapsed}s"
    break
  fi
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "  FATAL: healthagg not reachable after ${TIMEOUT}s"
    docker compose logs healthagg 2>&1 | tail -20
    exit 1
  fi
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

# Give all backend services time to finish starting and become healthy
echo "  Waiting 10s for all services to stabilize..."
sleep 10

# ─── Phase 3: Aggregate health check ────────────────────────────────────────
echo ""
echo "--- Phase 3: Aggregate health check ---"

RESPONSE=$(curl -sf "${HEALTHAGG_URL}/api/v1/health/aggregate") || {
  fail "GET /api/v1/health/aggregate did not return 200"
  echo "=== Results: $PASS passed, $FAIL failed ==="
  exit 1
}
pass "GET /api/v1/health/aggregate returned 200"

# Parse response fields
OVERALL=$(echo "$RESPONSE" | jq -r '.overall')
SERVICE_COUNT=$(echo "$RESPONSE" | jq '.services | length')
UNREACHABLE_COUNT=$(echo "$RESPONSE" | jq '.unreachable // [] | length')

# Assert overall is healthy
if [ "$OVERALL" = "healthy" ]; then
  pass "overall status is 'healthy'"
else
  fail "overall status is '$OVERALL', expected 'healthy'"
fi

# Assert service count >= 9
if [ "$SERVICE_COUNT" -ge 9 ]; then
  pass "service count is $SERVICE_COUNT (>= 9)"
else
  fail "service count is $SERVICE_COUNT, expected >= 9"
fi

# Assert 0 unreachable
if [ "$UNREACHABLE_COUNT" -eq 0 ]; then
  pass "0 unreachable services"
else
  UNREACHABLE_LIST=$(echo "$RESPONSE" | jq -r '.unreachable // [] | join(", ")')
  fail "$UNREACHABLE_COUNT unreachable service(s): $UNREACHABLE_LIST"
fi

# Assert connector status is "ok"
CONNECTOR_STATUS=$(echo "$RESPONSE" | jq -r '.services.connector.status // "missing"')
if [ "$CONNECTOR_STATUS" = "ok" ]; then
  pass "connector status is 'ok'"
else
  fail "connector status is '$CONNECTOR_STATUS', expected 'ok'"
fi

# Print service detail table
echo ""
echo "  ┌──────────────────┬──────────┬──────────────────────────┐"
echo "  │ Service          │ Status   │ Version                  │"
echo "  ├──────────────────┼──────────┼──────────────────────────┤"
echo "$RESPONSE" | jq -r '
  .services | to_entries[] |
  "  │ \(.key | . + " " * (16 - length)) │ \(.value.status | . + " " * (8 - length)) │ \(.value.version // "n/a" | . + " " * (24 - length)) │"
'
echo "  └──────────────────┴──────────┴──────────────────────────┘"
echo ""

# Check each service individually
EXPECTED_SERVICES="dataaccess intelligence crm correspondence dataquality knowledgebase casemanagement preferences connector"
for svc in $EXPECTED_SERVICES; do
  SVC_STATUS=$(echo "$RESPONSE" | jq -r ".services.\"$svc\".status // \"missing\"")
  if [ "$SVC_STATUS" = "ok" ] || [ "$SVC_STATUS" = "healthy" ]; then
    pass "$svc status is '$SVC_STATUS'"
  else
    fail "$svc status is '$SVC_STATUS'"
  fi
done

# ─── Phase 4: Failure detection ─────────────────────────────────────────────
echo ""
echo "--- Phase 4: Failure detection (stop dataaccess) ---"
docker compose stop dataaccess 2>&1 | tail -2
echo "  Waiting 15s for healthagg to detect failure..."
sleep 15

RESPONSE2=$(curl -sf "${HEALTHAGG_URL}/api/v1/health/aggregate") || {
  fail "GET /api/v1/health/aggregate failed after stopping dataaccess"
  echo "=== Results: $PASS passed, $FAIL failed ==="
  exit 1
}
pass "GET /api/v1/health/aggregate returned 200 after stopping dataaccess"

OVERALL2=$(echo "$RESPONSE2" | jq -r '.overall')
UNREACHABLE2=$(echo "$RESPONSE2" | jq -r '.unreachable // [] | join(", ")')

# Overall should NOT be healthy
if [ "$OVERALL2" != "healthy" ]; then
  pass "overall status is '$OVERALL2' (not healthy) after stopping dataaccess"
else
  fail "overall status is still 'healthy' after stopping dataaccess"
fi

# dataaccess should be in unreachable list
if echo "$UNREACHABLE2" | grep -q "dataaccess"; then
  pass "dataaccess is in unreachable list: [$UNREACHABLE2]"
else
  fail "dataaccess not found in unreachable list: [$UNREACHABLE2]"
fi

# ─── Phase 5: Results ───────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then
  exit 1
else
  exit 0
fi
