package transformer

import (
	"testing"
)

// helper to create a basic TransformContext.
func newTestCtx() *TransformContext {
	return &TransformContext{
		Lineage:    make([]LineageEntry, 0),
		Exceptions: make([]ExceptionEntry, 0),
	}
}

// ===== TypeCoerce =====

func TestTypeCoerce_IntFromString(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "age", CanonicalType: "INTEGER"}
	v, err := h.Apply("42", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.(int64) != 42 {
		t.Errorf("expected 42, got %v", v)
	}
}

func TestTypeCoerce_IntFromFloat(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "count", CanonicalType: "INTEGER"}
	v, err := h.Apply(float64(7), nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.(int64) != 7 {
		t.Errorf("expected 7, got %v", v)
	}
}

func TestTypeCoerce_IntFromFractionalFloat_Fails(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "count", CanonicalType: "INTEGER"}
	_, err := h.Apply(3.14, nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for fractional float → integer")
	}
	if len(ctx.Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(ctx.Exceptions))
	}
	if ctx.Exceptions[0].ExceptionType != ExceptionInvalidFormat {
		t.Errorf("expected INVALID_FORMAT, got %s", ctx.Exceptions[0].ExceptionType)
	}
}

func TestTypeCoerce_DecimalFromString(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "amount", CanonicalType: "DECIMAL"}
	v, err := h.Apply("123.45", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.(float64) != 123.45 {
		t.Errorf("expected 123.45, got %v", v)
	}
}

func TestTypeCoerce_DecimalFromInt(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "amount", CanonicalType: "DECIMAL"}
	v, err := h.Apply(42, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.(float64) != 42.0 {
		t.Errorf("expected 42.0, got %v", v)
	}
}

func TestTypeCoerce_BoolFromString(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "active", CanonicalType: "BOOLEAN"}

	cases := []struct {
		in   string
		want bool
	}{
		{"true", true}, {"false", false},
		{"1", true}, {"0", false},
		{"yes", true}, {"no", false},
		{"Y", true}, {"N", false},
		{"T", true}, {"F", false},
	}
	for _, tc := range cases {
		v, err := h.Apply(tc.in, nil, m, ctx)
		if err != nil {
			t.Errorf("unexpected error for %q: %v", tc.in, err)
			continue
		}
		if v.(bool) != tc.want {
			t.Errorf("input %q: expected %v, got %v", tc.in, tc.want, v)
		}
	}
}

func TestTypeCoerce_BoolInvalid(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "active", CanonicalType: "BOOLEAN"}
	_, err := h.Apply("maybe", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for invalid boolean")
	}
}

func TestTypeCoerce_VarcharPassthrough(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name", CanonicalType: "VARCHAR"}
	v, err := h.Apply(12345, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "12345" {
		t.Errorf("expected string '12345', got %v (%T)", v, v)
	}
}

func TestTypeCoerce_UUID_Valid(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "id", CanonicalType: "UUID"}
	v, err := h.Apply("550e8400-e29b-41d4-a716-446655440000", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "550e8400-e29b-41d4-a716-446655440000" {
		t.Errorf("unexpected value: %v", v)
	}
}

func TestTypeCoerce_UUID_Invalid(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "id", CanonicalType: "UUID"}
	_, err := h.Apply("not-a-uuid", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for invalid UUID")
	}
}

func TestTypeCoerce_Nil(t *testing.T) {
	h := TypeCoerceHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "x", CanonicalType: "INTEGER"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

// ===== NormalizeSSN =====

func TestNormalizeSSN_StripsDashes(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "ssn"}
	v, err := h.Apply("123-45-6789", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "123456789" {
		t.Errorf("expected 123456789, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Errorf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
}

func TestNormalizeSSN_StripsSpaces(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "social_security_number"}
	v, err := h.Apply("123 45 6789", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "123456789" {
		t.Errorf("expected 123456789, got %v", v)
	}
}

func TestNormalizeSSN_AlreadyClean(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "ssn"}
	v, err := h.Apply("123456789", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "123456789" {
		t.Errorf("expected 123456789, got %v", v)
	}
	if len(ctx.Lineage) != 0 {
		t.Errorf("expected no lineage for clean SSN, got %d", len(ctx.Lineage))
	}
}

func TestNormalizeSSN_WrongLength(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "ssn"}
	_, err := h.Apply("12345", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for short SSN")
	}
	if len(ctx.Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(ctx.Exceptions))
	}
}

func TestNormalizeSSN_NonSSNColumn_PassThrough(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("123-45-6789", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// Should pass through unchanged for non-SSN columns.
	if v != "123-45-6789" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

func TestNormalizeSSN_Nil(t *testing.T) {
	h := NormalizeSSNHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "ssn"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

// ===== ParseDate =====

func TestParseDate_ISO(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	v, err := h.Apply("2024-03-15", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-15" {
		t.Errorf("expected 2024-03-15, got %v", v)
	}
}

func TestParseDate_MMDDYYYY(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "hire_date", CanonicalType: "DATE"}
	v, err := h.Apply("03/15/2024", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-15" {
		t.Errorf("expected 2024-03-15, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Errorf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
}

func TestParseDate_YYYYMMDD_Compact(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "term_date", CanonicalType: "DATE"}
	v, err := h.Apply("20240315", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-15" {
		t.Errorf("expected 2024-03-15, got %v", v)
	}
}

func TestParseDate_OracleStyle(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "eff_date", CanonicalType: "DATE"}
	v, err := h.Apply("15-Mar-2024", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-15" {
		t.Errorf("expected 2024-03-15, got %v", v)
	}
}

func TestParseDate_Invalid(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	_, err := h.Apply("not-a-date", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for invalid date")
	}
	if len(ctx.Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(ctx.Exceptions))
	}
}

func TestParseDate_NonDateColumn_PassThrough(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name", CanonicalType: "VARCHAR"}
	v, err := h.Apply("not-a-date", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "not-a-date" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

func TestParseDate_Nil(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

func TestParseDate_MMDDYYYY_SingleDigit(t *testing.T) {
	h := ParseDateHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	v, err := h.Apply("3/5/2024", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-05" {
		t.Errorf("expected 2024-03-05, got %v", v)
	}
}

// ===== ResolveCode =====

func TestResolveCode_MapsValue(t *testing.T) {
	h := ResolveCodeHandler()
	ctx := newTestCtx()
	ctx.CodeMappings = map[string]map[string]string{
		"plan_code": {"401": "PLAN_A", "402": "PLAN_B"},
	}
	m := FieldMapping{CanonicalColumn: "plan_code"}
	v, err := h.Apply("401", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "PLAN_A" {
		t.Errorf("expected PLAN_A, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Errorf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
}

func TestResolveCode_UnmappedValue(t *testing.T) {
	h := ResolveCodeHandler()
	ctx := newTestCtx()
	ctx.CodeMappings = map[string]map[string]string{
		"plan_code": {"401": "PLAN_A"},
	}
	m := FieldMapping{CanonicalColumn: "plan_code"}
	_, err := h.Apply("999", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for unmapped code")
	}
	if len(ctx.Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(ctx.Exceptions))
	}
	if ctx.Exceptions[0].ExceptionType != ExceptionReferentialIntegrity {
		t.Errorf("expected REFERENTIAL_INTEGRITY, got %s", ctx.Exceptions[0].ExceptionType)
	}
}

func TestResolveCode_NoMappingTable_PassThrough(t *testing.T) {
	h := ResolveCodeHandler()
	ctx := newTestCtx()
	ctx.CodeMappings = map[string]map[string]string{}
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("hello", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "hello" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

func TestResolveCode_NilCodeMappings_PassThrough(t *testing.T) {
	h := ResolveCodeHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "plan_code"}
	v, err := h.Apply("401", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "401" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

// ===== ResolveMemberKey =====

func TestResolveMemberKey_ValuePresent_PassThrough(t *testing.T) {
	h := ResolveMemberKeyHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "member_id"}
	v, err := h.Apply("M123", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "M123" {
		t.Errorf("expected M123, got %v", v)
	}
}

func TestResolveMemberKey_Nil_FallbackToAlias(t *testing.T) {
	h := ResolveMemberKeyHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{"MBR_NBR": "FALLBACK-001"}
	m := FieldMapping{CanonicalColumn: "member_id"}
	v, err := h.Apply(nil, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "FALLBACK-001" {
		t.Errorf("expected FALLBACK-001, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Errorf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
}

func TestResolveMemberKey_Nil_NoFallback(t *testing.T) {
	h := ResolveMemberKeyHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{"some_other_col": "val"}
	m := FieldMapping{CanonicalColumn: "member_id"}
	v, err := h.Apply(nil, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

func TestResolveMemberKey_NonMemberColumn(t *testing.T) {
	h := ResolveMemberKeyHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil passthrough, got %v", v)
	}
}

// ===== ResolveStatus =====

func TestResolveStatus_Active(t *testing.T) {
	h := ResolveStatusHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "status"}
	cases := []struct{ in, want string }{
		{"A", "ACTIVE"}, {"active", "ACTIVE"}, {"ACT", "ACTIVE"}, {"1", "ACTIVE"},
	}
	for _, tc := range cases {
		ctx.Lineage = nil
		v, err := h.Apply(tc.in, nil, m, ctx)
		if err != nil {
			t.Fatalf("input %q: unexpected error: %v", tc.in, err)
		}
		if v != tc.want {
			t.Errorf("input %q: expected %s, got %v", tc.in, tc.want, v)
		}
	}
}

func TestResolveStatus_Retired(t *testing.T) {
	h := ResolveStatusHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "member_status"}
	v, err := h.Apply("RET", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "RETIRED" {
		t.Errorf("expected RETIRED, got %v", v)
	}
}

func TestResolveStatus_UnknownValue_PassThrough(t *testing.T) {
	h := ResolveStatusHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "status"}
	v, err := h.Apply("CUSTOM_STATUS", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "CUSTOM_STATUS" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

func TestResolveStatus_NonStatusColumn(t *testing.T) {
	h := ResolveStatusHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("A", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "A" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

func TestResolveStatus_Nil(t *testing.T) {
	h := ResolveStatusHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "status"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

// ===== DetectGranularity =====

func TestDetectGranularity_Annual(t *testing.T) {
	h := DetectGranularityHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"period_start": "2023-01-01",
		"period_end":   "2023-12-31",
	}
	m := FieldMapping{CanonicalColumn: "salary_amount"}
	v, err := h.Apply(75000.0, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != 75000.0 {
		t.Errorf("expected value unchanged, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
	if !contains(ctx.Lineage[0].ResultValue, "ANNUAL") {
		t.Errorf("expected ANNUAL annotation, got %s", ctx.Lineage[0].ResultValue)
	}
}

func TestDetectGranularity_Detailed(t *testing.T) {
	h := DetectGranularityHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"period_start": "2023-01-01",
		"period_end":   "2023-01-31",
	}
	m := FieldMapping{CanonicalColumn: "salary_amount"}
	v, err := h.Apply(6250.0, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != 6250.0 {
		t.Errorf("expected value unchanged, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
	if !contains(ctx.Lineage[0].ResultValue, "DETAILED") {
		t.Errorf("expected DETAILED annotation, got %s", ctx.Lineage[0].ResultValue)
	}
}

func TestDetectGranularity_NonSalaryColumn_PassThrough(t *testing.T) {
	h := DetectGranularityHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("hello", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "hello" {
		t.Errorf("expected passthrough, got %v", v)
	}
	if len(ctx.Lineage) != 0 {
		t.Errorf("expected no lineage, got %d", len(ctx.Lineage))
	}
}

// ===== DeduplicateQDRO =====

func TestDeduplicateQDRO_FlaggedWithBeneficiaryID(t *testing.T) {
	h := DeduplicateQDROHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"qdro_flag":      "Y",
		"beneficiary_id": "BEN-001",
	}
	m := FieldMapping{CanonicalColumn: "qdro_flag"}
	v, err := h.Apply("Y", row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "Y" {
		t.Errorf("expected value unchanged, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
	if !contains(ctx.Lineage[0].ResultValue, "QDRO duplicate") {
		t.Errorf("expected QDRO duplicate annotation, got %s", ctx.Lineage[0].ResultValue)
	}
}

func TestDeduplicateQDRO_NotFlagged(t *testing.T) {
	h := DeduplicateQDROHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"qdro_flag": "N",
	}
	m := FieldMapping{CanonicalColumn: "qdro_flag"}
	v, err := h.Apply("N", row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "N" {
		t.Errorf("expected passthrough, got %v", v)
	}
	if len(ctx.Lineage) != 0 {
		t.Errorf("expected no lineage, got %d", len(ctx.Lineage))
	}
}

func TestDeduplicateQDRO_NonQDROColumn(t *testing.T) {
	h := DeduplicateQDROHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("test", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "test" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

// ===== ResolveAddress =====

func TestResolveAddress_MailingPriority(t *testing.T) {
	h := ResolveAddressHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"mail_city": "Denver",
		"home_city": "Boulder",
		"work_city": "Aurora",
	}
	m := FieldMapping{CanonicalColumn: "city"}
	v, err := h.Apply(nil, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "Denver" {
		t.Errorf("expected Denver (mailing priority), got %v", v)
	}
}

func TestResolveAddress_FallbackToHome(t *testing.T) {
	h := ResolveAddressHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"home_city": "Boulder",
		"work_city": "Aurora",
	}
	m := FieldMapping{CanonicalColumn: "city"}
	v, err := h.Apply(nil, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "Boulder" {
		t.Errorf("expected Boulder (home fallback), got %v", v)
	}
}

func TestResolveAddress_ValuePresent_NoOverride(t *testing.T) {
	h := ResolveAddressHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "city"}
	v, err := h.Apply("ExistingCity", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "ExistingCity" {
		t.Errorf("expected existing value, got %v", v)
	}
}

func TestResolveAddress_NonAddressColumn(t *testing.T) {
	h := ResolveAddressHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

// ===== MapHireDates =====

func TestMapHireDates_CareerHireWithRehire(t *testing.T) {
	h := MapHireDatesHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"rehire_date": "2020-01-15",
	}
	m := FieldMapping{CanonicalColumn: "hire_date"}
	v, err := h.Apply("2005-06-01", row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2005-06-01" {
		t.Errorf("expected unchanged value, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
	if !contains(ctx.Lineage[0].ResultValue, "career hire") {
		t.Errorf("expected career hire annotation, got %s", ctx.Lineage[0].ResultValue)
	}
}

func TestMapHireDates_SpellStartWithCareer(t *testing.T) {
	h := MapHireDatesHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"hire_date": "2005-06-01",
	}
	m := FieldMapping{CanonicalColumn: "spell_start_date"}
	v, err := h.Apply("2020-01-15", row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2020-01-15" {
		t.Errorf("expected unchanged value, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Fatalf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
	if !contains(ctx.Lineage[0].ResultValue, "spell start") {
		t.Errorf("expected spell start annotation, got %s", ctx.Lineage[0].ResultValue)
	}
}

func TestMapHireDates_NonHireColumn(t *testing.T) {
	h := MapHireDatesHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "name"}
	v, err := h.Apply("test", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "test" {
		t.Errorf("expected passthrough, got %v", v)
	}
}

// ===== DeriveDefaults =====

func TestDeriveDefaults_DefaultValue(t *testing.T) {
	h := DeriveDefaultsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "status", DefaultValue: "ACTIVE"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "ACTIVE" {
		t.Errorf("expected ACTIVE, got %v", v)
	}
	if len(ctx.Lineage) != 1 {
		t.Errorf("expected 1 lineage entry, got %d", len(ctx.Lineage))
	}
}

func TestDeriveDefaults_ValuePresent_NoDefault(t *testing.T) {
	h := DeriveDefaultsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "status", DefaultValue: "ACTIVE"}
	v, err := h.Apply("RETIRED", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "RETIRED" {
		t.Errorf("expected RETIRED (existing value), got %v", v)
	}
}

func TestDeriveDefaults_FullName(t *testing.T) {
	h := DeriveDefaultsHandler()
	ctx := newTestCtx()
	row := map[string]interface{}{
		"first_name": "John",
		"last_name":  "Doe",
	}
	m := FieldMapping{CanonicalColumn: "full_name"}
	v, err := h.Apply(nil, row, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "John Doe" {
		t.Errorf("expected 'John Doe', got %v", v)
	}
}

func TestDeriveDefaults_NilNoDefault(t *testing.T) {
	h := DeriveDefaultsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "something"}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

// ===== ValidateConstraints =====

func TestValidateConstraints_RequiredNull(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "member_id", CanonicalType: "VARCHAR", Required: true}
	_, err := h.Apply(nil, nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for required NULL")
	}
	if len(ctx.Exceptions) != 1 {
		t.Fatalf("expected 1 exception, got %d", len(ctx.Exceptions))
	}
	if ctx.Exceptions[0].ExceptionType != ExceptionMissingRequired {
		t.Errorf("expected MISSING_REQUIRED, got %s", ctx.Exceptions[0].ExceptionType)
	}
}

func TestValidateConstraints_OptionalNull_OK(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "middle_name", CanonicalType: "VARCHAR", Required: false}
	v, err := h.Apply(nil, nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != nil {
		t.Errorf("expected nil, got %v", v)
	}
}

func TestValidateConstraints_ValidInteger(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "age", CanonicalType: "INTEGER"}
	v, err := h.Apply(int64(42), nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v.(int64) != 42 {
		t.Errorf("expected 42, got %v", v)
	}
}

func TestValidateConstraints_InvalidInteger(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "age", CanonicalType: "INTEGER"}
	_, err := h.Apply("abc", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for invalid integer")
	}
}

func TestValidateConstraints_ValidDate(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	v, err := h.Apply("2024-03-15", nil, m, ctx)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if v != "2024-03-15" {
		t.Errorf("expected 2024-03-15, got %v", v)
	}
}

func TestValidateConstraints_InvalidDate(t *testing.T) {
	h := ValidateConstraintsHandler()
	ctx := newTestCtx()
	m := FieldMapping{CanonicalColumn: "birth_date", CanonicalType: "DATE"}
	_, err := h.Apply("not-a-date", nil, m, ctx)
	if err == nil {
		t.Fatal("expected error for invalid date")
	}
}

// helper
func contains(s, substr string) bool {
	return len(s) >= len(substr) && containsStr(s, substr)
}

func containsStr(s, sub string) bool {
	for i := 0; i <= len(s)-len(sub); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
