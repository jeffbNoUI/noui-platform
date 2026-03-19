// Package api implements HTTP handlers for the employer-scp service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	scpdb "github.com/noui/platform/employer-scp/db"
	"github.com/noui/platform/employer-scp/domain"
)

const serviceName = "employer-scp"

// Handler holds dependencies for employer-scp API handlers.
type Handler struct {
	store *scpdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: scpdb.NewStore(database)}
}

// RegisterRoutes sets up all employer-scp API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Cost Factors
	mux.HandleFunc("GET /api/v1/scp/cost-factors", h.ListCostFactors)
	mux.HandleFunc("GET /api/v1/scp/cost-factors/lookup", h.LookupCostFactor)
	mux.HandleFunc("POST /api/v1/scp/cost-factors", h.CreateCostFactor)

	// Cost Quotes
	mux.HandleFunc("POST /api/v1/scp/quotes", h.GenerateQuote)

	// Purchase Requests
	mux.HandleFunc("POST /api/v1/scp/requests", h.CreateRequest)
	mux.HandleFunc("GET /api/v1/scp/requests", h.ListRequests)
	mux.HandleFunc("GET /api/v1/scp/requests/{id}", h.GetRequest)
	mux.HandleFunc("PUT /api/v1/scp/requests/{id}/quote", h.ApplyQuote)
	mux.HandleFunc("PUT /api/v1/scp/requests/{id}/submit-docs", h.SubmitDocumentation)
	mux.HandleFunc("PUT /api/v1/scp/requests/{id}/approve", h.ApproveRequest)
	mux.HandleFunc("PUT /api/v1/scp/requests/{id}/deny", h.DenyRequest)
	mux.HandleFunc("POST /api/v1/scp/requests/{id}/payment", h.RecordPayment)
	mux.HandleFunc("PUT /api/v1/scp/requests/{id}/cancel", h.CancelRequest)

	// Eligibility
	mux.HandleFunc("GET /api/v1/scp/eligibility", h.CheckEligibility)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": serviceName,
		"version": "0.1.0",
	})
}

// --- Cost Factor Handlers ---

func (h *Handler) ListCostFactors(w http.ResponseWriter, r *http.Request) {
	tier := r.URL.Query().Get("tier")
	activeOnly := r.URL.Query().Get("active") == "true"
	limit, offset := parsePagination(r)

	factors, total, err := h.store.ListCostFactors(r.Context(), tier, activeOnly, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list cost factors")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": factors, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) LookupCostFactor(w http.ResponseWriter, r *http.Request) {
	tier := r.URL.Query().Get("tier")
	hireDate := r.URL.Query().Get("hire_date")
	ageStr := r.URL.Query().Get("age")

	if tier == "" || hireDate == "" || ageStr == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_PARAMS",
			"tier, hire_date, and age query parameters are required")
		return
	}

	age, err := strconv.Atoi(ageStr)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_AGE", "age must be a number")
		return
	}

	factor, err := h.store.GetCostFactor(r.Context(), tier, hireDate, age)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND",
			"No cost factor found for the given tier, hire date, and age")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LOOKUP_FAILED", "Failed to lookup cost factor")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, factor)
}

func (h *Handler) CreateCostFactor(w http.ResponseWriter, r *http.Request) {
	var f scpdb.SCPCostFactor
	if err := json.NewDecoder(r.Body).Decode(&f); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if f.Tier == "" || f.HireDateFrom == "" || f.HireDateTo == "" || f.CostFactor == "" || f.EffectiveDate == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"tier, hireDateFrom, hireDateTo, costFactor, ageAtPurchase, and effectiveDate are required")
		return
	}

	if !domain.ValidTiers[f.Tier] {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_TIER",
			"tier must be TIER_1, TIER_2, or TIER_3")
		return
	}

	if err := h.store.CreateCostFactor(r.Context(), &f); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create cost factor")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, f)
}

// --- Cost Quote Handler ---

func (h *Handler) GenerateQuote(w http.ResponseWriter, r *http.Request) {
	var req scpdb.CostQuoteInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.Tier == "" || req.HireDate == "" || req.AnnualSalary == "" || req.YearsRequested == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"tier, hireDate, ageAtPurchase, annualSalary, and yearsRequested are required")
		return
	}

	// Look up cost factor
	factor, err := h.store.GetCostFactor(r.Context(), req.Tier, req.HireDate, req.AgeAtPurchase)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NO_FACTOR",
			"No cost factor found for the given parameters")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LOOKUP_FAILED", "Failed to lookup cost factor")
		return
	}

	// Calculate cost
	quote, err := domain.CalculateCost(factor.CostFactor, req.AnnualSalary, req.YearsRequested)
	if err != nil {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, serviceName, "CALC_FAILED", err.Error())
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"factor": factor,
		"quote":  quote,
	})
}

// --- Purchase Request Handlers ---

func (h *Handler) CreateRequest(w http.ResponseWriter, r *http.Request) {
	var req scpdb.CreateSCPRequestInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.OrgID == "" || req.SSNHash == "" || req.FirstName == "" || req.LastName == "" ||
		req.ServiceType == "" || req.Tier == "" || req.YearsRequested == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"orgId, ssnHash, firstName, lastName, serviceType, tier, and yearsRequested are required")
		return
	}

	// Validate eligibility
	eligibility := domain.ValidateEligibility(req.ServiceType, req.Tier)
	if !eligibility.Eligible {
		apiresponse.WriteJSON(w, http.StatusUnprocessableEntity, eligibility)
		return
	}

	submittedBy := auth.TenantID(r.Context())
	scpReq := &scpdb.SCPRequest{
		OrgID:          req.OrgID,
		MemberID:       req.MemberID,
		SSNHash:        req.SSNHash,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		ServiceType:    req.ServiceType,
		Tier:           req.Tier,
		YearsRequested: req.YearsRequested,
		// Exclusion flags always true — enforced by domain and DB trigger
		ExcludesFromRuleOf7585: true,
		ExcludesFromIPR:        true,
		ExcludesFromVesting:    true,
		RequestStatus:          "DRAFT",
		SubmittedBy:            &submittedBy,
		Notes:                  req.Notes,
	}

	if err := h.store.CreateSCPRequest(r.Context(), scpReq); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create purchase request")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, scpReq)
}

func (h *Handler) GetRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	req, err := h.store.GetSCPRequest(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Purchase request not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch purchase request")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, req)
}

func (h *Handler) ListRequests(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_ORG", "org_id query parameter is required")
		return
	}
	status := r.URL.Query().Get("status")
	limit, offset := parsePagination(r)

	requests, total, err := h.store.ListSCPRequests(r.Context(), orgID, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list purchase requests")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": requests, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) ApplyQuote(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req struct {
		CostFactorID string `json:"costFactorId"`
		CostFactor   string `json:"costFactor"`
		AnnualSalary string `json:"annualSalary"`
		TotalCost    string `json:"totalCost"`
		QuoteDate    string `json:"quoteDate"`
		QuoteExpires string `json:"quoteExpires"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.CostFactorID == "" || req.CostFactor == "" || req.AnnualSalary == "" ||
		req.TotalCost == "" || req.QuoteDate == "" || req.QuoteExpires == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"costFactorId, costFactor, annualSalary, totalCost, quoteDate, and quoteExpires are required")
		return
	}

	err := h.store.UpdateQuote(r.Context(), id, req.CostFactorID, req.CostFactor,
		req.AnnualSalary, req.TotalCost, req.QuoteDate, req.QuoteExpires)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request must be in DRAFT status to apply a quote")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to apply quote")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "QUOTED"})
}

func (h *Handler) SubmitDocumentation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	err := h.store.SubmitDocumentation(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request must be in QUOTED or PENDING_DOCS status")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to submit documentation")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "UNDER_REVIEW"})
}

func (h *Handler) ApproveRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	approvedBy := auth.TenantID(r.Context())

	err := h.store.ApproveRequest(r.Context(), id, approvedBy)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request must be in UNDER_REVIEW status to approve")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to approve request")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "APPROVED"})
}

func (h *Handler) DenyRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Reason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_REASON", "reason is required")
		return
	}

	deniedBy := auth.TenantID(r.Context())
	err := h.store.DenyRequest(r.Context(), id, deniedBy, req.Reason)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request must be in UNDER_REVIEW or PENDING_DOCS status to deny")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to deny request")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "DENIED"})
}

func (h *Handler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req scpdb.PaymentInput
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.Amount == "" || req.PaymentMethod == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"amount and paymentMethod are required")
		return
	}

	err := h.store.RecordPayment(r.Context(), id, req.Amount, req.PaymentMethod)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request must be in APPROVED or PAYING status to record payment")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "PAYMENT_FAILED", "Failed to record payment")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "PAYMENT_RECORDED"})
}

func (h *Handler) CancelRequest(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	err := h.store.CancelRequest(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Request can only be cancelled in DRAFT, QUOTED, or PENDING_DOCS status")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CANCEL_FAILED", "Failed to cancel request")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "CANCELLED"})
}

// --- Eligibility Handler ---

func (h *Handler) CheckEligibility(w http.ResponseWriter, r *http.Request) {
	serviceType := r.URL.Query().Get("service_type")
	tier := r.URL.Query().Get("tier")

	if serviceType == "" || tier == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_PARAMS",
			"service_type and tier query parameters are required")
		return
	}

	result := domain.ValidateEligibility(serviceType, tier)
	apiresponse.WriteJSON(w, http.StatusOK, result)
}

// --- Helpers ---

func parsePagination(r *http.Request) (int, int) {
	limit := 25
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 100 {
			limit = parsed
		}
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}
	return limit, offset
}
