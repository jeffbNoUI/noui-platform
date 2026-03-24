package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/url"

	_ "github.com/lib/pq"
	_ "github.com/microsoft/go-mssqldb"

	"github.com/noui/platform/migration/models"
)

// SaveSourceConnection updates the source_connection JSONB on an engagement.
func SaveSourceConnection(db *sql.DB, engagementID string, conn *models.SourceConnection) error {
	connJSON, err := json.Marshal(conn)
	if err != nil {
		return fmt.Errorf("marshal source connection: %w", err)
	}
	_, err = db.Exec(
		`UPDATE migration.engagement SET source_connection = $2::text::jsonb, updated_at = now() WHERE engagement_id = $1`,
		engagementID, string(connJSON),
	)
	if err != nil {
		return fmt.Errorf("save source connection: %w", err)
	}
	return nil
}

// supportedDrivers lists the database drivers this service can connect to.
var supportedDrivers = map[string]bool{
	"postgres": true,
	"mssql":    true,
}

// buildDSN constructs a connection string for the given driver.
func buildDSN(conn *models.SourceConnection) (driverName string, dsn string, err error) {
	switch conn.Driver {
	case "postgres":
		sslmode := conn.SSLMode
		if sslmode == "" {
			sslmode = "disable"
		}
		return "postgres", fmt.Sprintf(
			"host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
			conn.Host, conn.Port, conn.User, conn.Password, conn.DBName, sslmode,
		), nil

	case "mssql":
		// SQL Server connection string using go-mssqldb URL format.
		port := conn.Port
		if port == "" {
			port = "1433"
		}
		query := url.Values{}
		query.Set("database", conn.DBName)
		if conn.SSLMode == "disable" || conn.SSLMode == "" {
			query.Set("encrypt", "disable")
		}
		u := &url.URL{
			Scheme:   "sqlserver",
			User:     url.UserPassword(conn.User, conn.Password),
			Host:     fmt.Sprintf("%s:%s", conn.Host, port),
			RawQuery: query.Encode(),
		}
		return "sqlserver", u.String(), nil

	default:
		return "", "", fmt.Errorf("unsupported driver: %s (supported: postgres, mssql)", conn.Driver)
	}
}

// BuildSourceDSN constructs a connection string for the given source connection.
func BuildSourceDSN(conn *models.SourceConnection) string {
	_, dsn, _ := buildDSN(conn)
	return dsn
}

// OpenSourceDB opens a connection to the source database.
func OpenSourceDB(conn *models.SourceConnection) (*sql.DB, error) {
	driverName, dsn, err := buildDSN(conn)
	if err != nil {
		return nil, err
	}
	srcDB, err := sql.Open(driverName, dsn)
	if err != nil {
		return nil, fmt.Errorf("open source connection: %w", err)
	}
	return srcDB, nil
}

// TestSourceConnection tries to connect to the source database and returns nil on success.
func TestSourceConnection(conn *models.SourceConnection) error {
	srcDB, err := OpenSourceDB(conn)
	if err != nil {
		return err
	}
	defer srcDB.Close()

	if err := srcDB.Ping(); err != nil {
		return fmt.Errorf("ping source database: %w", err)
	}
	return nil
}

// DiscoverSourceTables connects to the source database and returns a list of tables
// with row counts and column counts.
func DiscoverSourceTables(conn *models.SourceConnection) ([]models.SourceTable, error) {
	srcDB, err := OpenSourceDB(conn)
	if err != nil {
		return nil, err
	}
	defer srcDB.Close()

	if err := srcDB.Ping(); err != nil {
		return nil, fmt.Errorf("ping source database: %w", err)
	}

	switch conn.Driver {
	case "postgres":
		return discoverPostgresTables(srcDB)
	case "mssql":
		return discoverMSSQLTables(srcDB)
	default:
		return nil, fmt.Errorf("unsupported driver for discovery: %s", conn.Driver)
	}
}

// discoverPostgresTables queries information_schema for PostgreSQL.
func discoverPostgresTables(srcDB *sql.DB) ([]models.SourceTable, error) {
	rows, err := srcDB.Query(`
		SELECT
			t.table_schema,
			t.table_name,
			COUNT(c.column_name)::int AS column_count
		FROM information_schema.tables t
		LEFT JOIN information_schema.columns c
			ON c.table_schema = t.table_schema AND c.table_name = t.table_name
		WHERE t.table_type = 'BASE TABLE'
			AND t.table_schema NOT IN ('pg_catalog', 'information_schema')
		GROUP BY t.table_schema, t.table_name
		ORDER BY t.table_schema, t.table_name
	`)
	if err != nil {
		return nil, fmt.Errorf("query tables: %w", err)
	}
	defer rows.Close()

	var tables []models.SourceTable
	for rows.Next() {
		var st models.SourceTable
		if err := rows.Scan(&st.SchemaName, &st.TableName, &st.ColumnCount); err != nil {
			return nil, fmt.Errorf("scan table: %w", err)
		}
		// Approximate row count from pg_class (always populated, unlike pg_stat_user_tables
		// which requires ANALYZE to have run).
		var rowCount int64
		err := srcDB.QueryRow(
			`SELECT GREATEST(c.reltuples::bigint, 0)
			   FROM pg_class c
			   JOIN pg_namespace n ON n.oid = c.relnamespace
			  WHERE n.nspname = $1 AND c.relname = $2`,
			st.SchemaName, st.TableName,
		).Scan(&rowCount)
		if err != nil {
			slog.Warn("row count estimate failed, falling back to COUNT(*)",
				"schema", st.SchemaName, "table", st.TableName, "error", err)
			// Fallback: exact count (slower but guaranteed correct)
			if err2 := srcDB.QueryRow(
				fmt.Sprintf(`SELECT COUNT(*) FROM %q.%q`, st.SchemaName, st.TableName),
			).Scan(&rowCount); err2 != nil {
				slog.Warn("COUNT(*) fallback also failed", "error", err2)
				rowCount = 0
			}
		}
		st.RowCount = rowCount
		tables = append(tables, st)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tables: %w", err)
	}

	return tables, nil
}

// discoverMSSQLTables queries INFORMATION_SCHEMA for SQL Server.
func discoverMSSQLTables(srcDB *sql.DB) ([]models.SourceTable, error) {
	rows, err := srcDB.Query(`
		SELECT
			t.TABLE_SCHEMA,
			t.TABLE_NAME,
			COUNT(c.COLUMN_NAME) AS column_count
		FROM INFORMATION_SCHEMA.TABLES t
		LEFT JOIN INFORMATION_SCHEMA.COLUMNS c
			ON c.TABLE_SCHEMA = t.TABLE_SCHEMA AND c.TABLE_NAME = t.TABLE_NAME
		WHERE t.TABLE_TYPE = 'BASE TABLE'
		GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME
		ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
	`)
	if err != nil {
		return nil, fmt.Errorf("query tables: %w", err)
	}
	defer rows.Close()

	var tables []models.SourceTable
	for rows.Next() {
		var st models.SourceTable
		if err := rows.Scan(&st.SchemaName, &st.TableName, &st.ColumnCount); err != nil {
			return nil, fmt.Errorf("scan table: %w", err)
		}
		// Approximate row count from sys.dm_db_partition_stats.
		// go-mssqldb uses positional @p1/@p2 params that map to arguments in order.
		var rowCount int64
		err := srcDB.QueryRow(`
			SELECT ISNULL(SUM(p.row_count), 0)
			FROM sys.dm_db_partition_stats p
			JOIN sys.tables t ON t.object_id = p.object_id
			JOIN sys.schemas s ON s.schema_id = t.schema_id
			WHERE s.name = @p1 AND t.name = @p2
			  AND p.index_id IN (0, 1)
		`, sql.Named("p1", st.SchemaName), sql.Named("p2", st.TableName)).Scan(&rowCount)
		if err != nil {
			slog.Warn("MSSQL row count estimate failed, falling back to COUNT(*)",
				"schema", st.SchemaName, "table", st.TableName, "error", err)
			if err2 := srcDB.QueryRow(
				fmt.Sprintf(`SELECT COUNT(*) FROM [%s].[%s]`, st.SchemaName, st.TableName),
			).Scan(&rowCount); err2 != nil {
				slog.Warn("COUNT(*) fallback also failed", "error", err2)
				rowCount = 0
			}
		}
		st.RowCount = rowCount
		tables = append(tables, st)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate tables: %w", err)
	}

	return tables, nil
}
