// Package api implements HTTP handlers for the DERP intelligence service.
// The intelligence service is the deterministic rules engine.
// AI does NOT execute business rules — all calculations are deterministic code.
package api

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	intelligencedb "github.com/noui/platform/intelligence/db"
	"github.com/noui/platform/intelligence/models"
	"github.com/noui/platform/intelligence/rules"
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
	writeJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "intelligence",
		"version": "0.1.0",
	})
}

// EvaluateEligibility evaluates retirement eligibility for a member.
func (h *Handler) EvaluateEligibility(w http.ResponseWriter, r *http.Request) {
	var req models.EligibilityRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	member, err := h.fetchMember(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	retDate := time.Now()
	if req.RetirementDate != "" {
		parsed, err := time.Parse("2006-01-02", req.RetirementDate)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_DATE", "retirement_date must be YYYY-MM-DD")
			return
		}
		retDate = parsed
	}

	result := rules.EvaluateEligibility(*member, *svcCredit, retDate)
	writeSuccess(w, result)
}

// CalculateBenefit performs the complete benefit calculation.
func (h *Handler) CalculateBenefit(w http.ResponseWriter, r *http.Request) {
	var req models.BenefitCalcRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	retDate, err := time.Parse("2006-01-02", req.RetirementDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "retirement_date must be YYYY-MM-DD")
		return
	}

	member, err := h.fetchMember(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	result := rules.CalculateBenefit(*member, *svcCredit, *ams, dro, retDate)
	writeSuccess(w, result)
}

// CalculatePaymentOptions calculates all four payment options.
func (h *Handler) CalculatePaymentOptions(w http.ResponseWriter, r *http.Request) {
	var req models.PaymentOptionsRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	retDate, err := time.Parse("2006-01-02", req.RetirementDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "retirement_date must be YYYY-MM-DD")
		return
	}

	member, err := h.fetchMember(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	result := rules.CalculateBenefit(*member, *svcCredit, *ams, dro, retDate)
	writeSuccess(w, result.PaymentOptions)
}

// CalculateScenario compares benefits across multiple retirement dates.
func (h *Handler) CalculateScenario(w http.ResponseWriter, r *http.Request) {
	var req models.ScenarioRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	member, err := h.fetchMember(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	// Only fetch DRO when the case explicitly links to one
	var dro *models.DROData
	if req.DROID != nil {
		droData, err := h.fetchDRO(req.MemberID)
		if err == nil && droData != nil {
			dro = droData
		}
	}

	var dates []time.Time
	for _, ds := range req.RetirementDates {
		t, err := time.Parse("2006-01-02", ds)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_DATE", fmt.Sprintf("invalid date: %s", ds))
			return
		}
		dates = append(dates, t)
	}

	result := rules.CalculateScenarios(*member, *svcCredit, *ams, dro, dates)
	writeSuccess(w, result)
}

// CalculateDRO calculates DRO impact for a member.
func (h *Handler) CalculateDRO(w http.ResponseWriter, r *http.Request) {
	var req models.DROCalcRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return
	}

	if req.RetirementDate == "" {
		writeError(w, http.StatusBadRequest, "MISSING_DATE", "retirement_date is required")
		return
	}

	retDate, err := time.Parse("2006-01-02", req.RetirementDate)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_DATE", "retirement_date must be YYYY-MM-DD")
		return
	}

	droData, err := h.fetchDRO(req.MemberID)
	if err != nil || droData == nil || !droData.HasDRO {
		writeError(w, http.StatusNotFound, "NO_DRO", "No DRO records found for this member")
		return
	}

	member, err := h.fetchMember(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	svcCredit, err := h.fetchServiceCredit(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
		return
	}

	ams, err := h.fetchAMS(req.MemberID)
	if err != nil {
		writeError(w, http.StatusBadGateway, "CONNECTOR_ERROR", err.Error())
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
	writeSuccess(w, result)
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
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}

	if req.MemberID == 0 || req.InputHash == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "memberId and inputHash required"})
		return
	}

	if h.store != nil {
		if err := h.store.InsertSummaryLog(req.MemberID, req.InputHash, req.Input, req.Output); err != nil {
			log.Printf("summary-log: insert failed for member=%d: %v", req.MemberID, err)
		}
	} else {
		hashPreview := req.InputHash
		if len(hashPreview) > 16 {
			hashPreview = hashPreview[:16]
		}
		log.Printf("summary-log: member=%d hash=%s (no DB, stdout only)", req.MemberID, hashPreview)
	}

	writeJSON(w, http.StatusAccepted, map[string]string{"status": "logged"})
}

// --- Connector service client methods ---

func (h *Handler) fetchMember(memberID int) (*models.MemberData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d", h.ConnectorURL, memberID)
	return fetchFromConnector[models.MemberData](url)
}

func (h *Handler) fetchServiceCredit(memberID int) (*models.ServiceCreditData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/service-credit", h.ConnectorURL, memberID)

	type svcCreditResp struct {
		Summary models.ServiceCreditData `json:"summary"`
	}
	resp, err := fetchFromConnector[svcCreditResp](url)
	if err != nil {
		return nil, err
	}
	return &resp.Summary, nil
}

func (h *Handler) fetchAMS(memberID int) (*models.AMSData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/salary/ams", h.ConnectorURL, memberID)
	return fetchFromConnector[models.AMSData](url)
}

func (h *Handler) fetchDRO(memberID int) (*models.DROData, error) {
	url := fmt.Sprintf("%s/api/v1/members/%d/dro", h.ConnectorURL, memberID)

	resp, err := http.Get(url)
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

func fetchFromConnector[T any](url string) (*T, error) {
	resp, err := http.Get(url)
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

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("error encoding JSON response: %v", err)
	}
}

func writeSuccess(w http.ResponseWriter, data interface{}) {
	resp := map[string]interface{}{
		"data": data,
		"meta": map[string]interface{}{
			"request_id": uuid.New().String(),
			"timestamp":  time.Now().UTC().Format(time.RFC3339),
		},
	}
	writeJSON(w, http.StatusOK, resp)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	resp := map[string]interface{}{
		"error": map[string]interface{}{
			"code":       code,
			"message":    message,
			"request_id": uuid.New().String(),
		},
	}
	writeJSON(w, status, resp)
}
