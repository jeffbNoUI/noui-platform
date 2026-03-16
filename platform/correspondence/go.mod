module github.com/noui/platform/correspondence

go 1.22.0

require (
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.11.2
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/dbcontext v0.0.0
	github.com/noui/platform/logging v0.0.0
	github.com/noui/platform/validation v0.0.0
)

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/dbcontext => ../dbcontext
	github.com/noui/platform/logging => ../logging
	github.com/noui/platform/validation => ../validation
)
