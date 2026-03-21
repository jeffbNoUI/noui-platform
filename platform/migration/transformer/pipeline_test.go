package transformer

import (
	"fmt"
	"testing"
)

func TestNewPipeline_SortsByPriority(t *testing.T) {
	handlers := []TransformHandler{
		{Name: "C", Priority: 30},
		{Name: "A", Priority: 10},
		{Name: "B", Priority: 20},
	}
	p := NewPipeline(handlers)
	if p.handlers[0].Name != "A" {
		t.Errorf("expected first handler to be A (priority 10), got %s", p.handlers[0].Name)
	}
	if p.handlers[1].Name != "B" {
		t.Errorf("expected second handler to be B (priority 20), got %s", p.handlers[1].Name)
	}
	if p.handlers[2].Name != "C" {
		t.Errorf("expected third handler to be C (priority 30), got %s", p.handlers[2].Name)
	}
}

func TestPipeline_Transform_SingleRow(t *testing.T) {
	// Simple pipeline: just uppercase strings.
	upper := TransformHandler{
		Name:     "Upper",
		Priority: 10,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if s, ok := value.(string); ok {
				result := ""
				for _, c := range s {
					if c >= 'a' && c <= 'z' {
						result += string(rune(c - 32))
					} else {
						result += string(c)
					}
				}
				return result, nil
			}
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{upper})
	rows := []map[string]interface{}{
		{"name_src": "alice", "age_src": 30},
	}
	mappings := []FieldMapping{
		{SourceColumn: "name_src", CanonicalColumn: "name"},
		{SourceColumn: "age_src", CanonicalColumn: "age"},
	}

	results := p.Transform(rows, mappings)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if results[0].CanonicalRow["name"] != "ALICE" {
		t.Errorf("expected ALICE, got %v", results[0].CanonicalRow["name"])
	}
	if results[0].CanonicalRow["age"] != 30 {
		t.Errorf("expected 30, got %v", results[0].CanonicalRow["age"])
	}
}

func TestPipeline_Transform_MultipleRows(t *testing.T) {
	noop := TransformHandler{
		Name:     "Noop",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{noop})
	rows := []map[string]interface{}{
		{"col": "row1"},
		{"col": "row2"},
		{"col": "row3"},
	}
	mappings := []FieldMapping{
		{SourceColumn: "col", CanonicalColumn: "target"},
	}

	results := p.Transform(rows, mappings)
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}
	for i, expected := range []string{"row1", "row2", "row3"} {
		if results[i].CanonicalRow["target"] != expected {
			t.Errorf("row %d: expected %s, got %v", i, expected, results[i].CanonicalRow["target"])
		}
	}
}

func TestPipeline_Transform_HandlerError_SetsNil(t *testing.T) {
	failing := TransformHandler{
		Name:     "Fail",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			ctx.AddException("Fail", mapping.CanonicalColumn, fmtValue(value), ExceptionInvalidFormat, "test error")
			return nil, fmt.Errorf("test error")
		},
	}

	p := NewPipeline([]TransformHandler{failing})
	rows := []map[string]interface{}{
		{"col": "bad_value"},
	}
	mappings := []FieldMapping{
		{SourceColumn: "col", CanonicalColumn: "target"},
	}

	results := p.Transform(rows, mappings)
	if results[0].CanonicalRow["target"] != nil {
		t.Errorf("expected nil after handler error, got %v", results[0].CanonicalRow["target"])
	}
	if len(results[0].Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(results[0].Exceptions))
	}
	// Confidence should be ESTIMATED when exceptions exist.
	if results[0].Confidence != ConfidenceEstimated {
		t.Errorf("expected ESTIMATED confidence, got %s", results[0].Confidence)
	}
}

func TestPipeline_Transform_HandlerOrder(t *testing.T) {
	// Track execution order.
	var order []string

	h1 := TransformHandler{
		Name:     "First",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			order = append(order, "First")
			return value, nil
		},
	}
	h2 := TransformHandler{
		Name:     "Second",
		Priority: 20,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			order = append(order, "Second")
			return value, nil
		},
	}
	h3 := TransformHandler{
		Name:     "Third",
		Priority: 30,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			order = append(order, "Third")
			return value, nil
		},
	}

	// Add in reverse order to verify sorting.
	p := NewPipeline([]TransformHandler{h3, h1, h2})
	rows := []map[string]interface{}{{"x": 1}}
	mappings := []FieldMapping{{SourceColumn: "x", CanonicalColumn: "x"}}
	p.Transform(rows, mappings)

	if len(order) != 3 {
		t.Fatalf("expected 3 calls, got %d", len(order))
	}
	if order[0] != "First" || order[1] != "Second" || order[2] != "Third" {
		t.Errorf("wrong order: %v", order)
	}
}

func TestPipeline_Confidence_Actual(t *testing.T) {
	noop := TransformHandler{
		Name:     "Noop",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{noop})
	rows := []map[string]interface{}{{"col": "hello"}}
	mappings := []FieldMapping{{SourceColumn: "col", CanonicalColumn: "target"}}

	results := p.Transform(rows, mappings)
	if results[0].Confidence != ConfidenceActual {
		t.Errorf("expected ACTUAL confidence, got %s", results[0].Confidence)
	}
}

func TestPipeline_Confidence_Derived(t *testing.T) {
	// Simulate DeriveDefaults adding a lineage entry.
	deriver := TransformHandler{
		Name:     "DeriveDefaults",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				ctx.AddLineage("DeriveDefaults", mapping.CanonicalColumn, "<nil>", "default_val")
				return "default_val", nil
			}
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{deriver})
	rows := []map[string]interface{}{{"other": "x"}} // "col" not present
	mappings := []FieldMapping{{SourceColumn: "col", CanonicalColumn: "target"}}

	results := p.Transform(rows, mappings)
	if results[0].Confidence != ConfidenceDerived {
		t.Errorf("expected DERIVED confidence, got %s", results[0].Confidence)
	}
}

func TestPipeline_MissingSourceColumn_IsNil(t *testing.T) {
	noop := TransformHandler{
		Name:     "Noop",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{noop})
	rows := []map[string]interface{}{{"other_col": "hello"}}
	mappings := []FieldMapping{{SourceColumn: "missing_col", CanonicalColumn: "target"}}

	results := p.Transform(rows, mappings)
	if results[0].CanonicalRow["target"] != nil {
		t.Errorf("expected nil for missing source column, got %v", results[0].CanonicalRow["target"])
	}
}

func TestPipeline_TransformWithContext(t *testing.T) {
	resolveCode := ResolveCodeHandler()
	p := NewPipeline([]TransformHandler{resolveCode})

	sharedCtx := &TransformContext{
		EngagementID:   "eng-001",
		MappingVersion: "v1",
		CodeMappings: map[string]map[string]string{
			"plan_code": {"401": "PLAN_A"},
		},
	}

	rows := []map[string]interface{}{
		{"plan": "401"},
	}
	mappings := []FieldMapping{
		{SourceColumn: "plan", CanonicalColumn: "plan_code"},
	}

	results := p.TransformWithContext(rows, mappings, sharedCtx)
	if results[0].CanonicalRow["plan_code"] != "PLAN_A" {
		t.Errorf("expected PLAN_A, got %v", results[0].CanonicalRow["plan_code"])
	}
}

func TestPipeline_Transform_EmptyRows(t *testing.T) {
	noop := TransformHandler{
		Name:     "Noop",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{noop})
	results := p.Transform(nil, nil)
	if len(results) != 0 {
		t.Errorf("expected 0 results for nil input, got %d", len(results))
	}
}

func TestDefaultPipeline_Has12Handlers(t *testing.T) {
	p := DefaultPipeline()
	if len(p.handlers) != 12 {
		t.Errorf("expected 12 handlers, got %d", len(p.handlers))
	}

	// Verify priority ordering.
	for i := 1; i < len(p.handlers); i++ {
		if p.handlers[i].Priority < p.handlers[i-1].Priority {
			t.Errorf("handler %s (priority %d) is before %s (priority %d)",
				p.handlers[i].Name, p.handlers[i].Priority,
				p.handlers[i-1].Name, p.handlers[i-1].Priority)
		}
	}
}

func TestDefaultPipeline_HandlerNames(t *testing.T) {
	p := DefaultPipeline()
	expected := []string{
		"TypeCoerce", "NormalizeSSN", "ParseDate", "ResolveCode",
		"ResolveMemberKey", "ResolveStatus", "DetectGranularity",
		"DeduplicateQDRO", "ResolveAddress", "MapHireDates",
		"DeriveDefaults", "ValidateConstraints",
	}
	for i, name := range expected {
		if p.handlers[i].Name != name {
			t.Errorf("handler %d: expected %s, got %s", i, name, p.handlers[i].Name)
		}
	}
}

// Integration test: run a row through the full default pipeline.
func TestDefaultPipeline_EndToEnd(t *testing.T) {
	p := DefaultPipeline()

	sourceRow := map[string]interface{}{
		"MBR_NBR":    "M-12345",
		"BIRTH_DT":   "03/15/1985",
		"SSN_COL":    "123-45-6789",
		"STATUS_COL": "A",
		"SALARY":     "75000",
		"first_name": "John",
		"last_name":  "Doe",
	}

	mappings := []FieldMapping{
		{SourceColumn: "MBR_NBR", CanonicalColumn: "member_id", CanonicalType: "VARCHAR", Required: true},
		{SourceColumn: "BIRTH_DT", CanonicalColumn: "birth_date", CanonicalType: "DATE"},
		{SourceColumn: "SSN_COL", CanonicalColumn: "ssn", CanonicalType: "VARCHAR"},
		{SourceColumn: "STATUS_COL", CanonicalColumn: "status", CanonicalType: "VARCHAR"},
		{SourceColumn: "SALARY", CanonicalColumn: "salary_amount", CanonicalType: "DECIMAL"},
		{SourceColumn: "MISSING_COL", CanonicalColumn: "full_name", CanonicalType: "VARCHAR"},
	}

	results := p.Transform([]map[string]interface{}{sourceRow}, mappings)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}

	r := results[0]

	// member_id should pass through.
	if r.CanonicalRow["member_id"] != "M-12345" {
		t.Errorf("member_id: expected M-12345, got %v", r.CanonicalRow["member_id"])
	}

	// birth_date should be parsed to ISO.
	if r.CanonicalRow["birth_date"] != "1985-03-15" {
		t.Errorf("birth_date: expected 1985-03-15, got %v", r.CanonicalRow["birth_date"])
	}

	// SSN should be normalised.
	if r.CanonicalRow["ssn"] != "123456789" {
		t.Errorf("ssn: expected 123456789, got %v", r.CanonicalRow["ssn"])
	}

	// Status should be resolved.
	if r.CanonicalRow["status"] != "ACTIVE" {
		t.Errorf("status: expected ACTIVE, got %v", r.CanonicalRow["status"])
	}

	// Salary should be coerced to float.
	if sal, ok := r.CanonicalRow["salary_amount"].(float64); !ok || sal != 75000.0 {
		t.Errorf("salary_amount: expected 75000.0, got %v (%T)", r.CanonicalRow["salary_amount"], r.CanonicalRow["salary_amount"])
	}

	// full_name should be derived from first_name + last_name.
	if r.CanonicalRow["full_name"] != "John Doe" {
		t.Errorf("full_name: expected 'John Doe', got %v", r.CanonicalRow["full_name"])
	}

	// Should have lineage entries for transformations.
	if len(r.Lineage) == 0 {
		t.Error("expected at least one lineage entry")
	}
}

// Test that error in one handler stops the chain for that field.
func TestPipeline_ErrorStopsChain(t *testing.T) {
	callCount := 0

	failing := TransformHandler{
		Name:     "Fail",
		Priority: 10,
		Apply: func(value interface{}, _ map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			callCount++
			return nil, fmt.Errorf("fail")
		},
	}
	second := TransformHandler{
		Name:     "Never",
		Priority: 20,
		Apply: func(value interface{}, _ map[string]interface{}, _ FieldMapping, _ *TransformContext) (interface{}, error) {
			callCount++
			return value, nil
		},
	}

	p := NewPipeline([]TransformHandler{failing, second})
	rows := []map[string]interface{}{{"x": "val"}}
	mappings := []FieldMapping{{SourceColumn: "x", CanonicalColumn: "x"}}
	p.Transform(rows, mappings)

	if callCount != 1 {
		t.Errorf("expected only 1 handler call (error stops chain), got %d", callCount)
	}
}
