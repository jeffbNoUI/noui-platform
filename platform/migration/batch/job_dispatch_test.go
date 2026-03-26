package batch

import (
	"context"
	"database/sql"
	"errors"
	"testing"

	"github.com/noui/platform/migration/jobqueue"
)

// --- test handler ---

type stubHandler struct {
	called    bool
	returnErr error
}

func (h *stubHandler) Execute(ctx context.Context, job *jobqueue.Job, conn *sql.Conn) error {
	h.called = true
	return h.returnErr
}

// --- TestJobDispatch ---

func TestJobDispatch_KnownType(t *testing.T) {
	d := NewJobDispatcher()
	h := &stubHandler{}
	d.Register("profile_l1", h)

	job := &jobqueue.Job{
		JobID:   "job-1",
		JobType: "profile_l1",
	}

	err := d.Dispatch(context.Background(), job, nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !h.called {
		t.Fatal("expected handler to be called")
	}
}

func TestJobDispatch_UnknownType(t *testing.T) {
	d := NewJobDispatcher()
	// register nothing

	job := &jobqueue.Job{
		JobID:   "job-1",
		JobType: "nonexistent_type",
	}

	err := d.Dispatch(context.Background(), job, nil)
	if err == nil {
		t.Fatal("expected error for unknown job type")
	}
	expected := "unknown job type: nonexistent_type"
	if err.Error() != expected {
		t.Fatalf("expected %q, got %q", expected, err.Error())
	}
}

func TestJobDispatch_HandlerReturnsError(t *testing.T) {
	d := NewJobDispatcher()
	h := &stubHandler{returnErr: errors.New("handler exploded")}
	d.Register("profile_l2", h)

	job := &jobqueue.Job{
		JobID:   "job-2",
		JobType: "profile_l2",
	}

	err := d.Dispatch(context.Background(), job, nil)
	if err == nil {
		t.Fatal("expected error from handler")
	}
	if err.Error() != "handler exploded" {
		t.Fatalf("expected 'handler exploded', got %q", err.Error())
	}
	if !h.called {
		t.Fatal("expected handler to be called even on error")
	}
}

func TestJobDispatch_MultipleHandlers(t *testing.T) {
	d := NewJobDispatcher()
	h1 := &stubHandler{}
	h2 := &stubHandler{}
	d.Register("type_a", h1)
	d.Register("type_b", h2)

	job := &jobqueue.Job{JobID: "j", JobType: "type_b"}
	if err := d.Dispatch(context.Background(), job, nil); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if h1.called {
		t.Fatal("handler for type_a should not have been called")
	}
	if !h2.called {
		t.Fatal("handler for type_b should have been called")
	}
}
