// Package api implements HTTP handlers for the employer-terminations service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	etdb "github.com/noui/platform/employer-terminations/db"
	"github.com/noui/platform/employer-terminations/domain"
)

const serviceName = "employer-terminations"

// Handler holds dependencies for employer-terminations API handlers.
type Handler struct {
	store *etdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: etdb.NewStore(database)}
}

// RegisterRoutes sets up all employer-terminations API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Certifications
	mux.HandleFunc("POST /api/v1/terminations/certifications", h.CreateCertification)
	mux.HandleFunc("GET /api/v1/terminations/certifications", h.ListCertifications)
	mux.HandleFunc("GET /api/v1/terminations/certifications/{id}", h.GetCertification)
	mux.HandleFunc("PUT /api/v1/terminations/certifications/{id}/verify", h.VerifyCertification)
	mux.HandleFunc("PUT /api/v1/terminations/certifications/{id}/reject", h.RejectCertification)

	// Holds
	mux.HandleFunc("GET /api/v1/terminations/holds", h.ListHolds)
	mux.HandleFunc("GET /api/v1/terminations/holds/{id}", h.GetHold)
	mux.HandleFunc("PUT /api/v1/terminations/holds/{id}/resolve", h.ResolveHold)
	mux.HandleFunc("PUT /api/v1/terminations/holds/{id}/escalate", h.EscalateHold)

	// Refund Applications
	mux.HandleFunc("POST /api/v1/terminations/refunds", h.CreateRefundApplication)
	mux.HandleFunc("GET /api/v1/terminations/refunds", h.ListRefundApplications)
	mux.HandleFunc("GET /api/v1/terminations/refunds/{id}", h.GetRefundApplication)
	mux.HandleFunc("POST /api/v1/terminations/refunds/{id}/calculate", h.CalculateRefund)
	mux.HandleFunc("PUT /api/v1/terminations/refunds/{id}/payment", h.SetupRefundPayment)
	mux.HandleFunc("GET /api/v1/terminations/refunds/{id}/eligibility", h.CheckEligibility)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": serviceName,
		"version": "0.1.0",
	})
}

// --- Certification Handlers ---

func (h *Handler) CreateCertification(w http.ResponseWriter, r *http.Request) {
	var req etdb.CreateCertificationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.OrgID == "" || req.SSNHash == "" || req.FirstName == "" || req.LastName == "" ||
		req.LastDayWorked == "" || req.TerminationReason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"orgId, ssnHash, firstName, lastName, lastDayWorked, and terminationReason are required")
		return
	}

	if !domain.IsValidTerminationReason(req.TerminationReason) {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REASON",
			"terminationReason must be one of: RESIGNATION, RETIREMENT, LAYOFF, TERMINATION, DEATH, DISABILITY, OTHER")
		return
	}

	cert := &etdb.TerminationCertification{
		OrgID:                 req.OrgID,
		MemberID:              req.MemberID,
		SSNHash:               req.SSNHash,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		LastDayWorked:         req.LastDayWorked,
		TerminationReason:     req.TerminationReason,
		FinalContributionDate: req.FinalContributionDate,
		FinalSalaryAmount:     req.FinalSalaryAmount,
		CertificationStatus:   "SUBMITTED",
		SubmittedBy:           auth.TenantID(r.Context()),
		Notes:                 req.Notes,
	}

	if err := h.store.CreateCertification(r.Context(), cert); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create certification")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, cert)
}

func (h *Handler) GetCertification(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	cert, err := h.store.GetCertification(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Certification not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch certification")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, cert)
}

func (h *Handler) ListCertifications(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_ORG", "org_id query parameter is required")
		return
	}
	status := r.URL.Query().Get("status")
	limit, offset := parsePagination(r)

	certs, total, err := h.store.ListCertifications(r.Context(), orgID, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list certifications")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": certs, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) VerifyCertification(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	verifiedBy := auth.TenantID(r.Context())

	if err := h.store.VerifyCertification(r.Context(), id, verifiedBy); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Certification cannot be verified in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to verify certification")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "VERIFIED"})
}

func (h *Handler) RejectCertification(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Reason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_REASON", "reason is required")
		return
	}

	rejectedBy := auth.TenantID(r.Context())
	if err := h.store.RejectCertification(r.Context(), id, rejectedBy, req.Reason); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Certification cannot be rejected in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to reject certification")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "REJECTED"})
}

// --- Hold Handlers ---

func (h *Handler) ListHolds(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_ORG", "org_id query parameter is required")
		return
	}
	status := r.URL.Query().Get("status")
	limit, offset := parsePagination(r)

	holds, total, err := h.store.ListHolds(r.Context(), orgID, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list holds")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": holds, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) GetHold(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	hold, err := h.store.GetHold(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Hold not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch hold")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, hold)
}

func (h *Handler) ResolveHold(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req etdb.ResolveHoldRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}
	if req.CertificationID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_CERT", "certificationId is required")
		return
	}

	resolvedBy := auth.TenantID(r.Context())
	if err := h.store.ResolveHold(r.Context(), id, resolvedBy, req.Note, req.CertificationID); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Hold cannot be resolved in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to resolve hold")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "RESOLVED"})
}

func (h *Handler) EscalateHold(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if err := h.store.EscalateHold(r.Context(), id); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Hold cannot be escalated in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to escalate hold")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "ESCALATED"})
}

// --- Refund Handlers ---

func (h *Handler) CreateRefundApplication(w http.ResponseWriter, r *http.Request) {
	var req etdb.CreateRefundRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.SSNHash == "" || req.FirstName == "" || req.LastName == "" || req.HireDate == "" || req.EmployeeContributions == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"ssnHash, firstName, lastName, hireDate, and employeeContributions are required")
		return
	}

	app := &etdb.RefundApplication{
		MemberID:              req.MemberID,
		SSNHash:               req.SSNHash,
		FirstName:             req.FirstName,
		LastName:              req.LastName,
		HireDate:              req.HireDate,
		TerminationDate:       req.TerminationDate,
		SeparationDate:        req.SeparationDate,
		YearsOfService:        req.YearsOfService,
		IsVested:              req.IsVested,
		HasDisabilityApp:      req.HasDisabilityApp,
		DisabilityAppDate:     req.DisabilityAppDate,
		EmployeeContributions: req.EmployeeContributions,
		ApplicationStatus:     "DRAFT",
	}

	if err := h.store.CreateRefundApplication(r.Context(), app); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create refund application")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, app)
}

func (h *Handler) GetRefundApplication(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	app, err := h.store.GetRefundApplication(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Refund application not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch refund application")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, app)
}

func (h *Handler) ListRefundApplications(w http.ResponseWriter, r *http.Request) {
	ssnHash := r.URL.Query().Get("ssn_hash")
	if ssnHash == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_SSN", "ssn_hash query parameter is required")
		return
	}
	status := r.URL.Query().Get("status")
	limit, offset := parsePagination(r)

	apps, total, err := h.store.ListRefundApplications(r.Context(), ssnHash, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list refund applications")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": apps, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) CalculateRefund(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Fetch the application
	app, err := h.store.GetRefundApplication(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Refund application not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch refund application")
		return
	}

	// Parse request body for interest rate (may come from board-set rate table)
	var req struct {
		InterestRatePercent string `json:"interestRatePercent"`
		DRODeduction        string `json:"droDeduction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}
	if req.InterestRatePercent == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_RATE", "interestRatePercent is required")
		return
	}

	termDate := ""
	if app.TerminationDate != nil {
		termDate = *app.TerminationDate
	}
	if termDate == "" {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, serviceName, "NO_TERM_DATE",
			"Cannot calculate refund without termination date")
		return
	}

	droDeduction := "0.00"
	if req.DRODeduction != "" {
		droDeduction = req.DRODeduction
	}

	input := domain.RefundInput{
		EmployeeContributions: app.EmployeeContributions,
		InterestRatePercent:   req.InterestRatePercent,
		HireDate:              app.HireDate,
		TerminationDate:       termDate,
		DRODeduction:          droDeduction,
	}

	result, err := domain.CalculateRefund(input)
	if err != nil {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, serviceName, "CALC_FAILED", err.Error())
		return
	}

	// Persist the calculation
	if err := h.store.UpdateRefundCalculation(r.Context(), id,
		result.InterestRate, result.InterestAmount, result.GrossRefund,
		result.FederalTaxWithholding, result.DRODeduction, result.NetRefund,
	); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to save calculation")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, result)
}

func (h *Handler) SetupRefundPayment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req etdb.SetupPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if !domain.IsValidPaymentMethod(req.PaymentMethod) {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_METHOD",
			"paymentMethod must be one of: DIRECT_DEPOSIT, ROLLOVER, PARTIAL_ROLLOVER, CHECK")
		return
	}

	if err := h.store.SetupRefundPayment(r.Context(), id,
		req.PaymentMethod, req.RolloverAmount, req.DirectAmount,
		req.ACHRoutingNumber, req.ACHAccountNumber,
		req.RolloverInstitution, req.RolloverAccount,
	); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE",
			"Payment can only be set up after calculation is complete")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to set up payment")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "PAYMENT_SCHEDULED"})
}

func (h *Handler) CheckEligibility(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	app, err := h.store.GetRefundApplication(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Refund application not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch refund application")
		return
	}

	var yos float64
	if app.YearsOfService != nil {
		// Parse years of service as float for comparison
		fmt := *app.YearsOfService
		if f, err := strconv.ParseFloat(fmt, 64); err == nil {
			yos = f
		}
	}

	result := domain.CheckRefundEligibility(
		app.TerminationDate,
		app.SeparationDate,
		yos,
		app.IsVested,
		app.HasDisabilityApp,
		app.DisabilityAppDate,
		time.Now(),
	)

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
