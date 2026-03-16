module github.com/noui/platform/dataquality

go 1.22.0

require (
	github.com/google/uuid v1.6.0
	github.com/lib/pq v1.10.9
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/logging v0.0.0
)

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/logging => ../logging
)
