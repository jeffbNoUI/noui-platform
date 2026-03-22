#!/usr/bin/env bash
# Shared HTTP request helpers for E2E tests.
# Requires: AUTH_HEADER and TENANT_ID set by the calling script.

do_get() {
  curl -s -w "\n%{http_code}" \
    "${BASE_URL}$1" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000"
}

do_post() {
  curl -s -w "\n%{http_code}" \
    -X POST "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

do_put() {
  curl -s -w "\n%{http_code}" \
    -X PUT "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

do_patch() {
  curl -s -w "\n%{http_code}" \
    -X PATCH "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

do_delete() {
  curl -s -w "\n%{http_code}" \
    -X DELETE "${BASE_URL}$1" \
    -H "${AUTH_HEADER}" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000"
}

# GET with no auth header (for 401 testing)
do_get_no_auth() {
  curl -s -w "\n%{http_code}" \
    "${BASE_URL}$1" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000"
}

# POST with no auth header (for 401 testing)
do_post_no_auth() {
  curl -s -w "\n%{http_code}" \
    -X POST "${BASE_URL}$1" \
    -H "Content-Type: application/json" \
    -H "X-Tenant-ID: ${TENANT_ID}" \
    -d "$2" 2>/dev/null || echo -e "\n000"
}

# GET with custom auth header (for bad-token testing)
do_get_with_auth() {
  local auth="$1"
  local path="$2"
  curl -s -w "\n%{http_code}" \
    "${BASE_URL}${path}" \
    -H "Authorization: ${auth}" \
    -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo -e "\n000"
}

# Wait for services to become healthy by polling endpoints.
# Usage: wait_for_services "svc1:endpoint1" "svc2:endpoint2" ...
wait_for_services() {
  echo -e "${YELLOW}Waiting for services to be healthy...${NC}"
  for entry in "$@"; do
    local svc="${entry%%:*}"
    local ep="${entry#*:}"
    local attempts=0
    while [ $attempts -lt 30 ]; do
      local hc
      hc=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${ep}" \
        -H "${AUTH_HEADER}" -H "X-Tenant-ID: ${TENANT_ID}" 2>/dev/null || echo "000")
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
