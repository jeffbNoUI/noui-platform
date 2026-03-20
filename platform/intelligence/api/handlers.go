// Package api implements HTTP handlers for the DERP intelligence service.
// The intelligence service is the deterministic rules engine.
// AI does NOT execute business rules — all calculations are deterministic code.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/noui/platform/apiresponse"
	intelligencedb "github.com/noui/platform/intelligence/db"
	"github.com/noui/platform/intelligence/models"
	"github.com/noui/platform/intelligence/rules"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for intelligence API handlers.
type Handler struct {
	ConnectorURL string
	store        *intelligencedb.Store
}

// NewHandler creates a Handler with the connector service URL.
// If db is non-nil, summary logs will be persisted to PostgreSQL.
func NewHandler(db *sql.DB) *Handler {
	connURL := os.Getenv("CONNECTOR_URL")
	if connURL == "" {
		connURL = "http://localhost:8081"
	}
	h := &Handler{ConnectorURL: connURL}
	if db != nil {
		h.store = intelligencedb.NewStore(db)
	}
	return h
}

// RegisterRoutes sets up all API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)
	mux.HandleFunc("POST /api/v1/eligibility/evaluate", h.EvaluateEligibility)
	mux.HandleFunc("POST /api/v1/benefit/calculate", h.CalculateBenefit)
	mux.HandleFunc("POST /api/v1/benefit/options", h.CalculatePaymentOptions)
	mux.HandleFunc("POST /api/v1/benefit/scenario", h.CalculateScenario)
	mux.HandleFunc("POST /api/v1/dro/calculate", h.CalculateDRO)
	mux.HandleFunc("POST /api/v1/summary-log", h.LogSummary)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "intelligence",
		"version": "0.1.0",
	})
}

// EvaluateEligibility evaluates retirement eligibility for a member.
func (h *Handler) EvaluateEligibility(w http.ResponseWriter, r *http.Request) {
	var req models.EligibilityRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.PositiveInt("member_id", req.MemberID)
	if req.RetirementDate != "" {
		errs.DateYMD("retirement_date", req.RetirementDate)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", errs.Error())
		return
	}

	authHeader := r.Header.Get("Authorization")

	member, err := h.fetchMember(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	retDate := time.Now()
	if req.RetirementDate != "" {
		retDate, _ = time.Parse("2006-01-02", req.RetirementDate)
	}

	result := rules.EvaluateEligibility(*member, *svcCredit, retDate)
	apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", result)
}

// CalculateBenefit performs the complete benefit calculation.
func (h *Handler) CalculateBenefit(w http.ResponseWriter, r *http.Request) {
	var req models.BenefitCalcRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.PositiveInt("member_id", req.MemberID)
	errs.Required("retirement_date", req.RetirementDate)
	errs.DateYMD("retirement_date", req.RetirementDate)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", errs.Error())
		return
	}

	retDate, _ := time.Parse("2006-01-02", req.RetirementDate)
	authHeader := r.Header.Get("Authorization")

	member, err := h.fetchMember(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID, authHeader)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	result := rules.CalculateBenefit(*member, *svcCredit, *ams, dro, retDate)
	apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", result)
}

// CalculatePaymentOptions calculates all four payment options.
func (h *Handler) CalculatePaymentOptions(w http.ResponseWriter, r *http.Request) {
	var req models.PaymentOptionsRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.PositiveInt("member_id", req.MemberID)
	errs.Required("retirement_date", req.RetirementDate)
	errs.DateYMD("retirement_date", req.RetirementDate)
	if req.BeneficiaryDOB != "" {
		errs.DateYMD("beneficiary_dob", req.BeneficiaryDOB)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", errs.Error())
		return
	}

	retDate, _ := time.Parse("2006-01-02", req.RetirementDate)
	authHeader := r.Header.Get("Authorization")

	member, err := h.fetchMember(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID, authHeader)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	result := rules.CalculateBenefit(*member, *svcCredit, *ams, dro, retDate)
	apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", result.PaymentOptions)
}

// CalculateScenario compares benefits across multiple retirement dates.
func (h *Handler) CalculateScenario(w http.ResponseWriter, r *http.Request) {
	var req models.ScenarioRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.PositiveInt("member_id", req.MemberID)
	for i, ds := range req.RetirementDates {
		errs.DateYMD(fmt.Sprintf("retirement_dates[%d]", i), ds)
	}
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", errs.Error())
		return
	}

	authHeader := r.Header.Get("Authorization")

	member, err := h.fetchMember(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID, authHeader)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	var dates []time.Time
	for _, ds := range req.RetirementDates {
		t, _ := time.Parse("2006-01-02", ds) // already validated above
		dates = append(dates, t)
	}

	result := rules.CalculateScenarios(*member, *svcCredit, *ams, dro, dates)
	apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", result)
}

// CalculateDRO calculates DRO impact for a member.
func (h *Handler) CalculateDRO(w http.ResponseWriter, r *http.Request) {
	var req models.DROCalcRequest
	if err := decodeJSON(r, &req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", err.Error())
		return
	}

	var errs validation.Errors
	errs.PositiveInt("member_id", req.MemberID)
	errs.Required("retirement_date", req.RetirementDate)
	errs.DateYMD("retirement_date", req.RetirementDate)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "intelligence", "INVALID_REQUEST", errs.Error())
		return
	}

	retDate, _ := time.Parse("2006-01-02", req.RetirementDate)
	authHeader := r.Header.Get("Authorization")

	droData, err := h.fetchDRO(req.MemberID, authHeader)
	if err != nil || droData == nil || !droData.HasDRO {
		apiresponse.WriteError(w, http.StatusNotFound, "intelligence", "NO_DRO", "No DRO records found for this member")
		return
	}

	member, err := h.fetchMember(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID, authHeader)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadGateway, "intelligence", "CONNECTOR_ERROR", err.Error())
		return
	}

	// Calculate gross benefit using the case's actual retirement date
	eligibility := rules.EvaluateEligibility(*member, *svcCredit, retDate)
	multiplier := rules.TierMultiplier[eligibility.Tier]
	grossBenefit := ams.Amount * multiplier * svcCredit.BenefitYears
	if eligibility.ReductionFactor > 0 {
		grossBenefit *= eligibility.ReductionFactor
	}

	result := rules.CalculateDRO(*droData, member.HireDate, retDate, *svcCredit, grossBenefit)
	apiresponse.WriteSuccess(w, http.StatusOK, "intelligence", result)
}

// LogSummary stores a deterministic summary for future LLM training.
// Fire-and-forget from the frontend — deduplicates by input_hash per member.
func (h *Handler) LogSummary(w http.ResponseWriter, r *http.Request) {
	var req struct {
		MemberID  int             `json:"memberId"`
		InputHash string          `json:"inputHash"`
		Input     json.RawMessage `json:"input"`
		Output    json.RawMessage `json:"output"`
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, 1<<20)) // 1MB limit
	if err != nil {
		apiresponse.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		apiresponse.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if req.MemberID == 0 || req.InputHash == "" {
		apiresponse.WriteJSON(w, http.StatusBadRequest, map[string]string{"error": "memberId and inputHash required"})
		return
	}

	if h.store != nil {
		if err := h.store.InsertSummaryLog(r.Context(), req.MemberID, req.InputHash, req.Input, req.Output); err != nil {
			slog.Error("summary-log insert failed", "memberID", req.MemberID, "error", err)
		}
	} else {
		hashPreview := req.InputHash
		if len(hashPreview) > 16 {
			hashPreview = hashPreview[:16]
		}
		slog.Info("summary-log", "memberID", req.MemberID, "hash", hashPreview, "note", "no DB, stdout only")
	}

	apiresponse.WriteJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})
}

// --- Connector service client methods ---

func (h *Handler) fetchMember(memberID int, authHeader string) (*models.MemberData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d", h.ConnectorURL, memberID)
	return fetchFromConnector[models.MemberData](url, authHeader)
}

func (h *Handler) fetchServiceCredit(memberID int, authHeader string) (*models.ServiceCreditData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/service-credit", h.ConnectorURL, memberID)

	type svcCreditResp struct {
		Summary models.ServiceCreditData `json:"summary"`
	}
	resp, err := fetchFromConnector[svcCreditResp](url, authHeader)
	if err != nil {
		return nil, err
	}
	return &resp.Summary, nil
}

func (h *Handler) fetchAMS(memberID int, authHeader string) (*models.AMSData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/salary/ams", h.ConnectorURL, memberID)
	return fetchFromConnector[models.AMSData](url, authHeader)
}

func (h *Handler) fetchDRO(memberID int, authHeader string) (*models.DROData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/dro", h.ConnectorURL, memberID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create DRO request: %w", err)
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch DRO: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("connector returned status %d for DRO", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read DRO response: %w", err)
	}

	var apiResp struct {
		Data []struct {
			MarriageDate   string  `json:"marriage_date"`
			DivorceDate    string  `json:"divorce_date"`
			DivisionMethod string  `json:"division_method"`
			DivisionValue  float64 `json:"division_value"`
			AltPayeeFirst  string  `json:"alt_payee_first_name"`
			AltPayeeLast   string  `json:"alt_payee_last_name"`
			AltPayeeDOB    string  `json:"alt_payee_dob"`
			Status         string  `json:"status"`
		} `json:"data"`
	}

	if err := json.Unmarshal(body, &apiResp); err != nil {
		return nil, fmt.Errorf("failed to parse DRO response: %w", err)
	}

	if len(apiResp.Data) == 0 {
		return nil, nil
	}

	// Use the first active DRO
	for _, d := range apiResp.Data {
		if d.Status != "ACTIVE" && d.Status != "APPROVED" {
			continue
		}
		result := &models.DROData{
			HasDRO:         true,
			DivisionMethod: d.DivisionMethod,
			DivisionValue:  d.DivisionValue,
			AltPayeeFirst:  d.AltPayeeFirst,
			AltPayeeLast:   d.AltPayeeLast,
		}
		if t, err := parseFlexDate(d.MarriageDate); err == nil {
			result.MarriageDate = t
		}
		if t, err := parseFlexDate(d.DivorceDate); err == nil {
			result.DivorceDate = t
		}
		if t, err := parseFlexDate(d.AltPayeeDOB); err == nil {
			result.AltPayeeDOB = &t
		}
		return result, nil
	}

	return nil, nil
}

// parseFlexDate parses a date string in either "2006-01-02" or RFC3339 format.
// The dataaccess service returns RFC3339 timestamps (e.g. "1999-08-15T00:00:00Z")
// while some inputs use bare dates ("1999-08-15").
func parseFlexDate(s string) (time.Time, error) {
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t, nil
	}
	return time.Parse(time.RFC3339, s)
}

func fetchFromConnector[T any](url string, authHeader string) (*T, error) {
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request for %s: %w", url, err)
	}
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch %s: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("connector returned %d: %s", resp.StatusCode, string(body))
	}

	var apiResp struct {
		Data T `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&apiResp); err != nil {
		return nil, fmt.Errorf("failed to decode response from %s: %w", url, err)
	}

	return &apiResp.Data, nil
}

// --- Helper functions ---

func decodeJSON(r *http.Request, v interface{}) error {
	if r.Body == nil {
		return fmt.Errorf("request body is empty")
	}
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}
