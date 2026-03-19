#!/bin/bash
# Generates go test -json output for the intelligence service.
# Run from repo root: bash scripts/generate-test-report.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$REPO_ROOT/test-results"

mkdir -p "$RESULTS_DIR"

echo "Running intelligence service tests..."
cd "$REPO_ROOT/platform/intelligence"
go test -json ./... > "$RESULTS_DIR/intelligence-report.json" 2>&1 || true

echo "Test report generated: $RESULTS_DIR/intelligence-report.json"
echo "Lines: $(wc -l < "$RESULTS_DIR/intelligence-report.json")"
