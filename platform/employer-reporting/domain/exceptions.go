package domain

// ExceptionType constants match the database CHECK constraint.
const (
	ExTypeRateMismatch    = "RATE_MISMATCH"
	ExTypeUnknownMember   = "UNKNOWN_MEMBER"
	ExTypeWrongPlan       = "WRONG_PLAN"
	ExTypeWrongDivision   = "WRONG_DIVISION"
	ExTypeRetireeDetected = "RETIREE_DETECTED"
	ExTypeICDetected      = "IC_DETECTED"
	ExTypeSalarySpreading = "SALARY_SPREADING"
	ExTypeDuplicateSSN    = "DUPLICATE_SSN"
	ExTypeMissingData     = "MISSING_DATA"
	ExTypeNegativeAmount  = "NEGATIVE_AMOUNT"
	ExTypeOther           = "OTHER"
)

// DCRoutedTypes are exception types that auto-route to the DC team.
var DCRoutedTypes = map[string]bool{
	"401K_EXCEPTION": true,
	"457_EXCEPTION":  true,
}

// ExceptionFromValidationError maps a ValidationError to an exception type and description.
func ExceptionFromValidationError(ve ValidationError) (exType, description string) {
	switch ve.Code {
	case "RATE_MISMATCH":
		return ExTypeRateMismatch, ve.Description
	case "INVALID_SALARY":
		return ExTypeMissingData, "Invalid or missing gross salary"
	case "INVALID_AMOUNT":
		return ExTypeMissingData, ve.Description
	case "INVALID_TOTAL":
		return ExTypeMissingData, "Invalid total amount"
	case "TOTAL_MISMATCH":
		return ExTypeRateMismatch, ve.Description
	case "NEGATIVE_AMOUNT":
		return ExTypeNegativeAmount, ve.Description
	default:
		return ExTypeOther, ve.Description
	}
}

// IsDCRouted returns true if the exception type should be auto-routed to DC team.
func IsDCRouted(exceptionType string) bool {
	return DCRoutedTypes[exceptionType]
}
