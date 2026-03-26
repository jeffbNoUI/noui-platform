package profiler

import (
	"testing"

	"github.com/noui/platform/migration/models"
)

func TestProfilingLevel_String(t *testing.T) {
	tests := []struct {
		level ProfilingLevel
		want  string
	}{
		{Level1Inventory, "L1: Table/Column Inventory"},
		{Level2Statistics, "L2: Column Statistics + Patterns"},
		{Level3Dependencies, "L3: Dependency Analysis"},
		{Level4Coverage, "L4: Canonical Coverage Report"},
		{Level5RuleSignals, "L5: Rule Signal Detection"},
		{ProfilingLevel(99), "Unknown Level 99"},
	}
	for _, tt := range tests {
		got := tt.level.String()
		if got != tt.want {
			t.Errorf("Level(%d).String() = %q, want %q", tt.level, got, tt.want)
		}
	}
}

func TestProfilingLevel_JobType(t *testing.T) {
	tests := []struct {
		level ProfilingLevel
		want  string
	}{
		{Level1Inventory, "profile_l1"},
		{Level2Statistics, "profile_l2"},
		{Level3Dependencies, "profile_l3"},
		{Level4Coverage, "profile_l4"},
		{Level5RuleSignals, "profile_l5"},
	}
	for _, tt := range tests {
		got := tt.level.JobType()
		if got != tt.want {
			t.Errorf("Level(%d).JobType() = %q, want %q", tt.level, got, tt.want)
		}
	}
}

func TestProfilingLevel_RunStatus(t *testing.T) {
	tests := []struct {
		level ProfilingLevel
		want  models.ProfilingRunStatus
	}{
		{Level1Inventory, models.ProfilingStatusRunningL1},
		{Level2Statistics, models.ProfilingStatusRunningL2},
		{Level3Dependencies, models.ProfilingStatusRunningL3},
		{Level4Coverage, models.ProfilingStatusRunningL4},
		{Level5RuleSignals, models.ProfilingStatusRunningL5},
	}
	for _, tt := range tests {
		got := tt.level.RunStatus()
		if got != tt.want {
			t.Errorf("Level(%d).RunStatus() = %q, want %q", tt.level, got, tt.want)
		}
	}
}

func TestProfilingLevel_RequiresSourceAccess(t *testing.T) {
	if !Level1Inventory.RequiresSourceAccess() {
		t.Error("L1 should require source access")
	}
	if !Level2Statistics.RequiresSourceAccess() {
		t.Error("L2 should require source access")
	}
	if Level3Dependencies.RequiresSourceAccess() {
		t.Error("L3 should not require source access")
	}
	if Level4Coverage.RequiresSourceAccess() {
		t.Error("L4 should not require source access")
	}
	if Level5RuleSignals.RequiresSourceAccess() {
		t.Error("L5 should not require source access")
	}
}

func TestProfilingLevel_NextLevel(t *testing.T) {
	tests := []struct {
		level ProfilingLevel
		want  ProfilingLevel
	}{
		{Level1Inventory, Level2Statistics},
		{Level2Statistics, Level3Dependencies},
		{Level3Dependencies, Level4Coverage},
		{Level4Coverage, Level5RuleSignals},
		{Level5RuleSignals, 0},
	}
	for _, tt := range tests {
		got := tt.level.NextLevel()
		if got != tt.want {
			t.Errorf("Level(%d).NextLevel() = %d, want %d", tt.level, got, tt.want)
		}
	}
}

func TestAllLevels(t *testing.T) {
	levels := AllLevels()
	if len(levels) != 5 {
		t.Errorf("AllLevels() has %d levels, want 5", len(levels))
	}
	if levels[0] != Level1Inventory || levels[4] != Level5RuleSignals {
		t.Error("AllLevels() should start with L1 and end with L5")
	}
}

func TestQuoteIdent(t *testing.T) {
	tests := []struct {
		input, want string
		wantErr     bool
	}{
		{"employees", `"employees"`, false},
		{"public.employees", `"public"."employees"`, false},
		{"", "", true},
		{"drop;table", "", true},
	}
	for _, tt := range tests {
		got, err := QuoteIdent(tt.input)
		if tt.wantErr {
			if err == nil {
				t.Errorf("QuoteIdent(%q) expected error", tt.input)
			}
			continue
		}
		if err != nil {
			t.Errorf("QuoteIdent(%q) error: %v", tt.input, err)
			continue
		}
		if got != tt.want {
			t.Errorf("QuoteIdent(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestParseSchemaTable_Levels(t *testing.T) {
	tests := []struct {
		input      string
		wantSchema string
		wantTable  string
	}{
		{"public.employees", "public", "employees"},
		{"employees", "", "employees"},
		{"a.b.c", "a", "b.c"},
	}
	for _, tt := range tests {
		schema, table := ParseSchemaTable(tt.input)
		if schema != tt.wantSchema || table != tt.wantTable {
			t.Errorf("ParseSchemaTable(%q) = (%q, %q), want (%q, %q)",
				tt.input, schema, table, tt.wantSchema, tt.wantTable)
		}
	}
}
