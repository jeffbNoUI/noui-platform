package domain

import "fmt"

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
	validated := parseRat(validatedAmount)
	if validated == nil {
		return nil, fmt.Errorf("invalid validated amount: %q", validatedAmount)
	}

	payment := parseRat(paymentAmount)
	if payment == nil {
		return nil, fmt.Errorf("invalid payment amount: %q", paymentAmount)
	}

	diff := ratSub(payment, validated)
	if withinPenny(payment, validated) {
		return nil, nil
	}

	s := ratFmt(diff)
	return &s, nil
}
