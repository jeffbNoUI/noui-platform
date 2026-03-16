package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/noui/platform/crm/models"
)

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h := &Handler{} // no DB needed for health check
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	h.HealthCheck(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("HealthCheck status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("HealthCheck body parse error: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("HealthCheck status = %q, want %q", body["status"], "ok")
	}
	if body["service"] != "crm" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "crm")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- Helper Functions ---

func TestTenantID_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(no context) = %q, want %q", got, defaultTenantID)
	}
}

func TestTenantID_FallbackWithoutMiddleware(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := tenantID(req)
	if got != defaultTenantID {
		t.Errorf("tenantID(empty context) = %q, want %q", got, defaultTenantID)
	}
}

func TestIntParam_Default(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(empty) = %d, want 25", got)
	}
}

func TestIntParam_Valid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=50", nil)
	got := intParam(req, "limit", 25)
	if got != 50 {
		t.Errorf("intParam(50) = %d, want 50", got)
	}
}

func TestIntParam_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/?limit=abc", nil)
	got := intParam(req, "limit", 25)
	if got != 25 {
		t.Errorf("intParam(abc) = %d, want 25 (default)", got)
	}
}

func TestIntParam_Missing(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	got := intParam(req, "offset", 0)
	if got != 0 {
		t.Errorf("intParam(missing) = %d, want 0", got)
	}
}

func TestPtrOrDefault_WithValue(t *testing.T) {
	val := "custom-value"
	got := ptrOrDefault(&val, "default")
	if got != "custom-value" {
		t.Errorf("ptrOrDefault(ptr) = %q, want %q", got, "custom-value")
	}
}

func TestPtrOrDefault_Nil(t *testing.T) {
	got := ptrOrDefault(nil, "default-value")
	if got != "default-value" {
		t.Errorf("ptrOrDefault(nil) = %q, want %q", got, "default-value")
	}
}

func TestParseOptionalTime_Valid(t *testing.T) {
	ts := "2026-03-09T10:30:00Z"
	got := parseOptionalTime(&ts)
	if got == nil {
		t.Fatal("parseOptionalTime(valid) returned nil")
	}
	if got.Year() != 2026 || got.Month() != 3 || got.Day() != 9 {
		t.Errorf("parseOptionalTime = %v, want 2026-03-09", got)
	}
}

func TestParseOptionalTime_Nil(t *testing.T) {
	got := parseOptionalTime(nil)
	if got != nil {
		t.Errorf("parseOptionalTime(nil) = %v, want nil", got)
	}
}

func TestParseOptionalTime_Invalid(t *testing.T) {
	bad := "not-a-date"
	got := parseOptionalTime(&bad)
	if got != nil {
		t.Errorf("parseOptionalTime(invalid) = %v, want nil", got)
	}
}

// --- Response Helpers ---

func TestWriteJSON(t *testing.T) {
	w := httptest.NewRecorder()
	writeJSON(w, http.StatusOK, map[string]string{"key": "value"})

	if w.Code != http.StatusOK {
		t.Errorf("writeJSON status = %d, want %d", w.Code, http.StatusOK)
	}
	if ct := w.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	var body map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writeJSON body parse error: %v", err)
	}
	if body["key"] != "value" {
		t.Errorf("body[key] = %q, want %q", body["key"], "value")
	}
}

func TestWriteSuccess(t *testing.T) {
	w := httptest.NewRecorder()
	writeSuccess(w, http.StatusOK, map[string]string{"hello": "world"})

	if w.Code != http.StatusOK {
		t.Errorf("writeSuccess status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writeSuccess body parse error: %v", err)
	}
	if body["data"] == nil {
		t.Error("writeSuccess response missing 'data' field")
	}
	meta, ok := body["meta"].(map[string]interface{})
	if !ok {
		t.Fatal("writeSuccess response missing 'meta' field")
	}
	if meta["service"] != "crm" {
		t.Errorf("meta.service = %q, want %q", meta["service"], "crm")
	}
	if meta["requestId"] == nil || meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
	if meta["version"] != "v1" {
		t.Errorf("meta.version = %q, want %q", meta["version"], "v1")
	}
}

func TestWriteSuccess_Created(t *testing.T) {
	w := httptest.NewRecorder()
	writeSuccess(w, http.StatusCreated, map[string]string{"id": "abc-123"})

	if w.Code != http.StatusCreated {
		t.Errorf("writeSuccess(Created) status = %d, want %d", w.Code, http.StatusCreated)
	}
}

func TestWriteError(t *testing.T) {
	w := httptest.NewRecorder()
	writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "bad input")

	if w.Code != http.StatusBadRequest {
		t.Errorf("writeError status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writeError body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("writeError response missing 'error' field")
	}
	if errObj["code"] != "INVALID_REQUEST" {
		t.Errorf("error.code = %q, want INVALID_REQUEST", errObj["code"])
	}
	if errObj["message"] != "bad input" {
		t.Errorf("error.message = %q, want %q", errObj["message"], "bad input")
	}
	if errObj["requestId"] == nil || errObj["requestId"] == "" {
		t.Error("error.requestId should not be empty")
	}
}

func TestWritePaginated(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a", "b"}, 10, 2, 0)

	if w.Code != http.StatusOK {
		t.Errorf("writePaginated status = %d, want %d", w.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("writePaginated body parse error: %v", err)
	}
	pag, ok := body["pagination"].(map[string]interface{})
	if !ok {
		t.Fatal("writePaginated missing 'pagination' field")
	}
	if pag["total"] != float64(10) {
		t.Errorf("pagination.total = %v, want 10", pag["total"])
	}
	if pag["hasMore"] != true {
		t.Errorf("pagination.hasMore = %v, want true (offset 0 + limit 2 < total 10)", pag["hasMore"])
	}
}

func TestWritePaginated_NoMore(t *testing.T) {
	w := httptest.NewRecorder()
	writePaginated(w, []string{"a"}, 1, 25, 0)

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	pag := body["pagination"].(map[string]interface{})
	if pag["hasMore"] != false {
		t.Errorf("pagination.hasMore = %v, want false (offset 0 + limit 25 >= total 1)", pag["hasMore"])
	}
}

// --- DecodeJSON ---

func TestDecodeJSON_Valid(t *testing.T) {
	body := `{"contactType":"member","firstName":"Robert","lastName":"Martinez"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var cr models.CreateContactRequest
	if err := decodeJSON(req, &cr); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if cr.ContactType != "member" {
		t.Errorf("ContactType = %q, want member", cr.ContactType)
	}
	if cr.FirstName != "Robert" {
		t.Errorf("FirstName = %q, want Robert", cr.FirstName)
	}
}

func TestDecodeJSON_NilBody(t *testing.T) {
	req := httptest.NewRequest("POST", "/", nil)
	req.Body = nil
	var cr models.CreateContactRequest
	if err := decodeJSON(req, &cr); err == nil {
		t.Error("decodeJSON(nil body) should return error")
	}
}

func TestDecodeJSON_InvalidJSON(t *testing.T) {
	req := httptest.NewRequest("POST", "/", strings.NewReader("{not valid json"))
	var cr models.CreateContactRequest
	if err := decodeJSON(req, &cr); err == nil {
		t.Error("decodeJSON(invalid json) should return error")
	}
}

func TestDecodeJSON_ConversationRequest(t *testing.T) {
	body := `{"anchorType":"contact","subject":"Retirement inquiry"}`
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	var cr models.CreateConversationRequest
	if err := decodeJSON(req, &cr); err != nil {
		t.Fatalf("decodeJSON error: %v", err)
	}
	if cr.AnchorType != "contact" {
		t.Errorf("AnchorType = %q, want contact", cr.AnchorType)
	}
	if cr.Subject == nil || *cr.Subject != "Retirement inquiry" {
		t.Errorf("Subject = %v, want 'Retirement inquiry'", cr.Subject)
	}
}

// --- Apply Update Functions ---

func TestApplyContactUpdates_PartialUpdate(t *testing.T) {
	c := &models.Contact{
		ContactID:        "c-1",
		FirstName:        "Robert",
		LastName:         "Martinez",
		PreferredChannel: "SECURE_MESSAGE",
	}

	newLast := "Martinez-Smith"
	newChannel := "EMAIL"
	req := &models.UpdateContactRequest{
		LastName:         &newLast,
		PreferredChannel: &newChannel,
	}

	applyContactUpdates(c, req)

	// Updated fields
	if c.LastName != "Martinez-Smith" {
		t.Errorf("LastName = %q, want Martinez-Smith", c.LastName)
	}
	if c.PreferredChannel != "EMAIL" {
		t.Errorf("PreferredChannel = %q, want EMAIL", c.PreferredChannel)
	}
	// Unchanged fields
	if c.FirstName != "Robert" {
		t.Errorf("FirstName = %q, want Robert (unchanged)", c.FirstName)
	}
}

func TestApplyContactUpdates_IdentityVerified(t *testing.T) {
	c := &models.Contact{
		ContactID:        "c-1",
		IdentityVerified: false,
	}

	verified := true
	req := &models.UpdateContactRequest{
		IdentityVerified: &verified,
	}

	applyContactUpdates(c, req)

	if !c.IdentityVerified {
		t.Error("IdentityVerified should be true after update")
	}
	if c.IdentityVerifiedAt == nil {
		t.Error("IdentityVerifiedAt should be set when verified")
	}
	if c.IdentityVerifiedBy == nil {
		t.Error("IdentityVerifiedBy should be set when verified")
	}
}

func TestApplyContactUpdates_SecurityFlag(t *testing.T) {
	c := &models.Contact{ContactID: "c-1"}

	flag := "CAUTION"
	note := "Caller may be agitated"
	req := &models.UpdateContactRequest{
		SecurityFlag:     &flag,
		SecurityFlagNote: &note,
	}

	applyContactUpdates(c, req)

	if c.SecurityFlag == nil || *c.SecurityFlag != "CAUTION" {
		t.Errorf("SecurityFlag = %v, want CAUTION", c.SecurityFlag)
	}
	if c.SecurityFlagNote == nil || *c.SecurityFlagNote != "Caller may be agitated" {
		t.Errorf("SecurityFlagNote = %v, want note text", c.SecurityFlagNote)
	}
}

func TestApplyConversationUpdates_Resolve(t *testing.T) {
	c := &models.Conversation{
		ConversationID: "conv-1",
		Status:         models.ConvStatusOpen,
	}

	resolved := "resolved"
	summary := "Issue resolved via callback"
	req := &models.UpdateConversationRequest{
		Status:            &resolved,
		ResolutionSummary: &summary,
	}

	applyConversationUpdates(c, req)

	if c.Status != models.ConvStatusResolved {
		t.Errorf("Status = %q, want resolved", c.Status)
	}
	if c.ResolvedAt == nil {
		t.Error("ResolvedAt should be set when status is resolved")
	}
	if c.ResolvedBy == nil {
		t.Error("ResolvedBy should be set when status is resolved")
	}
	if c.ResolutionSummary == nil || *c.ResolutionSummary != "Issue resolved via callback" {
		t.Errorf("ResolutionSummary = %v, want 'Issue resolved via callback'", c.ResolutionSummary)
	}
}

func TestApplyConversationUpdates_Close(t *testing.T) {
	c := &models.Conversation{
		ConversationID: "conv-1",
		Status:         models.ConvStatusResolved,
	}

	closed := "closed"
	req := &models.UpdateConversationRequest{Status: &closed}

	applyConversationUpdates(c, req)

	if c.Status != models.ConversationStatus("closed") {
		t.Errorf("Status = %q, want closed", c.Status)
	}
	// Both "resolved" and "closed" set ResolvedAt
	if c.ResolvedAt == nil {
		t.Error("ResolvedAt should be set when status is closed")
	}
}

func TestApplyConversationUpdates_Reassign(t *testing.T) {
	c := &models.Conversation{ConversationID: "conv-1", Status: models.ConvStatusOpen}

	team := "Benefits Team"
	agent := "agent-42"
	req := &models.UpdateConversationRequest{
		AssignedTeam:  &team,
		AssignedAgent: &agent,
	}

	applyConversationUpdates(c, req)

	if c.AssignedTeam == nil || *c.AssignedTeam != "Benefits Team" {
		t.Errorf("AssignedTeam = %v, want Benefits Team", c.AssignedTeam)
	}
	if c.AssignedAgent == nil || *c.AssignedAgent != "agent-42" {
		t.Errorf("AssignedAgent = %v, want agent-42", c.AssignedAgent)
	}
	// Status should remain unchanged
	if c.Status != models.ConvStatusOpen {
		t.Errorf("Status = %q, want open (unchanged)", c.Status)
	}
}

func TestApplyCommitmentUpdates_Fulfill(t *testing.T) {
	c := &models.Commitment{
		CommitmentID: "com-1",
		Status:       models.CommitPending,
	}

	fulfilled := "fulfilled"
	note := "Sent benefits estimate on 2026-03-09"
	req := &models.UpdateCommitmentRequest{
		Status:          &fulfilled,
		FulfillmentNote: &note,
	}

	applyCommitmentUpdates(c, req)

	if c.Status != models.CommitFulfilled {
		t.Errorf("Status = %q, want fulfilled", c.Status)
	}
	if c.FulfilledAt == nil {
		t.Error("FulfilledAt should be set when fulfilled")
	}
	if c.FulfilledBy == nil {
		t.Error("FulfilledBy should be set when fulfilled")
	}
	if c.FulfillmentNote == nil || *c.FulfillmentNote != "Sent benefits estimate on 2026-03-09" {
		t.Errorf("FulfillmentNote = %v, want note text", c.FulfillmentNote)
	}
}

func TestApplyCommitmentUpdates_InProgress(t *testing.T) {
	c := &models.Commitment{
		CommitmentID: "com-1",
		Status:       models.CommitPending,
	}

	inProgress := "in_progress"
	req := &models.UpdateCommitmentRequest{Status: &inProgress}

	applyCommitmentUpdates(c, req)

	if c.Status != models.CommitInProgress {
		t.Errorf("Status = %q, want in_progress", c.Status)
	}
	// FulfilledAt should NOT be set for non-fulfilled status
	if c.FulfilledAt != nil {
		t.Error("FulfilledAt should be nil for in_progress status")
	}
}

func TestApplyOutreachUpdates_Attempted(t *testing.T) {
	o := &models.Outreach{
		OutreachID:   "out-1",
		Status:       models.OutreachPending,
		AttemptCount: 0,
	}

	attempted := "attempted"
	req := &models.UpdateOutreachRequest{Status: &attempted}

	applyOutreachUpdates(o, req)

	if o.Status != models.OutreachAttempted {
		t.Errorf("Status = %q, want attempted", o.Status)
	}
	if o.AttemptCount != 1 {
		t.Errorf("AttemptCount = %d, want 1 (incremented)", o.AttemptCount)
	}
	if o.LastAttemptAt == nil {
		t.Error("LastAttemptAt should be set on attempt")
	}
}

func TestApplyOutreachUpdates_MultipleAttempts(t *testing.T) {
	o := &models.Outreach{
		OutreachID:   "out-1",
		Status:       models.OutreachAttempted,
		AttemptCount: 2,
	}

	attempted := "attempted"
	req := &models.UpdateOutreachRequest{Status: &attempted}

	applyOutreachUpdates(o, req)

	if o.AttemptCount != 3 {
		t.Errorf("AttemptCount = %d, want 3 (incremented from 2)", o.AttemptCount)
	}
}

func TestApplyOutreachUpdates_Completed(t *testing.T) {
	o := &models.Outreach{
		OutreachID:   "out-1",
		Status:       models.OutreachAttempted,
		AttemptCount: 2,
	}

	completed := "completed"
	outcome := "voicemail_left"
	req := &models.UpdateOutreachRequest{
		Status:        &completed,
		ResultOutcome: &outcome,
	}

	applyOutreachUpdates(o, req)

	if o.Status != models.OutreachCompleted {
		t.Errorf("Status = %q, want completed", o.Status)
	}
	if o.CompletedAt == nil {
		t.Error("CompletedAt should be set on completion")
	}
	if o.ResultOutcome == nil || *o.ResultOutcome != "voicemail_left" {
		t.Errorf("ResultOutcome = %v, want voicemail_left", o.ResultOutcome)
	}
	// AttemptCount should NOT increment for "completed" (only for "attempted")
	if o.AttemptCount != 2 {
		t.Errorf("AttemptCount = %d, want 2 (unchanged for completed)", o.AttemptCount)
	}
}

func TestApplyOutreachUpdates_Reschedule(t *testing.T) {
	o := &models.Outreach{
		OutreachID: "out-1",
		Status:     models.OutreachPending,
	}

	newTime := "2026-03-15T14:00:00Z"
	newAgent := "agent-99"
	req := &models.UpdateOutreachRequest{
		ScheduledFor:  &newTime,
		AssignedAgent: &newAgent,
	}

	applyOutreachUpdates(o, req)

	if o.ScheduledFor == nil {
		t.Error("ScheduledFor should be set after reschedule")
	}
	if o.AssignedAgent == nil || *o.AssignedAgent != "agent-99" {
		t.Errorf("AssignedAgent = %v, want agent-99", o.AssignedAgent)
	}
}

// --- Model Serialization ---

func TestContactJSON_RoundTrip(t *testing.T) {
	now := time.Now().UTC()
	c := models.Contact{
		ContactID:         "c-123",
		TenantID:          defaultTenantID,
		ContactType:       models.ContactTypeMember,
		FirstName:         "Robert",
		LastName:          "Martinez",
		PreferredLanguage: "en",
		PreferredChannel:  "SECURE_MESSAGE",
		CreatedAt:         now,
		UpdatedAt:         now,
		CreatedBy:         "system",
		UpdatedBy:         "system",
	}

	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("Marshal Contact: %v", err)
	}

	var decoded models.Contact
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Contact: %v", err)
	}

	if decoded.ContactType != models.ContactTypeMember {
		t.Errorf("ContactType = %q, want member", decoded.ContactType)
	}
	if decoded.FirstName != "Robert" {
		t.Errorf("FirstName = %q, want Robert", decoded.FirstName)
	}
}

func TestInteractionJSON_RoundTrip(t *testing.T) {
	now := time.Now().UTC()
	i := models.Interaction{
		InteractionID:   "int-456",
		TenantID:        defaultTenantID,
		Channel:         models.ChannelPhoneInbound,
		InteractionType: models.TypeInquiry,
		Direction:       models.DirectionInbound,
		Visibility:      models.VisibilityInternal,
		StartedAt:       now,
		CreatedAt:       now,
		CreatedBy:       "system",
	}

	data, err := json.Marshal(i)
	if err != nil {
		t.Fatalf("Marshal Interaction: %v", err)
	}

	var decoded models.Interaction
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Interaction: %v", err)
	}

	if decoded.Channel != models.ChannelPhoneInbound {
		t.Errorf("Channel = %q, want phone_inbound", decoded.Channel)
	}
	if decoded.Direction != models.DirectionInbound {
		t.Errorf("Direction = %q, want inbound", decoded.Direction)
	}
}

func TestCommitmentJSON_RoundTrip(t *testing.T) {
	now := time.Now().UTC()
	c := models.Commitment{
		CommitmentID:    "com-789",
		TenantID:        defaultTenantID,
		InteractionID:   "int-123",
		Description:     "Send retirement estimate",
		TargetDate:      "2026-03-15",
		OwnerAgent:      "agent-1",
		Status:          models.CommitPending,
		AlertDaysBefore: 2,
		CreatedAt:       now,
		CreatedBy:       "system",
		UpdatedAt:       now,
		UpdatedBy:       "system",
	}

	data, err := json.Marshal(c)
	if err != nil {
		t.Fatalf("Marshal Commitment: %v", err)
	}

	var decoded models.Commitment
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Commitment: %v", err)
	}

	if decoded.Status != models.CommitPending {
		t.Errorf("Status = %q, want pending", decoded.Status)
	}
	if decoded.AlertDaysBefore != 2 {
		t.Errorf("AlertDaysBefore = %d, want 2", decoded.AlertDaysBefore)
	}
}

func TestOutreachJSON_RoundTrip(t *testing.T) {
	now := time.Now().UTC()
	o := models.Outreach{
		OutreachID:   "out-101",
		TenantID:     defaultTenantID,
		TriggerType:  "NEW_MEMBER",
		OutreachType: "WELCOME_CALL",
		Priority:     "NORMAL",
		Status:       models.OutreachPending,
		MaxAttempts:  3,
		CreatedAt:    now,
		CreatedBy:    "system",
		UpdatedAt:    now,
		UpdatedBy:    "system",
	}

	data, err := json.Marshal(o)
	if err != nil {
		t.Fatalf("Marshal Outreach: %v", err)
	}

	var decoded models.Outreach
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Outreach: %v", err)
	}

	if decoded.Status != models.OutreachPending {
		t.Errorf("Status = %q, want pending", decoded.Status)
	}
	if decoded.MaxAttempts != 3 {
		t.Errorf("MaxAttempts = %d, want 3", decoded.MaxAttempts)
	}
}
