module github.com/noui/platform/preferences

go 1.22.0

require (
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.11.2
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/dbcontext v0.0.0
	github.com/noui/platform/envutil v0.0.0
	github.com/noui/platform/healthutil v0.0.0
	github.com/noui/platform/logging v0.0.0-00010101000000-000000000000
	github.com/noui/platform/ratelimit v0.0.0-00010101000000-000000000000
)

require golang.org/x/time v0.9.0 // indirect

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/dbcontext => ../dbcontext
	github.com/noui/platform/envutil => ../envutil
	github.com/noui/platform/healthutil => ../healthutil
	github.com/noui/platform/logging => ../logging
	github.com/noui/platform/ratelimit => ../ratelimit
	github.com/noui/platform/validation => ../validation
)
