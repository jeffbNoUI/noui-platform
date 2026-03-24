package mapper

import "testing"

func TestExpectedNameCountAfterMerge(t *testing.T) {
	r := NewRegistry()
	total := 0
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			total += len(slot.ExpectedNames)
		}
	}
	t.Logf("Total ExpectedNames after merge: %d", total)
	if total < 400 {
		t.Errorf("expected at least 400 ExpectedNames after vocabulary merge, got %d (base was ~299)", total)
	}
}

func TestServiceCreditEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		t.Logf("slot %q: %d names", slot.CanonicalColumn, len(slot.ExpectedNames))
	}

	for _, slot := range tmpl.Slots {
		switch slot.CanonicalColumn {
		case "credited_years_total":
			if len(slot.ExpectedNames) < 15 {
				t.Errorf("credited_years_total should have 15+ names, got %d", len(slot.ExpectedNames))
			}
		case "purchased_years":
			if len(slot.ExpectedNames) < 15 {
				t.Errorf("purchased_years should have 15+ names, got %d", len(slot.ExpectedNames))
			}
		case "military_service_years":
			if len(slot.ExpectedNames) < 8 {
				t.Errorf("military_service_years should have 8+ names, got %d", len(slot.ExpectedNames))
			}
		}
	}
}

func TestSalaryHistoryEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("salary-history")
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "gross_amount" && len(slot.ExpectedNames) < 15 {
			t.Errorf("gross_amount should have 15+ names, got %d", len(slot.ExpectedNames))
		}
	}
}

func TestContributionEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("benefit-deduction")
	for _, slot := range tmpl.Slots {
		if slot.CanonicalColumn == "ee_amount" && len(slot.ExpectedNames) < 12 {
			t.Errorf("ee_amount should have 12+ names, got %d", len(slot.ExpectedNames))
		}
	}
}
