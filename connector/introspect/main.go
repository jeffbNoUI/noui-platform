// connector/introspect — NoUI Schema Discovery Engine
//
// Connects to a legacy database and produces a schema manifest:
// a structured JSON description of all tables, columns, data types,
// row counts, and foreign key relationships.
//
// Supports multiple database backends via swappable adapters:
//   - mysql: MySQL / MariaDB (default)
//   - postgres: PostgreSQL
//   - mssql: Microsoft SQL Server
//
// The manifest is the input to the concept tagger (connector/tagger).
// It is a generated artifact — do not commit to version control.
package introspect

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/noui/platform/connector/schema"
)

// Introspect connects to the given database and produces a SchemaManifest
// describing all tables, columns, and foreign key relationships.
func Introspect(db *sql.DB, adapter SchemaAdapter, driver, dbName string) (*schema.SchemaManifest, error) {
	manifest := &schema.SchemaManifest{
		Source:         dbName,
		Driver:         driver,
		Database:       dbName,
		IntrospectedAt: time.Now().UTC().Format(time.RFC3339),
	}

	tables, err := adapter.GetTables(db, dbName)
	if err != nil {
		return nil, fmt.Errorf("getting tables: %w", err)
	}

	for i, t := range tables {
		cols, err := adapter.GetColumns(db, dbName, t.Name)
		if err != nil {
			return nil, fmt.Errorf("getting columns for %s: %w", t.Name, err)
		}
		tables[i].Columns = cols

		fks, err := adapter.GetForeignKeys(db, dbName, t.Name)
		if err != nil {
			return nil, fmt.Errorf("getting FKs for %s: %w", t.Name, err)
		}
		tables[i].ForeignKeys = fks
		tables[i].NoUITags = []string{} // populated by tagger
	}

	manifest.Tables = tables
	manifest.TableCount = len(tables)
	return manifest, nil
}
