# compose-sim — AI Composition Simulation Framework

Evaluate and refine LLM-driven UI composition decisions against ground truth scenarios.

## Quick Start

```bash
# Install
cd compose-sim
pip install -e .

# Set API key
export ANTHROPIC_API_KEY=sk-ant-...

# Smoke test (10 scenarios)
compose-sim run --count 10

# View report
compose-sim report

# Development iteration (100 scenarios, stratified)
compose-sim run --count 100 --sample-strategy stratified

# Compare runs
compose-sim report --results results/latest.json --compare results/previous.json

# Auto-refine prompt from failures
compose-sim learn --results results/latest.json --auto-apply

# Full validation with Haiku
compose-sim run --count 10000 --model claude-haiku-4-5-20241022

# Cost estimate only
compose-sim run --count 10000 --cost-estimate
```

## Commands

| Command | Purpose |
|---------|---------|
| `compose-sim run` | Send scenarios to Claude API and evaluate results |
| `compose-sim report` | Generate accuracy reports from run results |
| `compose-sim learn` | Analyze failures and refine the prompt |

## Sampling Strategies

| Strategy | Description |
|----------|-------------|
| `stratified` | Proportional sampling across strata (default) |
| `random` | Uniform random sampling |
| `boundary-heavy` | 2x weight for boundary condition scenarios |
| `failures-only` | Re-run only previously failed scenarios |

## Quality Gates

| Phase | Panels | Alerts | View Mode |
|-------|--------|--------|-----------|
| Initial | >80% | >70% | >95% |
| Stabilization | >90% | >85% | >98% |
| Pre-production | >95% | >90% | >99% |

## Cost Estimates

| Model | 10 | 100 | 1,000 | 10,000 |
|-------|-----|------|-------|--------|
| Sonnet (cached) | ~$0.12 | ~$1.20 | ~$12 | ~$115 |
| Haiku (cached) | ~$0.03 | ~$0.30 | ~$3 | ~$30 |

## Refinement Workflow

```
Round 0: Base prompt, 0 few-shots → run 100 → analyze
Round 1: + few-shots from failures → run 100 → analyze
Round 2: Refine wording → run 1K → validate
Round N: Converge to thresholds → run 10K → certify
```
