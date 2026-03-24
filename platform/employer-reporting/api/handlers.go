// Package api implements HTTP handlers for the employer-reporting service.
package api

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/auth"
	erdb "github.com/noui/platform/employer-reporting/db"
	"github.com/noui/platform/employer-reporting/domain"
	"github.com/noui/platform/validation"
)

const serviceName = "employer-reporting"

// Handler holds dependencies for employer-reporting API handlers.
type Handler struct {
	store *erdb.Store
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(database *sql.DB) *Handler {
	return &Handler{store: erdb.NewStore(database)}
}

// RegisterRoutes sets up all employer-reporting API routes.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)

	// Files
	mux.HandleFunc("GET /api/v1/reporting/files", h.ListFiles)
	mux.HandleFunc("GET /api/v1/reporting/files/{fileId}", h.GetFile)
	mux.HandleFunc("GET /api/v1/reporting/files/{fileId}/records", h.ListRecords)
	mux.HandleFunc("DELETE /api/v1/reporting/files/{fileId}", h.DeleteFile)

	// Manual entry
	mux.HandleFunc("POST /api/v1/reporting/manual-entry", h.ManualEntry)

	// Exceptions
	mux.HandleFunc("GET /api/v1/reporting/exceptions", h.ListExceptions)
	mux.HandleFunc("GET /api/v1/reporting/exceptions/{id}", h.GetException)
	mux.HandleFunc("PUT /api/v1/reporting/exceptions/{id}/resolve", h.ResolveException)
	mux.HandleFunc("PUT /api/v1/reporting/exceptions/{id}/escalate", h.EscalateException)

	// Payments
	mux.HandleFunc("POST /api/v1/reporting/files/{fileId}/payment-setup", h.SetupPayment)
	mux.HandleFunc("GET /api/v1/reporting/payments", h.ListPayments)
	mux.HandleFunc("DELETE /api/v1/reporting/payments/{paymentId}", h.CancelPayment)

	// Corrections
	mux.HandleFunc("POST /api/v1/reporting/corrections", h.SubmitCorrection)

	// Late interest
	mux.HandleFunc("GET /api/v1/reporting/interest/{orgId}", h.GetInterest)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": serviceName,
		"version": "0.1.0",
	})
}

// --- File Handlers ---

func (h *Handler) ListFiles(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	files, total, err := h.store.ListFiles(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, serviceName, files, total, limit, offset)
}

func (h *Handler) GetFile(w http.ResponseWriter, r *http.Request) {
	fileID := r.PathValue("fileId")
	if fileID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "fileId is required")
		return
	}

	file, err := h.store.GetFile(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "file not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, file)
}

func (h *Handler) ListRecords(w http.ResponseWriter, r *http.Request) {
	fileID := r.PathValue("fileId")
	if fileID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "fileId is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 200)

	records, total, err := h.store.ListRecords(r.Context(), fileID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, serviceName, records, total, limit, offset)
}

func (h *Handler) DeleteFile(w http.ResponseWriter, r *http.Request) {
	fileID := r.PathValue("fileId")
	if fileID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "fileId is required")
		return
	}

	err := h.store.DeleteFile(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusConflict, serviceName, "CANNOT_DELETE", "file can only be deleted when in UPLOADED status")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, map[string]string{"deleted": fileID})
}

// --- Manual Entry ---

func (h *Handler) ManualEntry(w http.ResponseWriter, r *http.Request) {
	var req erdb.ManualEntryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "invalid request body")
		return
	}

	if req.OrgID == "" || req.PeriodStart == "" || req.PeriodEnd == "" || req.DivisionCode == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS", "orgId, periodStart, periodEnd, divisionCode are required")
		return
	}

	if len(req.Records) == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "NO_RECORDS", "at least one record is required")
		return
	}

	// Create the file record.
	file := &erdb.ContributionFile{
		OrgID:        req.OrgID,
		UploadedBy:   userIDOrDefault(r),
		FileName:     "manual-entry",
		FileType:     "MANUAL_ENTRY",
		FileStatus:   "VALIDATING",
		PeriodStart:  req.PeriodStart,
		PeriodEnd:    req.PeriodEnd,
		DivisionCode: req.DivisionCode,
	}

	if err := h.store.CreateFile(r.Context(), file); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	// Convert manual entries to records.
	var records []erdb.ContributionRecord
	for i, entry := range req.Records {
		total := sumAmounts(entry)
		records = append(records, erdb.ContributionRecord{
			FileID:               file.ID,
			RowNumber:            i + 1,
			SSNHash:              entry.SSNHash,
			MemberName:           strPtr(entry.MemberName),
			DivisionCode:         req.DivisionCode,
			IsSafetyOfficer:      entry.IsSafetyOfficer,
			IsORP:                entry.IsORP,
			GrossSalary:          entry.GrossSalary,
			MemberContribution:   entry.MemberContribution,
			EmployerContribution: entry.EmployerContribution,
			AEDAmount:            entry.AEDAmount,
			SAEDAmount:           entry.SAEDAmount,
			AAPAmount:            entry.AAPAmount,
			DCSupplementAmount:   entry.DCSupplementAmount,
			TotalAmount:          total,
		})
	}

	if err := h.store.CreateRecords(r.Context(), records); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	// Validate records against rate table.
	validCount, failedCount := 0, 0
	for i := range records {
		rec := &records[i]
		rateRow, err := h.store.LookupRate(r.Context(), rec.DivisionCode, rec.IsSafetyOfficer, req.PeriodStart)
		if err != nil {
			// No rate found — create exception.
			failedCount++
			_ = h.store.UpdateRecordStatus(r.Context(), rec.ID, "FAILED", strPtr("rate lookup failed"))
			exc := &erdb.ContributionException{
				FileID:          file.ID,
				RecordID:        &rec.ID,
				OrgID:           req.OrgID,
				ExceptionType:   domain.ExTypeRateMismatch,
				ExceptionStatus: "UNRESOLVED",
				Description:     "No matching rate found for division/date",
			}
			_ = h.store.CreateException(r.Context(), exc)
			continue
		}

		// Run validation.
		negErrors := domain.ValidateNegativeAmounts(domain.RecordInput{
			GrossSalary:          rec.GrossSalary,
			MemberContribution:   rec.MemberContribution,
			EmployerContribution: rec.EmployerContribution,
			AEDAmount:            rec.AEDAmount,
			SAEDAmount:           rec.SAEDAmount,
			AAPAmount:            rec.AAPAmount,
			DCSupplementAmount:   rec.DCSupplementAmount,
			TotalAmount:          rec.TotalAmount,
			IsORP:                rec.IsORP,
		})

		rateErrors := domain.ValidateRecord(domain.RecordInput{
			GrossSalary:          rec.GrossSalary,
			MemberContribution:   rec.MemberContribution,
			EmployerContribution: rec.EmployerContribution,
			AEDAmount:            rec.AEDAmount,
			SAEDAmount:           rec.SAEDAmount,
			AAPAmount:            rec.AAPAmount,
			DCSupplementAmount:   rec.DCSupplementAmount,
			TotalAmount:          rec.TotalAmount,
			IsORP:                rec.IsORP,
		}, domain.RateInput{
			MemberRate:        rateRow.MemberRate,
			EmployerBaseRate:  rateRow.EmployerBaseRate,
			AEDRate:           rateRow.AEDRate,
			SAEDRate:          rateRow.SAEDRate,
			AAPRate:           rateRow.AAPRate,
			DCSupplementRate:  rateRow.DCSupplementRate,
			EmployerTotalRate: rateRow.EmployerTotalRate,
		})

		allErrors := append(negErrors, rateErrors...)

		if len(allErrors) == 0 {
			validCount++
			_ = h.store.UpdateRecordStatus(r.Context(), rec.ID, "VALID", nil)
		} else {
			failedCount++
			errJSON, _ := json.Marshal(allErrors)
			errStr := string(errJSON)
			_ = h.store.UpdateRecordStatus(r.Context(), rec.ID, "FAILED", &errStr)

			// Create exceptions for each error.
			for _, ve := range allErrors {
				exType, desc := domain.ExceptionFromValidationError(ve)
				exc := &erdb.ContributionException{
					FileID:          file.ID,
					RecordID:        &rec.ID,
					OrgID:           req.OrgID,
					ExceptionType:   exType,
					ExceptionStatus: "UNRESOLVED",
					Description:     desc,
					ExpectedValue:   strPtrNonEmpty(ve.ExpectedValue),
					SubmittedValue:  strPtrNonEmpty(ve.SubmittedValue),
				}
				_ = h.store.CreateException(r.Context(), exc)
			}
		}
	}

	// Update file status.
	status := "VALIDATED"
	if failedCount > 0 && validCount > 0 {
		status = "PARTIAL_POST"
	} else if failedCount > 0 && validCount == 0 {
		status = "EXCEPTION"
	}

	_ = h.store.UpdateFileStatus(r.Context(), file.ID, status,
		len(records), validCount, failedCount, "0.00", "0.00")

	// Re-read file for response.
	updatedFile, _ := h.store.GetFile(r.Context(), file.ID)
	if updatedFile == nil {
		updatedFile = file
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, updatedFile)
}

// --- Exception Handlers ---

func (h *Handler) ListExceptions(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	status := r.URL.Query().Get("status")
	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	exceptions, total, err := h.store.ListExceptions(r.Context(), orgID, status, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, serviceName, exceptions, total, limit, offset)
}

func (h *Handler) GetException(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "id is required")
		return
	}

	exc, err := h.store.GetException(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "exception not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, exc)
}

func (h *Handler) ResolveException(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "id is required")
		return
	}

	var req erdb.ResolveExceptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "invalid request body")
		return
	}

	if req.Note == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_NOTE", "resolution note is required")
		return
	}

	err := h.store.ResolveException(r.Context(), id, userIDOrDefault(r), req.Note)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "exception not found or already resolved")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, map[string]string{"resolved": id})
}

func (h *Handler) EscalateException(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "id is required")
		return
	}

	err := h.store.EscalateException(r.Context(), id)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "exception not found or cannot be escalated")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, map[string]string{"escalated": id})
}

// --- Payment Handlers ---

func (h *Handler) SetupPayment(w http.ResponseWriter, r *http.Request) {
	fileID := r.PathValue("fileId")
	if fileID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "fileId is required")
		return
	}

	var req erdb.SetupPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "invalid request body")
		return
	}

	if err := domain.ValidatePaymentMethod(req.Method); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_METHOD", err.Error())
		return
	}

	// Look up the file to get org_id and validated amount.
	file, err := h.store.GetFile(r.Context(), fileID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusNotFound, serviceName, "NOT_FOUND", "file not found")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	payment := &erdb.ContributionPayment{
		FileID:        fileID,
		OrgID:         file.OrgID,
		PaymentMethod: req.Method,
		PaymentStatus: "PENDING",
		Amount:        file.ValidatedAmount,
	}

	if err := h.store.CreatePayment(r.Context(), payment); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	// Update file status.
	_ = h.store.UpdateFileStatus(r.Context(), fileID, "PAYMENT_SETUP",
		file.TotalRecords, file.ValidRecords, file.FailedRecords,
		file.TotalAmount, file.ValidatedAmount)

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, payment)
}

func (h *Handler) ListPayments(w http.ResponseWriter, r *http.Request) {
	orgID := r.URL.Query().Get("org_id")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "org_id query parameter is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	payments, total, err := h.store.ListPayments(r.Context(), orgID, limit, offset)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WritePaginated(w, serviceName, payments, total, limit, offset)
}

func (h *Handler) CancelPayment(w http.ResponseWriter, r *http.Request) {
	paymentID := r.PathValue("paymentId")
	if paymentID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "paymentId is required")
		return
	}

	err := h.store.CancelPayment(r.Context(), paymentID)
	if err != nil {
		if err == sql.ErrNoRows {
			apiresponse.WriteError(w, http.StatusConflict, serviceName, "CANNOT_CANCEL", "payment can only be cancelled when PENDING")
			return
		}
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, map[string]string{"cancelled": paymentID})
}

// --- Correction Handler ---

func (h *Handler) SubmitCorrection(w http.ResponseWriter, r *http.Request) {
	var req erdb.CorrectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_JSON", "invalid request body")
		return
	}

	if req.OrgID == "" || req.OriginalFileID == "" || req.PeriodStart == "" || req.PeriodEnd == "" || req.DivisionCode == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "MISSING_FIELDS", "all fields are required")
		return
	}

	// Create correction file that references the original.
	file := &erdb.ContributionFile{
		OrgID:          req.OrgID,
		UploadedBy:     auth.UserID(r.Context()),
		FileName:       "correction",
		FileType:       "MANUAL_ENTRY",
		FileStatus:     "UPLOADED",
		PeriodStart:    req.PeriodStart,
		PeriodEnd:      req.PeriodEnd,
		DivisionCode:   req.DivisionCode,
		ReplacesFileID: &req.OriginalFileID,
	}

	if err := h.store.CreateFile(r.Context(), file); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, file)
}

// --- Late Interest Handler ---

func (h *Handler) GetInterest(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, serviceName, "INVALID_REQUEST", "orgId is required")
		return
	}

	accruals, err := h.store.ListInterest(r.Context(), orgID)
	if err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, serviceName, "DB_ERROR", err.Error())
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, serviceName, accruals)
}

// --- Helpers ---

func intParam(r *http.Request, key string, defaultVal int) int {
	s := r.URL.Query().Get(key)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func strPtrNonEmpty(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// defaultUserID is used when the JWT sub claim is absent or not a valid UUID
// to avoid PostgreSQL rejecting it on UUID-typed columns.
const defaultUserID = "00000000-0000-0000-0000-000000000001"

// uuidLen is 36: 8-4-4-4-12 hex digits with hyphens.
func isUUID(s string) bool {
	if len(s) != 36 {
		return false
	}
	for i, c := range s {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
		} else if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func userIDOrDefault(r *http.Request) string {
	if uid := auth.UserID(r.Context()); uid != "" && isUUID(uid) {
		return uid
	}
	return defaultUserID
}

func sumAmounts(entry erdb.ManualEntryRecord) string {
	member, _ := strconv.ParseFloat(entry.MemberContribution, 64)
	employer, _ := strconv.ParseFloat(entry.EmployerContribution, 64)
	aed, _ := strconv.ParseFloat(entry.AEDAmount, 64)
	saed, _ := strconv.ParseFloat(entry.SAEDAmount, 64)
	aap, _ := strconv.ParseFloat(entry.AAPAmount, 64)
	dcSupp, _ := strconv.ParseFloat(entry.DCSupplementAmount, 64)
	total := member + employer + aed + saed + aap + dcSupp
	return strconv.FormatFloat(total, 'f', 2, 64)
}
