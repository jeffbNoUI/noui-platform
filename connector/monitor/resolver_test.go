package monitor

import (
	"testing"

	"github.com/noui/platform/connector/schema"
)

func testManifest() schema.SchemaManifest {
	return schema.SchemaManifest{
		Source:   "test",
		Driver:   "postgres",
		Database: "testdb",
		Tables: []schema.TableInfo{
			{
				Name:     "member_master",
				RowCount: 200,
				Columns: []schema.ColumnInfo{
					{Name: "member_id", DataType: "integer", IsKey: "PRI"},
					{Name: "first_name", DataType: "character varying"},
					{Name: "last_name", DataType: "character varying"},
					{Name: "dob", DataType: "date"},
					{Name: "gender", DataType: "character"},
					{Name: "hire_dt", DataType: "date"},
					{Name: "status_cd", DataType: "character varying"},
					{Name: "dept_cd", DataType: "character varying"},
					{Name: "pos_cd", DataType: "character varying"},
				},
				NoUITags: []string{"employee-master"},
			},
			{
				Name:     "salary_hist",
				RowCount: 6000,
				Columns: []schema.ColumnInfo{
					{Name: "salary_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "pay_period_end", DataType: "date"},
					{Name: "annual_salary", DataType: "numeric"},
					{Name: "gross_pay", DataType: "numeric"},
					{Name: "pensionable_pay", DataType: "numeric"},
					{Name: "fy_year", DataType: "integer"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"salary-history"},
			},
			{
				Name:     "employment_hist",
				RowCount: 300,
				Columns: []schema.ColumnInfo{
					{Name: "empl_hist_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "event_type", DataType: "character varying"},
					{Name: "event_dt", DataType: "date"},
					{Name: "separation_cd", DataType: "character varying"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"employment-timeline"},
			},
			{
				Name:     "beneficiary",
				RowCount: 400,
				Columns: []schema.ColumnInfo{
					{Name: "bene_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "relationship", DataType: "character varying"},
					{Name: "alloc_pct", DataType: "numeric"},
					{Name: "eff_dt", DataType: "date"},
					{Name: "end_dt", DataType: "date"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"beneficiary-designation"},
			},
			{
				Name:     "svc_credit",
				RowCount: 250,
				Columns: []schema.ColumnInfo{
					{Name: "svc_credit_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "credit_type", DataType: "character varying"},
					{Name: "begin_dt", DataType: "date"},
					{Name: "end_dt", DataType: "date"},
					{Name: "years_credited", DataType: "numeric"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"service-credit"},
			},
			{
				Name:     "dro_master",
				RowCount: 50,
				Columns: []schema.ColumnInfo{
					{Name: "dro_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "court_order_num", DataType: "character varying"},
					{Name: "status", DataType: "character varying"},
					{Name: "division_method", DataType: "character varying"},
					{Name: "division_value", DataType: "numeric"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"domestic-relations-order"},
			},
			{
				Name:     "benefit_payment",
				RowCount: 5000,
				Columns: []schema.ColumnInfo{
					{Name: "payment_id", DataType: "integer", IsKey: "PRI"},
					{Name: "member_id", DataType: "integer", IsKey: "MUL"},
					{Name: "payment_type", DataType: "character varying"},
					{Name: "gross_monthly", DataType: "numeric"},
					{Name: "net_payment", DataType: "numeric"},
					{Name: "dro_deduct", DataType: "numeric"},
					{Name: "status", DataType: "character varying"},
					{Name: "last_paid_dt", DataType: "date"},
				},
				ForeignKeys: []schema.ForeignKey{
					{Column: "member_id", ReferencedTable: "member_master", ReferencedColumn: "member_id"},
				},
				NoUITags: []string{"salary-history", "benefit-payment"},
			},
		},
	}
}

// ============================================================================
// SchemaResolver tests
// ============================================================================

func TestSchemaResolverHasTag(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	if !r.HasTag("employee-master") {
		t.Error("expected HasTag('employee-master') = true")
	}
	if !r.HasTag("salary-history") {
		t.Error("expected HasTag('salary-history') = true")
	}
	if !r.HasTag("beneficiary-designation") {
		t.Error("expected HasTag('beneficiary-designation') = true")
	}
	if r.HasTag("leave-balance") {
		t.Error("expected HasTag('leave-balance') = false")
	}
	if r.HasTag("attendance") {
		t.Error("expected HasTag('attendance') = false")
	}
}

func TestSchemaResolverTableName(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	cases := []struct {
		tag      string
		expected string
	}{
		{"employee-master", "member_master"},
		{"salary-history", "salary_hist"},
		{"employment-timeline", "employment_hist"},
		{"beneficiary-designation", "beneficiary"},
		{"service-credit", "svc_credit"},
		{"domestic-relations-order", "dro_master"},
		{"benefit-payment", "benefit_payment"},
		{"leave-balance", ""},
	}
	for _, tc := range cases {
		got := r.TableName(tc.tag)
		if got != tc.expected {
			t.Errorf("TableName(%q): expected %q, got %q", tc.tag, tc.expected, got)
		}
	}
}

func TestSchemaResolverColumnRole(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	cases := []struct {
		tag      string
		patterns []string
		expected string
	}{
		// Exact match
		{"employee-master", []string{"hire_dt"}, "hire_dt"},
		{"employee-master", []string{"status_cd"}, "status_cd"},
		// Contains match
		{"employee-master", []string{"status"}, "status_cd"},
		{"salary-history", []string{"gross_pay"}, "gross_pay"},
		// Multiple patterns — first match
		{"employee-master", []string{"date_of_joining", "hire_dt"}, "hire_dt"},
		// No match
		{"employee-master", []string{"nonexistent"}, ""},
	}
	for _, tc := range cases {
		got := r.ColumnRole(tc.tag, tc.patterns)
		if got != tc.expected {
			t.Errorf("ColumnRole(%q, %v): expected %q, got %q", tc.tag, tc.patterns, tc.expected, got)
		}
	}
}

func TestSchemaResolverMemberIDColumn(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	// salary_hist has FK to member_master via member_id
	got := r.MemberIDColumn("salary-history")
	if got != "member_id" {
		t.Errorf("MemberIDColumn('salary-history'): expected 'member_id', got %q", got)
	}

	// employee-master has member_id as column name (no FK to self)
	got = r.MemberIDColumn("employee-master")
	if got != "member_id" {
		t.Errorf("MemberIDColumn('employee-master'): expected 'member_id', got %q", got)
	}
}

func TestSchemaResolverPrimaryKey(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	cases := []struct {
		tag      string
		expected string
	}{
		{"employee-master", "member_id"},
		{"salary-history", "salary_id"},
		{"service-credit", "svc_credit_id"},
	}
	for _, tc := range cases {
		got := r.PrimaryKeyColumn(tc.tag)
		if got != tc.expected {
			t.Errorf("PrimaryKeyColumn(%q): expected %q, got %q", tc.tag, tc.expected, got)
		}
	}
}

func TestSchemaResolverQuotedTable(t *testing.T) {
	r := NewSchemaResolver(testManifest())

	got := r.QuotedTable("employee-master")
	if got != `"member_master"` {
		t.Errorf("QuotedTable: expected '\"member_master\"', got %q", got)
	}
	got = r.QuotedTable("nonexistent")
	if got != "" {
		t.Errorf("QuotedTable(nonexistent): expected empty, got %q", got)
	}
}

func TestSchemaResolverFirstTableWins(t *testing.T) {
	// salary-history tag appears on both salary_hist and benefit_payment
	// First one (salary_hist) should win
	r := NewSchemaResolver(testManifest())
	got := r.TableName("salary-history")
	if got != "salary_hist" {
		t.Errorf("First table should win for salary-history: expected 'salary_hist', got %q", got)
	}
}

// ============================================================================
// TagDrivenAdapter factory test
// ============================================================================

func TestNewTagDrivenAdapter(t *testing.T) {
	manifest := testManifest()
	adapter := NewTagDrivenAdapter(manifest, "postgres")

	if adapter.Driver != "postgres" {
		t.Errorf("expected driver 'postgres', got %q", adapter.Driver)
	}
	if adapter.Resolver == nil {
		t.Error("expected non-nil resolver")
	}
	if !adapter.Resolver.HasTag("employee-master") {
		t.Error("expected resolver to have employee-master tag")
	}
}

func TestTagDrivenAdapterImplementsInterface(t *testing.T) {
	manifest := testManifest()
	adapter := NewTagDrivenAdapter(manifest, "postgres")

	// Verify it implements MonitorAdapter
	var _ MonitorAdapter = adapter
}

// ============================================================================
// Pension check skip tests (non-tag-driven adapter)
// ============================================================================

func TestBeneficiaryCheckSkipsNonTagDriven(t *testing.T) {
	adapter := NewMonitorAdapter("postgres")
	th := DefaultThresholds()
	result := BeneficiaryAllocationCheck(nil, adapter, th)
	if result.Status != "pass" {
		t.Errorf("expected pass (skip), got %q", result.Status)
	}
	if result.Message != "skipped: requires tag-driven adapter" {
		t.Errorf("unexpected message: %q", result.Message)
	}
}

func TestServiceCreditCheckSkipsNonTagDriven(t *testing.T) {
	adapter := NewMonitorAdapter("postgres")
	th := DefaultThresholds()
	result := ServiceCreditOverlapCheck(nil, adapter, th)
	if result.Status != "pass" {
		t.Errorf("expected pass (skip), got %q", result.Status)
	}
}

func TestDROCheckSkipsNonTagDriven(t *testing.T) {
	adapter := NewMonitorAdapter("postgres")
	th := DefaultThresholds()
	result := DROStatusConsistencyCheck(nil, adapter, th)
	if result.Status != "pass" {
		t.Errorf("expected pass (skip), got %q", result.Status)
	}
}

// ============================================================================
// SkipReason test
// ============================================================================

func TestSkipReason(t *testing.T) {
	msg := SkipReason("test_check", "beneficiary-designation", "service-credit")
	expected := "test_check: skipped (required concept tags not found: beneficiary-designation, service-credit)"
	if msg != expected {
		t.Errorf("expected %q, got %q", expected, msg)
	}
}

// ============================================================================
// resolveColumn priority tests
// ============================================================================

func TestResolveColumnExactMatch(t *testing.T) {
	ti := schema.TableInfo{
		Columns: []schema.ColumnInfo{
			{Name: "status_cd"},
			{Name: "status"},
		},
	}
	// Exact match should find "status" before "status_cd" when looking for exact "status"
	got := resolveColumn(ti, []string{"status"})
	if got != "status" {
		t.Errorf("expected exact match 'status', got %q", got)
	}
}

func TestResolveColumnSuffixMatch(t *testing.T) {
	ti := schema.TableInfo{
		Columns: []schema.ColumnInfo{
			{Name: "employee_name"},
			{Name: "full_name"},
		},
	}
	// "name" should match "employee_name" via suffix (_name)
	got := resolveColumn(ti, []string{"name"})
	if got != "employee_name" {
		t.Errorf("expected suffix match 'employee_name', got %q", got)
	}
}

func TestResolveColumnContainsMatch(t *testing.T) {
	ti := schema.TableInfo{
		Columns: []schema.ColumnInfo{
			{Name: "gross_monthly"},
		},
	}
	got := resolveColumn(ti, []string{"gross"})
	if got != "gross_monthly" {
		t.Errorf("expected contains match 'gross_monthly', got %q", got)
	}
}

func TestResolveColumnNoMatch(t *testing.T) {
	ti := schema.TableInfo{
		Columns: []schema.ColumnInfo{
			{Name: "first_name"},
			{Name: "last_name"},
		},
	}
	got := resolveColumn(ti, []string{"nonexistent_column"})
	if got != "" {
		t.Errorf("expected empty string, got %q", got)
	}
}

// ============================================================================
// New threshold defaults test
// ============================================================================

func TestDefaultThresholdsPensionChecks(t *testing.T) {
	th := DefaultThresholds()
	if th.BeneficiaryAllocation.WarnAt != 1 || th.BeneficiaryAllocation.FailAt != 1 {
		t.Errorf("expected beneficiary allocation default 1/1, got %.0f/%.0f",
			th.BeneficiaryAllocation.WarnAt, th.BeneficiaryAllocation.FailAt)
	}
	if th.ServiceCreditOverlap.WarnAt != 1 || th.ServiceCreditOverlap.FailAt != 1 {
		t.Errorf("expected service credit overlap default 1/1, got %.0f/%.0f",
			th.ServiceCreditOverlap.WarnAt, th.ServiceCreditOverlap.FailAt)
	}
	if th.DROStatusConsistency.WarnAt != 1 || th.DROStatusConsistency.FailAt != 1 {
		t.Errorf("expected DRO status consistency default 1/1, got %.0f/%.0f",
			th.DROStatusConsistency.WarnAt, th.DROStatusConsistency.FailAt)
	}
}
