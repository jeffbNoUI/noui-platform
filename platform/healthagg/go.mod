module github.com/noui/platform/healthagg

go 1.22.0

require (
	github.com/noui/platform/healthutil v0.0.0
	github.com/noui/platform/logging v0.0.0
)

replace (
	github.com/noui/platform/healthutil => ../healthutil
	github.com/noui/platform/logging => ../logging
)
