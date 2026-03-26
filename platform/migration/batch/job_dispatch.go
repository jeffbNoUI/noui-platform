package batch

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/noui/platform/migration/jobqueue"
)

// JobHandler processes a single job of a specific type.
// Implementations receive a DB querier scoped to the job's tenant (via
// dbcontext.ScopedConn), so all queries go through RLS automatically.
type JobHandler interface {
	Execute(ctx context.Context, job *jobqueue.Job, db *sql.Conn) error
}

// JobDispatcher maps job types to their handlers and dispatches jobs.
type JobDispatcher struct {
	handlers map[string]JobHandler
}

// NewJobDispatcher creates an empty dispatcher.
func NewJobDispatcher() *JobDispatcher {
	return &JobDispatcher{handlers: make(map[string]JobHandler)}
}

// Register maps a job type string to a handler.
func (d *JobDispatcher) Register(jobType string, handler JobHandler) {
	d.handlers[jobType] = handler
}

// Dispatch looks up the handler for the job's type and executes it.
// Returns an error immediately if no handler is registered for the type.
func (d *JobDispatcher) Dispatch(ctx context.Context, job *jobqueue.Job, conn *sql.Conn) error {
	handler, ok := d.handlers[job.JobType]
	if !ok {
		return fmt.Errorf("unknown job type: %s", job.JobType)
	}
	return handler.Execute(ctx, job, conn)
}
