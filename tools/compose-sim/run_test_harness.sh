#!/bin/bash
# Run Test Harness — compose-sim evaluation
# Usage: ./run_test_harness.sh [count] [concurrency]

COUNT=${1:-100}
CONCURRENCY=${2:-3}

cd "$(dirname "$0")"

# Source .env if it exists (ANTHROPIC_API_KEY)
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "Error: ANTHROPIC_API_KEY not set."
    echo "Either export it or create compose-sim/.env with: ANTHROPIC_API_KEY=sk-ant-..."
    exit 1
fi

echo "=== Compose-Sim Test Harness ==="
echo "Count: $COUNT | Concurrency: $CONCURRENCY"
echo ""

python3 -m compose_sim.cli run \
    --count "$COUNT" \
    --sample-strategy stratified \
    --no-cache \
    --concurrency "$CONCURRENCY"
