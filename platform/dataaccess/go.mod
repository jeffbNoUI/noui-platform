module github.com/noui/platform/dataaccess

go 1.22.0

require (
	github.com/DATA-DOG/go-sqlmock v1.5.2
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.11.2
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/dbcontext v0.0.0
	github.com/noui/platform/envutil v0.0.0
	github.com/noui/platform/logging v0.0.0
	github.com/noui/platform/ratelimit v0.0.0
	github.com/noui/platform/validation v0.0.0
)

require golang.org/x/time v0.9.0 // indirect

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/dbcontext => ../dbcontext
	github.com/noui/platform/envutil => ../envutil
	github.com/noui/platform/logging => ../logging
	github.com/noui/platform/ratelimit => ../ratelimit
	github.com/noui/platform/validation => ../validation
)
