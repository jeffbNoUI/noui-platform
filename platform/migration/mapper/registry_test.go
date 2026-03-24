package mapper

import (
	"strings"
	"testing"
)

func TestAllEighteenConceptTagsRegistered(t *testing.T) {
	r := NewRegistry()
	tags := r.Tags()
	if len(tags) != 18 {
		t.Errorf("expected 18 registered tags, got %d: %v", len(tags), tags)
	}
}

func TestEmployeeMasterCanonicalTable(t *testing.T) {
	r := NewRegistry()
	tmpl, ok := r.Get("employee-master")
	if !ok {
		t.Fatal("employee-master not found in registry")
	}
	if tmpl.CanonicalTable != "member" {
		t.Errorf("expected canonical_table 'member', got %q", tmpl.CanonicalTable)
	}
}

func TestSalaryHistoryCanonicalTable(t *testing.T) {
	r := NewRegistry()
	tmpl, ok := r.Get("salary-history")
	if !ok {
		t.Fatal("salary-history not found in registry")
	}
	if tmpl.CanonicalTable != "earnings" {
		t.Errorf("expected canonical_table 'earnings', got %q", tmpl.CanonicalTable)
	}
}

func TestEmployeeMasterRequiredFields(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("employee-master")

	requiredSlots := map[string]bool{
		"member_id":  false,
		"birth_date": false,
	}

	for _, slot := range tmpl.Slots {
		if _, want := requiredSlots[slot.CanonicalColumn]; want && slot.Required {
			requiredSlots[slot.CanonicalColumn] = true
		}
	}

	for col, found := range requiredSlots {
		if !found {
			t.Errorf("expected %q to be a required slot in employee-master", col)
		}
	}
}

func TestNonPensionConceptsHaveEmptySlots(t *testing.T) {
	r := NewRegistry()
	nonPension := []string{
		"leave-balance", "attendance", "training-record", "expense-claim",
		"performance-review", "shift-schedule", "loan-advance", "audit-trail",
	}
	for _, tag := range nonPension {
		tmpl, ok := r.Get(tag)
		if !ok {
			t.Errorf("non-pension tag %q not registered", tag)
			continue
		}
		if len(tmpl.Slots) != 0 {
			t.Errorf("non-pension tag %q should have empty slots, got %d", tag, len(tmpl.Slots))
		}
	}
}

func TestAtLeastTenPensionTemplatesHaveSlots(t *testing.T) {
	r := NewRegistry()
	count := 0
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		if len(tmpl.Slots) > 0 {
			count++
		}
	}
	if count < 10 {
		t.Errorf("expected at least 10 pension-relevant templates with slots, got %d", count)
	}
}

func TestExpectedNamesAreLowercase(t *testing.T) {
	r := NewRegistry()
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			for _, name := range slot.ExpectedNames {
				if name != strings.ToLower(name) {
					t.Errorf("tag %q slot %q has non-lowercase expected name %q",
						tag, slot.CanonicalColumn, name)
				}
			}
		}
	}
}

func TestGetReturnsFalseForUnknownTag(t *testing.T) {
	r := NewRegistry()
	_, ok := r.Get("nonexistent-tag")
	if ok {
		t.Error("expected Get to return false for unknown tag")
	}
}

func TestTagsSorted(t *testing.T) {
	r := NewRegistry()
	tags := r.Tags()
	for i := 1; i < len(tags); i++ {
		if tags[i] < tags[i-1] {
			t.Errorf("Tags() not sorted: %q comes after %q", tags[i], tags[i-1])
		}
	}
}

func TestPensionTemplateCanonicalTables(t *testing.T) {
	r := NewRegistry()
	expected := map[string]string{
		"employee-master":          "member",
		"salary-history":           "earnings",
		"employment-timeline":      "employment",
		"benefit-deduction":        "contribution",
		"service-credit":           "service_credit",
		"beneficiary-designation":  "beneficiary",
		"domestic-relations-order": "dro",
		"benefit-payment":          "payment",
		"case-management":          "case",
	}
	for tag, table := range expected {
		tmpl, ok := r.Get(tag)
		if !ok {
			t.Errorf("tag %q not found", tag)
			continue
		}
		if tmpl.CanonicalTable != table {
			t.Errorf("tag %q: expected canonical_table %q, got %q", tag, table, tmpl.CanonicalTable)
		}
	}
}

func TestEverySlotHasExpectedNames(t *testing.T) {
	r := NewRegistry()
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			if len(slot.ExpectedNames) == 0 {
				t.Errorf("tag %q slot %q has no expected names", tag, slot.CanonicalColumn)
			}
		}
	}
}

func TestServiceCreditHasNewSlots(t *testing.T) {
	r := NewRegistry()
	tmpl, ok := r.Get("service-credit")
	if !ok {
		t.Fatal("service-credit not found")
	}

	wantSlots := []string{
		"purchased_years", "military_service_years", "transferred_service",
		"eligibility_service_years", "benefit_service_years",
	}
	slotMap := make(map[string]bool)
	for _, slot := range tmpl.Slots {
		slotMap[slot.CanonicalColumn] = true
	}

	for _, want := range wantSlots {
		if !slotMap[want] {
			t.Errorf("service-credit missing slot %q", want)
		}
	}
}

func TestServiceCreditDualFields(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	for _, slot := range tmpl.Slots {
		switch slot.CanonicalColumn {
		case "eligibility_service_years":
			if slot.Required {
				t.Error("eligibility_service_years must be optional")
			}
			if slot.DataTypeFamily != "DECIMAL" {
				t.Errorf("eligibility_service_years type: want DECIMAL, got %q", slot.DataTypeFamily)
			}
		case "benefit_service_years":
			if slot.Required {
				t.Error("benefit_service_years must be optional")
			}
			if slot.DataTypeFamily != "DECIMAL" {
				t.Errorf("benefit_service_years type: want DECIMAL, got %q", slot.DataTypeFamily)
			}
		}
	}
}

func TestSalaryHistoryFACSlots(t *testing.T) {
	r := NewRegistry()
	tmpl, ok := r.Get("salary-history")
	if !ok {
		t.Fatal("salary-history not found")
	}

	wantSlots := map[string]string{
		"fac_window_months":       "INTEGER",
		"anti_spiking_cap_pct":    "DECIMAL",
		"compensation_inclusions": "VARCHAR",
	}

	slotMap := make(map[string]TemplateSlot)
	for _, slot := range tmpl.Slots {
		slotMap[slot.CanonicalColumn] = slot
	}

	for name, wantType := range wantSlots {
		slot, ok := slotMap[name]
		if !ok {
			t.Errorf("salary-history missing slot %q", name)
			continue
		}
		if slot.Required {
			t.Errorf("slot %q must be optional", name)
		}
		if slot.DataTypeFamily != wantType {
			t.Errorf("slot %q type: want %q, got %q", name, wantType, slot.DataTypeFamily)
		}
	}
}

func TestServiceCreditMetadata(t *testing.T) {
	r := NewRegistry()
	tmpl, _ := r.Get("service-credit")

	if tmpl.Metadata == nil {
		t.Fatal("service-credit Metadata is nil")
	}
	note, ok := tmpl.Metadata["benefit_model_note"]
	if !ok {
		t.Fatal("service-credit missing benefit_model_note metadata")
	}
	if !strings.Contains(note, "TMRS") {
		t.Errorf("benefit_model_note should mention TMRS, got %q", note)
	}
}

func TestEverySlotHasDataTypeFamily(t *testing.T) {
	r := NewRegistry()
	validTypes := map[string]bool{
		"INTEGER": true, "DECIMAL": true, "VARCHAR": true,
		"DATE": true, "BOOLEAN": true, "UUID": true, "TEXT": true,
	}
	for _, tag := range r.Tags() {
		tmpl, _ := r.Get(tag)
		for _, slot := range tmpl.Slots {
			if !validTypes[slot.DataTypeFamily] {
				t.Errorf("tag %q slot %q has invalid data type family %q",
					tag, slot.CanonicalColumn, slot.DataTypeFamily)
			}
		}
	}
}
