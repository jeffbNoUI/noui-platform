module github.com/noui/platform/ratelimit

go 1.22.0

require (
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/envutil v0.0.0
	golang.org/x/time v0.9.0
)

replace (
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/envutil => ../envutil
)
