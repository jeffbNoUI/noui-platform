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
	if total < 440 {
		t.Errorf("expected at least 440 ExpectedNames after vocabulary merge, got %d", total)
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

func TestServiceCreditDualFieldNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		switch slot.CanonicalColumn {
		case "eligibility_service_years":
			t.Logf("eligibility_service_years: %d names", len(slot.ExpectedNames))
			if len(slot.ExpectedNames) < 8 {
				t.Errorf("eligibility_service_years should have 8+ names after merge, got %d", len(slot.ExpectedNames))
			}
		case "benefit_service_years":
			t.Logf("benefit_service_years: %d names", len(slot.ExpectedNames))
			if len(slot.ExpectedNames) < 6 {
				t.Errorf("benefit_service_years should have 6+ names after merge, got %d", len(slot.ExpectedNames))
			}
		}
	}
}

func TestSalaryHistoryFACEnrichedNames(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("salary-history")

	for _, slot := range tmpl.Slots {
		switch slot.CanonicalColumn {
		case "fac_window_months":
			t.Logf("fac_window_months: %d names", len(slot.ExpectedNames))
			if len(slot.ExpectedNames) < 5 {
				t.Errorf("fac_window_months should have 5+ names after merge, got %d", len(slot.ExpectedNames))
			}
		case "anti_spiking_cap_pct":
			t.Logf("anti_spiking_cap_pct: %d names", len(slot.ExpectedNames))
			if len(slot.ExpectedNames) < 5 {
				t.Errorf("anti_spiking_cap_pct should have 5+ names after merge, got %d", len(slot.ExpectedNames))
			}
		}
	}
}
