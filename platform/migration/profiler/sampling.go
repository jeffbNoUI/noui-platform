package profiler

import "fmt"

// SamplingThreshold is the row count above which TABLESAMPLE is used instead
// of a full scan. Tables with estimated rows <= this threshold are scanned fully.
const SamplingThreshold = 1_000_000

// SamplePercent is the Bernoulli sample percentage for large tables.
const SamplePercent = 1.0

// SampleSeed ensures reproducible sampling across runs.
const SampleSeed = 42

// SamplingStrategy describes whether a table should use sampling or full scan.
type SamplingStrategy struct {
	UseSampling   bool    // true if TABLESAMPLE should be used
	SamplePercent float64 // Bernoulli percentage (e.g. 1.0 = 1%)
	SampleSeed    int     // REPEATABLE seed
	EstimatedRows int64   // catalog estimate used for the decision
}

// DetermineSampling decides whether to use TABLESAMPLE for a table based on
// estimated row count and database driver.
func DetermineSampling(driver string, estimatedRows int64) SamplingStrategy {
	if estimatedRows <= SamplingThreshold {
		return SamplingStrategy{
			UseSampling:   false,
			EstimatedRows: estimatedRows,
		}
	}
	return SamplingStrategy{
		UseSampling:   true,
		SamplePercent: SamplePercent,
		SampleSeed:    SampleSeed,
		EstimatedRows: estimatedRows,
	}
}

// TableSampleClause returns the SQL TABLESAMPLE clause for a given driver,
// or empty string if no sampling is needed.
// For PostgreSQL: TABLESAMPLE BERNOULLI(1) REPEATABLE(42)
// For MSSQL: TABLESAMPLE SYSTEM(1 PERCENT)
func TableSampleClause(s SamplingStrategy, driver string) string {
	if !s.UseSampling {
		return ""
	}
	switch driver {
	case "postgres":
		return fmt.Sprintf(" TABLESAMPLE BERNOULLI(%.1f) REPEATABLE(%d)", s.SamplePercent, s.SampleSeed)
	case "mssql":
		return fmt.Sprintf(" TABLESAMPLE SYSTEM(%.0f PERCENT)", s.SamplePercent)
	default:
		// Fallback: no sampling, full scan
		return ""
	}
}

// RowCountEstimateQuery returns the SQL query to get an approximate row count
// from the database catalog (fast, no table scan).
func RowCountEstimateQuery(driver, schema, table string) string {
	switch driver {
	case "postgres":
		return fmt.Sprintf(
			`SELECT GREATEST(c.reltuples::bigint, 0)
			 FROM pg_class c
			 JOIN pg_namespace n ON n.oid = c.relnamespace
			 WHERE n.nspname = '%s' AND c.relname = '%s'`,
			schema, table,
		)
	case "mssql":
		return fmt.Sprintf(
			`SELECT ISNULL(SUM(p.row_count), 0)
			 FROM sys.dm_db_partition_stats p
			 JOIN sys.tables t ON t.object_id = p.object_id
			 JOIN sys.schemas s ON s.schema_id = t.schema_id
			 WHERE s.name = '%s' AND t.name = '%s'
			   AND p.index_id IN (0, 1)`,
			schema, table,
		)
	default:
		return ""
	}
}

// ExactRowCountNeeded returns true if an exact COUNT(*) should be done.
// This is the case for small tables where catalog estimates may be stale.
func ExactRowCountNeeded(estimatedRows int64) bool {
	return estimatedRows <= SamplingThreshold
}
