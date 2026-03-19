package domain

import (
	"testing"
)

func TestCalculateCost_Basic(t *testing.T) {
	// 5 years × $80,000 salary × 0.125 factor = $50,000.00
	result, err := CalculateCost("0.125", "80000.00", "5.00")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalCost != "50000.00" {
		t.Errorf("expected total cost 50000.00, got %s", result.TotalCost)
	}
}

func TestCalculateCost_FractionalYears(t *testing.T) {
	// 2.5 years × $60,000 × 0.10 = $15,000.00
	result, err := CalculateCost("0.10", "60000.00", "2.50")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalCost != "15000.00" {
		t.Errorf("expected total cost 15000.00, got %s", result.TotalCost)
	}
}

func TestCalculateCost_PennyAccuracy(t *testing.T) {
	// 3 years × $75,123.45 × 0.125 = $28,171.29 (rounds to nearest cent)
	result, err := CalculateCost("0.125", "75123.45", "3.00")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// 3 × 75123.45 × 0.125 = 28171.293750
	if result.TotalCost != "28171.29" {
		t.Errorf("expected total cost 28171.29, got %s", result.TotalCost)
	}
}

func TestCalculateCost_SmallFactor(t *testing.T) {
	// 1 year × $100,000 × 0.045678 = $4,567.80
	result, err := CalculateCost("0.045678", "100000.00", "1.00")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.TotalCost != "4567.80" {
		t.Errorf("expected total cost 4567.80, got %s", result.TotalCost)
	}
}

func TestCalculateCost_QuoteDates(t *testing.T) {
	result, err := CalculateCost("0.10", "50000.00", "1.00")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.QuoteDate == "" {
		t.Error("expected quote date to be set")
	}
	if result.QuoteExpires == "" {
		t.Error("expected quote expiry to be set")
	}
}

func TestCalculateCost_InvalidFactor(t *testing.T) {
	_, err := CalculateCost("invalid", "80000.00", "5.00")
	if err == nil {
		t.Error("expected error for invalid cost factor")
	}
}

func TestCalculateCost_InvalidSalary(t *testing.T) {
	_, err := CalculateCost("0.10", "bad", "5.00")
	if err == nil {
		t.Error("expected error for invalid salary")
	}
}

func TestCalculateCost_NegativeSalary(t *testing.T) {
	_, err := CalculateCost("0.10", "-50000.00", "5.00")
	if err == nil {
		t.Error("expected error for negative salary")
	}
}

func TestCalculateCost_InvalidYears(t *testing.T) {
	_, err := CalculateCost("0.10", "80000.00", "abc")
	if err == nil {
		t.Error("expected error for invalid years")
	}
}

func TestCalculateCost_ZeroYears(t *testing.T) {
	_, err := CalculateCost("0.10", "80000.00", "0.00")
	if err == nil {
		t.Error("expected error for zero years")
	}
}

func TestIsQuoteExpired_NotExpired(t *testing.T) {
	expired, err := IsQuoteExpired("2099-12-31")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expired {
		t.Error("expected quote to not be expired")
	}
}

func TestIsQuoteExpired_Expired(t *testing.T) {
	expired, err := IsQuoteExpired("2020-01-01")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !expired {
		t.Error("expected quote to be expired")
	}
}

func TestIsQuoteExpired_InvalidDate(t *testing.T) {
	_, err := IsQuoteExpired("not-a-date")
	if err == nil {
		t.Error("expected error for invalid date")
	}
}
