# Plan

Before implementing anything, create a structured plan for the task described by the user.

## Plan Format

**Goal:** One sentence describing what we're building/fixing.

**Files to modify:**
- `path/to/file.go` — what changes and why
- (list all files)

**Files to create:**
- `path/to/new_file.go` — purpose
- (list all new files)

**Tests to add/update:**
- `path/to/file_test.go` — what it validates

**Layer(s) affected:** connector / platform/{service} / frontend / domains

**Verification steps:**
1. How we'll confirm this works
2. Which test suite(s) to run
3. Any manual verification needed

**Risks or open questions:**
- Anything that could go wrong
- Anything we need the user to clarify

**Estimated scope:** S (1-3 files) / M (4-8 files) / L (9+ files)

---

Present this plan and wait for the user's approval before writing any code.
If the user says "go" or "approved" or similar, proceed with implementation.
If they have corrections, revise the plan first.
