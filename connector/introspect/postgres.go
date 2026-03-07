package introspect

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/connector/schema"

	_ "github.com/lib/pq"
)

// PostgresAdapter implements SchemaAdapter for PostgreSQL databases.
type PostgresAdapter struct{}

func (a *PostgresAdapter) GetTables(db *sql.DB, dbName string) ([]schema.TableInfo, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "public"
	}

	rows, err := db.Query(`
		SELECT t.table_name, COALESCE(s.n_live_tup, 0)
		FROM information_schema.tables t
		LEFT JOIN pg_stat_user_tables s
		  ON t.table_name = s.relname AND t.table_schema = s.schemaname
		WHERE t.table_schema = $1
		  AND t.table_type = 'BASE TABLE'
		ORDER BY t.table_name
	`, schemaName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []schema.TableInfo
	for rows.Next() {
		var t schema.TableInfo
		if err := rows.Scan(&t.Name, &t.RowCount); err != nil {
			return nil, err
		}
		tables = append(tables, t)
	}
	return tables, rows.Err()
}

func (a *PostgresAdapter) GetColumns(db *sql.DB, dbName, tableName string) ([]schema.ColumnInfo, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "public"
	}

	rows, err := db.Query(`
		SELECT
			c.column_name,
			c.data_type,
			c.is_nullable,
			COALESCE(
				(SELECT CASE tc.constraint_type
					WHEN 'PRIMARY KEY' THEN 'PRI'
					WHEN 'UNIQUE' THEN 'UNI'
					WHEN 'FOREIGN KEY' THEN 'MUL'
				END
				FROM information_schema.key_column_usage kcu
				JOIN information_schema.table_constraints tc
				  ON kcu.constraint_name = tc.constraint_name
				  AND kcu.constraint_schema = tc.constraint_schema
				WHERE kcu.table_schema = c.table_schema
				  AND kcu.table_name = c.table_name
				  AND kcu.column_name = c.column_name
				ORDER BY CASE tc.constraint_type
					WHEN 'PRIMARY KEY' THEN 1
					WHEN 'UNIQUE' THEN 2
					WHEN 'FOREIGN KEY' THEN 3
				END
				LIMIT 1),
				''
			) AS key_type
		FROM information_schema.columns c
		WHERE c.table_schema = $1
		  AND c.table_name = $2
		ORDER BY c.ordinal_position
	`, schemaName, tableName)
	if err != nil {
		return nil, fmt.Errorf("querying columns for %s.%s: %w", schemaName, tableName, err)
	}
	defer rows.Close()

	var cols []schema.ColumnInfo
	for rows.Next() {
		var c schema.ColumnInfo
		var nullable string
		if err := rows.Scan(&c.Name, &c.DataType, &nullable, &c.IsKey); err != nil {
			return nil, err
		}
		c.IsNullable = nullable == "YES"
		cols = append(cols, c)
	}
	return cols, rows.Err()
}

func (a *PostgresAdapter) GetForeignKeys(db *sql.DB, dbName, tableName string) ([]schema.ForeignKey, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "public"
	}

	rows, err := db.Query(`
		SELECT
			tc.constraint_name,
			kcu.column_name,
			ccu.table_name AS referenced_table,
			ccu.column_name AS referenced_column
		FROM information_schema.table_constraints tc
		JOIN information_schema.key_column_usage kcu
		  ON tc.constraint_name = kcu.constraint_name
		  AND tc.constraint_schema = kcu.constraint_schema
		JOIN information_schema.constraint_column_usage ccu
		  ON tc.constraint_name = ccu.constraint_name
		  AND tc.constraint_schema = ccu.constraint_schema
		WHERE tc.constraint_type = 'FOREIGN KEY'
		  AND tc.table_schema = $1
		  AND tc.table_name = $2
		ORDER BY tc.constraint_name
	`, schemaName, tableName)
	if err != nil {
		return nil, fmt.Errorf("querying FKs for %s.%s: %w", schemaName, tableName, err)
	}
	defer rows.Close()

	var fks []schema.ForeignKey
	for rows.Next() {
		var fk schema.ForeignKey
		if err := rows.Scan(&fk.ConstraintName, &fk.Column,
			&fk.ReferencedTable, &fk.ReferencedColumn); err != nil {
			return nil, err
		}
		fks = append(fks, fk)
	}
	return fks, rows.Err()
}
