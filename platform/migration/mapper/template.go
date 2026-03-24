package mapper

// MappingTemplate defines expected canonical columns for a concept-tagged table.
type MappingTemplate struct {
	ConceptTag     string            `json:"concept_tag"`
	CanonicalTable string            `json:"canonical_table"`
	Description    string            `json:"description"`
	Slots          []TemplateSlot    `json:"slots"`
	Metadata       map[string]string `json:"metadata,omitempty"` // Concept-level annotations (e.g., benefit model notes)
}

// MappingWarning flags a false cognate — a term that matched but has different
// meanings across pension systems. Warnings are informational; they do not
// block matching or reduce confidence.
type MappingWarning struct {
	Term    string `json:"term"`    // The matched term that triggered the warning
	Warning string `json:"warning"` // Human-readable explanation of the ambiguity
	Risk    string `json:"risk"`    // HIGH, MEDIUM, LOW
}

// TemplateSlot is one canonical column with patterns for finding it in source.
type TemplateSlot struct {
	CanonicalColumn string   `json:"canonical_column"`
	DataTypeFamily  string   `json:"data_type_family"` // "INTEGER", "DECIMAL", "VARCHAR", "DATE", "BOOLEAN", "UUID", "TEXT"
	Required        bool     `json:"required"`         // Must be mapped for migration to proceed
	ExpectedNames   []string `json:"expected_names"`   // Source column name patterns (lowercase)
}
