package mapper

// AgreementStatus classifies how template and signal mappings relate.
type AgreementStatus string

const (
	Agreed       AgreementStatus = "AGREED"        // Both map to same canonical column
	Disagreed    AgreementStatus = "DISAGREED"     // Both map, but to different columns
	TemplateOnly AgreementStatus = "TEMPLATE_ONLY" // Template matched, signal didn't
	SignalOnly   AgreementStatus = "SIGNAL_ONLY"   // Signal matched, template didn't
)

// ScoredMapping mirrors the Python intelligence service response.
type ScoredMapping struct {
	SourceColumn    string             `json:"source_column"`
	CanonicalColumn string             `json:"canonical_column"`
	Confidence      float64            `json:"confidence"`
	Signals         map[string]float64 `json:"signals"`
}

// AgreementResult is the combined result for one source column.
type AgreementResult struct {
	SourceColumn       string          `json:"source_column"`
	CanonicalColumn    string          `json:"canonical_column"`    // final proposed canonical target
	TemplateConfidence float64         `json:"template_confidence"` // 0 if no template match
	SignalConfidence   float64         `json:"signal_confidence"`   // 0 if no signal match
	AgreementStatus    AgreementStatus `json:"agreement_status"`
	AutoApproved       bool            `json:"auto_approved"` // true if both agree with decent confidence
}

// AnalyzeAgreement compares template and signal results for a single source column.
// Returns the agreement result. If only one side matched, uses that mapping.
func AnalyzeAgreement(templateMatch *ColumnMatch, signalMatch *ScoredMapping) AgreementResult {
	switch {
	case templateMatch != nil && signalMatch != nil:
		return analyzeBothPresent(templateMatch, signalMatch)
	case templateMatch != nil:
		return AgreementResult{
			SourceColumn:       templateMatch.SourceColumn,
			CanonicalColumn:    templateMatch.CanonicalColumn,
			TemplateConfidence: templateMatch.Confidence,
			SignalConfidence:   0,
			AgreementStatus:    TemplateOnly,
			AutoApproved:       templateMatch.Confidence > 0.7,
		}
	case signalMatch != nil:
		return AgreementResult{
			SourceColumn:       signalMatch.SourceColumn,
			CanonicalColumn:    signalMatch.CanonicalColumn,
			TemplateConfidence: 0,
			SignalConfidence:   signalMatch.Confidence,
			AgreementStatus:    SignalOnly,
			AutoApproved:       false, // Signal-only is never auto-approved
		}
	default:
		return AgreementResult{}
	}
}

// analyzeBothPresent handles the case where both template and signal produced a match.
func analyzeBothPresent(tmpl *ColumnMatch, signal *ScoredMapping) AgreementResult {
	if tmpl.CanonicalColumn == signal.CanonicalColumn {
		// AGREED: both map to the same canonical column.
		// Average confidence is available via (TemplateConfidence + SignalConfidence) / 2.
		return AgreementResult{
			SourceColumn:       tmpl.SourceColumn,
			CanonicalColumn:    tmpl.CanonicalColumn,
			TemplateConfidence: tmpl.Confidence,
			SignalConfidence:   signal.Confidence,
			AgreementStatus:    Agreed,
			AutoApproved:       tmpl.Confidence > 0.5 && signal.Confidence > 0.5,
		}
	}

	// DISAGREED: both map but to different canonical columns.
	// Use the higher-confidence mapping as the proposed canonical.
	proposed := tmpl.CanonicalColumn
	if signal.Confidence > tmpl.Confidence {
		proposed = signal.CanonicalColumn
	}

	return AgreementResult{
		SourceColumn:       tmpl.SourceColumn,
		CanonicalColumn:    proposed,
		TemplateConfidence: tmpl.Confidence,
		SignalConfidence:   signal.Confidence,
		AgreementStatus:    Disagreed,
		AutoApproved:       false, // Disagreed is never auto-approved
	}
}

// AnalyzeTableMappings compares full template and signal results for all columns in a table.
// templateMatches: from MatchColumns (Go template matcher)
// signalMatches: from /intelligence/score-columns (Python signal scorer) — top match per source column
// Returns one AgreementResult per unique source column found in either set.
func AnalyzeTableMappings(templateMatches []ColumnMatch, signalMatches []ScoredMapping) []AgreementResult {
	// Index template matches by source column.
	tmplBySource := make(map[string]*ColumnMatch, len(templateMatches))
	for i := range templateMatches {
		tmplBySource[templateMatches[i].SourceColumn] = &templateMatches[i]
	}

	// Index signal matches by source column.
	signalBySource := make(map[string]*ScoredMapping, len(signalMatches))
	for i := range signalMatches {
		signalBySource[signalMatches[i].SourceColumn] = &signalMatches[i]
	}

	// Collect all unique source columns, preserving a stable order.
	seen := make(map[string]bool)
	var sourceColumns []string
	for _, m := range templateMatches {
		if !seen[m.SourceColumn] {
			seen[m.SourceColumn] = true
			sourceColumns = append(sourceColumns, m.SourceColumn)
		}
	}
	for _, m := range signalMatches {
		if !seen[m.SourceColumn] {
			seen[m.SourceColumn] = true
			sourceColumns = append(sourceColumns, m.SourceColumn)
		}
	}

	results := make([]AgreementResult, 0, len(sourceColumns))
	for _, col := range sourceColumns {
		results = append(results, AnalyzeAgreement(tmplBySource[col], signalBySource[col]))
	}
	return results
}

// AgreementSummary provides statistics about the agreement analysis.
type AgreementSummary struct {
	TotalColumns int `json:"total_columns"`
	Agreed       int `json:"agreed"`
	Disagreed    int `json:"disagreed"`
	TemplateOnly int `json:"template_only"`
	SignalOnly   int `json:"signal_only"`
	AutoApproved int `json:"auto_approved"`
	NeedsReview  int `json:"needs_review"`
}

// Summarize computes aggregate statistics from agreement results.
func Summarize(results []AgreementResult) AgreementSummary {
	var s AgreementSummary
	s.TotalColumns = len(results)
	for _, r := range results {
		switch r.AgreementStatus {
		case Agreed:
			s.Agreed++
		case Disagreed:
			s.Disagreed++
		case TemplateOnly:
			s.TemplateOnly++
		case SignalOnly:
			s.SignalOnly++
		}
		if r.AutoApproved {
			s.AutoApproved++
		} else {
			s.NeedsReview++
		}
	}
	return s
}
