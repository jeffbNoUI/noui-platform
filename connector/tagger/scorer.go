package tagger

import "github.com/noui/platform/connector/schema"

// ScoreTable evaluates all signals for a given concept against a table.
// Returns the accumulated score and the list of signals that fired.
func ScoreTable(table schema.TableInfo, allTables []schema.TableInfo, concept ConceptDef) (float64, []SignalHit) {
	var score float64
	var hits []SignalHit

	for _, sig := range concept.Signals {
		fired, evidence := sig.Detect(table, allTables)
		if fired {
			score += sig.Weight
			hits = append(hits, SignalHit{
				SignalName:  sig.Name,
				Description: sig.Description,
				Weight:      sig.Weight,
				Evidence:    evidence,
			})
		}
	}

	return score, hits
}

// AssignTags evaluates a table against all concept definitions.
// Returns the assigned tags, scores per concept, and signal audit per concept.
func AssignTags(table schema.TableInfo, allTables []schema.TableInfo, concepts []ConceptDef) ([]ConceptTag, map[ConceptTag]float64, map[ConceptTag][]SignalHit) {
	var tags []ConceptTag
	scores := make(map[ConceptTag]float64)
	signals := make(map[ConceptTag][]SignalHit)

	for _, concept := range concepts {
		score, hits := ScoreTable(table, allTables, concept)
		if score > 0 {
			scores[concept.Tag] = score
			signals[concept.Tag] = hits
		}
		if score >= concept.Threshold {
			tags = append(tags, concept.Tag)
		}
	}

	return tags, scores, signals
}
