package introspect

import (
	"database/sql"

	"github.com/noui/platform/connector/schema"
)

// MySQLAdapter implements SchemaAdapter for MySQL/MariaDB databases.
type MySQLAdapter struct{}

func (a *MySQLAdapter) GetTables(db *sql.DB, dbName string) ([]schema.TableInfo, error) {
	rows, err := db.Query(`
		SELECT TABLE_NAME, COALESCE(TABLE_ROWS, 0)
		FROM information_schema.TABLES
		WHERE TABLE_SCHEMA = ?
		  AND TABLE_TYPE = 'BASE TABLE'
		ORDER BY TABLE_NAME
	`, dbName)
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

func (a *MySQLAdapter) GetColumns(db *sql.DB, dbName, tableName string) ([]schema.ColumnInfo, error) {
	rows, err := db.Query(`
		SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COALESCE(COLUMN_KEY, '')
		FROM information_schema.COLUMNS
		WHERE TABLE_SCHEMA = ?
		  AND TABLE_NAME = ?
		ORDER BY ORDINAL_POSITION
	`, dbName, tableName)
	if err != nil {
		return nil, err
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

func (a *MySQLAdapter) GetForeignKeys(db *sql.DB, dbName, tableName string) ([]schema.ForeignKey, error) {
	rows, err := db.Query(`
		SELECT CONSTRAINT_NAME, COLUMN_NAME,
		       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
		FROM information_schema.KEY_COLUMN_USAGE
		WHERE TABLE_SCHEMA = ?
		  AND TABLE_NAME = ?
		  AND REFERENCED_TABLE_NAME IS NOT NULL
		ORDER BY CONSTRAINT_NAME
	`, dbName, tableName)
	if err != nil {
		return nil, err
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
