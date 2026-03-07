package main

import (
	"encoding/json"
	"flag"
	"log"
	"os"

	"github.com/noui/platform/connector/schema"
	"github.com/noui/platform/connector/tagger"
)

func main() {
	input := flag.String("input", "manifest.json", "Input schema manifest JSON path")
	output := flag.String("output", "manifest-tagged.json", "Output enriched manifest path")
	report := flag.String("report", "tags-report.json", "Output tags audit report path")
	threshold := flag.Float64("threshold", 0.0, "Global threshold override (0 = use per-concept defaults)")
	flag.Parse()

	data, err := os.ReadFile(*input)
	if err != nil {
		log.Fatalf("Failed to read manifest: %v", err)
	}

	var manifest schema.SchemaManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		log.Fatalf("Failed to parse manifest: %v", err)
	}

	log.Printf("Loaded manifest: %d tables from %s", manifest.TableCount, manifest.Source)

	concepts := tagger.DefaultConcepts()
	if *threshold > 0 {
		for i := range concepts {
			concepts[i].Threshold = *threshold
		}
		log.Printf("Using global threshold override: %.1f", *threshold)
	}

	tagReport := tagger.TagManifest(&manifest, concepts)
	tagReport.Threshold = *threshold

	manifestData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal enriched manifest: %v", err)
	}
	if err := os.WriteFile(*output, manifestData, 0644); err != nil {
		log.Fatalf("Failed to write enriched manifest: %v", err)
	}
	log.Printf("Enriched manifest written to %s", *output)

	reportData, err := json.MarshalIndent(tagReport, "", "  ")
	if err != nil {
		log.Fatalf("Failed to marshal tags report: %v", err)
	}
	if err := os.WriteFile(*report, reportData, 0644); err != nil {
		log.Fatalf("Failed to write tags report: %v", err)
	}
	log.Printf("Tags report written to %s", *report)

	log.Printf("--- Tagging Summary ---")
	log.Printf("Total tables: %d", tagReport.Summary.TotalTables)
	log.Printf("Tagged tables: %d", tagReport.Summary.TaggedTables)
	for tag, count := range tagReport.Summary.TagCounts {
		log.Printf("  %s: %d tables", tag, count)
	}
}
