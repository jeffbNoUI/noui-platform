package api

import (
	"database/sql"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/noui/platform/dataaccess/ecm"
	"github.com/noui/platform/dataaccess/models"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/validation"
)

// maxUploadSize is the maximum file size for document uploads (25 MB).
const maxUploadSize = 25 << 20

// allowedContentTypes maps file extensions to expected MIME prefixes.
var allowedContentTypes = map[string]bool{
	"application/pdf":    true,
	"image/jpeg":         true,
	"image/png":          true,
	"image/tiff":         true,
	"image/heic":         true,
	"application/msword": true,
	"application/vnd.openxmlformats-officedocument.wordprocessingml.document": true,
	"application/vnd.ms-excel": true,
	"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
	"application/octet-stream": true, // fallback for browsers
}

// allowedExtensions lists permitted file extensions.
var allowedExtensions = map[string]bool{
	".pdf": true, ".jpg": true, ".jpeg": true, ".png": true,
	".tiff": true, ".heic": true, ".doc": true, ".docx": true,
	".xls": true, ".xlsx": true,
}

// UploadDocument handles multipart file upload, stores in ECM, records metadata in DB.
// POST /api/v1/issues/{id}/documents
func (h *Handler) UploadDocument(w http.ResponseWriter, r *http.Request) {
	issueID := parsePathID(r, "issues")
	if issueID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ISSUE_ID", "Issue ID is required")
		return
	}

	memberIDStr := r.URL.Query().Get("member_id")
	if memberIDStr == "" {
		writeError(w, http.StatusBadRequest, "MISSING_MEMBER_ID", "member_id query parameter is required")
		return
	}
	memberID, err := strconv.Atoi(memberIDStr)
	if err != nil || memberID <= 0 {
		writeError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "member_id must be a positive integer")
		return
	}

	documentType := r.URL.Query().Get("document_type")
	if documentType == "" {
		documentType = "general"
	}

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize+1024) // small overhead for multipart headers

	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "File exceeds maximum size of 25 MB")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "MISSING_FILE", "file form field is required")
		return
	}
	defer file.Close()

	// Validate file extension
	fileName := header.Filename
	ext := strings.ToLower(fileExtension(fileName))
	if !allowedExtensions[ext] {
		writeError(w, http.StatusBadRequest, "INVALID_FILE_TYPE",
			"File type not allowed. Accepted: PDF, JPG, JPEG, PNG, TIFF, HEIC, DOC, DOCX, XLS, XLSX")
		return
	}

	// Validate file size
	if header.Size > maxUploadSize {
		writeError(w, http.StatusBadRequest, "FILE_TOO_LARGE", "File exceeds maximum size of 25 MB")
		return
	}

	// Read file content
	fileBytes, err := io.ReadAll(file)
	if err != nil {
		slog.Error("error reading uploaded file", "error", err)
		writeError(w, http.StatusInternalServerError, "READ_ERROR", "Failed to read uploaded file")
		return
	}

	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// Ingest into ECM
	metadata := ecm.DocumentMetadata{
		MemberID:     strconv.Itoa(memberID),
		DocumentType: documentType,
		FileName:     fileName,
		ContentType:  contentType,
		UploadedBy:   "portal", // TODO: extract from auth context when wired
	}

	ref, err := h.ECM.Ingest(r.Context(), fileBytes, metadata)
	if err != nil {
		slog.Error("ecm ingest failed", "error", err, "member_id", memberID, "file_name", fileName)
		writeError(w, http.StatusInternalServerError, "ECM_ERROR", "Failed to store document")
		return
	}

	// Store metadata in database
	docID := uuid.New().String()
	now := time.Now().UTC()

	query := `
		INSERT INTO documents (document_id, member_id, issue_id, document_type,
		                       file_name, content_type, file_size_bytes, ecm_ref,
		                       status, uploaded_by, uploaded_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING document_id`

	err = dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), query,
		docID, memberID, issueID, documentType,
		fileName, contentType, header.Size, ref.ID,
		"received", metadata.UploadedBy, now,
	).Scan(&docID)
	if err != nil {
		slog.Error("error inserting document metadata", "error", err, "ecm_ref", ref.ID)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Failed to store document metadata")
		return
	}

	doc := models.Document{
		DocumentID:    docID,
		MemberID:      memberID,
		IssueID:       &issueID,
		DocumentType:  documentType,
		FileName:      fileName,
		ContentType:   contentType,
		FileSizeBytes: header.Size,
		ECMRef:        ref.ID,
		Status:        "received",
		UploadedBy:    metadata.UploadedBy,
		UploadedAt:    now,
	}

	slog.Info("document uploaded",
		"document_id", docID,
		"member_id", memberID,
		"issue_id", issueID,
		"ecm_ref", ref.ID,
		"file_name", fileName,
	)

	writeJSON(w, http.StatusCreated, map[string]interface{}{
		"data": doc,
		"meta": map[string]interface{}{
			"request_id": uuid.New().String(),
			"timestamp":  now.Format(time.RFC3339),
			"service":    "dataaccess",
			"version":    "v1",
		},
	})
}

// ListIssueDocuments returns documents attached to a specific issue.
// GET /api/v1/issues/{id}/documents
func (h *Handler) ListIssueDocuments(w http.ResponseWriter, r *http.Request) {
	issueID := parsePathID(r, "issues")
	if issueID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_ISSUE_ID", "Issue ID is required")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 100)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       document_id, document_type, file_name, content_type,
		       file_size_bytes, status, uploaded_by, uploaded_at
		FROM documents
		WHERE issue_id = $1
		ORDER BY uploaded_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, issueID, limit, offset)
	if err != nil {
		slog.Error("error querying issue documents", "issue_id", issueID, "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var docs []models.DocumentListItem
	total := 0
	for rows.Next() {
		var d models.DocumentListItem
		if err := rows.Scan(&total, &d.DocumentID, &d.DocumentType, &d.FileName,
			&d.ContentType, &d.FileSizeBytes, &d.Status, &d.UploadedBy, &d.UploadedAt); err != nil {
			slog.Error("error scanning document row", "error", err)
			continue
		}
		docs = append(docs, d)
	}

	writePaginated(w, docs, total, limit, offset)
}

// DownloadDocument returns the ECM URL/path for a document.
// GET /api/v1/documents/{id}/download
func (h *Handler) DownloadDocument(w http.ResponseWriter, r *http.Request) {
	docID := parsePathID(r, "documents")
	if docID == "" {
		writeError(w, http.StatusBadRequest, "INVALID_DOCUMENT_ID", "Document ID is required")
		return
	}

	var errs validation.Errors
	errs.UUID("document_id", docID)
	if errs.HasErrors() {
		writeError(w, http.StatusBadRequest, "INVALID_DOCUMENT_ID", errs.Error())
		return
	}

	// Look up ECM reference from DB
	var ecmRef, fileName, contentType string
	query := `SELECT ecm_ref, file_name, content_type FROM documents WHERE document_id = $1`
	err := dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), query, docID).Scan(&ecmRef, &fileName, &contentType)
	if err == sql.ErrNoRows {
		writeError(w, http.StatusNotFound, "DOCUMENT_NOT_FOUND", "No document found with ID "+docID)
		return
	}
	if err != nil {
		slog.Error("error querying document", "document_id", docID, "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}

	// Get URL/path from ECM
	url, err := h.ECM.Retrieve(r.Context(), ecmRef)
	if err != nil {
		slog.Error("ecm retrieve failed", "ecm_ref", ecmRef, "error", err)
		writeError(w, http.StatusInternalServerError, "ECM_ERROR", "Failed to retrieve document from storage")
		return
	}

	writeSuccess(w, map[string]string{
		"document_id":  docID,
		"file_name":    fileName,
		"content_type": contentType,
		"download_url": url,
	})
}

// ListMemberDocuments returns all documents for a member.
// GET /api/v1/members/{id}/documents
func (h *Handler) ListMemberDocuments(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 100)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       document_id, document_type, file_name, content_type,
		       file_size_bytes, status, uploaded_by, uploaded_at
		FROM documents
		WHERE member_id = $1
		ORDER BY uploaded_at DESC
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID, limit, offset)
	if err != nil {
		slog.Error("error querying member documents", "member_id", memberID, "error", err)
		writeError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var docs []models.DocumentListItem
	total := 0
	for rows.Next() {
		var d models.DocumentListItem
		if err := rows.Scan(&total, &d.DocumentID, &d.DocumentType, &d.FileName,
			&d.ContentType, &d.FileSizeBytes, &d.Status, &d.UploadedBy, &d.UploadedAt); err != nil {
			slog.Error("error scanning document row", "error", err)
			continue
		}
		docs = append(docs, d)
	}

	writePaginated(w, docs, total, limit, offset)
}

// parsePathID extracts a path segment value after the given resource name.
// For "/api/v1/issues/abc-123/documents", parsePathID(r, "issues") returns "abc-123".
func parsePathID(r *http.Request, resource string) string {
	// Try Go 1.22 path value first
	id := r.PathValue("id")
	if id != "" {
		return id
	}
	// Fallback: parse from URL path
	parts := strings.Split(r.URL.Path, "/"+resource+"/")
	if len(parts) == 2 {
		rest := parts[1]
		if idx := strings.Index(rest, "/"); idx != -1 {
			return rest[:idx]
		}
		return rest
	}
	return ""
}

// fileExtension returns the lowercase file extension including the dot.
func fileExtension(name string) string {
	if idx := strings.LastIndex(name, "."); idx != -1 {
		return strings.ToLower(name[idx:])
	}
	return ""
}
