package batch

import (
	"database/sql"
	"fmt"
	"strings"

	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"
)

// DBSourceRowProvider reads source rows from a database table.
// It implements SourceRowProvider for real source database connections.
type DBSourceRowProvider struct {
	DSN       string // full DSN for the source database
	TableName string // schema-qualified table name (e.g. "src_prism.prism_member")
	KeyColumn string // column to use as SourceRow.Key (for checkpoint ordering)
}

// driverFromDSN infers the database driver name from a DSN string.
// DSNs starting with "sqlserver:" use the sqlserver driver; all others
// are assumed to be PostgreSQL.
func driverFromDSN(dsn string) string {
	if strings.HasPrefix(dsn, "sqlserver:") {
		return "sqlserver"
	}
	return "postgres"
}

// FetchRows connects to the source database and returns all rows for the
// given scope (table). When checkpointKey is non-empty, only rows whose
// key column value is greater than the checkpoint are returned, enabling
// resumable batch processing.
func (p *DBSourceRowProvider) FetchRows(scope string, checkpointKey string) ([]SourceRow, error) {
	driver := driverFromDSN(p.DSN)
	db, err := sql.Open(driver, p.DSN)
	if err != nil {
		return nil, fmt.Errorf("db_provider: open connection: %w", err)
	}
	defer db.Close()

	// Build query with optional checkpoint filter.
	var query string
	var args []interface{}

	if checkpointKey != "" {
		query = fmt.Sprintf(
			"SELECT * FROM %s WHERE %s > $1 ORDER BY %s",
			p.TableName, p.KeyColumn, p.KeyColumn,
		)
		args = append(args, checkpointKey)
	} else {
		query = fmt.Sprintf(
			"SELECT * FROM %s ORDER BY %s",
			p.TableName, p.KeyColumn,
		)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("db_provider: query rows: %w", err)
	}
	defer rows.Close()

	columns, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("db_provider: get columns: %w", err)
	}

	var result []SourceRow

	for rows.Next() {
		// Create scan targets — use []interface{} with *interface{} pointers
		// so database/sql can write any column type.
		scanTargets := make([]interface{}, len(columns))
		scanPtrs := make([]interface{}, len(columns))
		for i := range scanTargets {
			scanPtrs[i] = &scanTargets[i]
		}

		if err := rows.Scan(scanPtrs...); err != nil {
			return nil, fmt.Errorf("db_provider: scan row: %w", err)
		}

		data := make(map[string]interface{}, len(columns))
		var key string

		for i, col := range columns {
			val := scanTargets[i]

			// Convert []byte to string for map readability.
			if b, ok := val.([]byte); ok {
				val = string(b)
			}

			data[col] = val

			if col == p.KeyColumn {
				key = fmt.Sprintf("%v", val)
			}
		}

		result = append(result, SourceRow{
			Key:       key,
			Data:      data,
			IsRetiree: false, // Set by caller or transformation layer
		})
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("db_provider: iterate rows: %w", err)
	}

	return result, nil
}
