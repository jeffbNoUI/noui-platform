package schema

// SchemaManifest is the top-level introspection output.
type SchemaManifest struct {
	Source         string      `json:"source"`
	Driver         string      `json:"driver"`
	Database       string      `json:"database"`
	IntrospectedAt string      `json:"introspected_at"`
	TableCount     int         `json:"table_count"`
	Tables         []TableInfo `json:"tables"`
}

// TableInfo describes a single table.
type TableInfo struct {
	Name        string       `json:"name"`
	RowCount    int64        `json:"row_count"`
	Columns     []ColumnInfo `json:"columns"`
	ForeignKeys []ForeignKey `json:"foreign_keys"`
	NoUITags    []string     `json:"noui_tags"`
}

// ColumnInfo describes a single column.
type ColumnInfo struct {
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsNullable bool   `json:"is_nullable"`
	IsKey      string `json:"key_type"`
}

// ForeignKey describes a referential constraint.
type ForeignKey struct {
	ConstraintName   string `json:"constraint_name"`
	Column           string `json:"column"`
	ReferencedTable  string `json:"referenced_table"`
	ReferencedColumn string `json:"referenced_column"`
}
