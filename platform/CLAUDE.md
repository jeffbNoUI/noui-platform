# platform/ — Claude Code Instructions

## What This Is

Shared platform services that power the NoUI workspace. Each service is an independent Go module with its own `go.mod`, Dockerfile, and API.

## Services

| Service | Module | Port | Database | Purpose |
|---------|--------|------|----------|---------|
| dataaccess | `github.com/noui/platform/dataaccess` | 8081 | PostgreSQL | Legacy data access (member, salary, employment queries) |
| intelligence | `github.com/noui/platform/intelligence` | 8082 | Stateless | Eligibility, benefit calculation, DRO, scenario analysis |
| crm | `github.com/noui/platform/crm` | 8083 | PostgreSQL | Contact management, interaction history |
| correspondence | `github.com/noui/platform/correspondence` | 8085 | PostgreSQL | Template rendering, merge fields, letter history |
| dataquality | `github.com/noui/platform/dataquality` | 8086 | PostgreSQL | Data quality checks, scoring, issues, trend analysis |
| knowledgebase | `github.com/noui/platform/knowledgebase` | 8087 | PostgreSQL | Articles, stage help, rule references, search |
| casemanagement | `github.com/noui/platform/casemanagement` | 8088 | PostgreSQL | Retirement case tracking, stage workflow, work queue |

## Common Patterns

- All services use `PORT` env var for listen address
- DB services use `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSLMODE`
- CORS configured via `CORS_ORIGIN` env var
- Health check at `/healthz`
- API prefix: `/api/v1/`
- Request IDs via `X-Request-ID` header (`request_id` in response JSON)

## Key Rule

These services do NOT import from `connector/`. The connector is generic infrastructure; these services contain domain-aware business logic. The `intelligence` service calls `dataaccess` via HTTP (`CONNECTOR_URL` env var), not via Go imports.

## Go Version

All platform services use Go 1.22.
