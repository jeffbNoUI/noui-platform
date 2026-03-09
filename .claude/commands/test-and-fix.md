# Test and Fix

Run the full test suite for the specified layer and iteratively fix any failures.

## Process

1. Ask the user which layer to test if not obvious from recent changes. Default to all modified layers.

2. Run tests:
```bash
# Check what changed recently
git diff --name-only HEAD~3

# Run tests for affected layers
```

3. For each failure:
   - Read the test to understand what it's checking
   - Read the source code being tested
   - Identify the root cause (do NOT modify the test unless the test itself has a bug)
   - Fix the implementation
   - Re-run the specific failing test to confirm the fix
   - Re-run the full suite to confirm no regressions

4. **CRITICAL RULE:** For tests in `domains/pension/demo-cases/` (test fixtures):
   - These are hand-calculated expected values and are the **oracle**
   - NEVER modify fixture expected values to match code output
   - If code disagrees with fixtures, the code is wrong
   - If you believe a fixture has an error, STOP and inform the user

5. Show final test results:
```bash
# Re-run everything to confirm clean state
```

6. If all tests pass, ask the user if they want to commit.
