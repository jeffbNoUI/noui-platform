package domain

import (
	"fmt"
	"math"
	"strconv"
)

// PaymentMethod constants.
const (
	PaymentACH  = "ACH"
	PaymentWire = "WIRE"
)

// ValidPaymentMethods are the accepted payment methods.
var ValidPaymentMethods = map[string]bool{
	PaymentACH:  true,
	PaymentWire: true,
}

// ValidatePaymentMethod checks that a payment method string is valid.
func ValidatePaymentMethod(method string) error {
	if !ValidPaymentMethods[method] {
		return fmt.Errorf("invalid payment method %q: must be ACH or WIRE", method)
	}
	return nil
}

// CalculateDiscrepancy computes the difference between validated amount and payment amount.
// Returns nil if amounts match within $0.01.
func CalculateDiscrepancy(validatedAmount, paymentAmount string) (*string, error) {
	validated, err := strconv.ParseFloat(validatedAmount, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid validated amount: %w", err)
	}

	payment, err := strconv.ParseFloat(paymentAmount, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid payment amount: %w", err)
	}

	diff := payment - validated
	if math.Abs(diff) <= 0.01 {
		return nil, nil
	}

	s := fmt.Sprintf("%.2f", diff)
	return &s, nil
}
