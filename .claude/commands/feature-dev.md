# Feature Development — Interview Then Implement

Use this for any feature larger than a simple bug fix. This follows the interview-then-implement pattern.

## Phase 1: Interview (DO NOT write code yet)

Ask the user up to 3 focused questions to understand:
1. **What** exactly they want (acceptance criteria, not implementation details)
2. **Which layers** are affected (connector, platform service, frontend, domain rules)
3. **How to verify** — what does "done" look like? Is there a test fixture, a visual behavior, or an API response shape?

Wait for answers before proceeding.

## Phase 2: Plan

Based on the answers, produce a concrete plan:

**Files to create/modify:**
- List each file with a one-line description of the change

**Tests to add:**
- What tests will verify this feature works
- What existing tests might be affected

**Verification steps:**
- How will we confirm this works end-to-end

**Risks:**
- Anything that could go wrong or that we're uncertain about

Present this plan and wait for approval. If the user says "go", proceed. If they have corrections, revise the plan first.

## Phase 3: Implement

With an approved plan:
1. Write tests first for any calculation or business logic
2. Implement the feature following the plan
3. Run tests after each logical unit of work
4. Run the full verification suite when complete

## Phase 4: Confirm

Show the user:
- Test results
- `git diff --stat` showing scope of changes
- Any decisions you made during implementation that weren't in the plan

Ask: "Ready to commit, or do you want to review/adjust anything?"
