# domains/pension/ — Claude Code Instructions

## What This Is

Pension domain data. Contains database schemas, seed data, business rules, and acceptance test fixtures for the pension line of business.

## Contents

- `schema/` — PostgreSQL DDL scripts (5 schemas: legacy, CRM, KB, DQ, correspondence)
- `seed/` — SQL seed data + Python generators
- `rules/definitions/` — 9 YAML files encoding plan provisions
- `demo-cases/` — 4 mandatory acceptance test cases with expected results

## Rules Source

All rules are derived from governing plan documents — NOT from legacy database inference. Rules follow full SDLC (review, test, approve).

## AI Boundary

AI does NOT execute benefit calculations or make fiduciary determinations. All calculation results must be verified against demo-case test fixtures to the penny.

## Demo Cases

| Case | Member | Tests |
|------|--------|-------|
| case1 | Robert Martinez (Tier 1) | Leave payout + AMS interaction |
| case2 | Jennifer Kim (Tier 2) | Purchased service credit validation |
| case3 | David Washington (Tier 3) | Rule of 85 boundary + early retirement |
| case4 | Robert Martinez (DRO) | Domestic Relations Order settlement |
