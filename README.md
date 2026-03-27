# NoUI Platform

AI-composed workspace software for benefits administration. Connects to legacy systems, discovers schemas, monitors data quality, and provides intelligent workspace composition for staff and members.

**21 services** across four layers: Data Connector, Platform Services, Migration Pipeline, and Frontend.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Frontend (React/Vite/Tailwind)         :3000   │
├─────────────────────────────────────────────────┤
│  Platform Services (Go)                         │
│  dataaccess :8081   intelligence :8082          │
│  crm :8083          correspondence :8085        │
│  dataquality :8086  knowledgebase :8087          │
│  casemanagement :8088  preferences :8089        │
│  healthagg :8091    issues :8092                │
│  security :8093     employer-* :8094-8099       │
├─────────────────────────────────────────────────┤
│  Migration Pipeline (Go + Python)               │
│  migration :8100    migration-intelligence :8101│
│  profiler → mapper → transformer → reconciler   │
│  → parallel → cutover → go-live                 │
├─────────────────────────────────────────────────┤
│  Connector (Go)                                 │
│  introspect → tagger → monitor → dashboard      │
├─────────────────────────────────────────────────┤
│  Domains                                        │
│  pension        │ [future domains]              │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
# Start the full stack
docker compose up --build

# Access
# Frontend:     http://localhost:3000
# DataAccess:   http://localhost:8081
# Intelligence: http://localhost:8082
```

## Development

```bash
# Build connector
cd connector && go build ./...

# Build a platform service
cd platform/dataaccess && go build ./...

# Build frontend
cd frontend && npm install && npm run build

# Run tests
cd connector && go test ./... -short
cd platform/dataaccess && go test ./...
cd frontend && npm test -- --run
```

## Repository Structure

| Directory | Purpose |
|-----------|---------|
| `connector/` | Generic schema introspection, concept tagging, monitoring (Go 1.26) |
| `platform/` | Shared backend services — 19 Go services (ports 8081–8099) |
| `platform/migration/` | Migration pipeline — 15 packages, 38 contracts (port 8100) |
| `migration-intelligence/` | Migration ML service — Python (port 8101) |
| `domains/pension/` | Pension schemas, rules, seed data, test cases |
| `frontend/` | React UI with Tailwind CSS |
| `targets/` | Test target databases (ERPNext, PostgreSQL, MSSQL) |
| `infrastructure/` | Helm charts for Kubernetes deployment |
| `tools/` | Development utilities (compose-sim) |
| `docs/` | Architecture, plans, prototypes |

## Client Deployment

Client-specific configuration lives in separate repos (`noui-client-{name}`). This repo contains only the product code.
