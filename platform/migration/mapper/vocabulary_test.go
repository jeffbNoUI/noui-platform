package mapper

import (
	"strings"
	"testing"
)

func TestVocabularyLoads(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	if len(vocab) == 0 {
		t.Fatal("vocabulary is empty")
	}
}

func TestVocabularyHasServiceCredit(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	sc, ok := vocab["service-credit"]
	if !ok {
		t.Fatal("vocabulary missing service-credit section")
	}
	cyt, ok := sc["credited_years_total"]
	if !ok {
		t.Fatal("service-credit missing credited_years_total slot")
	}
	if len(cyt.Terms) < 10 {
		t.Errorf("expected at least 10 terms for credited_years_total, got %d", len(cyt.Terms))
	}
}

func TestVocabularyTermsAreLowercase(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	for section, slots := range vocab {
		for slotName, slot := range slots {
			for _, term := range slot.Terms {
				if term != strings.ToLower(term) {
					t.Errorf("section %q slot %q has non-lowercase term %q",
						section, slotName, term)
				}
			}
		}
	}
}

func TestMergeVocabularyExpandsRegistry(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "credited_years_total" {
			if len(slot.ExpectedNames) < 15 {
				t.Errorf("credited_years_total should have 15+ names after merge, got %d",
					len(slot.ExpectedNames))
			}
			return
		}
	}
	t.Error("credited_years_total slot not found")
}

func TestMergeDeduplicates(t *testing.T) {
	r := NewRegistry()
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			seen := make(map[string]bool)
			for _, name := range slot.ExpectedNames {
				if seen[name] {
					t.Errorf("tag %q slot %q has duplicate expected name %q",
						tag, slot.CanonicalColumn, name)
				}
				seen[name] = true
			}
		}
	}
}

func TestVocabularyFalseCognatesPresent(t *testing.T) {
	vocab, err := LoadVocabulary()
	if err != nil {
		t.Fatalf("LoadVocabulary() error: %v", err)
	}
	sc := vocab["service-credit"]
	cyt := sc["credited_years_total"]
	if len(cyt.FalseCognates) == 0 {
		t.Error("credited_years_total should have false cognate definitions")
	}
	found := false
	for _, fc := range cyt.FalseCognates {
		if fc.Term == "membership_service" {
			found = true
			if fc.Risk != "HIGH" {
				t.Errorf("membership_service should be HIGH risk, got %q", fc.Risk)
			}
		}
	}
	if !found {
		t.Error("membership_service false cognate not found in vocabulary")
	}
}
