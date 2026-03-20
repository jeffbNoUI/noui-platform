# NoUI Platform

AI-composed workspace software for benefits administration. Connects to legacy systems, discovers schemas, monitors data quality, and provides intelligent workspace composition for staff and members.

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (React/Vite/Tailwind)     :3000   │
├─────────────────────────────────────────────┤
│  Platform Services (Go)                     │
│  dataaccess :8081  intelligence :8082       │
│  crm :8083         correspondence :8085     │
│  dataquality :8086 knowledgebase :8087      │
├─────────────────────────────────────────────┤
│  Connector (Go)                             │
│  introspect → tagger → monitor → dashboard  │
├─────────────────────────────────────────────┤
│  Domains                                    │
│  pension        │ [future domains]          │
└─────────────────────────────────────────────┘
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
| `platform/` | Shared backend services (Go 1.22) |
| `domains/pension/` | Pension schemas, rules, seed data, test cases |
| `frontend/` | React UI with Tailwind CSS |
| `targets/` | Test target databases (ERPNext, PostgreSQL, MSSQL) |
| `infrastructure/` | Helm charts for Kubernetes deployment |
| `tools/` | Development utilities (compose-sim) |
| `docs/` | Architecture, plans, prototypes |

## Client Deployment

Client-specific configuration lives in separate repos (`noui-client-{name}`). This repo contains only the product code.
