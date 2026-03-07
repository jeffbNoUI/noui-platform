package introspect

import (
	"database/sql"

	"github.com/noui/platform/connector/schema"
)

// SchemaAdapter provides database-specific query implementations for schema introspection.
// Per CLAUDE.md: "Connector DB adapter must be swappable per target — no MariaDB-specific
// code in core connector logic."
type SchemaAdapter interface {
	GetTables(db *sql.DB, dbName string) ([]schema.TableInfo, error)
	GetColumns(db *sql.DB, dbName, tableName string) ([]schema.ColumnInfo, error)
	GetForeignKeys(db *sql.DB, dbName, tableName string) ([]schema.ForeignKey, error)
}

// NewAdapter returns the appropriate SchemaAdapter for the given driver.
func NewAdapter(driver string) SchemaAdapter {
	switch driver {
	case "postgres":
		return &PostgresAdapter{}
	case "mssql":
		return &MSSQLAdapter{}
	default:
		return &MySQLAdapter{}
	}
}
