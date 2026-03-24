#!/usr/bin/env bash
# Shared assertion helpers for E2E tests.
# Requires: colors.sh sourced first, PASS_COUNT / FAIL_COUNT / TOTAL_COUNT initialized.

assert_status() {
  local label="$1" expected="$2" actual="$3"
  TOTAL_COUNT=$((TOTAL_COUNT + 1))
  # Support space-separated expected codes (e.g. "200 201")
  local code matched=false
  for code in $expected; do
    if [ "$code" = "$actual" ]; then matched=true; break; fi
  done
  if $matched; then
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

extract_http() {
  local response="$1"
  HTTP_CODE=$(echo "$response" | tail -1)
  BODY=$(echo "$response" | sed '$d')
  if [ -z "$HTTP_CODE" ] || ! [[ "$HTTP_CODE" =~ ^[0-9]+$ ]]; then
    HTTP_CODE="000"
    BODY=""
  fi
}

# Print summary and exit with appropriate code
print_summary() {
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
}
