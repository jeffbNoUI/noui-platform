#!/usr/bin/env bash
# Health Dashboard E2E Smoke Test
# Usage: bash tests/smoke/health_smoke_test.sh
# Requires: docker compose, curl, jq
#
# Boots the full Docker Compose stack, verifies the health aggregation
# dashboard works end-to-end, tests failure detection, and cleans up.
# CI-ready: exit 0 on pass, exit 1 on fail.
set -euo pipefail

# Route through nginx proxy — no direct host port access to services
HEALTHAGG_URL="http://localhost:3000"
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
echo "--- Phase 2: Wait for nginx + healthagg ---"
elapsed=0
while true; do
  if curl -sf "${HEALTHAGG_URL}/api/v1/health/aggregate" > /dev/null 2>&1; then
    echo "  health aggregate reachable via nginx after ${elapsed}s"
    break
  fi
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "  FATAL: health aggregate not reachable after ${TIMEOUT}s"
    docker compose logs frontend healthagg 2>&1 | tail -30
    exit 1
  fi
  sleep "$POLL_INTERVAL"
  elapsed=$((elapsed + POLL_INTERVAL))
done

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

# Note: connector is expected unreachable in docker-compose because it requires
# its own target database for schema introspection (Layer 1 infrastructure).
# The 8 platform services (Layer 2) are the "must be healthy" set.

# Assert service count >= 8 (all platform services)
if [ "$SERVICE_COUNT" -ge 8 ]; then
  pass "service count is $SERVICE_COUNT (>= 8 platform services)"
else
  fail "service count is $SERVICE_COUNT, expected >= 8"
fi

# Assert only connector is unreachable (expected — no target DB in compose)
UNREACHABLE_LIST=$(echo "$RESPONSE" | jq -r '.unreachable // [] | join(", ")')
if [ "$UNREACHABLE_COUNT" -eq 0 ]; then
  pass "0 unreachable services"
elif [ "$UNREACHABLE_COUNT" -eq 1 ] && [ "$UNREACHABLE_LIST" = "connector" ]; then
  pass "only connector unreachable (expected — no target DB in compose)"
else
  fail "$UNREACHABLE_COUNT unreachable service(s): $UNREACHABLE_LIST (expected only connector)"
fi

# Overall may be "unhealthy" due to connector — check platform services individually
if [ "$OVERALL" = "healthy" ]; then
  pass "overall status is 'healthy'"
elif [ "$OVERALL" = "unhealthy" ] && [ "$UNREACHABLE_LIST" = "connector" ]; then
  pass "overall 'unhealthy' only due to expected connector absence"
else
  fail "overall status is '$OVERALL' with unexpected unreachable: $UNREACHABLE_LIST"
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

# Check each platform service individually (connector excluded — expected unreachable)
EXPECTED_SERVICES="dataaccess intelligence crm correspondence dataquality knowledgebase casemanagement preferences"
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

# Overall should NOT be healthy (dataaccess down + connector already down)
if [ "$OVERALL2" != "healthy" ]; then
  pass "overall status is '$OVERALL2' (not healthy) after stopping dataaccess"
else
  fail "overall status is still 'healthy' after stopping dataaccess"
fi

# dataaccess should be in unreachable list (connector may also be there)
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
