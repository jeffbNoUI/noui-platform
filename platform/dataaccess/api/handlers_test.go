package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/dataaccess/models"
)

// --- HealthCheck ---

func TestHealthCheck(t *testing.T) {
	h := &Handler{} // no DB needed
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
	if body["service"] != "dataaccess" {
		t.Errorf("HealthCheck service = %q, want %q", body["service"], "dataaccess")
	}
	if body["version"] != "0.1.0" {
		t.Errorf("HealthCheck version = %q, want %q", body["version"], "0.1.0")
	}
}

// --- Helper Functions ---

func TestParseMemberID_Valid(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/members/10001", nil)
	// Go 1.22 ServeMux path values aren't populated by httptest, so parseMemberID
	// falls back to URL path parsing.
	got, err := parseMemberID(req)
	if err != nil {
		t.Fatalf("parseMemberID(10001) error: %v", err)
	}
	if got != 10001 {
		t.Errorf("parseMemberID(10001) = %d, want 10001", got)
	}
}

func TestParseMemberID_Invalid(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/members/abc", nil)
	_, err := parseMemberID(req)
	if err == nil {
		t.Error("parseMemberID(abc) should return error")
	}
}

func TestParseMemberID_Nested(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/v1/members/10002/salary", nil)
	got, err := parseMemberID(req)
	if err != nil {
		t.Fatalf("parseMemberID(nested) error: %v", err)
	}
	if got != 10002 {
		t.Errorf("parseMemberID(nested) = %d, want 10002", got)
	}
}

func TestNullStr_Valid(t *testing.T) {
	ns := sql.NullString{String: "hello", Valid: true}
	if got := nullStr(ns); got != "hello" {
		t.Errorf("nullStr(valid) = %q, want %q", got, "hello")
	}
}

func TestNullStr_Null(t *testing.T) {
	ns := sql.NullString{Valid: false}
	if got := nullStr(ns); got != "" {
		t.Errorf("nullStr(null) = %q, want empty string", got)
	}
}

// --- Model Serialization ---

func TestMemberJSON(t *testing.T) {
	dob := time.Date(1968, 7, 15, 0, 0, 0, 0, time.UTC)
	hire := time.Date(1998, 3, 2, 0, 0, 0, 0, time.UTC)
	m := models.Member{
		MemberID:   10001,
		FirstName:  "Robert",
		LastName:   "Martinez",
		DOB:        dob,
		HireDate:   hire,
		StatusCode: "ACTIVE",
		TierCode:   1,
	}

	data, err := json.Marshal(m)
	if err != nil {
		t.Fatalf("Marshal Member: %v", err)
	}

	var decoded models.Member
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal Member: %v", err)
	}
	if decoded.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", decoded.MemberID)
	}
	if decoded.TierCode != 1 {
		t.Errorf("TierCode = %d, want 1", decoded.TierCode)
	}
}

func TestAMSResultJSON(t *testing.T) {
	ams := models.AMSResult{
		WindowMonths:    36,
		WindowStart:     "2023-01",
		WindowEnd:       "2025-12",
		Amount:          8500.75,
		LeavePayoutIncl: true,
		LeavePayoutAmt:  12000.00,
	}

	data, err := json.Marshal(ams)
	if err != nil {
		t.Fatalf("Marshal AMSResult: %v", err)
	}

	var decoded models.AMSResult
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal AMSResult: %v", err)
	}
	if decoded.WindowMonths != 36 {
		t.Errorf("WindowMonths = %d, want 36", decoded.WindowMonths)
	}
	if decoded.Amount != 8500.75 {
		t.Errorf("Amount = %f, want 8500.75", decoded.Amount)
	}
}

// --- Service Credit Summary Logic (CRITICAL: Service Purchase Exclusion) ---
//
// This tests the core business rule from CLAUDE.md:
//   - Purchased service credit counts toward BENEFIT CALCULATION
//   - Purchased service credit does NOT count toward Rule of 75/85 or IPR
//   - eligibility_years = earned only
//   - benefit_years = earned + purchased

func TestServiceCreditSummary_EarnedOnlyEligibility(t *testing.T) {
	summary := models.ServiceCreditSummary{
		MemberID:       10002,
		EarnedYears:    15.0,
		PurchasedYears: 3.0,
		MilitaryYears:  2.0,
		LeaveYears:     0.5,
	}

	// Replicate the calculation logic from GetServiceCredit handler (handlers.go:567-572)
	summary.TotalYears = summary.EarnedYears + summary.PurchasedYears +
		summary.MilitaryYears + summary.LeaveYears
	summary.EligibilityYears = summary.EarnedYears
	summary.BenefitYears = summary.EarnedYears + summary.PurchasedYears

	// CRITICAL: Eligibility years must be earned-only (no purchased credit)
	if summary.EligibilityYears != 15.0 {
		t.Errorf("EligibilityYears = %f, want 15.0 (earned only)", summary.EligibilityYears)
	}

	// CRITICAL: Benefit years include purchased credit
	if summary.BenefitYears != 18.0 {
		t.Errorf("BenefitYears = %f, want 18.0 (earned + purchased)", summary.BenefitYears)
	}

	// Total years include all types
	if summary.TotalYears != 20.5 {
		t.Errorf("TotalYears = %f, want 20.5 (all types)", summary.TotalYears)
	}

	// Verify JSON round-trip preserves the distinction
	data, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("Marshal ServiceCreditSummary: %v", err)
	}

	var decoded models.ServiceCreditSummary
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatalf("Unmarshal ServiceCreditSummary: %v", err)
	}

	if decoded.EligibilityYears != 15.0 {
		t.Errorf("decoded EligibilityYears = %f, want 15.0", decoded.EligibilityYears)
	}
	if decoded.BenefitYears != 18.0 {
		t.Errorf("decoded BenefitYears = %f, want 18.0", decoded.BenefitYears)
	}
}

func TestServiceCreditSummary_NoPurchased(t *testing.T) {
	summary := models.ServiceCreditSummary{
		MemberID:    10001,
		EarnedYears: 25.0,
	}

	summary.TotalYears = summary.EarnedYears + summary.PurchasedYears +
		summary.MilitaryYears + summary.LeaveYears
	summary.EligibilityYears = summary.EarnedYears
	summary.BenefitYears = summary.EarnedYears + summary.PurchasedYears

	// When no purchased credit exists, eligibility and benefit years match
	if summary.EligibilityYears != summary.BenefitYears {
		t.Errorf("With no purchased credit, EligibilityYears (%f) should equal BenefitYears (%f)",
			summary.EligibilityYears, summary.BenefitYears)
	}
}

func TestServiceCreditSummary_PurchasedExcludedFromEligibility(t *testing.T) {
	// Simulates Jennifer Kim (Case 2): member with purchased service credit
	// The purchased credit must NOT affect eligibility (Rule of 75/85)
	summary := models.ServiceCreditSummary{
		MemberID:       10002,
		EarnedYears:    18.0,
		PurchasedYears: 5.0,
	}

	summary.TotalYears = summary.EarnedYears + summary.PurchasedYears +
		summary.MilitaryYears + summary.LeaveYears
	summary.EligibilityYears = summary.EarnedYears
	summary.BenefitYears = summary.EarnedYears + summary.PurchasedYears

	// For Rule of 75 check: age + eligibility_years (NOT benefit_years)
	age := 55.0
	ruleOf75 := age + summary.EligibilityYears // 55 + 18 = 73 — NOT eligible

	if ruleOf75 >= 75 {
		t.Errorf("Rule of 75 check: %f + %f = %f >= 75, but should NOT be eligible (purchased excluded)",
			age, summary.EligibilityYears, ruleOf75)
	}

	// If we incorrectly used BenefitYears: 55 + 23 = 78 — would wrongly show as eligible
	wrongRuleOf75 := age + summary.BenefitYears
	if wrongRuleOf75 < 75 {
		t.Error("This test's numbers assume BenefitYears would wrongly trigger Rule of 75")
	}
}

// --- DB-Dependent Handler Tests (using sqlmock) ---

func newMockHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	return &Handler{DB: db}, mock
}

// serveWithPathValue dispatches a request through a real ServeMux so that
// Go 1.22's {id} path value is populated.
func serveWithPathValue(h *Handler, method, path string) *httptest.ResponseRecorder {
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	req := httptest.NewRequest(method, path, nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// --- GetMember ---

func TestGetMember_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc")

	if w.Code != http.StatusBadRequest {
		t.Errorf("GetMember(abc) status = %d, want %d", w.Code, http.StatusBadRequest)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_MEMBER_ID" {
		t.Errorf("error.code = %q, want INVALID_MEMBER_ID", errObj["code"])
	}
}

func TestGetMember_NotFound(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT m.MEMBER_ID").
		WithArgs(99999).
		WillReturnError(sql.ErrNoRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/99999")

	if w.Code != http.StatusNotFound {
		t.Errorf("GetMember(99999) status = %d, want %d", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "MEMBER_NOT_FOUND" {
		t.Errorf("error.code = %q, want MEMBER_NOT_FOUND", errObj["code"])
	}
}

func TestGetMember_Valid(t *testing.T) {
	h, mock := newMockHandler(t)

	dob := time.Date(1968, 7, 15, 0, 0, 0, 0, time.UTC)
	hire := time.Date(1998, 3, 2, 0, 0, 0, 0, time.UTC)

	rows := sqlmock.NewRows([]string{
		"MEMBER_ID", "FIRST_NAME", "LAST_NAME", "MIDDLE_NAME",
		"DOB", "GENDER", "MARITAL_STAT", "HIRE_DT", "TERM_DATE",
		"REHIRE_DT", "STATUS_CD", "TIER_CD", "DEPT_CD", "POS_CD",
		"MEDICARE_FLAG", "EMAIL", "DEPT_NAME", "POS_TITLE",
	}).AddRow(
		10001, "Robert", "Martinez", sql.NullString{String: "A", Valid: true},
		dob, sql.NullString{String: "M", Valid: true},
		sql.NullString{String: "M", Valid: true}, hire,
		sql.NullTime{Valid: false}, sql.NullTime{Valid: false},
		"ACTIVE", 1,
		sql.NullString{String: "FIN", Valid: true},
		sql.NullString{String: "ACCT", Valid: true},
		sql.NullString{String: "N", Valid: true},
		sql.NullString{String: "rmartinez@example.com", Valid: true},
		sql.NullString{String: "Finance", Valid: true},
		sql.NullString{String: "Senior Accountant", Valid: true},
	)

	mock.ExpectQuery("SELECT m.MEMBER_ID").
		WithArgs(10001).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001")

	if w.Code != http.StatusOK {
		t.Fatalf("GetMember(10001) status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.Member          `json:"data"`
		Meta map[string]interface{} `json:"meta"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if body.Data.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", body.Data.MemberID)
	}
	if body.Data.FirstName != "Robert" {
		t.Errorf("FirstName = %q, want Robert", body.Data.FirstName)
	}
	if body.Data.TierCode != 1 {
		t.Errorf("TierCode = %d, want 1", body.Data.TierCode)
	}
	if body.Data.StatusCode != "ACTIVE" {
		t.Errorf("StatusCode = %q, want ACTIVE", body.Data.StatusCode)
	}
	if body.Meta["requestId"] == nil || body.Meta["requestId"] == "" {
		t.Error("meta.requestId should not be empty")
	}
	if body.Meta["service"] != "dataaccess" {
		t.Errorf("meta.service = %q, want dataaccess", body.Meta["service"])
	}
}

// --- GetEmploymentHistory ---

func TestGetEmploymentHistory_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/employment")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetEmploymentHistory_Empty(t *testing.T) {
	h, mock := newMockHandler(t)

	rows := sqlmock.NewRows([]string{
		"total_count",
		"EMPL_HIST_ID", "MEMBER_ID", "EVENT_TYPE", "EVENT_DT",
		"DEPT_CD", "POS_CD", "SALARY_ANNUAL", "SEPARATION_CD", "SEPARATION_RSN",
	})

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/employment")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body.Pagination.Total != 0 {
		t.Errorf("total = %d, want 0", body.Pagination.Total)
	}
}

func TestGetEmploymentHistory_WithRecords(t *testing.T) {
	h, mock := newMockHandler(t)

	eventDate := time.Date(1998, 3, 2, 0, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"total_count",
		"EMPL_HIST_ID", "MEMBER_ID", "EVENT_TYPE", "EVENT_DT",
		"DEPT_CD", "POS_CD", "SALARY_ANNUAL", "SEPARATION_CD", "SEPARATION_RSN",
	}).AddRow(
		1,
		1, 10001, "HIRE", eventDate,
		sql.NullString{String: "FIN", Valid: true},
		sql.NullString{String: "ACCT", Valid: true},
		sql.NullFloat64{Float64: 45000.0, Valid: true},
		sql.NullString{Valid: false},
		sql.NullString{Valid: false},
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/employment")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data       []models.EmploymentEvent `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 event, got %d", len(body.Data))
	}
	if body.Data[0].EventType != "HIRE" {
		t.Errorf("EventType = %q, want HIRE", body.Data[0].EventType)
	}
	if body.Pagination.Total != 1 {
		t.Errorf("total = %d, want 1", body.Pagination.Total)
	}
}

// --- GetSalaryHistory ---

func TestGetSalaryHistory_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/xyz/salary")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetSalaryHistory_WithRecords(t *testing.T) {
	h, mock := newMockHandler(t)

	ppEnd := time.Date(2025, 1, 31, 0, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"total_count",
		"SALARY_ID", "MEMBER_ID", "PAY_PERIOD_END", "PAY_PERIOD_NUM",
		"ANNUAL_SALARY", "GROSS_PAY", "PENSIONABLE_PAY", "OT_PAY",
		"LEAVE_PAYOUT_AMT", "FURLOUGH_DEDUCT", "FY_YEAR",
	}).AddRow(
		1,
		1, 10001, ppEnd, 1,
		85000.0, 3541.67, sql.NullFloat64{Float64: 3541.67, Valid: true},
		0.0, 0.0, 0.0, 2025,
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/salary")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data       []models.SalaryRecord `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 salary record, got %d", len(body.Data))
	}
	if body.Data[0].AnnualSalary != 85000.0 {
		t.Errorf("AnnualSalary = %f, want 85000.0", body.Data[0].AnnualSalary)
	}
}

// --- GetAMS ---

func TestGetAMS_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/salary/ams")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetAMS_MemberNotFound(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(99999).
		WillReturnError(sql.ErrNoRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/99999/salary/ams")

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d", w.Code, http.StatusNotFound)
	}
}

func TestGetAMS_Tier1_36MonthWindow(t *testing.T) {
	h, mock := newMockHandler(t)

	// Tier 1 member hired before 2010 (leave payout eligible)
	hireDate := time.Date(1998, 3, 2, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{"TIER_CD", "HIRE_DT"}).
			AddRow(1, hireDate))

	// Build 36 months of salary data
	salaryRows := sqlmock.NewRows([]string{"year_month", "pensionable", "leave_payout"})
	for i := 0; i < 36; i++ {
		month := time.Date(2023, time.Month(1+i%12), 1, 0, 0, 0, 0, time.UTC)
		ym := month.Format("2006-01")
		if i >= 12 {
			month = time.Date(2024, time.Month(1+(i-12)%12), 1, 0, 0, 0, 0, time.UTC)
			ym = month.Format("2006-01")
		}
		if i >= 24 {
			month = time.Date(2025, time.Month(1+(i-24)%12), 1, 0, 0, 0, 0, time.UTC)
			ym = month.Format("2006-01")
		}
		salaryRows.AddRow(ym, 7000.0, 0.0)
	}

	mock.ExpectQuery("SELECT TO_CHAR").
		WithArgs(10001).
		WillReturnRows(salaryRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/salary/ams")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.AMSResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}

	// RULE-AMS-WINDOW: Tier 1 uses 36-month window
	if body.Data.WindowMonths != 36 {
		t.Errorf("WindowMonths = %d, want 36 (Tier 1)", body.Data.WindowMonths)
	}

	// AMS should be 7000.0 (uniform salary across all months)
	if body.Data.Amount != 7000.0 {
		t.Errorf("Amount = %f, want 7000.0", body.Data.Amount)
	}
}

func TestGetAMS_Tier3_60MonthWindow(t *testing.T) {
	h, mock := newMockHandler(t)

	// Tier 3 member (hired after July 1, 2011 — not leave payout eligible)
	hireDate := time.Date(2012, 8, 15, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(10003).
		WillReturnRows(sqlmock.NewRows([]string{"TIER_CD", "HIRE_DT"}).
			AddRow(3, hireDate))

	// Build 60 months of salary data
	salaryRows := sqlmock.NewRows([]string{"year_month", "pensionable", "leave_payout"})
	baseDate := time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 60; i++ {
		m := baseDate.AddDate(0, i, 0)
		salaryRows.AddRow(m.Format("2006-01"), 5000.0, 0.0)
	}

	mock.ExpectQuery("SELECT TO_CHAR").
		WithArgs(10003).
		WillReturnRows(salaryRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10003/salary/ams")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.AMSResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)

	// RULE-AMS-WINDOW: Tier 3 uses 60-month window
	if body.Data.WindowMonths != 60 {
		t.Errorf("WindowMonths = %d, want 60 (Tier 3)", body.Data.WindowMonths)
	}
}

func TestGetAMS_LeavePayoutIncluded_Pre2010Hire(t *testing.T) {
	h, mock := newMockHandler(t)

	// RULE-LEAVE-PAYOUT: Member hired before Jan 1, 2010 — leave payout IS included
	hireDate := time.Date(2005, 6, 1, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{"TIER_CD", "HIRE_DT"}).
			AddRow(2, hireDate))

	// 36 months: last month has leave payout
	salaryRows := sqlmock.NewRows([]string{"year_month", "pensionable", "leave_payout"})
	baseDate := time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 36; i++ {
		m := baseDate.AddDate(0, i, 0)
		leavePayout := 0.0
		if i == 35 { // Last month has leave payout
			leavePayout = 12000.0
		}
		salaryRows.AddRow(m.Format("2006-01"), 6000.0, leavePayout)
	}

	mock.ExpectQuery("SELECT TO_CHAR").
		WithArgs(10001).
		WillReturnRows(salaryRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/salary/ams")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.AMSResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)

	if !body.Data.LeavePayoutIncl {
		t.Error("LeavePayoutIncl should be true for pre-2010 hire with leave payout")
	}

	// AMS = (35*6000 + 1*(6000+12000)) / 36 = (210000 + 18000) / 36 = 6333.33...
	expectedAMS := (35*6000.0 + 18000.0) / 36.0
	if body.Data.Amount != expectedAMS {
		t.Errorf("Amount = %f, want %f (leave payout included)", body.Data.Amount, expectedAMS)
	}

	if body.Data.LeavePayoutAmt != 12000.0 {
		t.Errorf("LeavePayoutAmt = %f, want 12000.0", body.Data.LeavePayoutAmt)
	}
}

func TestGetAMS_LeavePayoutExcluded_Post2010Hire(t *testing.T) {
	h, mock := newMockHandler(t)

	// RULE-LEAVE-PAYOUT: Member hired AFTER Jan 1, 2010 — leave payout NOT included
	hireDate := time.Date(2012, 8, 15, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(10003).
		WillReturnRows(sqlmock.NewRows([]string{"TIER_CD", "HIRE_DT"}).
			AddRow(3, hireDate))

	// 60 months: last month has leave payout (should be ignored for Tier 3 post-2010)
	salaryRows := sqlmock.NewRows([]string{"year_month", "pensionable", "leave_payout"})
	baseDate := time.Date(2021, 1, 1, 0, 0, 0, 0, time.UTC)
	for i := 0; i < 60; i++ {
		m := baseDate.AddDate(0, i, 0)
		leavePayout := 0.0
		if i == 59 {
			leavePayout = 8000.0 // Has leave payout but should be excluded
		}
		salaryRows.AddRow(m.Format("2006-01"), 5000.0, leavePayout)
	}

	mock.ExpectQuery("SELECT TO_CHAR").
		WithArgs(10003).
		WillReturnRows(salaryRows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10003/salary/ams")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.AMSResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)

	// AMS = 5000.0 (leave payout excluded for post-2010 hire)
	if body.Data.Amount != 5000.0 {
		t.Errorf("Amount = %f, want 5000.0 (leave payout excluded for post-2010 hire)",
			body.Data.Amount)
	}
}

func TestGetAMS_NoSalaryData(t *testing.T) {
	h, mock := newMockHandler(t)

	hireDate := time.Date(2005, 1, 1, 0, 0, 0, 0, time.UTC)
	mock.ExpectQuery("SELECT TIER_CD").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{"TIER_CD", "HIRE_DT"}).
			AddRow(1, hireDate))

	// Empty salary data
	mock.ExpectQuery("SELECT TO_CHAR").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{"year_month", "pensionable", "leave_payout"}))

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/salary/ams")

	if w.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d (no salary data)", w.Code, http.StatusNotFound)
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "NO_SALARY_DATA" {
		t.Errorf("error.code = %q, want NO_SALARY_DATA", errObj["code"])
	}
}

// --- GetBeneficiaries ---

func TestGetBeneficiaries_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/beneficiaries")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetBeneficiaries_WithRecords(t *testing.T) {
	h, mock := newMockHandler(t)

	effDate := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"total_count",
		"BENE_ID", "MEMBER_ID", "BENE_TYPE", "FIRST_NAME", "LAST_NAME",
		"RELATIONSHIP", "DOB", "ALLOC_PCT", "EFF_DT", "END_DT",
	}).AddRow(
		1,
		1, 10001, "PRIMARY", "Maria", "Martinez",
		sql.NullString{String: "SPOUSE", Valid: true},
		sql.NullTime{Time: time.Date(1970, 5, 10, 0, 0, 0, 0, time.UTC), Valid: true},
		100.0, effDate,
		sql.NullTime{Valid: false},
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/beneficiaries")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data       []models.Beneficiary `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 beneficiary, got %d", len(body.Data))
	}
	if body.Data[0].BeneType != "PRIMARY" {
		t.Errorf("BeneType = %q, want PRIMARY", body.Data[0].BeneType)
	}
	if body.Data[0].AllocPct != 100.0 {
		t.Errorf("AllocPct = %f, want 100.0", body.Data[0].AllocPct)
	}
}

// --- GetDRO ---

func TestGetDRO_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/dro")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetDRO_WithRecords(t *testing.T) {
	h, mock := newMockHandler(t)

	rows := sqlmock.NewRows([]string{
		"total_count",
		"DRO_ID", "MEMBER_ID", "COURT_ORDER_NUM", "MARRIAGE_DT", "DIVORCE_DT",
		"ALT_PAYEE_FIRST", "ALT_PAYEE_LAST", "ALT_PAYEE_DOB",
		"DIVISION_METHOD", "DIVISION_VALUE", "STATUS",
	}).AddRow(
		1,
		1, 10001,
		sql.NullString{String: "DRO-2020-001", Valid: true},
		sql.NullTime{Time: time.Date(1995, 6, 15, 0, 0, 0, 0, time.UTC), Valid: true},
		sql.NullTime{Time: time.Date(2019, 11, 30, 0, 0, 0, 0, time.UTC), Valid: true},
		"Sarah", "Martinez",
		sql.NullTime{Time: time.Date(1970, 3, 20, 0, 0, 0, 0, time.UTC), Valid: true},
		"TIME_RULE", 0.45, "APPROVED",
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 50, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/dro")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data       []models.DRORecord `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 DRO, got %d", len(body.Data))
	}
	if body.Data[0].Status != "APPROVED" {
		t.Errorf("Status = %q, want APPROVED", body.Data[0].Status)
	}
	if body.Data[0].DivisionMethod != "TIME_RULE" {
		t.Errorf("DivisionMethod = %q, want TIME_RULE", body.Data[0].DivisionMethod)
	}
}

// --- GetContributions ---

func TestGetContributions_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/contributions")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetContributions_WithSummary(t *testing.T) {
	h, mock := newMockHandler(t)

	// Summary query
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{
			"total_ee", "total_er", "total_interest", "count",
		}).AddRow(52000.0, 110000.0, 8500.0, 312))

	// Balance query
	mock.ExpectQuery("SELECT COALESCE").
		WithArgs(10001).
		WillReturnRows(sqlmock.NewRows([]string{
			"ee_balance", "er_balance",
		}).AddRow(52000.0, 110000.0))

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/contributions")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data models.ContributionSummary `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}
	if body.Data.MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", body.Data.MemberID)
	}
	if body.Data.TotalEE != 52000.0 {
		t.Errorf("TotalEE = %f, want 52000.0", body.Data.TotalEE)
	}
	if body.Data.PeriodCount != 312 {
		t.Errorf("PeriodCount = %d, want 312", body.Data.PeriodCount)
	}
}

// --- GetServiceCredit (CRITICAL: Service Purchase Exclusion Rule) ---

func TestGetServiceCredit_InvalidID(t *testing.T) {
	h, _ := newMockHandler(t)
	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/service-credit")

	if w.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestGetServiceCredit_EarnedOnly(t *testing.T) {
	h, mock := newMockHandler(t)

	begin := time.Date(1998, 3, 2, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC)

	rows := sqlmock.NewRows([]string{
		"total_count",
		"SVC_CREDIT_ID", "MEMBER_ID", "CREDIT_TYPE", "BEGIN_DT", "END_DT",
		"YEARS_CREDITED", "COST", "PURCHASE_DT", "STATUS",
	}).AddRow(
		1,
		1, 10001, "EARNED",
		sql.NullTime{Time: begin, Valid: true},
		sql.NullTime{Time: end, Valid: true},
		27.0, sql.NullFloat64{Valid: false}, sql.NullTime{Valid: false}, "ACTIVE",
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/service-credit")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Credits []models.ServiceCredit      `json:"credits"`
			Summary models.ServiceCreditSummary `json:"summary"`
		} `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}

	s := body.Data.Summary
	if s.EarnedYears != 27.0 {
		t.Errorf("EarnedYears = %f, want 27.0", s.EarnedYears)
	}
	if s.PurchasedYears != 0.0 {
		t.Errorf("PurchasedYears = %f, want 0.0", s.PurchasedYears)
	}
	// With no purchased credit, eligibility and benefit years should match
	if s.EligibilityYears != s.BenefitYears {
		t.Errorf("EligibilityYears (%f) != BenefitYears (%f), should match when no purchased credit",
			s.EligibilityYears, s.BenefitYears)
	}
}

func TestGetServiceCredit_EarnedPlusPurchased(t *testing.T) {
	h, mock := newMockHandler(t)

	// Simulates Jennifer Kim (Case 2) pattern: earned + purchased service credit
	earnBegin := time.Date(2004, 9, 1, 0, 0, 0, 0, time.UTC)
	earnEnd := time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC)
	purchBegin := time.Date(2001, 6, 1, 0, 0, 0, 0, time.UTC)
	purchEnd := time.Date(2004, 5, 31, 0, 0, 0, 0, time.UTC)
	purchDate := time.Date(2010, 3, 15, 0, 0, 0, 0, time.UTC)

	rows := sqlmock.NewRows([]string{
		"total_count",
		"SVC_CREDIT_ID", "MEMBER_ID", "CREDIT_TYPE", "BEGIN_DT", "END_DT",
		"YEARS_CREDITED", "COST", "PURCHASE_DT", "STATUS",
	}).AddRow(
		// Earned credit
		2,
		1, 10002, "EARNED",
		sql.NullTime{Time: earnBegin, Valid: true},
		sql.NullTime{Time: earnEnd, Valid: true},
		21.0, sql.NullFloat64{Valid: false}, sql.NullTime{Valid: false}, "ACTIVE",
	).AddRow(
		// Purchased credit
		2,
		2, 10002, "PURCHASED",
		sql.NullTime{Time: purchBegin, Valid: true},
		sql.NullTime{Time: purchEnd, Valid: true},
		3.0, sql.NullFloat64{Float64: 15000.0, Valid: true},
		sql.NullTime{Time: purchDate, Valid: true}, "ACTIVE",
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10002, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10002/service-credit")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Credits []models.ServiceCredit      `json:"credits"`
			Summary models.ServiceCreditSummary `json:"summary"`
		} `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("body parse error: %v", err)
	}

	s := body.Data.Summary

	// CRITICAL: Earned years = 21
	if s.EarnedYears != 21.0 {
		t.Errorf("EarnedYears = %f, want 21.0", s.EarnedYears)
	}

	// CRITICAL: Purchased years = 3
	if s.PurchasedYears != 3.0 {
		t.Errorf("PurchasedYears = %f, want 3.0", s.PurchasedYears)
	}

	// CRITICAL SERVICE PURCHASE EXCLUSION:
	// Eligibility years = earned only (21), NOT earned + purchased (24)
	if s.EligibilityYears != 21.0 {
		t.Errorf("EligibilityYears = %f, want 21.0 (EARNED ONLY — purchased excluded per Service Purchase Exclusion rule)",
			s.EligibilityYears)
	}

	// Benefit years = earned + purchased (21 + 3 = 24)
	if s.BenefitYears != 24.0 {
		t.Errorf("BenefitYears = %f, want 24.0 (earned + purchased for benefit formula)",
			s.BenefitYears)
	}

	// Total years = all types (21 + 3 = 24)
	if s.TotalYears != 24.0 {
		t.Errorf("TotalYears = %f, want 24.0", s.TotalYears)
	}

	// Verify eligibility != benefit when purchased credit exists
	if s.EligibilityYears == s.BenefitYears {
		t.Error("EligibilityYears should NOT equal BenefitYears when purchased credit exists")
	}

	// Verify we got both credit records
	if len(body.Data.Credits) != 2 {
		t.Errorf("expected 2 credit records, got %d", len(body.Data.Credits))
	}
}

func TestGetServiceCredit_AllCreditTypes(t *testing.T) {
	h, mock := newMockHandler(t)

	begin := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC)

	rows := sqlmock.NewRows([]string{
		"total_count",
		"SVC_CREDIT_ID", "MEMBER_ID", "CREDIT_TYPE", "BEGIN_DT", "END_DT",
		"YEARS_CREDITED", "COST", "PURCHASE_DT", "STATUS",
	}).AddRow(
		4,
		1, 10001, "EARNED",
		sql.NullTime{Time: begin, Valid: true}, sql.NullTime{Time: end, Valid: true},
		20.0, sql.NullFloat64{Valid: false}, sql.NullTime{Valid: false}, "ACTIVE",
	).AddRow(
		4,
		2, 10001, "PURCHASED",
		sql.NullTime{Time: begin, Valid: true}, sql.NullTime{Time: end, Valid: true},
		3.0, sql.NullFloat64{Float64: 12000.0, Valid: true},
		sql.NullTime{Time: begin, Valid: true}, "ACTIVE",
	).AddRow(
		4,
		3, 10001, "MILITARY",
		sql.NullTime{Time: begin, Valid: true}, sql.NullTime{Time: end, Valid: true},
		2.0, sql.NullFloat64{Valid: false}, sql.NullTime{Valid: false}, "ACTIVE",
	).AddRow(
		4,
		4, 10001, "LEAVE",
		sql.NullTime{Time: begin, Valid: true}, sql.NullTime{Time: end, Valid: true},
		0.5, sql.NullFloat64{Valid: false}, sql.NullTime{Valid: false}, "ACTIVE",
	)

	mock.ExpectQuery("SELECT COUNT").
		WithArgs(10001, 100, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/service-credit")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data struct {
			Credits []models.ServiceCredit      `json:"credits"`
			Summary models.ServiceCreditSummary `json:"summary"`
		} `json:"data"`
		Pagination struct {
			Total int `json:"total"`
		} `json:"pagination"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)

	s := body.Data.Summary

	if s.EarnedYears != 20.0 {
		t.Errorf("EarnedYears = %f, want 20.0", s.EarnedYears)
	}
	if s.PurchasedYears != 3.0 {
		t.Errorf("PurchasedYears = %f, want 3.0", s.PurchasedYears)
	}
	if s.MilitaryYears != 2.0 {
		t.Errorf("MilitaryYears = %f, want 2.0", s.MilitaryYears)
	}
	if s.LeaveYears != 0.5 {
		t.Errorf("LeaveYears = %f, want 0.5", s.LeaveYears)
	}

	// Total = 20 + 3 + 2 + 0.5 = 25.5
	if s.TotalYears != 25.5 {
		t.Errorf("TotalYears = %f, want 25.5", s.TotalYears)
	}

	// CRITICAL: Eligibility = earned only = 20 (military and leave DON'T count)
	if s.EligibilityYears != 20.0 {
		t.Errorf("EligibilityYears = %f, want 20.0 (earned only)", s.EligibilityYears)
	}

	// Benefit = earned + purchased = 23 (military and leave DON'T count)
	if s.BenefitYears != 23.0 {
		t.Errorf("BenefitYears = %f, want 23.0 (earned + purchased)", s.BenefitYears)
	}

	if len(body.Data.Credits) != 4 {
		t.Errorf("expected 4 credit records, got %d", len(body.Data.Credits))
	}
}

// --- SearchMembers ---

var searchCols = []string{"member_id", "first_name", "last_name", "tier_cd", "dept_name", "status_cd"}

func TestSearchMembers_ByLastName(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols).
			AddRow(10001, "Robert", "Martinez", 1, "Public Works", "ACTIVE"))

	w := serveWithPathValue(h, "GET", "/api/v1/members/search?q=martinez&limit=10")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers status = %d, want %d\nbody: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse error: %v", err)
	}
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(body.Data))
	}
	if body.Data[0].MemberID != 10001 {
		t.Errorf("MemberID = %d, want 10001", body.Data[0].MemberID)
	}
	if body.Data[0].LastName != "Martinez" {
		t.Errorf("LastName = %q, want Martinez", body.Data[0].LastName)
	}
}

func TestSearchMembers_ByMemberID(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols).
			AddRow(10002, "Jennifer", "Kim", 2, "Finance", "ACTIVE"))

	w := serveWithPathValue(h, "GET", "/api/v1/members/search?q=10002")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(byID) status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if len(body.Data) != 1 {
		t.Fatalf("expected 1 result, got %d", len(body.Data))
	}
	if body.Data[0].MemberID != 10002 {
		t.Errorf("MemberID = %d, want 10002", body.Data[0].MemberID)
	}
}

func TestSearchMembers_EmptyQuery(t *testing.T) {
	h, _ := newMockHandler(t)

	w := serveWithPathValue(h, "GET", "/api/v1/members/search?q=")

	if w.Code != http.StatusBadRequest {
		t.Errorf("SearchMembers(empty) status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

func TestSearchMembers_NoResults(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols))

	w := serveWithPathValue(h, "GET", "/api/v1/members/search?q=zzzznotfound")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(no results) status = %d, want %d", w.Code, http.StatusOK)
	}

	var body struct {
		Data []models.MemberSearchResult `json:"data"`
	}
	json.Unmarshal(w.Body.Bytes(), &body)
	if len(body.Data) != 0 {
		t.Errorf("expected 0 results, got %d", len(body.Data))
	}
}

func TestSearchMembers_LimitCap(t *testing.T) {
	h, mock := newMockHandler(t)

	mock.ExpectQuery("SELECT").
		WillReturnRows(sqlmock.NewRows(searchCols))

	w := serveWithPathValue(h, "GET", "/api/v1/members/search?q=test&limit=100")

	if w.Code != http.StatusOK {
		t.Fatalf("SearchMembers(limit cap) status = %d, want %d", w.Code, http.StatusOK)
	}
}
