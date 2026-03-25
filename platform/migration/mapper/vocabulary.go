package mapper

import (
	"fmt"
	"os"
	"strings"

	"gopkg.in/yaml.v3"
)

// Vocabulary represents the parsed pension terminology vocabulary.
type Vocabulary struct {
	Version  string                               `yaml:"version"`
	Source   string                               `yaml:"source"`
	Systems  []string                             `yaml:"systems"`
	Concepts map[string]map[string]VocabularySlot `yaml:"concepts"`
}

// VocabularySlot holds terms and false cognates for one canonical column.
type VocabularySlot struct {
	Terms         []VocabularyTerm `yaml:"terms"`
	FalseCognates []FalseCognate   `yaml:"false_cognates"`
}

// VocabularyTerm is a single synonym with optional abbreviation and source systems.
type VocabularyTerm struct {
	Name    string   `yaml:"name"`
	Abbrev  string   `yaml:"abbrev,omitempty"`
	Systems []string `yaml:"systems"`
}

// FalseCognate describes a term that means different things at different systems.
type FalseCognate struct {
	Term    string `yaml:"term"`
	Warning string `yaml:"warning"`
	Risk    string `yaml:"risk"` // HIGH, MEDIUM, LOW
}

// LoadVocabulary reads and parses a vocabulary YAML file.
func LoadVocabulary(path string) (*Vocabulary, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading vocabulary file: %w", err)
	}

	var vocab Vocabulary
	if err := yaml.Unmarshal(data, &vocab); err != nil {
		return nil, fmt.Errorf("parsing vocabulary YAML: %w", err)
	}

	// Validate all term names are lowercase
	for concept, slots := range vocab.Concepts {
		for slot, vs := range slots {
			for _, term := range vs.Terms {
				if term.Name != strings.ToLower(term.Name) {
					return nil, fmt.Errorf("vocabulary term %q in %s.%s is not lowercase", term.Name, concept, slot)
				}
			}
		}
	}

	return &vocab, nil
}

// EnrichRegistry adds vocabulary terms to the registry's ExpectedNames arrays.
// Only adds terms that don't already exist in the slot. Returns the count of
// new terms added.
func EnrichRegistry(r *Registry, v *Vocabulary) int {
	added := 0
	for conceptTag, slots := range v.Concepts {
		tmpl, ok := r.Get(conceptTag)
		if !ok {
			continue
		}
		for si := range tmpl.Slots {
			slot := &tmpl.Slots[si]
			vocabSlot, ok := slots[slot.CanonicalColumn]
			if !ok {
				continue
			}

			existing := make(map[string]bool, len(slot.ExpectedNames))
			for _, name := range slot.ExpectedNames {
				existing[name] = true
			}

			for _, term := range vocabSlot.Terms {
				// Add the full name
				if !existing[term.Name] {
					slot.ExpectedNames = append(slot.ExpectedNames, term.Name)
					existing[term.Name] = true
					added++
				}
				// Add the abbreviation (lowercased) if present
				if term.Abbrev != "" {
					abbrevLower := strings.ToLower(term.Abbrev)
					if !existing[abbrevLower] {
						slot.ExpectedNames = append(slot.ExpectedNames, abbrevLower)
						existing[abbrevLower] = true
						added++
					}
				}
			}
		}
		// Write back the modified template via register()
		r.register(tmpl)
	}
	return added
}

// TermCount returns the total number of ExpectedNames entries across all slots.
func (r *Registry) TermCount() int {
	count := 0
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			count += len(slot.ExpectedNames)
		}
	}
	return count
}
