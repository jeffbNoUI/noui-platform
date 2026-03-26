#!/bin/bash
set -euo pipefail

# Usage: ./scripts/run-contract.sh <contract-id>
# Example: ./scripts/run-contract.sh M00

CONTRACT=${1:?Usage: ./scripts/run-contract.sh <contract-id>}
CONTRACT_FILE="docs/contracts/sprint-${CONTRACT}.json"

if [ ! -f "$CONTRACT_FILE" ]; then
  echo "ERROR: Contract file not found: $CONTRACT_FILE"
  exit 1
fi

# Verify prerequisites are merged before starting
deps=$(jq -r '.depends_on[]?' "$CONTRACT_FILE" 2>/dev/null)
for dep in $deps; do
  merged=$(gh pr list --state merged --label migration-build --search "migration/${dep} in:title" --json title --jq length)
  if [ "$merged" -eq 0 ]; then
    echo "BLOCKED: prerequisite $dep not merged. Stopping."
    exit 1
  fi
done

echo "=== Executing contract $CONTRACT ==="
echo "Contract: $CONTRACT_FILE"
echo "Goal: $(jq -r '.goal' "$CONTRACT_FILE")"
echo "Depends on: $(jq -r '.depends_on // [] | join(", ")' "$CONTRACT_FILE")"
echo ""

# Inline SESSION_DISPATCH.md content so the session has the full workflow
claude -p "$(cat <<'DISPATCH'
$(cat docs/contracts/SESSION_DISPATCH.md)
DISPATCH
)

CONTRACT FILE: ${CONTRACT_FILE}

Read the contract file above, then follow the Phase 0-5 workflow exactly."
