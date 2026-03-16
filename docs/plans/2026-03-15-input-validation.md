# F-010 Input Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a shared validation package and wire it into all 7 platform services to enforce string length limits, enum validation, UUID format, date format, and pagination bounds.

**Architecture:** New `platform/validation/` Go module with function-based validators and an error collector. Each validator appends to a `Errors` slice. Handlers call validators after JSON decode, then check `errs.HasErrors()` before proceeding. No struct-tag reflection — explicit calls are clearer and easier to audit.

**Tech Stack:** Go 1.22, stdlib only (no external validation libraries)

---

## Context

**F-010 from SECURITY_FINDINGS.md:** "Minimal input validation. No string length limits, no enum validation, no date range validation."

**Current state:** Each of the 7 platform services has ad-hoc inline validation (required field checks, `intParam()` helper) duplicated across handlers. No centralized validation package exists. Major gaps: enum values accepted without checking, no string length caps, UUIDs not format-checked, pagination unbounded in most services.

**Error response format (existing, must preserve):**
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "caseId is required",
    "requestId": "uuid"
  }
}
```

The validation package returns structured errors that handlers format into this existing pattern. We do NOT change the error response shape.

---

## Task 1: Create `platform/validation/` Package — Core Validators + Tests

**Files:**
- Create: `platform/validation/go.mod`
- Create: `platform/validation/validation.go`
- Create: `platform/validation/validation_test.go`

### Step 1: Create go.mod

```
platform/validation/go.mod
```
```go
module github.com/noui/platform/validation

go 1.22.0
```

### Step 2: Write the failing tests

Create `platform/validation/validation_test.go` with tests for all validators:

```go
package validation

import (
	"testing"
)

func TestRequired(t *testing.T) {
	var errs Errors

	errs.Required("name", "Alice")
	if errs.HasErrors() {
		t.Fatal("expected no error for non-empty value")
	}

	errs.Required("name", "")
	if !errs.HasErrors() {
		t.Fatal("expected error for empty value")
	}

	errs.Required("name", "   ")
	if len(errs) != 2 {
		t.Fatalf("expected 2 errors, got %d", len(errs))
	}
}

func TestMaxLen(t *testing.T) {
	var errs Errors

	errs.MaxLen("name", "Alice", 10)
	if errs.HasErrors() {
		t.Fatal("expected no error for short string")
	}

	errs.MaxLen("name", "A very long name that exceeds the limit", 10)
	if !errs.HasErrors() {
		t.Fatal("expected error for string exceeding max length")
	}
}

func TestEnum(t *testing.T) {
	var errs Errors
	allowed := []string{"standard", "high", "urgent"}

	errs.Enum("priority", "high", allowed)
	if errs.HasErrors() {
		t.Fatal("expected no error for valid enum value")
	}

	errs.Enum("priority", "critical", allowed)
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid enum value")
	}
}

func TestEnumOptional(t *testing.T) {
	var errs Errors
	allowed := []string{"standard", "high", "urgent"}

	// Empty string should be allowed (optional field)
	errs.EnumOptional("priority", "", allowed)
	if errs.HasErrors() {
		t.Fatal("expected no error for empty optional enum")
	}

	errs.EnumOptional("priority", "high", allowed)
	if errs.HasErrors() {
		t.Fatal("expected no error for valid optional enum")
	}

	errs.EnumOptional("priority", "critical", allowed)
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid optional enum value")
	}
}

func TestUUID(t *testing.T) {
	var errs Errors

	errs.UUID("id", "550e8400-e29b-41d4-a716-446655440000")
	if errs.HasErrors() {
		t.Fatal("expected no error for valid UUID")
	}

	errs = nil
	errs.UUID("id", "not-a-uuid")
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid UUID")
	}

	errs = nil
	errs.UUID("id", "")
	if !errs.HasErrors() {
		t.Fatal("expected error for empty UUID")
	}
}

func TestUUIDOptional(t *testing.T) {
	var errs Errors

	errs.UUIDOptional("id", "")
	if errs.HasErrors() {
		t.Fatal("expected no error for empty optional UUID")
	}

	errs.UUIDOptional("id", "550e8400-e29b-41d4-a716-446655440000")
	if errs.HasErrors() {
		t.Fatal("expected no error for valid optional UUID")
	}

	errs.UUIDOptional("id", "bad")
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid optional UUID")
	}
}

func TestDateYMD(t *testing.T) {
	var errs Errors

	errs.DateYMD("date", "2026-03-15")
	if errs.HasErrors() {
		t.Fatal("expected no error for valid date")
	}

	errs.DateYMD("date", "03/15/2026")
	if !errs.HasErrors() {
		t.Fatal("expected error for wrong format")
	}

	errs = nil
	errs.DateYMD("date", "2026-13-01")
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid month")
	}
}

func TestDateYMDOptional(t *testing.T) {
	var errs Errors

	errs.DateYMDOptional("date", "")
	if errs.HasErrors() {
		t.Fatal("expected no error for empty optional date")
	}

	errs.DateYMDOptional("date", "2026-03-15")
	if errs.HasErrors() {
		t.Fatal("expected no error for valid optional date")
	}

	errs.DateYMDOptional("date", "bad")
	if !errs.HasErrors() {
		t.Fatal("expected error for invalid optional date")
	}
}

func TestPositiveInt(t *testing.T) {
	var errs Errors

	errs.PositiveInt("memberId", 42)
	if errs.HasErrors() {
		t.Fatal("expected no error for positive int")
	}

	errs.PositiveInt("memberId", 0)
	if !errs.HasErrors() {
		t.Fatal("expected error for zero")
	}

	errs = Errors{}
	errs.PositiveInt("memberId", -1)
	if !errs.HasErrors() {
		t.Fatal("expected error for negative")
	}
}

func TestIntRange(t *testing.T) {
	var errs Errors

	errs.IntRange("score", 5, 1, 10)
	if errs.HasErrors() {
		t.Fatal("expected no error for in-range value")
	}

	errs.IntRange("score", 0, 1, 10)
	if !errs.HasErrors() {
		t.Fatal("expected error for below-range value")
	}

	errs = nil
	errs.IntRange("score", 11, 1, 10)
	if !errs.HasErrors() {
		t.Fatal("expected error for above-range value")
	}
}

func TestPagination(t *testing.T) {
	limit, offset := Pagination(25, 0, 100)
	if limit != 25 || offset != 0 {
		t.Fatalf("expected 25/0, got %d/%d", limit, offset)
	}

	// Negative offset clamps to 0
	limit, offset = Pagination(10, -5, 100)
	if offset != 0 {
		t.Fatalf("expected offset 0, got %d", offset)
	}

	// Over-limit clamps to max
	limit, offset = Pagination(200, 0, 100)
	if limit != 100 {
		t.Fatalf("expected limit 100, got %d", limit)
	}

	// Zero limit gets default (25)
	limit, offset = Pagination(0, 0, 100)
	if limit != 25 {
		t.Fatalf("expected default limit 25, got %d", limit)
	}

	// Negative limit gets default
	limit, offset = Pagination(-1, 0, 100)
	if limit != 25 {
		t.Fatalf("expected default limit 25, got %d", limit)
	}
}

func TestErrorMessage(t *testing.T) {
	var errs Errors
	errs.Required("name", "")
	errs.MaxLen("bio", "x]x]x]x]x]x", 5)

	msg := errs.Error()
	if msg == "" {
		t.Fatal("expected non-empty error message")
	}

	// Should contain both field names
	if !containsSubstring(msg, "name") {
		t.Fatal("expected error to mention 'name'")
	}
	if !containsSubstring(msg, "bio") {
		t.Fatal("expected error to mention 'bio'")
	}
}

func TestMultipleErrors(t *testing.T) {
	var errs Errors
	errs.Required("a", "")
	errs.Required("b", "")
	errs.Required("c", "ok")

	if len(errs) != 2 {
		t.Fatalf("expected 2 errors, got %d", len(errs))
	}

	fields := errs.Fields()
	if len(fields) != 2 {
		t.Fatalf("expected 2 field errors, got %d", len(fields))
	}
}

func containsSubstring(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && stringContains(s, sub))
}

func stringContains(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
```

### Step 3: Run tests — verify they fail

```bash
cd platform/validation && go test ./... -v
```

Expected: compilation failure — `Errors`, `Pagination` types not defined yet.

### Step 4: Implement the validation package

Create `platform/validation/validation.go`:

```go
// Package validation provides input validation helpers for platform services.
// Validators append errors to an Errors slice. Handlers check HasErrors()
// after running all validators, then return the collected messages.
package validation

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// uuidRE matches standard UUID format (8-4-4-4-12 hex digits).
var uuidRE = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// FieldError represents a single validation error on a named field.
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Errors collects validation errors. The zero value is ready to use.
type Errors []FieldError

// add appends a field error.
func (e *Errors) add(field, msg string) {
	*e = append(*e, FieldError{Field: field, Message: msg})
}

// HasErrors returns true if any validation errors were collected.
func (e Errors) HasErrors() bool {
	return len(e) > 0
}

// Error returns a single string with all field errors joined by "; ".
func (e Errors) Error() string {
	parts := make([]string, len(e))
	for i, fe := range e {
		parts[i] = fmt.Sprintf("%s: %s", fe.Field, fe.Message)
	}
	return strings.Join(parts, "; ")
}

// Fields returns the collected field errors for structured JSON responses.
func (e Errors) Fields() []FieldError {
	return e
}

// --- Validators ---

// Required checks that value is non-empty after trimming whitespace.
func (e *Errors) Required(field, value string) {
	if strings.TrimSpace(value) == "" {
		e.add(field, "is required")
	}
}

// MaxLen checks that value does not exceed max characters.
func (e *Errors) MaxLen(field, value string, max int) {
	if len(value) > max {
		e.add(field, fmt.Sprintf("must be at most %d characters", max))
	}
}

// MinLen checks that value has at least min characters (after trim).
func (e *Errors) MinLen(field, value string, min int) {
	if len(strings.TrimSpace(value)) < min {
		e.add(field, fmt.Sprintf("must be at least %d characters", min))
	}
}

// Enum checks that value is one of the allowed values.
func (e *Errors) Enum(field, value string, allowed []string) {
	for _, a := range allowed {
		if value == a {
			return
		}
	}
	e.add(field, fmt.Sprintf("must be one of: %s", strings.Join(allowed, ", ")))
}

// EnumOptional checks that value is one of the allowed values, or empty.
func (e *Errors) EnumOptional(field, value string, allowed []string) {
	if value == "" {
		return
	}
	e.Enum(field, value, allowed)
}

// UUID checks that value is a valid UUID format.
func (e *Errors) UUID(field, value string) {
	if !uuidRE.MatchString(value) {
		e.add(field, "must be a valid UUID")
	}
}

// UUIDOptional checks UUID format only if non-empty.
func (e *Errors) UUIDOptional(field, value string) {
	if value == "" {
		return
	}
	e.UUID(field, value)
}

// DateYMD checks that value is a valid YYYY-MM-DD date.
func (e *Errors) DateYMD(field, value string) {
	_, err := time.Parse("2006-01-02", value)
	if err != nil {
		e.add(field, "must be a valid date (YYYY-MM-DD)")
	}
}

// DateYMDOptional checks date format only if non-empty.
func (e *Errors) DateYMDOptional(field, value string) {
	if value == "" {
		return
	}
	e.DateYMD(field, value)
}

// PositiveInt checks that value is > 0.
func (e *Errors) PositiveInt(field string, value int) {
	if value <= 0 {
		e.add(field, "must be a positive integer")
	}
}

// IntRange checks that value is between min and max (inclusive).
func (e *Errors) IntRange(field string, value, min, max int) {
	if value < min || value > max {
		e.add(field, fmt.Sprintf("must be between %d and %d", min, max))
	}
}

// Pagination clamps limit and offset to safe bounds.
// Returns (clamped_limit, clamped_offset).
// Zero/negative limit defaults to 25. Limit is capped at maxLimit.
// Negative offset clamps to 0.
func Pagination(limit, offset, maxLimit int) (int, int) {
	if limit <= 0 {
		limit = 25
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	if offset < 0 {
		offset = 0
	}
	return limit, offset
}
```

### Step 5: Run tests — verify they pass

```bash
cd platform/validation && go test ./... -v
```

Expected: all tests PASS.

### Step 6: Commit

```bash
git add platform/validation/
git commit -m "[platform/validation] Add shared input validation package (F-010)"
```

---

## Task 2: Wire Validation into Case Management Service

**Files:**
- Modify: `platform/casemanagement/go.mod` — add validation dependency
- Modify: `platform/casemanagement/api/handlers.go` — replace inline validation with package calls

### Step 1: Add dependency to go.mod

Add to `require` block:
```
github.com/noui/platform/validation v0.0.0
```

Add to `replace` block:
```
github.com/noui/platform/validation => ../validation
```

### Step 2: Update handlers.go — import and validate

Add to imports:
```go
"github.com/noui/platform/validation"
```

**CreateCase handler** — replace the existing `req.CaseID == ""` check with:
```go
var errs validation.Errors
errs.Required("caseId", req.CaseID)
errs.PositiveInt("memberId", req.MemberID)
errs.MaxLen("caseId", req.CaseID, 100)
errs.MaxLen("caseType", req.CaseType, 50)
errs.MaxLen("assignedTo", req.AssignedTo, 200)
errs.EnumOptional("priority", req.Priority, []string{"standard", "high", "urgent"})
errs.DateYMDOptional("retirementDate", req.RetirementDate)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**AdvanceStage handler** — replace inline `TransitionedBy` check:
```go
var errs validation.Errors
errs.Required("transitionedBy", req.TransitionedBy)
errs.MaxLen("transitionedBy", req.TransitionedBy, 200)
errs.MaxLen("note", req.Note, 2000)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**CreateNote handler** — replace inline checks:
```go
var errs validation.Errors
errs.Required("author", req.Author)
errs.Required("content", req.Content)
errs.MaxLen("author", req.Author, 200)
errs.MaxLen("content", req.Content, 10000)
errs.MaxLen("category", req.Category, 50)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**CreateDocument handler** — replace inline checks:
```go
var errs validation.Errors
errs.Required("filename", req.Filename)
errs.Required("uploadedBy", req.UploadedBy)
errs.MaxLen("filename", req.Filename, 255)
errs.MaxLen("uploadedBy", req.UploadedBy, 200)
errs.MaxLen("documentType", req.DocumentType, 50)
errs.MaxLen("mimeType", req.MimeType, 100)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**ListCases** — add pagination clamping:
```go
limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)
```
Use `limit` and `offset` in the filter instead of raw `intParam` calls.

**UpdateCase handler** — add enum validation for optional pointer fields:
```go
var errs validation.Errors
if req.Priority != nil {
    errs.Enum("priority", *req.Priority, []string{"standard", "high", "urgent"})
}
if req.SLAStatus != nil {
    errs.Enum("slaStatus", *req.SLAStatus, []string{"on-track", "at-risk", "overdue"})
}
if req.Status != nil {
    errs.Enum("status", *req.Status, []string{"active", "completed", "withdrawn"})
}
if req.AssignedTo != nil {
    errs.MaxLen("assignedTo", *req.AssignedTo, 200)
}
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

### Step 3: Build and test

```bash
cd platform/casemanagement && go build ./... && go test ./... -v
```

Expected: build succeeds, all existing tests pass.

### Step 4: Commit

```bash
git add platform/casemanagement/go.mod platform/casemanagement/api/handlers.go
git commit -m "[platform/casemanagement] Wire shared validation into handlers (F-010)"
```

---

## Task 3: Wire Validation into CRM Service

**Files:**
- Modify: `platform/crm/go.mod` — add validation dependency
- Modify: `platform/crm/api/handlers.go` — add validation to all create/update handlers

### Step 1: Add dependency

Same pattern as Task 2 — add `github.com/noui/platform/validation` to require + replace.

### Step 2: Add validation to CRM handlers

The CRM service has the most endpoints. Key validations:

**CreateContact:**
```go
var errs validation.Errors
errs.Required("contactType", req.ContactType)
errs.Enum("contactType", req.ContactType, []string{"member", "beneficiary", "employer", "vendor", "other"})
errs.Required("firstName", req.FirstName)
errs.MaxLen("firstName", req.FirstName, 100)
errs.Required("lastName", req.LastName)
errs.MaxLen("lastName", req.LastName, 100)
if req.PrimaryEmail != nil {
    errs.MaxLen("primaryEmail", *req.PrimaryEmail, 254)
}
if req.PrimaryPhone != nil {
    errs.MaxLen("primaryPhone", *req.PrimaryPhone, 20)
}
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**CreateInteraction:**
```go
var errs validation.Errors
errs.Required("channel", req.Channel)
errs.Enum("channel", req.Channel, []string{"phone", "email", "in-person", "portal", "chat"})
errs.Required("interactionType", req.InteractionType)
errs.Required("direction", req.Direction)
errs.Enum("direction", req.Direction, []string{"inbound", "outbound"})
errs.MaxLen("subject", req.Subject, 200)
errs.MaxLen("summary", req.Summary, 5000)
errs.MaxLen("narrative", req.Narrative, 50000)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

**CreateCommitment:**
```go
var errs validation.Errors
errs.Required("description", req.Description)
errs.MaxLen("description", req.Description, 1000)
errs.MaxLen("ownerAgent", req.OwnerAgent, 200)
errs.DateYMDOptional("targetDate", req.TargetDate)
if errs.HasErrors() {
    writeError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
    return
}
```

Apply `validation.Pagination()` to all list endpoints.

### Step 3: Build and test

```bash
cd platform/crm && go build ./... && go test ./... -v
```

### Step 4: Commit

```bash
git add platform/crm/go.mod platform/crm/api/handlers.go
git commit -m "[platform/crm] Wire shared validation into handlers (F-010)"
```

---

## Task 4: Wire Validation into Remaining Services

**Files (4 services):**
- Modify: `platform/correspondence/go.mod` + `platform/correspondence/api/handlers.go`
- Modify: `platform/dataquality/go.mod` + `platform/dataquality/api/handlers.go`
- Modify: `platform/knowledgebase/go.mod` + `platform/knowledgebase/api/handlers.go`
- Modify: `platform/intelligence/go.mod` + `platform/intelligence/api/handlers.go`
- Modify: `platform/dataaccess/go.mod` + `platform/dataaccess/api/handlers.go`

### Correspondence validations:
- **GenerateRequest:** Required templateId, MaxLen mergeData values (1000 each)
- **UpdateCorrespondence:** Enum status ("draft", "final", "sent", "void")
- All list endpoints: `validation.Pagination()`

### DataQuality validations:
- **UpdateIssue:** Enum severity, Enum status, MaxLen fields
- IntRange for `days` query param (1-365)
- All list endpoints: `validation.Pagination()`

### KnowledgeBase validations:
- Search query `q`: MaxLen 200
- All list endpoints: `validation.Pagination()`

### Intelligence validations:
- Already has date validation — keep it, add MaxLen and PositiveInt where missing
- `member_id`: PositiveInt
- Retirement dates: DateYMD (already done inline — replace with shared validator)

### DataAccess validations:
- Search query `q`: Required + MaxLen 200
- `limit`: Already caps at 50 — replace with `validation.Pagination(_, _, 50)`
- `id` (memberId): PositiveInt

### Step 1: Add validation dependency to all 5 go.mod files

Same pattern: require + replace block additions.

### Step 2: Update each service's handlers

Apply validators as described above. Each handler that accepts input gets validation.

### Step 3: Build and test all 5 services

```bash
cd platform/correspondence && go build ./... && go test ./... -v
cd platform/dataquality && go build ./... && go test ./... -v
cd platform/knowledgebase && go build ./... && go test ./... -v
cd platform/intelligence && go build ./... && go test ./... -v
cd platform/dataaccess && go build ./... && go test ./... -v
```

### Step 4: Commit

```bash
git add platform/correspondence/ platform/dataquality/ platform/knowledgebase/ platform/intelligence/ platform/dataaccess/
git commit -m "[platform/*] Wire shared validation into remaining 5 services (F-010)"
```

---

## Task 5: Update Documentation

**Files:**
- Modify: `docs/SECURITY_FINDINGS.md` — mark F-010 as resolved
- Modify: `BUILD_HISTORY.md` — add Session 3 summary

### SECURITY_FINDINGS.md changes:
- Change F-010 header from "Session 3" to "RESOLVED"
- Add What/Why/Impact/Fix/Prevention pattern
- Fix description: shared `platform/validation/` package with string length, enum, UUID, date, pagination validators wired into all 7 services

### BUILD_HISTORY.md changes:
- Add Session 3 summary: new files, modified files, test results

### Commit:
```bash
git add docs/SECURITY_FINDINGS.md BUILD_HISTORY.md
git commit -m "[docs] Update security findings and build history for Session 3"
```

---

## Validation Limits Reference

These are the standard limits applied across all services:

| Field type | Max length | Notes |
|------------|-----------|-------|
| Person name (first, last) | 100 | |
| Email | 254 | RFC 5321 max |
| Phone | 20 | |
| Short identifier (type, category, code) | 50 | |
| Medium text (subject, description) | 200-1000 | Context-dependent |
| Long text (content, narrative, summary) | 5000-50000 | Context-dependent |
| Filename | 255 | Filesystem limit |
| MIME type | 100 | |
| Pagination limit | 100 max, 25 default | dataaccess keeps 50 max |
| Pagination offset | 0 minimum | |

## Enum Values Reference

| Field | Service | Allowed values |
|-------|---------|----------------|
| priority | casemanagement | standard, high, urgent |
| slaStatus | casemanagement | on-track, at-risk, overdue |
| status (case) | casemanagement | active, completed, withdrawn |
| contactType | crm | member, beneficiary, employer, vendor, other |
| channel | crm | phone, email, in-person, portal, chat |
| direction | crm | inbound, outbound |
| status (correspondence) | correspondence | draft, final, sent, void |
| severity | dataquality | critical, warning, info |
| status (issue) | dataquality | open, resolved, false_positive |
