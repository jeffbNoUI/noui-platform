package introspect

import (
	"database/sql"
	"fmt"

	"github.com/noui/platform/connector/schema"

	_ "github.com/microsoft/go-mssqldb"
)

// MSSQLAdapter implements SchemaAdapter for Microsoft SQL Server databases.
// Uses sys.tables + sys.partitions for row counts and sys.foreign_keys for FK discovery.
// Default schema: "dbo" (MSSQL convention).
type MSSQLAdapter struct{}

func (a *MSSQLAdapter) GetTables(db *sql.DB, dbName string) ([]schema.TableInfo, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "dbo"
	}

	rows, err := db.Query(`
		SELECT t.name, COALESCE(SUM(p.rows), 0)
		FROM sys.tables t
		INNER JOIN sys.partitions p
		  ON t.object_id = p.object_id AND p.index_id IN (0, 1)
		INNER JOIN sys.schemas s
		  ON t.schema_id = s.schema_id
		WHERE s.name = @p1
		  AND t.type = 'U'
		GROUP BY t.name
		ORDER BY t.name
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

func (a *MSSQLAdapter) GetColumns(db *sql.DB, dbName, tableName string) ([]schema.ColumnInfo, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "dbo"
	}

	rows, err := db.Query(`
		SELECT
			c.COLUMN_NAME,
			c.DATA_TYPE,
			c.IS_NULLABLE,
			COALESCE(
				(SELECT TOP 1
					CASE tc.CONSTRAINT_TYPE
						WHEN 'PRIMARY KEY' THEN 'PRI'
						WHEN 'UNIQUE' THEN 'UNI'
						WHEN 'FOREIGN KEY' THEN 'MUL'
					END
				FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
				JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
				  ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
				  AND kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
				WHERE kcu.TABLE_SCHEMA = c.TABLE_SCHEMA
				  AND kcu.TABLE_NAME = c.TABLE_NAME
				  AND kcu.COLUMN_NAME = c.COLUMN_NAME
				ORDER BY CASE tc.CONSTRAINT_TYPE
					WHEN 'PRIMARY KEY' THEN 1
					WHEN 'UNIQUE' THEN 2
					WHEN 'FOREIGN KEY' THEN 3
				END),
				''
			) AS key_type
		FROM INFORMATION_SCHEMA.COLUMNS c
		WHERE c.TABLE_SCHEMA = @p1
		  AND c.TABLE_NAME = @p2
		ORDER BY c.ORDINAL_POSITION
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

func (a *MSSQLAdapter) GetForeignKeys(db *sql.DB, dbName, tableName string) ([]schema.ForeignKey, error) {
	schemaName := dbName
	if schemaName == "" {
		schemaName = "dbo"
	}

	rows, err := db.Query(`
		SELECT
			fk.name AS constraint_name,
			COL_NAME(fkc.parent_object_id, fkc.parent_column_id) AS column_name,
			OBJECT_NAME(fkc.referenced_object_id) AS referenced_table,
			COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS referenced_column
		FROM sys.foreign_keys fk
		INNER JOIN sys.foreign_key_columns fkc
		  ON fk.object_id = fkc.constraint_object_id
		INNER JOIN sys.tables t
		  ON fk.parent_object_id = t.object_id
		INNER JOIN sys.schemas s
		  ON t.schema_id = s.schema_id
		WHERE s.name = @p1
		  AND t.name = @p2
		ORDER BY fk.name
	`, schemaName, tableName)
	if err != nil {
		return nil, fmt.Errorf("querying FKs for %s.%s: %w", schemaName, tableName, err)
	}
	defer rows.Close()

	var fks []schema.ForeignKey
	for rows.Next() {
		var fkey schema.ForeignKey
		if err := rows.Scan(&fkey.ConstraintName, &fkey.Column,
			&fkey.ReferencedTable, &fkey.ReferencedColumn); err != nil {
			return nil, err
		}
		fks = append(fks, fkey)
	}
	return fks, rows.Err()
}
