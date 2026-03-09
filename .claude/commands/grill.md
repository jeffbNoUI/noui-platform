# Grill — Adversarial Code Review

Review the recent changes with a critical eye. Look for real issues, not style nits.

## What to examine

```bash
# See what changed
git diff --stat HEAD~1
git diff HEAD~1
```

## Review checklist — check each item and report findings

### Correctness
- Do the changes match the stated intent?
- Are there off-by-one errors, edge cases, or boundary conditions not handled?
- For any calculation code: does it carry full precision through intermediates and round only at the end?
- For service credit usage: is it explicitly using earned-only or total as appropriate?

### Layer boundaries
- Does connector/ import from platform/ or domains/? (violation)
- Does platform/ import from connector/? (violation)
- Does frontend/ bypass the API and access Go types directly? (violation)

### Monetary handling
- Are monetary values strings in JSON (`"10639.45"`) not floats?
- Is arithmetic done with `big.Rat` or scaled integers, never `float64`?
- Are percentages string decimals (`"0.03"` = 3%)?

### Test coverage
- Do new functions have corresponding tests?
- Do tests check edge cases, not just the happy path?
- Are test fixture expected values untouched?

### Architecture
- Is there any AI/LLM call in a calculation path? (violation)
- Are all database accesses going through dataaccess, not direct SQL from other services?
- Are new dependencies justified and minimal?

### Terminology
- Any use of banned terms? ("self-healing", "auto-resolved", "AI calculated")

## Report format

For each finding, report:
- **File and line**
- **Severity** (critical / warning / note)
- **What's wrong and why**
- **Suggested fix**

If no issues found, say so. Don't invent problems.
