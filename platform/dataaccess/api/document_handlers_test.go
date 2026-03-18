package api

import (
	"bytes"
	"encoding/json"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/noui/platform/dataaccess/ecm"
)

// newDocHandler creates a Handler with sqlmock DB and local ECM backed by t.TempDir().
func newDocHandler(t *testing.T) (*Handler, sqlmock.Sqlmock) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	ecmProvider := ecm.NewLocalProvider(t.TempDir())
	return &Handler{DB: db, ECM: ecmProvider}, mock
}

// serveMultipart dispatches a multipart POST request through the real ServeMux.
func serveMultipart(h *Handler, path string, fieldName string, fileName string, fileContent []byte, queryParams string) *httptest.ResponseRecorder {
	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, _ := writer.CreateFormFile(fieldName, fileName)
	part.Write(fileContent)
	writer.Close()

	fullPath := path
	if queryParams != "" {
		fullPath += "?" + queryParams
	}

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	req := httptest.NewRequest("POST", fullPath, &buf)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)
	return w
}

// --- UploadDocument ---

func TestUploadDocument_Success(t *testing.T) {
	h, mock := newDocHandler(t)

	// Expect the INSERT query
	mock.ExpectQuery(`INSERT INTO documents`).
		WithArgs(
			sqlmock.AnyArg(), // document_id
			10001,            // member_id
			sqlmock.AnyArg(), // issue_id
			"birth_certificate",
			"test.pdf",
			sqlmock.AnyArg(), // content_type
			sqlmock.AnyArg(), // file_size_bytes
			sqlmock.AnyArg(), // ecm_ref
			"received",
			"portal",
			sqlmock.AnyArg(), // uploaded_at
		).
		WillReturnRows(sqlmock.NewRows([]string{"document_id"}).AddRow("doc-uuid-123"))

	w := serveMultipart(h,
		"/api/v1/issues/issue-001/documents",
		"file", "test.pdf", []byte("fake pdf content"),
		"member_id=10001&document_type=birth_certificate",
	)

	if w.Code != http.StatusCreated {
		t.Fatalf("UploadDocument status = %d, want %d. Body: %s", w.Code, http.StatusCreated, w.Body.String())
	}

	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("parse response: %v", err)
	}
	data := body["data"].(map[string]interface{})
	if data["file_name"] != "test.pdf" {
		t.Errorf("file_name = %q, want test.pdf", data["file_name"])
	}
	if data["status"] != "received" {
		t.Errorf("status = %q, want received", data["status"])
	}
	if data["ecm_ref"] == nil || data["ecm_ref"] == "" {
		t.Error("ecm_ref should not be empty")
	}
}

func TestUploadDocument_MissingMemberID(t *testing.T) {
	h, _ := newDocHandler(t)

	w := serveMultipart(h,
		"/api/v1/issues/issue-001/documents",
		"file", "test.pdf", []byte("content"),
		"", // no member_id
	)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "MISSING_MEMBER_ID" {
		t.Errorf("error.code = %q, want MISSING_MEMBER_ID", errObj["code"])
	}
}

func TestUploadDocument_InvalidFileType(t *testing.T) {
	h, _ := newDocHandler(t)

	w := serveMultipart(h,
		"/api/v1/issues/issue-001/documents",
		"file", "virus.exe", []byte("bad content"),
		"member_id=10001",
	)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	errObj := body["error"].(map[string]interface{})
	if errObj["code"] != "INVALID_FILE_TYPE" {
		t.Errorf("error.code = %q, want INVALID_FILE_TYPE", errObj["code"])
	}
}

func TestUploadDocument_MissingFile(t *testing.T) {
	h, _ := newDocHandler(t)

	// Send a POST with no multipart body
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)
	req := httptest.NewRequest("POST", "/api/v1/issues/issue-001/documents?member_id=10001", nil)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=xxx")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusBadRequest, w.Body.String())
	}
}

// --- ListIssueDocuments ---

func TestListIssueDocuments_Success(t *testing.T) {
	h, mock := newDocHandler(t)

	uploadedAt := time.Date(2026, 3, 18, 12, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"total_count", "document_id", "document_type", "file_name", "content_type",
		"file_size_bytes", "status", "uploaded_by", "uploaded_at",
	}).
		AddRow(1, "doc-001", "birth_certificate", "cert.pdf", "application/pdf",
			1024, "received", "portal", uploadedAt)

	mock.ExpectQuery(`SELECT .+ FROM documents WHERE issue_id`).
		WithArgs("issue-001", 50, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/issues/issue-001/documents")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	data := body["data"].([]interface{})
	if len(data) != 1 {
		t.Fatalf("expected 1 document, got %d", len(data))
	}
	doc := data[0].(map[string]interface{})
	if doc["file_name"] != "cert.pdf" {
		t.Errorf("file_name = %q, want cert.pdf", doc["file_name"])
	}
}

func TestListIssueDocuments_Empty(t *testing.T) {
	h, mock := newDocHandler(t)

	rows := sqlmock.NewRows([]string{
		"total_count", "document_id", "document_type", "file_name", "content_type",
		"file_size_bytes", "status", "uploaded_by", "uploaded_at",
	})

	mock.ExpectQuery(`SELECT .+ FROM documents WHERE issue_id`).
		WithArgs("issue-001", 50, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/issues/issue-001/documents")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
}

// --- DownloadDocument ---

func TestDownloadDocument_Success(t *testing.T) {
	h, mock := newDocHandler(t)

	// First ingest a file into ECM so Retrieve will work
	ref, err := h.ECM.Ingest(nil, []byte("file content"), ecm.DocumentMetadata{
		MemberID:     "10001",
		DocumentType: "voided_check",
		FileName:     "check.png",
		ContentType:  "image/png",
		UploadedBy:   "portal",
	})
	if err != nil {
		t.Fatalf("ECM ingest: %v", err)
	}

	docID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	mock.ExpectQuery(`SELECT ecm_ref, file_name, content_type FROM documents`).
		WithArgs(docID).
		WillReturnRows(sqlmock.NewRows([]string{"ecm_ref", "file_name", "content_type"}).
			AddRow(ref.ID, "check.png", "image/png"))

	w := serveWithPathValue(h, "GET", "/api/v1/documents/"+docID+"/download")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	data := body["data"].(map[string]interface{})
	if data["download_url"] == nil || data["download_url"] == "" {
		t.Error("download_url should not be empty")
	}
	if data["file_name"] != "check.png" {
		t.Errorf("file_name = %q, want check.png", data["file_name"])
	}
}

func TestDownloadDocument_NotFound(t *testing.T) {
	h, mock := newDocHandler(t)

	docID := "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
	mock.ExpectQuery(`SELECT ecm_ref, file_name, content_type FROM documents`).
		WithArgs(docID).
		WillReturnRows(sqlmock.NewRows([]string{"ecm_ref", "file_name", "content_type"}))

	w := serveWithPathValue(h, "GET", "/api/v1/documents/"+docID+"/download")

	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusNotFound, w.Body.String())
	}
}

func TestDownloadDocument_InvalidUUID(t *testing.T) {
	h, _ := newDocHandler(t)

	w := serveWithPathValue(h, "GET", "/api/v1/documents/not-a-uuid/download")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- ListMemberDocuments ---

func TestListMemberDocuments_Success(t *testing.T) {
	h, mock := newDocHandler(t)

	uploadedAt := time.Date(2026, 3, 18, 14, 0, 0, 0, time.UTC)
	rows := sqlmock.NewRows([]string{
		"total_count", "document_id", "document_type", "file_name", "content_type",
		"file_size_bytes", "status", "uploaded_by", "uploaded_at",
	}).
		AddRow(2, "doc-001", "birth_certificate", "cert.pdf", "application/pdf", 2048, "received", "portal", uploadedAt).
		AddRow(2, "doc-002", "voided_check", "check.png", "image/png", 512, "received", "portal", uploadedAt)

	mock.ExpectQuery(`SELECT .+ FROM documents WHERE member_id`).
		WithArgs(10001, 50, 0).
		WillReturnRows(rows)

	w := serveWithPathValue(h, "GET", "/api/v1/members/10001/documents")

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. Body: %s", w.Code, http.StatusOK, w.Body.String())
	}

	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	data := body["data"].([]interface{})
	if len(data) != 2 {
		t.Fatalf("expected 2 documents, got %d", len(data))
	}
}

func TestListMemberDocuments_InvalidMemberID(t *testing.T) {
	h, _ := newDocHandler(t)

	w := serveWithPathValue(h, "GET", "/api/v1/members/abc/documents")

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusBadRequest)
	}
}

// --- Helper Functions ---

func TestFileExtension(t *testing.T) {
	tests := []struct {
		name string
		want string
	}{
		{"document.pdf", ".pdf"},
		{"photo.JPG", ".jpg"},
		{"archive.tar.gz", ".gz"},
		{"noext", ""},
	}
	for _, tt := range tests {
		got := fileExtension(tt.name)
		if got != tt.want {
			t.Errorf("fileExtension(%q) = %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestParsePathID(t *testing.T) {
	tests := []struct {
		path     string
		resource string
		want     string
	}{
		{"/api/v1/issues/abc-123/documents", "issues", "abc-123"},
		{"/api/v1/documents/doc-456/download", "documents", "doc-456"},
		{"/api/v1/other", "issues", ""},
	}
	for _, tt := range tests {
		req := httptest.NewRequest("GET", tt.path, nil)
		got := parsePathID(req, tt.resource)
		if got != tt.want {
			t.Errorf("parsePathID(%q, %q) = %q, want %q", tt.path, tt.resource, got, tt.want)
		}
	}
}
