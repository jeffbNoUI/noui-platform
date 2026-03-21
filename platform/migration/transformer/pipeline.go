// Package transformer implements the ordered transformation pipeline for
// migrating source rows into the canonical schema. Handlers execute in
// priority order, producing lineage entries and exceptions along the way.
package transformer

import (
	"fmt"
	"sort"
	"time"
)

// --- Confidence levels ---

// Confidence describes how a canonical value was obtained.
type Confidence string

const (
	ConfidenceActual    Confidence = "ACTUAL"    // directly mapped, no transformation loss
	ConfidenceDerived   Confidence = "DERIVED"   // computed from related source data
	ConfidenceEstimated Confidence = "ESTIMATED" // inferred from patterns or defaults
	ConfidenceRolledUp  Confidence = "ROLLED_UP" // summarised from a prior migration
)

// --- Exception types ---

// ExceptionType classifies a data quality issue found during transformation.
type ExceptionType string

const (
	ExceptionMissingRequired      ExceptionType = "MISSING_REQUIRED"
	ExceptionInvalidFormat        ExceptionType = "INVALID_FORMAT"
	ExceptionReferentialIntegrity ExceptionType = "REFERENTIAL_INTEGRITY"
	ExceptionBusinessRule         ExceptionType = "BUSINESS_RULE"
	ExceptionCrossTableMismatch   ExceptionType = "CROSS_TABLE_MISMATCH"
	ExceptionThresholdBreach      ExceptionType = "THRESHOLD_BREACH"
)

// --- Field mapping (input to handlers) ---

// FieldMapping describes how a single source column maps to a canonical column.
type FieldMapping struct {
	SourceColumn    string `json:"source_column"`
	CanonicalColumn string `json:"canonical_column"`
	SourceType      string `json:"source_type"`    // e.g. "varchar(50)", "int4"
	CanonicalType   string `json:"canonical_type"` // e.g. "VARCHAR", "DATE", "INTEGER"
	Required        bool   `json:"required"`
	DefaultValue    string `json:"default_value,omitempty"` // for DeriveDefaults
}

// --- Lineage / Exception entries ---

// LineageEntry records one transformation step for audit purposes.
type LineageEntry struct {
	HandlerName string    `json:"handler_name"`
	Column      string    `json:"column"`
	SourceValue string    `json:"source_value"`
	ResultValue string    `json:"result_value"`
	Timestamp   time.Time `json:"timestamp"`
}

// ExceptionEntry records a data quality issue discovered during transformation.
type ExceptionEntry struct {
	HandlerName   string        `json:"handler_name"`
	Column        string        `json:"column"`
	SourceValue   string        `json:"source_value"`
	ExceptionType ExceptionType `json:"exception_type"`
	Message       string        `json:"message"`
	Timestamp     time.Time     `json:"timestamp"`
}

// --- Transform context ---

// TransformContext carries shared state through the pipeline for a single batch.
type TransformContext struct {
	EngagementID   string
	MappingVersion string
	// CodeMappings maps "table.column" → source_value → canonical_value.
	CodeMappings map[string]map[string]string
	Lineage      []LineageEntry
	Exceptions   []ExceptionEntry
}

// AddLineage appends a lineage record to the context.
func (c *TransformContext) AddLineage(handler, column, sourceVal, resultVal string) {
	c.Lineage = append(c.Lineage, LineageEntry{
		HandlerName: handler,
		Column:      column,
		SourceValue: sourceVal,
		ResultValue: resultVal,
		Timestamp:   time.Now(),
	})
}

// AddException appends an exception record to the context.
func (c *TransformContext) AddException(handler, column, sourceVal string, exType ExceptionType, msg string) {
	c.Exceptions = append(c.Exceptions, ExceptionEntry{
		HandlerName:   handler,
		Column:        column,
		SourceValue:   sourceVal,
		ExceptionType: exType,
		Message:       msg,
		Timestamp:     time.Now(),
	})
}

// --- Transform handler ---

// TransformHandler is a single step in the pipeline. Apply receives the current
// value for one field plus the full source row for cross-field logic. It returns
// the (possibly transformed) value and an error if the value should be rejected.
type TransformHandler struct {
	Name     string
	Priority int // lower = earlier execution
	Apply    func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error)
}

// --- Transform result ---

// TransformResult is the output for one source row after the full pipeline runs.
type TransformResult struct {
	CanonicalRow map[string]interface{} `json:"canonical_row"`
	Lineage      []LineageEntry         `json:"lineage"`
	Exceptions   []ExceptionEntry       `json:"exceptions"`
	Confidence   Confidence             `json:"confidence"`
}

// --- Pipeline ---

// Pipeline is an ordered collection of transform handlers.
type Pipeline struct {
	handlers []TransformHandler
}

// NewPipeline creates a Pipeline from the given handlers, sorted by priority.
func NewPipeline(handlers []TransformHandler) *Pipeline {
	sorted := make([]TransformHandler, len(handlers))
	copy(sorted, handlers)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i].Priority < sorted[j].Priority
	})
	return &Pipeline{handlers: sorted}
}

// Transform processes a batch of source rows through the handler chain.
// Each row is transformed independently. The returned slice parallels sourceRows.
func (p *Pipeline) Transform(sourceRows []map[string]interface{}, mappings []FieldMapping) []TransformResult {
	results := make([]TransformResult, len(sourceRows))
	for i, row := range sourceRows {
		results[i] = p.transformRow(row, mappings, nil)
	}
	return results
}

// transformRow runs the full handler chain on a single source row.
// If sharedCtx is non-nil, EngagementID, MappingVersion, and CodeMappings
// are copied into the per-row context.
func (p *Pipeline) transformRow(sourceRow map[string]interface{}, mappings []FieldMapping, sharedCtx *TransformContext) TransformResult {
	ctx := &TransformContext{
		Lineage:    make([]LineageEntry, 0),
		Exceptions: make([]ExceptionEntry, 0),
	}
	if sharedCtx != nil {
		ctx.EngagementID = sharedCtx.EngagementID
		ctx.MappingVersion = sharedCtx.MappingVersion
		ctx.CodeMappings = sharedCtx.CodeMappings
	}

	canonical := make(map[string]interface{}, len(mappings))
	confidence := ConfidenceActual

	for _, m := range mappings {
		value, exists := sourceRow[m.SourceColumn]
		if !exists {
			value = nil
		}

		for _, h := range p.handlers {
			var err error
			value, err = h.Apply(value, sourceRow, m, ctx)
			if err != nil {
				// The handler already recorded the exception via ctx.
				// Mark the value as nil so downstream handlers see it.
				value = nil
				break
			}
		}

		canonical[m.CanonicalColumn] = value
	}

	// Determine overall confidence: downgrade if any lineage shows derivation.
	for _, le := range ctx.Lineage {
		if le.HandlerName == "DeriveDefaults" {
			if confidence == ConfidenceActual {
				confidence = ConfidenceDerived
			}
		}
	}
	if len(ctx.Exceptions) > 0 {
		confidence = ConfidenceEstimated
	}

	return TransformResult{
		CanonicalRow: canonical,
		Lineage:      ctx.Lineage,
		Exceptions:   ctx.Exceptions,
		Confidence:   confidence,
	}
}

// TransformWithContext is like Transform but uses a shared context for code
// mappings, engagement ID, etc.
func (p *Pipeline) TransformWithContext(sourceRows []map[string]interface{}, mappings []FieldMapping, sharedCtx *TransformContext) []TransformResult {
	results := make([]TransformResult, len(sourceRows))
	for i, row := range sourceRows {
		results[i] = p.transformRow(row, mappings, sharedCtx)
	}
	return results
}

// DefaultPipeline returns a Pipeline with all 12 standard handlers in the
// correct priority order.
func DefaultPipeline() *Pipeline {
	return NewPipeline([]TransformHandler{
		TypeCoerceHandler(),
		NormalizeSSNHandler(),
		ParseDateHandler(),
		ResolveCodeHandler(),
		ResolveMemberKeyHandler(),
		ResolveStatusHandler(),
		DetectGranularityHandler(),
		DeduplicateQDROHandler(),
		ResolveAddressHandler(),
		MapHireDatesHandler(),
		DeriveDefaultsHandler(),
		ValidateConstraintsHandler(),
	})
}

// fmtValue converts an arbitrary value to a string for lineage/exception logging.
func fmtValue(v interface{}) string {
	if v == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%v", v)
}
