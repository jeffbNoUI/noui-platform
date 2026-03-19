#!/usr/bin/env bash
# Shared ANSI color constants and logging helpers for E2E tests.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_header() {
  echo -e "\n${CYAN}═══ $1 ═══${NC}"
}
