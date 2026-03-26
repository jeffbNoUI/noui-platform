# Execute Contract

Execute a sprint contract using the quality-gated TDD workflow.

## Usage

`/execute-contract <contract-file>`

Example: `/execute-contract docs/contracts/sprint-M01.json`

## Workflow

Read and follow the full workflow in `docs/contracts/SESSION_DISPATCH.md`.

The workflow has 6 phases:
- **Phase 0: Sync** — fetch, clean tree, read CLAUDE.md + migration design doc
- **Phase 1: Design** — read contract, write design, dual-agent review
- **Phase 2: Red** — write tests from ACs, verify all FAIL, commit checkpoint
- **Phase 3: Green** — implement one AC at a time, /validate after each
- **Phase 4: Refactor** — /simplify + /validate + /precommit
- **Phase 5: Ship** — squash, push, create PR, /session-end

Read `docs/contracts/SESSION_DISPATCH.md` NOW for the detailed step-by-step instructions.
