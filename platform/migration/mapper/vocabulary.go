package mapper

import (
	_ "embed"
	"fmt"
	"strings"

	"gopkg.in/yaml.v3"
)

//go:embed vocabulary.yaml
var vocabData []byte

// VocabSlot holds terms and false cognates for one canonical slot.
type VocabSlot struct {
	Terms         []string       `yaml:"terms"`
	FalseCognates []FalseCognate `yaml:"false_cognates,omitempty"`
}

// FalseCognate defines a term that looks equivalent but differs across systems.
type FalseCognate struct {
	Term    string `yaml:"term"`
	Warning string `yaml:"warning"`
	Risk    string `yaml:"risk"` // HIGH, MEDIUM, LOW
}

// Vocabulary maps concept-tag → slot-name → VocabSlot.
type Vocabulary map[string]map[string]VocabSlot

// LoadVocabulary parses the embedded vocabulary.yaml.
func LoadVocabulary() (Vocabulary, error) {
	var vocab Vocabulary
	if err := yaml.Unmarshal(vocabData, &vocab); err != nil {
		return nil, fmt.Errorf("parse vocabulary.yaml: %w", err)
	}
	return vocab, nil
}

// FalseCognateIndex provides fast lookup: does a matched term have a warning
// for a given concept tag and slot? Key format: "concept_tag\x00slot\x00term".
type FalseCognateIndex map[string]FalseCognate

// BuildFalseCognateIndex creates a lookup from the full vocabulary.
func BuildFalseCognateIndex(vocab Vocabulary) FalseCognateIndex {
	idx := make(FalseCognateIndex)
	for section, slots := range vocab {
		for slotName, vs := range slots {
			for _, fc := range vs.FalseCognates {
				key := section + "\x00" + slotName + "\x00" + strings.ToLower(fc.Term)
				idx[key] = fc
			}
		}
	}
	return idx
}

// Lookup returns a false cognate warning if the term is flagged for the given
// concept tag and canonical column. Returns zero value and false if not found.
func (idx FalseCognateIndex) Lookup(conceptTag, canonicalColumn, term string) (FalseCognate, bool) {
	key := conceptTag + "\x00" + canonicalColumn + "\x00" + strings.ToLower(term)
	fc, ok := idx[key]
	return fc, ok
}

// mergeVocabulary expands ExpectedNames in registry slots using vocabulary terms.
// It matches vocabulary sections to registry templates by concept tag, then
// matches vocabulary slot names to template slot CanonicalColumn names.
// Duplicate terms are removed. Sections not matching any template are silently
// ignored (e.g., fac-abbreviations, contribution-accounts for future use).
func mergeVocabulary(r *Registry) error {
	vocab, err := LoadVocabulary()
	if err != nil {
		return err
	}

	for section, slots := range vocab {
		tmpl, ok := r.Get(section)
		if !ok {
			continue // section like fac-abbreviations has no template yet
		}

		for slotName, vocabSlot := range slots {
			for i, ts := range tmpl.Slots {
				if ts.CanonicalColumn != slotName {
					continue
				}
				// Build set of existing names
				existing := make(map[string]bool, len(ts.ExpectedNames))
				for _, n := range ts.ExpectedNames {
					existing[n] = true
				}
				// Append new terms (deduplicated, lowercased)
				for _, term := range vocabSlot.Terms {
					t := strings.ToLower(term)
					if !existing[t] {
						tmpl.Slots[i].ExpectedNames = append(tmpl.Slots[i].ExpectedNames, t)
						existing[t] = true
					}
				}
				break
			}
		}

		// Re-register the modified template
		r.register(tmpl)
	}

	return nil
}
