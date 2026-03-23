package api

import "testing"

func TestResolveSourceTable_FromMappings(t *testing.T) {
	mappings := []FieldMapping{
		{SourceTable: "src_prism.prism_member", SourceColumn: "mbr_nbr"},
		{SourceTable: "src_prism.prism_member", SourceColumn: "first_name"},
	}

	got := resolveSourceTable("SomeRandomName", "ACTIVE_MEMBERS", mappings)
	if got != "src_prism.prism_member" {
		t.Errorf("resolveSourceTable with mappings = %q, want %q", got, "src_prism.prism_member")
	}
}

func TestResolveSourceTable_FallbackToSystemName(t *testing.T) {
	// No mappings — should fall back to hard-coded system names.
	got := resolveSourceTable("PRISM", "ACTIVE_MEMBERS", nil)
	if got != "src_prism.prism_member" {
		t.Errorf("resolveSourceTable PRISM fallback = %q, want %q", got, "src_prism.prism_member")
	}

	got = resolveSourceTable("PAS", "ACTIVE_MEMBERS", nil)
	if got != "src_pas.member" {
		t.Errorf("resolveSourceTable PAS fallback = %q, want %q", got, "src_pas.member")
	}
}

func TestResolveSourceTable_FallbackToScope(t *testing.T) {
	// Unknown system, no mappings — falls back to scope as table name.
	got := resolveSourceTable("UnknownSystem", "custom_table", nil)
	if got != "custom_table" {
		t.Errorf("resolveSourceTable fallback = %q, want %q", got, "custom_table")
	}
}

func TestResolveSourceTable_EmptyMappings(t *testing.T) {
	// Mappings exist but with empty source_table — should fall through.
	mappings := []FieldMapping{
		{SourceTable: "", SourceColumn: "mbr_nbr"},
	}

	got := resolveSourceTable("PRISM", "ACTIVE_MEMBERS", mappings)
	if got != "src_prism.prism_member" {
		t.Errorf("resolveSourceTable empty mapping = %q, want %q", got, "src_prism.prism_member")
	}
}

func TestResolvePrimaryKey_Fallbacks(t *testing.T) {
	// No DSN — should use system name fallbacks.
	tests := []struct {
		system string
		want   string
	}{
		{"PRISM", "mbr_nbr"},
		{"PAS", "member_id"},
		{"Unknown", "id"},
	}

	for _, tc := range tests {
		got := resolvePrimaryKey(tc.system, "", "")
		if got != tc.want {
			t.Errorf("resolvePrimaryKey(%q) = %q, want %q", tc.system, got, tc.want)
		}
	}
}
