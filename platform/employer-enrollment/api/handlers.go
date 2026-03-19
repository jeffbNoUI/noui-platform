// Package api implements HTTP handlers for the employer-enrollment service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	eedb "github.com/noui/platform/employer-enrollment/db"
	"github.com/noui/platform/employer-enrollment/domain"
	"github.com/noui/platform/validation"
)

const serviceName = "employer-enrollment"

// Handler holds dependencies for employer-enrollment API handlers.
type Handler struct {
	store *eedb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: eedb.NewStore(database)}
}

// RegisterRoutes sets up all employer-enrollment API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Submissions
	mux.HandleFunc("POST /api/v1/enrollment/submissions", h.CreateSubmission)
	mux.HandleFunc("GET /api/v1/enrollment/submissions", h.ListSubmissions)
	mux.HandleFunc("GET /api/v1/enrollment/submissions/{id}", h.GetSubmission)
	mux.HandleFunc("PUT /api/v1/enrollment/submissions/{id}/submit", h.SubmitForValidation)
	mux.HandleFunc("PUT /api/v1/enrollment/submissions/{id}/approve", h.ApproveSubmission)
	mux.HandleFunc("PUT /api/v1/enrollment/submissions/{id}/reject", h.RejectSubmission)

	// Duplicates
	mux.HandleFunc("GET /api/v1/enrollment/duplicates", h.ListPendingDuplicates)
	mux.HandleFunc("GET /api/v1/enrollment/submissions/{id}/duplicates", h.ListSubmissionDuplicates)
	mux.HandleFunc("PUT /api/v1/enrollment/duplicates/{id}/resolve", h.ResolveDuplicate)

	// PERAChoice
	mux.HandleFunc("GET /api/v1/enrollment/perachoice", h.ListPERAChoicePending)
	mux.HandleFunc("GET /api/v1/enrollment/perachoice/{id}", h.GetPERAChoiceElection)
	mux.HandleFunc("PUT /api/v1/enrollment/perachoice/{id}/elect", h.ElectPERAChoice)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": serviceName,
		"version": "0.1.0",
	})
}

// --- Submission Handlers ---

func (h *Handler) CreateSubmission(w http.ResponseWriter, r *http.Request) {
	var req eedb.CreateSubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	// Validate mandatory fields
	validationErrs := domain.ValidateSubmission(
		req.SSNHash, req.FirstName, req.LastName,
		req.DateOfBirth, req.HireDate, req.PlanCode, req.DivisionCode,
	)
	if len(validationErrs) > 0 {
		apiresponse.WriteJSON(w, http.StatusUnprocessableEntity, map[string]interface{}{
			"error":            "VALIDATION_FAILED",
			"service":          serviceName,
			"validationErrors": validationErrs,
		})
		return
	}

	// Validate enrollment type
	if !domain.ValidEnrollmentType(req.EnrollmentType) {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_ENROLLMENT_TYPE",
			"Enrollment type must be EMPLOYER_INITIATED, MEMBER_INITIATED, or REHIRE")
		return
	}

	// Assign tier from hire date
	tier, err := domain.AssignTier(req.HireDate, req.PlanCode)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_HIRE_DATE", err.Error())
		return
	}

	var tierPtr *string
	if tier != "" {
		tierPtr = &tier
	}

	sub := &eedb.EnrollmentSubmission{
		OrgID:            req.OrgID,
		SubmittedBy:      auth.TenantID(r.Context()),
		EnrollmentType:   req.EnrollmentType,
		SubmissionStatus: "DRAFT",
		SSNHash:          req.SSNHash,
		FirstName:        req.FirstName,
		LastName:         req.LastName,
		DateOfBirth:      req.DateOfBirth,
		HireDate:         req.HireDate,
		PlanCode:         req.PlanCode,
		DivisionCode:     req.DivisionCode,
		Tier:             tierPtr,
		MiddleName:       req.MiddleName,
		Suffix:           req.Suffix,
		Gender:           req.Gender,
		AddressLine1:     req.AddressLine1,
		AddressLine2:     req.AddressLine2,
		City:             req.City,
		State:            req.State,
		ZipCode:          req.ZipCode,
		Email:            req.Email,
		Phone:            req.Phone,
		IsSafetyOfficer:  req.IsSafetyOfficer,
		JobTitle:         req.JobTitle,
		AnnualSalary:     req.AnnualSalary,
		IsRehire:         req.IsRehire,
		PriorMemberID:    req.PriorMemberID,
		PriorRefundTaken: req.PriorRefundTaken,
	}

	if err := h.store.CreateSubmission(r.Context(), sub); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "CREATE_FAILED", "Failed to create enrollment submission")
		return
	}

	apiresponse.WriteJSON(w, http.StatusCreated, sub)
}

func (h *Handler) ListSubmissions(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	status := r.URL.Query().Get("status")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	subs, total, err := h.store.ListSubmissions(r.Context(), orgID, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list submissions")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": subs,
		"total": total,
	})
}

func (h *Handler) GetSubmission(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	sub, err := h.store.GetSubmission(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Submission not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "GET_FAILED", "Failed to get submission")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, sub)
}

func (h *Handler) SubmitForValidation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	// Move to SUBMITTED, which triggers validation pipeline
	if err := h.store.UpdateSubmissionStatus(r.Context(), id, "SUBMITTED"); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Submission not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "UPDATE_FAILED", "Failed to submit")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "SUBMITTED"})
}

func (h *Handler) ApproveSubmission(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	approvedBy := auth.TenantID(r.Context())

	if err := h.store.ApproveSubmission(r.Context(), id, approvedBy); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Submission not found or not in approvable state")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "APPROVE_FAILED", "Failed to approve submission")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "APPROVED"})
}

func (h *Handler) RejectSubmission(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	rejectedBy := auth.TenantID(r.Context())

	var req eedb.RejectSubmissionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}
	if req.Reason == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_REASON", "Rejection reason is required")
		return
	}

	if err := h.store.RejectSubmission(r.Context(), id, rejectedBy, req.Reason); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Submission not found or already finalized")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "REJECT_FAILED", "Failed to reject submission")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": "REJECTED"})
}

// --- Duplicate Handlers ---

func (h *Handler) ListPendingDuplicates(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	flags, total, err := h.store.ListPendingDuplicates(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list duplicates")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": flags,
		"total": total,
	})
}

func (h *Handler) ListSubmissionDuplicates(w http.ResponseWriter, r *http.Request) {
	submissionID := r.PathValue("id")

	flags, err := h.store.ListDuplicateFlags(r.Context(), submissionID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list duplicate flags")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": flags,
		"total": len(flags),
	})
}

func (h *Handler) ResolveDuplicate(w http.ResponseWriter, r *http.Request) {
	flagID := r.PathValue("id")
	resolvedBy := auth.TenantID(r.Context())

	var req eedb.ResolveDuplicateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.Resolution != "CONFIRMED_DUPLICATE" && req.Resolution != "FALSE_POSITIVE" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_RESOLUTION",
			"Resolution must be CONFIRMED_DUPLICATE or FALSE_POSITIVE")
		return
	}

	if err := h.store.ResolveDuplicateFlag(r.Context(), flagID, req.Resolution, resolvedBy, req.Note); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "Duplicate flag not found or already resolved")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "RESOLVE_FAILED", "Failed to resolve duplicate")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": req.Resolution})
}

// --- PERAChoice Handlers ---

func (h *Handler) ListPERAChoicePending(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	elections, total, err := h.store.ListPERAChoicePending(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "LIST_FAILED", "Failed to list PERAChoice elections")
		return
	}

	apiresponse.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"items": elections,
		"total": total,
	})
}

func (h *Handler) GetPERAChoiceElection(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	election, err := h.store.GetPERAChoiceElection(r.Context(), id)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "PERAChoice election not found")
		return
	}
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "GET_FAILED", "Failed to get PERAChoice election")
		return
	}
	apiresponse.WriteJSON(w, http.StatusOK, election)
}

func (h *Handler) ElectPERAChoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")

	var req eedb.ElectPERAChoiceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "Invalid JSON body")
		return
	}

	if req.Plan != "DB" && req.Plan != "DC" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_PLAN", "Plan must be DB or DC")
		return
	}

	if err := h.store.ElectPERAChoice(r.Context(), id, req.Plan); err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "PERAChoice election not found or already decided")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "ELECT_FAILED", "Failed to record PERAChoice election")
		return
	}

	status := "ELECTED_DC"
	if req.Plan == "DB" {
		status = "WAIVED"
	}
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{"status": status})
}

// --- Helpers ---

func intParam(r *http.Request, key string, def int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return def
	}
	v, err := strconv.Atoi(s)
	if err != nil || v < 0 {
		return def
	}
	return v
}
