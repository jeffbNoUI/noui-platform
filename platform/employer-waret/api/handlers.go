// Package api implements HTTP handlers for the employer-waret service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	ewdb "github.com/noui/platform/employer-waret/db"
	"github.com/noui/platform/employer-waret/domain"
)

const serviceName = "employer-waret"

// Handler holds dependencies for employer-waret API handlers.
type Handler struct {
	store *ewdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: ewdb.NewStore(database)}
}

// RegisterRoutes sets up all employer-waret API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Designations
	mux.HandleFunc("POST /api/v1/waret/designations", h.CreateDesignation)
	mux.HandleFunc("GET /api/v1/waret/designations", h.ListDesignations)
	mux.HandleFunc("GET /api/v1/waret/designations/{id}", h.GetDesignation)
	mux.HandleFunc("PUT /api/v1/waret/designations/{id}/approve", h.ApproveDesignation)
	mux.HandleFunc("PUT /api/v1/waret/designations/{id}/revoke", h.RevokeDesignation)

	// Tracking
	mux.HandleFunc("POST /api/v1/waret/tracking", h.RecordWorkDay)
	mux.HandleFunc("GET /api/v1/waret/tracking", h.ListTracking)
	mux.HandleFunc("GET /api/v1/waret/tracking/summary/{designationId}", h.GetYTDSummary)

	// Penalties
	mux.HandleFunc("POST /api/v1/waret/penalties", h.AssessPenalty)
	mux.HandleFunc("GET /api/v1/waret/penalties", h.ListPenalties)
	mux.HandleFunc("PUT /api/v1/waret/penalties/{id}/appeal", h.AppealPenalty)
	mux.HandleFunc("PUT /api/v1/waret/penalties/{id}/waive", h.WaivePenalty)

	// IC Disclosures
	mux.HandleFunc("POST /api/v1/waret/disclosures", h.CreateICDisclosure)
	mux.HandleFunc("GET /api/v1/waret/disclosures", h.ListICDisclosures)

	// PERACare
	mux.HandleFunc("POST /api/v1/waret/designations/{id}/peracare-check", h.CheckPERACare)
	mux.HandleFunc("PUT /api/v1/waret/designations/{id}/peracare-resolve", h.ResolvePERACare)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": serviceName,
		"version": "0.1.0",
	})
}

// --- Designation Handlers ---

func (h *Handler) CreateDesignation(w http.ResponseWriter, r *http.Request) {
	var req ewdb.CreateDesignationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.OrgID == "" || req.SSNHash == "" || req.FirstName == "" || req.LastName == "" ||
		req.DesignationType == "" || req.CalendarYear == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"orgId, ssnHash, firstName, lastName, designationType, and calendarYear are required")
		return
	}

	if !domain.ValidDesignationTypes[req.DesignationType] {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_TYPE",
			"designationType must be STANDARD, 140_DAY, or CRITICAL_SHORTAGE")
		return
	}

	// Check 140-day district capacity
	districtCount := 0
	if req.DesignationType == domain.Designation140Day {
		if req.DistrictID == nil || *req.DistrictID == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_DISTRICT",
				"districtId is required for 140-day designations")
			return
		}
		var err error
		districtCount, err = h.store.Count140DayInDistrict(r.Context(), *req.DistrictID, req.CalendarYear)
		if err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", "Failed to check district capacity")
			return
		}
	}

	// Check consecutive years
	consecutiveYears, err := h.store.CountConsecutiveYears(r.Context(), req.OrgID, req.SSNHash, req.CalendarYear)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", "Failed to check consecutive years")
		return
	}

	// Validate
	validation := domain.ValidateDesignation(
		req.DesignationType,
		req.DistrictID,
		consecutiveYears,
		districtCount,
		req.ORPExempt,
	)
	if !validation.Valid {
		apiresponse.WriteJSON(w, http.StatusUnprocessableEntity, validation)
		return
	}

	// Get limits for the type
	dayLimit, hourLimit := domain.GetLimitsForType(req.DesignationType)

	desig := &ewdb.WaretDesignation{
		OrgID:             req.OrgID,
		RetireeID:         req.RetireeID,
		SSNHash:           req.SSNHash,
		FirstName:         req.FirstName,
		LastName:          req.LastName,
		DesignationType:   req.DesignationType,
		CalendarYear:      req.CalendarYear,
		DayLimit:          dayLimit,
		HourLimit:         hourLimit,
		ConsecutiveYears:  consecutiveYears + 1,
		DistrictID:        req.DistrictID,
		ORPExempt:         req.ORPExempt,
		DesignationStatus: "PENDING",
		Notes:             req.Notes,
	}

	if err := h.store.CreateDesignation(r.Context(), desig); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create designation")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, desig)
}

func (h *Handler) GetDesignation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	desig, err := h.store.GetDesignation(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Designation not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch designation")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, desig)
}

func (h *Handler) ListDesignations(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_ORG", "org_id query parameter is required")
		return
	}
	year := 0
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}
	status := r.URL.Query().Get("status")
	limit, offset := parsePagination(r)

	designations, total, err := h.store.ListDesignations(r.Context(), orgID, year, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list designations")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": designations, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) ApproveDesignation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	approvedBy := auth.TenantID(r.Context())

	if err := h.store.ApproveDesignation(r.Context(), id, approvedBy); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Designation cannot be approved in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to approve designation")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "APPROVED"})
}

func (h *Handler) RevokeDesignation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Reason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_REASON", "reason is required")
		return
	}

	revokedBy := auth.TenantID(r.Context())
	if err := h.store.RevokeDesignation(r.Context(), id, revokedBy, req.Reason); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Designation cannot be revoked in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to revoke designation")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "REVOKED"})
}

// --- Tracking Handlers ---

func (h *Handler) RecordWorkDay(w http.ResponseWriter, r *http.Request) {
	var req ewdb.RecordTrackingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.DesignationID == "" || req.OrgID == "" || req.WorkDate == "" || req.HoursWorked == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"designationId, orgId, workDate, and hoursWorked are required")
		return
	}

	// Get the designation to know limits
	desig, err := h.store.GetDesignation(r.Context(), req.DesignationID)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Designation not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch designation")
		return
	}

	// Get current YTD from the view
	summary, err := h.store.GetYTDSummary(r.Context(), req.DesignationID)
	currentDays := 0
	currentHours := "0.00"
	if err == nil {
		currentDays = summary.TotalDays
		currentHours = summary.TotalHours
	}

	// Process the work day
	result, err := domain.ProcessWorkDay(
		req.HoursWorked,
		currentDays,
		currentHours,
		desig.DayLimit,
		desig.HourLimit,
		desig.ORPExempt,
	)
	if err != nil {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, serviceName, "INVALID_INPUT", err.Error())
		return
	}

	track := &ewdb.WaretTracking{
		DesignationID: req.DesignationID,
		OrgID:         req.OrgID,
		RetireeID:     req.RetireeID,
		WorkDate:      req.WorkDate,
		HoursWorked:   result.HoursWorked,
		CountsAsDay:   result.CountsAsDay,
		YTDDays:       result.NewYTDDays,
		YTDHours:      result.NewYTDHours,
		EntryStatus:   "RECORDED",
		SubmittedBy:   auth.TenantID(r.Context()),
		Notes:         req.Notes,
	}

	if err := h.store.CreateTracking(r.Context(), track); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to record work day")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, map[string]interface{}{
		"tracking": track,
		"limits":   result,
	})
}

func (h *Handler) ListTracking(w http.ResponseWriter, r *http.Request) {
	designationID := r.URL.Query().Get("designation_id")
	if designationID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_DESIG", "designation_id query parameter is required")
		return
	}
	limit, offset := parsePagination(r)

	records, total, err := h.store.ListTracking(r.Context(), designationID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list tracking records")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": records, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) GetYTDSummary(w http.ResponseWriter, r *http.Request) {
	designationID := r.PathValue("designationId")
	summary, err := h.store.GetYTDSummary(r.Context(), designationID)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Designation not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to get YTD summary")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, summary)
}

// --- Penalty Handlers ---

func (h *Handler) AssessPenalty(w http.ResponseWriter, r *http.Request) {
	var req ewdb.AssessPenaltyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.DesignationID == "" || req.SSNHash == "" || req.PenaltyType == "" ||
		req.PenaltyMonth == "" || req.MonthlyBenefit == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"designationId, ssnHash, penaltyType, penaltyMonth, and monthlyBenefit are required")
		return
	}

	result, err := domain.CalculatePenalty(domain.PenaltyInput{
		PenaltyType:    req.PenaltyType,
		MonthlyBenefit: req.MonthlyBenefit,
		DaysOverLimit:  req.DaysOverLimit,
		SpreadMonths:   req.SpreadMonths,
	})
	if err != nil {
		apiresponse.WriteError(w, http.StatusUnprocessableEntity, serviceName, "CALC_FAILED", err.Error())
		return
	}

	assessedBy := auth.TenantID(r.Context())
	penalty := &ewdb.WaretPenalty{
		DesignationID:    req.DesignationID,
		RetireeID:        req.RetireeID,
		SSNHash:          req.SSNHash,
		PenaltyType:      result.PenaltyType,
		PenaltyMonth:     req.PenaltyMonth,
		MonthlyBenefit:   result.MonthlyBenefit,
		DaysOverLimit:    result.DaysOverLimit,
		PenaltyRate:      result.PenaltyRate,
		PenaltyAmount:    result.PenaltyAmount,
		EmployerRecovery: result.EmployerRecovery,
		RetireeRecovery:  result.RetireeRecovery,
		SpreadMonths:     result.SpreadMonths,
		MonthlyDeduction: result.MonthlyDeduction,
		PenaltyStatus:    "ASSESSED",
		AssessedBy:       &assessedBy,
	}

	if err := h.store.CreatePenalty(r.Context(), penalty); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to assess penalty")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, penalty)
}

func (h *Handler) ListPenalties(w http.ResponseWriter, r *http.Request) {
	designationID := r.URL.Query().Get("designation_id")
	if designationID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_DESIG", "designation_id query parameter is required")
		return
	}
	limit, offset := parsePagination(r)

	penalties, total, err := h.store.ListPenalties(r.Context(), designationID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list penalties")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": penalties, "total": total, "limit": limit, "offset": offset,
	})
}

func (h *Handler) AppealPenalty(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Note string `json:"note"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Note == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_NOTE", "note is required for appeal")
		return
	}

	if err := h.store.AppealPenalty(r.Context(), id, req.Note); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Penalty cannot be appealed in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to appeal penalty")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "APPEALED"})
}

func (h *Handler) WaivePenalty(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Reason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_REASON", "reason is required")
		return
	}

	waivedBy := auth.TenantID(r.Context())
	if err := h.store.WaivePenalty(r.Context(), id, waivedBy, req.Reason); err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusConflict, serviceName, "INVALID_STATE", "Penalty cannot be waived in its current state")
		return
	} else if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to waive penalty")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "WAIVED"})
}

// --- IC Disclosure Handlers ---

func (h *Handler) CreateICDisclosure(w http.ResponseWriter, r *http.Request) {
	var req ewdb.CreateICDisclosureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.SSNHash == "" || req.OrgID == "" || req.CalendarYear == 0 || req.ICStartDate == "" || req.ICDescription == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS",
			"ssnHash, orgId, calendarYear, icStartDate, and icDescription are required")
		return
	}

	disc := &ewdb.WaretICDisclosure{
		RetireeID:             req.RetireeID,
		SSNHash:               req.SSNHash,
		OrgID:                 req.OrgID,
		CalendarYear:          req.CalendarYear,
		ICStartDate:           req.ICStartDate,
		ICEndDate:             req.ICEndDate,
		ICDescription:         req.ICDescription,
		EstimatedHours:        req.EstimatedHours,
		EstimatedCompensation: req.EstimatedCompensation,
		DisclosureStatus:      "SUBMITTED",
	}

	if err := h.store.CreateICDisclosure(r.Context(), disc); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create disclosure")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, disc)
}

func (h *Handler) ListICDisclosures(w http.ResponseWriter, r *http.Request) {
	ssnHash := r.URL.Query().Get("ssn_hash")
	if ssnHash == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_SSN", "ssn_hash query parameter is required")
		return
	}
	year := 0
	if y := r.URL.Query().Get("year"); y != "" {
		if parsed, err := strconv.Atoi(y); err == nil {
			year = parsed
		}
	}
	limit, offset := parsePagination(r)

	disclosures, total, err := h.store.ListICDisclosures(r.Context(), ssnHash, year, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list disclosures")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": disclosures, "total": total, "limit": limit, "offset": offset,
	})
}

// --- PERACare Handlers ---

func (h *Handler) CheckPERACare(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	desig, err := h.store.GetDesignation(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Designation not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "FETCH_FAILED", "Failed to fetch designation")
		return
	}

	// Read has_active_subsidy from request body
	var req struct {
		HasActiveSubsidy bool `json:"hasActiveSubsidy"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	result := domain.CheckPERACareConflict(desig.DesignationType, req.HasActiveSubsidy, time.Now())

	if result.HasConflict && result.ResponseDue != nil {
		if err := h.store.SetPERACareConflict(r.Context(), id, *result.ResponseDue); err != nil {
			apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to set PERACare conflict")
			return
		}
	}

	apiresponse.WriteJSON(w, http.StatusOK, result)
}

func (h *Handler) ResolvePERACare(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	if err := h.store.ResolvePERACareConflict(r.Context(), id); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to resolve PERACare conflict")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "RESOLVED"})
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
