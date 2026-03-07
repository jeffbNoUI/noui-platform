# connector/ — Claude Code Instructions

## What This Is

Generic connector infrastructure for schema discovery, concept tagging, and operational monitoring against **any** legacy database system. This code is plan-agnostic and domain-agnostic.

## Governing Principles

- **No hardcoded schema knowledge** — all discovery is signal-based
- Every concept tag must reference the signals that triggered it (auditable)
- Every anomaly check must define its baseline calculation explicitly
- Adapter pattern: MySQL, PostgreSQL, MSSQL are swappable per target

## Go Module

- Module: `github.com/noui/platform/connector`
- Go version: 1.26
- Dependencies: go-sql-driver/mysql, lib/pq, go-mssqldb

## Commands

```bash
cd connector && go build ./...
cd connector && go test ./...
cd connector && go run ./cmd/introspect
cd connector && go run ./cmd/tagger
cd connector && go run ./cmd/monitor
cd connector && go run ./cmd/dashboard
```

## Package Overview

| Package | Purpose | Tests |
|---------|---------|-------|
| introspect/ | Schema discovery (3 DB adapters) | Unit |
| tagger/ | 18 concept definitions, signal-based scoring | 25 tests |
| monitor/ | 8 checks, 5 baselines, 3 adapters, scheduler, webhooks | 41 tests |
| dashboard/ | 9 REST endpoints + embedded HTML UI | 25 tests |
| schema/ | Shared type definitions (SchemaManifest, MonitorReport) | — |
| service/ | Unified HTTP binary combining all stages | — |
| cmd/ | CLI entry points for each stage | — |

## Key Rule

This directory must NEVER import from `platform/` or `domains/`. If you need domain-specific behavior, add it via concept definitions in `tagger/concepts.go`, not via direct imports.
