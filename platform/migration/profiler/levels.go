package profiler

import (
	"fmt"

	"github.com/noui/platform/migration/models"
)

// ProfilingLevel represents a numbered profiling stage (1–5).
type ProfilingLevel int

const (
	Level1Inventory    ProfilingLevel = 1
	Level2Statistics   ProfilingLevel = 2
	Level3Dependencies ProfilingLevel = 3
	Level4Coverage     ProfilingLevel = 4
	Level5RuleSignals  ProfilingLevel = 5
)

// String returns the human-readable name for a profiling level.
func (l ProfilingLevel) String() string {
	switch l {
	case Level1Inventory:
		return "L1: Table/Column Inventory"
	case Level2Statistics:
		return "L2: Column Statistics + Patterns"
	case Level3Dependencies:
		return "L3: Dependency Analysis"
	case Level4Coverage:
		return "L4: Canonical Coverage Report"
	case Level5RuleSignals:
		return "L5: Rule Signal Detection"
	default:
		return fmt.Sprintf("Unknown Level %d", l)
	}
}

// JobType returns the job queue type string for this level.
func (l ProfilingLevel) JobType() string {
	return fmt.Sprintf("profile_l%d", l)
}

// RunStatus returns the ProfilingRunStatus corresponding to "running" this level.
func (l ProfilingLevel) RunStatus() models.ProfilingRunStatus {
	switch l {
	case Level1Inventory:
		return models.ProfilingStatusRunningL1
	case Level2Statistics:
		return models.ProfilingStatusRunningL2
	case Level3Dependencies:
		return models.ProfilingStatusRunningL3
	case Level4Coverage:
		return models.ProfilingStatusRunningL4
	case Level5RuleSignals:
		return models.ProfilingStatusRunningL5
	default:
		return models.ProfilingStatusFailed
	}
}

// RequiresSourceAccess returns true if this level queries the source database.
func (l ProfilingLevel) RequiresSourceAccess() bool {
	return l == Level1Inventory || l == Level2Statistics || l == Level3Dependencies
}

// NextLevel returns the next profiling level, or 0 if this is the last.
func (l ProfilingLevel) NextLevel() ProfilingLevel {
	if l >= Level5RuleSignals {
		return 0
	}
	return l + 1
}

// AllLevels returns all profiling levels in order.
func AllLevels() []ProfilingLevel {
	return []ProfilingLevel{
		Level1Inventory,
		Level2Statistics,
		Level3Dependencies,
		Level4Coverage,
		Level5RuleSignals,
	}
}
