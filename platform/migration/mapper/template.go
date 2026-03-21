package mapper

// MappingTemplate defines expected canonical columns for a concept-tagged table.
type MappingTemplate struct {
	ConceptTag     string         `json:"concept_tag"`
	CanonicalTable string         `json:"canonical_table"`
	Description    string         `json:"description"`
	Slots          []TemplateSlot `json:"slots"`
}

// TemplateSlot is one canonical column with patterns for finding it in source.
type TemplateSlot struct {
	CanonicalColumn string   `json:"canonical_column"`
	DataTypeFamily  string   `json:"data_type_family"` // "INTEGER", "DECIMAL", "VARCHAR", "DATE", "BOOLEAN", "UUID", "TEXT"
	Required        bool     `json:"required"`         // Must be mapped for migration to proceed
	ExpectedNames   []string `json:"expected_names"`   // Source column name patterns (lowercase)
}
