package profiler

import (
	"regexp"

	"github.com/noui/platform/migration/models"
)

// PensionPattern defines a named regex detector for pension-domain encoding patterns.
// These are common in AS400/DB2, Oracle, and SQL Server legacy pension systems.
type PensionPattern struct {
	Name  string         // machine-readable pattern name
	Label string         // human-readable description
	Regex *regexp.Regexp // compiled pattern
}

// PensionPatterns is the canonical set of pension-domain pattern detectors
// for Level 2 profiling. Each pattern is tested against sampled column values.
var PensionPatterns = []PensionPattern{
	{
		Name:  "CYYMMDD",
		Label: "CYYMMDD century-encoded date (AS400)",
		Regex: regexp.MustCompile(`^\d{7}$`),
	},
	{
		Name:  "YYYYMMDD",
		Label: "YYYYMMDD packed date",
		Regex: regexp.MustCompile(`^\d{8}$`),
	},
	{
		Name:  "IMPLICIT_2DEC",
		Label: "Implicit decimal (cents in last 2 digits)",
		Regex: regexp.MustCompile(`^\d{6,12}$`), // 6+ digits: excludes IDs <100k, catches typical cent amounts
	},
	{
		Name:  "PCT_WHOLE",
		Label: "Percentage as whole number",
		Regex: regexp.MustCompile(`^\d{1,3}$`),
	},
	{
		Name:  "TIER_CODE",
		Label: "Plan tier designation",
		Regex: regexp.MustCompile(`^[A-Z0-9]{1,4}$`),
	},
	{
		Name:  "STATUS_CODE",
		Label: "Status code (1-2 alpha)",
		Regex: regexp.MustCompile(`^[A-Z]{1,2}$`),
	},
	{
		Name:  "MEMBER_NUM",
		Label: "Member number (optional alpha prefix)",
		Regex: regexp.MustCompile(`^[A-Z]?\d{6,10}$`),
	},
	{
		Name:  "SSN",
		Label: "SSN without dashes (9 digits)",
		Regex: regexp.MustCompile(`^\d{9}$`),
	},
	{
		Name:  "FISCAL_YEAR",
		Label: "4-digit fiscal year",
		Regex: regexp.MustCompile(`^(19|20)\d{2}$`),
	},
}

// PensionPatternMinMatchRate is the minimum fraction of sampled values that must
// match a pattern for it to be reported in pattern_frequencies.
const PensionPatternMinMatchRate = 0.30

// MatchPensionPatterns tests a set of sampled string values against all pension
// patterns and returns entries for patterns exceeding PensionPatternMinMatchRate.
func MatchPensionPatterns(values []string) []models.PatternFreqEntry {
	if len(values) == 0 {
		return nil
	}

	var results []models.PatternFreqEntry
	total := int64(len(values))

	for _, pat := range PensionPatterns {
		var matched int64
		for _, v := range values {
			if pat.Regex.MatchString(v) {
				matched++
			}
		}
		rate := float64(matched) / float64(total)
		if rate >= PensionPatternMinMatchRate {
			results = append(results, models.PatternFreqEntry{
				Pattern: pat.Name,
				Label:   pat.Label,
				Count:   matched,
				Pct:     rate,
			})
		}
	}
	return results
}
