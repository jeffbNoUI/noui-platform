package mapper

import "strings"

// ColumnMatch represents a proposed mapping from source to canonical.
type ColumnMatch struct {
	SourceColumn    string  `json:"source_column"`
	SourceType      string  `json:"source_type"`
	CanonicalColumn string  `json:"canonical_column"`
	Confidence      float64 `json:"confidence"`
	MatchMethod     string  `json:"match_method"` // "exact", "pattern", "similarity", "type_only"
}

// SourceColumn represents a column discovered in the source database.
type SourceColumn struct {
	Name       string `json:"name"`
	DataType   string `json:"data_type"`
	IsNullable bool   `json:"is_nullable"`
	IsKey      bool   `json:"is_key"`
}

// MatchColumns takes source columns and a template, returns proposed matches.
// Matching priority:
//  1. Exact name match against CanonicalColumn (confidence 1.0)
//  2. Pattern match: source name found in ExpectedNames list (confidence 0.9)
//  3. Similarity: ColumnNameSimilarity > 0.7 AND compatible type (confidence = sim * 0.85)
//  4. Type-only: compatible type for required unmatched slots (confidence 0.3)
func MatchColumns(sourceColumns []SourceColumn, template MappingTemplate) []ColumnMatch {
	// Track which source columns and template slots have been claimed.
	usedSource := make(map[int]bool)
	usedSlot := make(map[int]bool)
	matches := make([]ColumnMatch, 0)

	// Pass 1: Exact canonical name match
	for si, sc := range sourceColumns {
		if usedSource[si] {
			continue
		}
		srcLower := strings.ToLower(sc.Name)
		for ti, slot := range template.Slots {
			if usedSlot[ti] {
				continue
			}
			if srcLower == slot.CanonicalColumn {
				matches = append(matches, ColumnMatch{
					SourceColumn:    sc.Name,
					SourceType:      sc.DataType,
					CanonicalColumn: slot.CanonicalColumn,
					Confidence:      1.0,
					MatchMethod:     "exact",
				})
				usedSource[si] = true
				usedSlot[ti] = true
				break
			}
		}
	}

	// Pass 2: Pattern match — source name appears in ExpectedNames list
	for si, sc := range sourceColumns {
		if usedSource[si] {
			continue
		}
		srcLower := strings.ToLower(sc.Name)
		for ti, slot := range template.Slots {
			if usedSlot[ti] {
				continue
			}
			for _, expected := range slot.ExpectedNames {
				if srcLower == expected {
					matches = append(matches, ColumnMatch{
						SourceColumn:    sc.Name,
						SourceType:      sc.DataType,
						CanonicalColumn: slot.CanonicalColumn,
						Confidence:      0.9,
						MatchMethod:     "pattern",
					})
					usedSource[si] = true
					usedSlot[ti] = true
					break
				}
			}
			if usedSource[si] {
				break
			}
		}
	}

	// Pass 3: Similarity — ColumnNameSimilarity > 0.7 AND compatible type
	// Collect all candidates, pick best per slot greedily.
	type candidate struct {
		sourceIdx int
		slotIdx   int
		score     float64
	}
	var candidates []candidate

	for si, sc := range sourceColumns {
		if usedSource[si] {
			continue
		}
		for ti, slot := range template.Slots {
			if usedSlot[ti] {
				continue
			}
			if !TypeCompatible(sc.DataType, slot.DataTypeFamily) {
				continue
			}
			sim := ColumnNameSimilarity(sc.Name, slot.CanonicalColumn)
			// Also check similarity against expected names and take the best.
			for _, expected := range slot.ExpectedNames {
				s := ColumnNameSimilarity(sc.Name, expected)
				if s > sim {
					sim = s
				}
			}
			if sim > 0.7 {
				candidates = append(candidates, candidate{si, ti, sim})
			}
		}
	}

	// Sort candidates by descending score (greedy).
	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			if candidates[j].score > candidates[i].score {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}

	for _, c := range candidates {
		if usedSource[c.sourceIdx] || usedSlot[c.slotIdx] {
			continue
		}
		sc := sourceColumns[c.sourceIdx]
		slot := template.Slots[c.slotIdx]
		matches = append(matches, ColumnMatch{
			SourceColumn:    sc.Name,
			SourceType:      sc.DataType,
			CanonicalColumn: slot.CanonicalColumn,
			Confidence:      c.score * 0.85,
			MatchMethod:     "similarity",
		})
		usedSource[c.sourceIdx] = true
		usedSlot[c.slotIdx] = true
	}

	// Pass 4: Type-only — compatible type for required unmatched slots
	for ti, slot := range template.Slots {
		if usedSlot[ti] || !slot.Required {
			continue
		}
		for si, sc := range sourceColumns {
			if usedSource[si] {
				continue
			}
			if TypeCompatible(sc.DataType, slot.DataTypeFamily) {
				matches = append(matches, ColumnMatch{
					SourceColumn:    sc.Name,
					SourceType:      sc.DataType,
					CanonicalColumn: slot.CanonicalColumn,
					Confidence:      0.3,
					MatchMethod:     "type_only",
				})
				usedSource[si] = true
				usedSlot[ti] = true
				break
			}
		}
	}

	return matches
}

// TypeCompatible checks if a source database type is compatible with a target
// type family. Returns true for compatible families:
// INTEGER/SERIAL/BIGINT, DECIMAL/NUMERIC, VARCHAR/TEXT/CHAR, DATE/TIMESTAMP, etc.
func TypeCompatible(sourceType, targetTypeFamily string) bool {
	src := normalizeType(sourceType)
	tgt := strings.ToUpper(targetTypeFamily)

	families := map[string][]string{
		"INTEGER": {"integer", "int", "int4", "int8", "bigint", "smallint", "serial", "bigserial", "tinyint", "mediumint"},
		"DECIMAL": {"decimal", "numeric", "real", "float", "double", "money", "number"},
		"VARCHAR": {"varchar", "text", "char", "character", "nvarchar", "nchar", "ntext", "bpchar", "string", "clob"},
		"DATE":    {"date", "timestamp", "datetime", "timestamptz", "timestamp_tz", "datetime2", "smalldatetime"},
		"BOOLEAN": {"boolean", "bool", "bit"},
		"UUID":    {"uuid", "uniqueidentifier"},
		"TEXT":    {"text", "clob", "ntext", "varchar", "nvarchar", "char"},
	}

	members, ok := families[tgt]
	if !ok {
		return false
	}
	for _, m := range members {
		if src == m {
			return true
		}
	}
	return false
}

// normalizeType strips length/precision qualifiers and lowercases.
// "varchar(50)" → "varchar", "decimal(10,2)" → "decimal"
func normalizeType(dt string) string {
	dt = strings.ToLower(strings.TrimSpace(dt))
	if idx := strings.IndexByte(dt, '('); idx != -1 {
		dt = dt[:idx]
	}
	return dt
}

// UnmatchedSlots returns template slots that no source column matched.
func UnmatchedSlots(matches []ColumnMatch, template MappingTemplate) []TemplateSlot {
	matched := make(map[string]bool, len(matches))
	for _, m := range matches {
		matched[m.CanonicalColumn] = true
	}

	var unmatched []TemplateSlot
	for _, slot := range template.Slots {
		if !matched[slot.CanonicalColumn] {
			unmatched = append(unmatched, slot)
		}
	}
	return unmatched
}
