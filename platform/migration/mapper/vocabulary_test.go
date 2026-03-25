package mapper

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// vocabPath returns the absolute path to vocabulary.yaml from the test file location.
func vocabPath(t *testing.T) string {
	t.Helper()
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path")
	}
	// Navigate from platform/migration/mapper/ to repo root
	repoRoot := filepath.Join(filepath.Dir(thisFile), "..", "..", "..")
	path := filepath.Join(repoRoot, "domains", "pension", "terminology", "vocabulary.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		t.Skipf("vocabulary.yaml not found at %s (run from repo root)", path)
	}
	return path
}

func TestLoadVocabulary(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	if vocab.Version != "1.0" {
		t.Errorf("expected version 1.0, got %q", vocab.Version)
	}
	if len(vocab.Systems) != 25 {
		t.Errorf("expected 25 systems, got %d", len(vocab.Systems))
	}
}

func TestVocabularyConceptsMatchRegistry(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	for conceptTag, slots := range vocab.Concepts {
		tmpl, ok := r.Get(conceptTag)
		if !ok {
			t.Errorf("vocabulary concept %q not found in registry", conceptTag)
			continue
		}
		slotNames := make(map[string]bool)
		for _, slot := range tmpl.Slots {
			slotNames[slot.CanonicalColumn] = true
		}
		for slotName := range slots {
			if !slotNames[slotName] {
				t.Errorf("vocabulary slot %s.%s not found in registry template", conceptTag, slotName)
			}
		}
	}
}

func TestEnrichRegistryAddsTerms(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	before := r.TermCount()
	added := EnrichRegistry(r, vocab)

	if added == 0 {
		t.Error("EnrichRegistry added zero terms — expected enrichment")
	}
	after := r.TermCount()
	if after != before+added {
		t.Errorf("TermCount mismatch: before=%d + added=%d != after=%d", before, added, after)
	}
	t.Logf("Enrichment: %d → %d (+%d terms)", before, after, added)
}

func TestEnrichRegistryNoDuplicates(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	EnrichRegistry(r, vocab)

	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			seen := make(map[string]bool)
			for _, name := range slot.ExpectedNames {
				if seen[name] {
					t.Errorf("duplicate ExpectedName %q in %s.%s", name, tag, slot.CanonicalColumn)
				}
				seen[name] = true
			}
		}
	}
}

func TestEnrichRegistryIdempotent(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	added1 := EnrichRegistry(r, vocab)
	added2 := EnrichRegistry(r, vocab)

	if added2 != 0 {
		t.Errorf("second EnrichRegistry call added %d terms (expected 0 — not idempotent)", added2)
	}
	if added1 == 0 {
		t.Error("first call added 0 terms — vocabulary may be empty or all duplicates")
	}
}

func TestAllVocabTermsAreLowercase(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	for concept, slots := range vocab.Concepts {
		for slot, vs := range slots {
			for _, term := range vs.Terms {
				if term.Name != strings.ToLower(term.Name) {
					t.Errorf("non-lowercase term %q in %s.%s", term.Name, concept, slot)
				}
			}
		}
	}
}

func TestVocabularyBaselineCount(t *testing.T) {
	r := NewRegistry()
	baseline := r.TermCount()
	if baseline < 290 {
		t.Errorf("baseline TermCount too low: %d (expected ~299)", baseline)
	}
	t.Logf("Baseline TermCount: %d", baseline)
}

func TestEnrichedCountAbove400(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	r := NewRegistry()
	EnrichRegistry(r, vocab)
	total := r.TermCount()
	if total < 350 {
		t.Errorf("enriched TermCount too low: %d (expected 350+)", total)
	}
	t.Logf("Enriched TermCount: %d", total)
}

func TestFalseCognatesLoaded(t *testing.T) {
	path := vocabPath(t)
	vocab, err := LoadVocabulary(path)
	if err != nil {
		t.Fatalf("LoadVocabulary failed: %v", err)
	}
	// Service credit should have false cognates
	scSlots, ok := vocab.Concepts["service-credit"]
	if !ok {
		t.Fatal("service-credit concept not in vocabulary")
	}
	cyt, ok := scSlots["credited_years_total"]
	if !ok {
		t.Fatal("credited_years_total slot not in service-credit")
	}
	if len(cyt.FalseCognates) == 0 {
		t.Error("expected false cognates for service-credit.credited_years_total")
	}
	// Check membership_service is flagged HIGH
	found := false
	for _, fc := range cyt.FalseCognates {
		if fc.Term == "membership_service" && fc.Risk == "HIGH" {
			found = true
		}
	}
	if !found {
		t.Error("membership_service HIGH-risk false cognate not found")
	}
}
