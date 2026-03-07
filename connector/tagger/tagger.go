package tagger

import (
	"time"

	"github.com/noui/platform/connector/schema"
)

// TagManifest processes the entire schema manifest and returns tag results.
// It also updates manifest.Tables[i].NoUITags in place.
func TagManifest(manifest *schema.SchemaManifest, concepts []ConceptDef) *TagReport {
	report := &TagReport{
		GeneratedAt:    Now().UTC().Format(time.RFC3339),
		ManifestSource: manifest.Source,
		Summary: TagSummary{
			TotalTables:  len(manifest.Tables),
			TagCounts:    make(map[ConceptTag]int),
			TaggedNames:  make(map[ConceptTag][]string),
		},
	}

	taggedCount := 0

	for i := range manifest.Tables {
		table := &manifest.Tables[i]
		tags, scores, signals := AssignTags(*table, manifest.Tables, concepts)

		// Update manifest in place
		tagStrings := make([]string, len(tags))
		for j, tag := range tags {
			tagStrings[j] = string(tag)
		}
		table.NoUITags = tagStrings

		// Only include tables with at least one signal hit in the report
		if len(scores) > 0 {
			result := TableTagResult{
				TableName: table.Name,
				Tags:      tags,
				Scores:    scores,
				Signals:   signals,
			}
			report.Tables = append(report.Tables, result)
		}

		if len(tags) > 0 {
			taggedCount++
			for _, tag := range tags {
				report.Summary.TagCounts[tag]++
				report.Summary.TaggedNames[tag] = append(report.Summary.TaggedNames[tag], table.Name)
			}
		}
	}

	report.Summary.TaggedTables = taggedCount
	return report
}
