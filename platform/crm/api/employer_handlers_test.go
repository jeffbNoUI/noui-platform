package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// --- ListOrgInteractions ---

func TestListOrgInteractions_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/crm/organizations//interactions", nil)
	w := httptest.NewRecorder()

	h.ListOrgInteractions(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListOrgInteractions(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCRMErrorCode(t, w, "INVALID_ORG_ID")
}

func TestListOrgInteractions_InvalidUUID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/crm/organizations/not-a-uuid/interactions", nil)
	// PathValue won't work in httptest, so we rely on the path-parsing fallback
	w := httptest.NewRecorder()

	h.ListOrgInteractions(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListOrgInteractions(bad uuid) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- CreateEmployerInteraction ---

func TestCreateEmployerInteraction_MissingOrgID(t *testing.T) {
	h := &Handler{}
	body := `{"channel":"PHONE_INBOUND","interactionType":"INQUIRY","direction":"INBOUND"}`
	req := httptest.NewRequest("POST", "/api/v1/crm/interactions/employer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateEmployerInteraction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerInteraction(no org) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCRMErrorCode(t, w, "INVALID_REQUEST")
}

func TestCreateEmployerInteraction_InvalidCategory(t *testing.T) {
	h := &Handler{}
	body := `{
		"orgId":"550e8400-e29b-41d4-a716-446655440000",
		"channel":"PHONE_INBOUND",
		"interactionType":"INQUIRY",
		"direction":"INBOUND",
		"category":"INVALID_CATEGORY"
	}`
	req := httptest.NewRequest("POST", "/api/v1/crm/interactions/employer", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.CreateEmployerInteraction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerInteraction(bad cat) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCRMErrorCode(t, w, "INVALID_REQUEST")
}

func TestCreateEmployerInteraction_EmptyBody(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("POST", "/api/v1/crm/interactions/employer", nil)
	w := httptest.NewRecorder()

	h.CreateEmployerInteraction(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("CreateEmployerInteraction(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListOrgContacts ---

func TestListOrgContacts_MissingOrgID(t *testing.T) {
	h := &Handler{}
	req := httptest.NewRequest("GET", "/api/v1/crm/organizations//contacts", nil)
	w := httptest.NewRecorder()

	h.ListOrgContacts(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("ListOrgContacts(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	assertCRMErrorCode(t, w, "INVALID_ORG_ID")
}

// --- Employer category constants ---

func TestEmployerCategoryConstants(t *testing.T) {
	expected := map[string]string{
		"EmpCatContribution": "CONTRIBUTION_QUESTION",
		"EmpCatEnrollment":   "ENROLLMENT_ISSUE",
		"EmpCatTermination":  "TERMINATION_INQUIRY",
		"EmpCatWaret":        "WARET_INQUIRY",
		"EmpCatSCP":          "SCP_INQUIRY",
		"EmpCatGeneral":      "GENERAL_EMPLOYER",
	}
	actuals := map[string]string{
		"EmpCatContribution": EmpCatContribution,
		"EmpCatEnrollment":   EmpCatEnrollment,
		"EmpCatTermination":  EmpCatTermination,
		"EmpCatWaret":        EmpCatWaret,
		"EmpCatSCP":          EmpCatSCP,
		"EmpCatGeneral":      EmpCatGeneral,
	}
	for name, want := range expected {
		if actuals[name] != want {
			t.Errorf("%s = %q, want %q", name, actuals[name], want)
		}
	}
}

// --- helpers ---

func assertCRMErrorCode(t *testing.T, w *httptest.ResponseRecorder, expectedCode string) {
	t.Helper()
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("response body parse error: %v", err)
	}
	errObj, ok := body["error"].(map[string]interface{})
	if !ok {
		t.Fatal("response missing 'error' field")
	}
	if errObj["code"] != expectedCode {
		t.Errorf("error.code = %q, want %q", errObj["code"], expectedCode)
	}
}
