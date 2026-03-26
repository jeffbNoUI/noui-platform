# Simplify

Iterative code simplification — up to 3 cycles until clean.

## Cycle Loop (max 3 iterations)

For each cycle:

### Step 1: Find changed files

```bash
git diff --name-only HEAD~1
```

### Step 2: Review

For each changed source file, launch a code-simplifier agent to review for:
- Unnecessary complexity
- Dead code
- Naming clarity
- DRY violations
- YAGNI violations

Report findings with specific file:line references and suggested fixes.

### Step 3: Fix (if needed)

If findings are warranted:
1. Apply fixes
2. Run `cd frontend && npm test -- --run` to verify nothing breaks
3. If tests pass, continue to Step 4
4. If tests fail, revert fixes and report the failure

### Step 4: Re-check or exit

- If this cycle found zero issues → EXIT. Report "Clean after N cycle(s)."
- If this is cycle 3 → EXIT. Report remaining findings as advisory.
- Otherwise → start next cycle from Step 2.

## Rules

- Only simplify code — do not add features, refactor architecture, or change behavior
- Each cycle must produce fewer findings than the previous, or exit early
- Never simplify code you haven't read
