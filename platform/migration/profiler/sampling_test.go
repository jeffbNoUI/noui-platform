package profiler

import (
	"strings"
	"testing"
)

func TestDetermineSampling_SmallTable(t *testing.T) {
	s := DetermineSampling("postgres", 500_000)
	if s.UseSampling {
		t.Error("expected no sampling for small table")
	}
	if s.EstimatedRows != 500_000 {
		t.Errorf("EstimatedRows = %d, want 500000", s.EstimatedRows)
	}
}

func TestDetermineSampling_LargeTable(t *testing.T) {
	s := DetermineSampling("postgres", 5_000_000)
	if !s.UseSampling {
		t.Error("expected sampling for large table")
	}
	if s.SamplePercent != 1.0 {
		t.Errorf("SamplePercent = %f, want 1.0", s.SamplePercent)
	}
	if s.SampleSeed != 42 {
		t.Errorf("SampleSeed = %d, want 42", s.SampleSeed)
	}
}

func TestDetermineSampling_ExactThreshold(t *testing.T) {
	s := DetermineSampling("postgres", SamplingThreshold)
	if s.UseSampling {
		t.Error("expected no sampling at exact threshold")
	}
}

func TestDetermineSampling_OneAboveThreshold(t *testing.T) {
	s := DetermineSampling("postgres", SamplingThreshold+1)
	if !s.UseSampling {
		t.Error("expected sampling for one above threshold")
	}
}

func TestTableSampleClause_Postgres(t *testing.T) {
	s := SamplingStrategy{UseSampling: true, SamplePercent: 1.0, SampleSeed: 42}
	clause := TableSampleClause(s, "postgres")
	if !strings.Contains(clause, "BERNOULLI") {
		t.Errorf("expected BERNOULLI in clause, got %q", clause)
	}
	if !strings.Contains(clause, "REPEATABLE(42)") {
		t.Errorf("expected REPEATABLE(42) in clause, got %q", clause)
	}
}

func TestTableSampleClause_MSSQL(t *testing.T) {
	s := SamplingStrategy{UseSampling: true, SamplePercent: 1.0, SampleSeed: 42}
	clause := TableSampleClause(s, "mssql")
	if !strings.Contains(clause, "SYSTEM") {
		t.Errorf("expected SYSTEM in clause, got %q", clause)
	}
	if !strings.Contains(clause, "PERCENT") {
		t.Errorf("expected PERCENT in clause, got %q", clause)
	}
}

func TestTableSampleClause_NoSampling(t *testing.T) {
	s := SamplingStrategy{UseSampling: false}
	clause := TableSampleClause(s, "postgres")
	if clause != "" {
		t.Errorf("expected empty clause, got %q", clause)
	}
}

func TestTableSampleClause_UnknownDriver(t *testing.T) {
	s := SamplingStrategy{UseSampling: true, SamplePercent: 1.0, SampleSeed: 42}
	clause := TableSampleClause(s, "oracle")
	if clause != "" {
		t.Errorf("expected empty clause for unknown driver, got %q", clause)
	}
}

func TestRowCountEstimateQuery_Postgres(t *testing.T) {
	q := RowCountEstimateQuery("postgres", "public", "employees")
	if !strings.Contains(q, "pg_class") {
		t.Errorf("expected pg_class in query, got %q", q)
	}
}

func TestRowCountEstimateQuery_MSSQL(t *testing.T) {
	q := RowCountEstimateQuery("mssql", "dbo", "employees")
	if !strings.Contains(q, "dm_db_partition_stats") {
		t.Errorf("expected dm_db_partition_stats in query, got %q", q)
	}
}

func TestRowCountEstimateQuery_Unknown(t *testing.T) {
	q := RowCountEstimateQuery("oracle", "hr", "employees")
	if q != "" {
		t.Errorf("expected empty query for unknown driver, got %q", q)
	}
}

func TestExactRowCountNeeded(t *testing.T) {
	if !ExactRowCountNeeded(500_000) {
		t.Error("expected exact count needed for small table")
	}
	if ExactRowCountNeeded(5_000_000) {
		t.Error("expected no exact count for large table")
	}
}
