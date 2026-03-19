package domain

import (
	"testing"
)

func TestValidatePaymentMethod_Valid(t *testing.T) {
	for _, method := range []string{"ACH", "WIRE"} {
		if err := ValidatePaymentMethod(method); err != nil {
			t.Errorf("expected %s to be valid, got error: %v", method, err)
		}
	}
}

func TestValidatePaymentMethod_Invalid(t *testing.T) {
	for _, method := range []string{"CASH", "CHECK", "", "ach"} {
		if err := ValidatePaymentMethod(method); err == nil {
			t.Errorf("expected %q to be invalid", method)
		}
	}
}

func TestCalculateDiscrepancy_Match(t *testing.T) {
	disc, err := CalculateDiscrepancy("1000.00", "1000.00")
	if err != nil {
		t.Fatal(err)
	}
	if disc != nil {
		t.Errorf("expected nil discrepancy for matching amounts, got %v", *disc)
	}
}

func TestCalculateDiscrepancy_PennyMatch(t *testing.T) {
	disc, err := CalculateDiscrepancy("1000.00", "1000.01")
	if err != nil {
		t.Fatal(err)
	}
	if disc != nil {
		t.Errorf("expected nil discrepancy within penny tolerance, got %v", *disc)
	}
}

func TestCalculateDiscrepancy_Overpayment(t *testing.T) {
	disc, err := CalculateDiscrepancy("1000.00", "1050.00")
	if err != nil {
		t.Fatal(err)
	}
	if disc == nil {
		t.Fatal("expected non-nil discrepancy")
	}
	if *disc != "50.00" {
		t.Errorf("expected discrepancy 50.00, got %s", *disc)
	}
}

func TestCalculateDiscrepancy_Underpayment(t *testing.T) {
	disc, err := CalculateDiscrepancy("1000.00", "950.00")
	if err != nil {
		t.Fatal(err)
	}
	if disc == nil {
		t.Fatal("expected non-nil discrepancy")
	}
	if *disc != "-50.00" {
		t.Errorf("expected discrepancy -50.00, got %s", *disc)
	}
}
