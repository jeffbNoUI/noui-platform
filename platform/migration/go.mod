module github.com/noui/platform/migration

go 1.25.7

require (
	github.com/DATA-DOG/go-sqlmock v1.5.2
	github.com/gorilla/websocket v1.5.3
	github.com/lib/pq v1.11.2
	github.com/microsoft/go-mssqldb v1.7.2
	github.com/noui/platform/apiresponse v0.0.0
	github.com/noui/platform/auth v0.0.0
	github.com/noui/platform/dbcontext v0.0.0
	github.com/noui/platform/envutil v0.0.0
	github.com/noui/platform/healthutil v0.0.0
	github.com/noui/platform/logging v0.0.0
	github.com/noui/platform/ratelimit v0.0.0
	gopkg.in/yaml.v3 v3.0.1
)

require (
	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/google/uuid v1.6.0 // indirect
	golang.org/x/crypto v0.48.0 // indirect
	golang.org/x/text v0.34.0 // indirect
	golang.org/x/time v0.9.0 // indirect
)

replace (
	github.com/noui/platform/apiresponse => ../apiresponse
	github.com/noui/platform/auth => ../auth
	github.com/noui/platform/dbcontext => ../dbcontext
	github.com/noui/platform/envutil => ../envutil
	github.com/noui/platform/healthutil => ../healthutil
	github.com/noui/platform/logging => ../logging
	github.com/noui/platform/ratelimit => ../ratelimit
	github.com/noui/platform/validation => ../validation
)
