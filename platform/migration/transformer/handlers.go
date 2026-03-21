package transformer

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// --- 1. TypeCoerce (Priority 10) ---

// TypeCoerceHandler converts source values to the canonical type family.
// Handles INTEGER, DECIMAL, VARCHAR, DATE, BOOLEAN, UUID, TEXT.
func TypeCoerceHandler() TransformHandler {
	return TransformHandler{
		Name:     "TypeCoerce",
		Priority: 10,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}

			target := strings.ToUpper(mapping.CanonicalType)
			original := fmtValue(value)

			switch target {
			case "INTEGER":
				v, err := coerceToInt(value)
				if err != nil {
					ctx.AddException("TypeCoerce", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
						fmt.Sprintf("cannot coerce %q to INTEGER: %v", original, err))
					return nil, err
				}
				if original != fmt.Sprintf("%d", v) {
					ctx.AddLineage("TypeCoerce", mapping.CanonicalColumn, original, fmt.Sprintf("%d", v))
				}
				return v, nil

			case "DECIMAL":
				v, err := coerceToFloat(value)
				if err != nil {
					ctx.AddException("TypeCoerce", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
						fmt.Sprintf("cannot coerce %q to DECIMAL: %v", original, err))
					return nil, err
				}
				return v, nil

			case "BOOLEAN":
				v, err := coerceToBool(value)
				if err != nil {
					ctx.AddException("TypeCoerce", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
						fmt.Sprintf("cannot coerce %q to BOOLEAN: %v", original, err))
					return nil, err
				}
				return v, nil

			case "VARCHAR", "TEXT":
				s := fmt.Sprintf("%v", value)
				return s, nil

			case "DATE":
				// Date parsing is handled by ParseDateHandler; pass through here.
				return value, nil

			case "UUID":
				s := fmt.Sprintf("%v", value)
				if !isValidUUID(s) {
					ctx.AddException("TypeCoerce", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
						fmt.Sprintf("invalid UUID: %q", s))
					return nil, fmt.Errorf("invalid UUID: %s", s)
				}
				return s, nil

			default:
				// Unknown type family — pass through.
				return value, nil
			}
		},
	}
}

func coerceToInt(v interface{}) (int64, error) {
	switch val := v.(type) {
	case int:
		return int64(val), nil
	case int64:
		return val, nil
	case float64:
		if val != math.Trunc(val) {
			return 0, fmt.Errorf("float %f has fractional part", val)
		}
		return int64(val), nil
	case string:
		s := strings.TrimSpace(val)
		return strconv.ParseInt(s, 10, 64)
	default:
		return strconv.ParseInt(fmt.Sprintf("%v", v), 10, 64)
	}
}

func coerceToFloat(v interface{}) (float64, error) {
	switch val := v.(type) {
	case float64:
		return val, nil
	case int:
		return float64(val), nil
	case int64:
		return float64(val), nil
	case string:
		s := strings.TrimSpace(val)
		return strconv.ParseFloat(s, 64)
	default:
		return strconv.ParseFloat(fmt.Sprintf("%v", v), 64)
	}
}

func coerceToBool(v interface{}) (bool, error) {
	switch val := v.(type) {
	case bool:
		return val, nil
	case int:
		return val != 0, nil
	case int64:
		return val != 0, nil
	case float64:
		return val != 0, nil
	case string:
		s := strings.ToLower(strings.TrimSpace(val))
		switch s {
		case "true", "1", "yes", "y", "t":
			return true, nil
		case "false", "0", "no", "n", "f":
			return false, nil
		default:
			return false, fmt.Errorf("unrecognized boolean value: %q", val)
		}
	default:
		return false, fmt.Errorf("cannot coerce %T to boolean", v)
	}
}

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

func isValidUUID(s string) bool {
	return uuidRegex.MatchString(s)
}

// --- 2. NormalizeSSN (Priority 20) — P-03 ---

// ssnColumns are canonical column names that hold SSN-like values.
var ssnColumns = map[string]bool{
	"ssn": true, "social_security_number": true, "tax_id": true,
}

// NormalizeSSNHandler strips dashes, spaces, and dots from SSN-pattern columns,
// producing a 9-digit string.
func NormalizeSSNHandler() TransformHandler {
	return TransformHandler{
		Name:     "NormalizeSSN",
		Priority: 20,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			col := strings.ToLower(mapping.CanonicalColumn)
			if !ssnColumns[col] {
				return value, nil
			}

			s := fmt.Sprintf("%v", value)
			original := s
			s = strings.Map(func(r rune) rune {
				if r >= '0' && r <= '9' {
					return r
				}
				return -1 // strip non-digits
			}, s)

			if len(s) != 9 {
				ctx.AddException("NormalizeSSN", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
					fmt.Sprintf("SSN does not have 9 digits after normalization: %q → %q", original, s))
				return nil, fmt.Errorf("invalid SSN length: %d", len(s))
			}

			if s != original {
				ctx.AddLineage("NormalizeSSN", mapping.CanonicalColumn, original, s)
			}
			return s, nil
		},
	}
}

// --- 3. ParseDate (Priority 30) — P-02 ---

// dateFormats lists the date formats to try, in order.
var dateFormats = []string{
	"2006-01-02T15:04:05Z07:00", // ISO 8601 with timezone
	"2006-01-02T15:04:05",       // ISO 8601 without timezone
	"2006-01-02",                // ISO date
	"01/02/2006",                // MM/DD/YYYY
	"1/2/2006",                  // M/D/YYYY
	"01-02-2006",                // MM-DD-YYYY
	"20060102",                  // YYYYMMDD compact
	"2006/01/02",                // YYYY/MM/DD
	"Jan 2, 2006",               // Month D, YYYY
	"January 2, 2006",           // Full month D, YYYY
	"02-Jan-2006",               // DD-Mon-YYYY (Oracle style)
}

// ParseDateHandler parses multiple date formats and normalises to ISO 8601 (YYYY-MM-DD).
func ParseDateHandler() TransformHandler {
	return TransformHandler{
		Name:     "ParseDate",
		Priority: 30,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			if strings.ToUpper(mapping.CanonicalType) != "DATE" {
				return value, nil
			}

			// Already a time.Time — normalise.
			if t, ok := value.(time.Time); ok {
				iso := t.Format("2006-01-02")
				return iso, nil
			}

			s := strings.TrimSpace(fmt.Sprintf("%v", value))
			if s == "" {
				return nil, nil
			}
			original := s

			for _, layout := range dateFormats {
				t, err := time.Parse(layout, s)
				if err == nil {
					iso := t.Format("2006-01-02")
					if iso != original {
						ctx.AddLineage("ParseDate", mapping.CanonicalColumn, original, iso)
					}
					return iso, nil
				}
			}

			ctx.AddException("ParseDate", mapping.CanonicalColumn, original, ExceptionInvalidFormat,
				fmt.Sprintf("unable to parse date: %q", original))
			return nil, fmt.Errorf("unparseable date: %s", original)
		},
	}
}

// --- 4. ResolveCode (Priority 40) — P-12 ---

// ResolveCodeHandler looks up code table mappings from ctx.CodeMappings.
// Key format: "table.column" → source_value → canonical_value.
func ResolveCodeHandler() TransformHandler {
	return TransformHandler{
		Name:     "ResolveCode",
		Priority: 40,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil || ctx.CodeMappings == nil {
				return value, nil
			}

			// Look for a code mapping keyed on the canonical column.
			// Try both qualified (table.column) and bare column forms.
			keys := []string{
				mapping.CanonicalColumn,
			}
			if mapping.SourceColumn != "" {
				keys = append([]string{mapping.SourceColumn + "." + mapping.CanonicalColumn}, keys...)
			}
			s := fmt.Sprintf("%v", value)

			for _, key := range keys {
				if codeMap, ok := ctx.CodeMappings[key]; ok {
					if canonical, found := codeMap[s]; found {
						ctx.AddLineage("ResolveCode", mapping.CanonicalColumn, s, canonical)
						return canonical, nil
					}
					// Code exists in mapping table but value not found — exception.
					ctx.AddException("ResolveCode", mapping.CanonicalColumn, s, ExceptionReferentialIntegrity,
						fmt.Sprintf("code value %q not found in mapping for %q", s, key))
					return nil, fmt.Errorf("unmapped code: %s", s)
				}
			}

			return value, nil
		},
	}
}

// --- 5. ResolveMemberKey (Priority 50) — P-01 ---

// memberIDColumns are canonical columns that may hold member identifiers.
var memberIDColumns = map[string]bool{
	"member_id": true, "member_key": true, "participant_id": true,
	"person_id": true, "employee_id": true,
}

// ResolveMemberKeyHandler handles multiple ID aliases for member identification.
// If the primary member key column is nil, it falls back to other known ID
// columns in the source row.
func ResolveMemberKeyHandler() TransformHandler {
	// Source column aliases to check for fallback (common source names).
	fallbackSources := []string{
		"MEMBER_NBR", "MBR_NBR", "MBR_ID", "PARTICIPANT_ID", "PERS_ID",
		"EMPLOYEE_ID", "EMP_ID", "EMP_NBR", "SSN", "PERSON_ID", "ID",
		"member_nbr", "mbr_nbr", "mbr_id", "participant_id", "pers_id",
		"employee_id", "emp_id", "emp_nbr", "ssn", "person_id", "id",
	}

	return TransformHandler{
		Name:     "ResolveMemberKey",
		Priority: 50,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			col := strings.ToLower(mapping.CanonicalColumn)
			if !memberIDColumns[col] {
				return value, nil
			}
			if value != nil {
				return value, nil
			}

			// Value is nil — try fallback aliases in the source row.
			for _, alias := range fallbackSources {
				if v, ok := sourceRow[alias]; ok && v != nil {
					ctx.AddLineage("ResolveMemberKey", mapping.CanonicalColumn, "<nil>", fmtValue(v))
					return v, nil
				}
			}

			return nil, nil
		},
	}
}

// --- 6. ResolveStatus (Priority 60) — P-04 ---

// statusColumns are canonical columns holding status codes.
var statusColumns = map[string]bool{
	"status": true, "member_status": true, "employment_status": true,
	"account_status": true, "benefit_status": true,
}

// canonicalStatuses maps common source status values to canonical status codes.
// This handles cross-epoch semantic mapping (e.g., legacy "A" → "ACTIVE").
var canonicalStatuses = map[string]string{
	// Active variants
	"a": "ACTIVE", "active": "ACTIVE", "act": "ACTIVE", "1": "ACTIVE",
	// Inactive variants
	"i": "INACTIVE", "inactive": "INACTIVE", "inact": "INACTIVE", "0": "INACTIVE",
	// Terminated variants
	"t": "TERMINATED", "terminated": "TERMINATED", "term": "TERMINATED",
	// Retired variants
	"r": "RETIRED", "retired": "RETIRED", "ret": "RETIRED",
	// Deceased variants
	"d": "DECEASED", "deceased": "DECEASED", "dead": "DECEASED",
	// Deferred variants
	"def": "DEFERRED", "deferred": "DEFERRED",
	// Suspended variants
	"s": "SUSPENDED", "suspended": "SUSPENDED", "susp": "SUSPENDED",
	// Pending
	"p": "PENDING", "pending": "PENDING", "pend": "PENDING",
}

// ResolveStatusHandler maps status codes across semantic epochs to canonical values.
func ResolveStatusHandler() TransformHandler {
	return TransformHandler{
		Name:     "ResolveStatus",
		Priority: 60,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			col := strings.ToLower(mapping.CanonicalColumn)
			if !statusColumns[col] {
				return value, nil
			}

			s := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", value)))
			original := fmt.Sprintf("%v", value)

			if canonical, ok := canonicalStatuses[s]; ok {
				if canonical != original {
					ctx.AddLineage("ResolveStatus", mapping.CanonicalColumn, original, canonical)
				}
				return canonical, nil
			}

			// Not in the known status map — pass through as-is.
			// The ValidateConstraints handler will catch invalid values later.
			return value, nil
		},
	}
}

// --- 7. DetectGranularity (Priority 70) — P-06 ---

// granularityColumns are canonical columns where we detect annual vs detailed records.
var granularityColumns = map[string]bool{
	"salary_amount": true, "contribution_amount": true, "earnings_amount": true,
}

// DetectGranularityHandler flags whether salary/contribution records appear to be
// annual summaries vs detailed (monthly/biweekly/etc). It adds a lineage annotation
// but does not modify the value.
func DetectGranularityHandler() TransformHandler {
	return TransformHandler{
		Name:     "DetectGranularity",
		Priority: 70,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			col := strings.ToLower(mapping.CanonicalColumn)
			if !granularityColumns[col] {
				return value, nil
			}

			// Heuristic: if both period_start and period_end exist in the source row
			// and span ~1 year, annotate as ANNUAL.
			startVal := findSourceField(sourceRow, "period_start", "start_date", "eff_date", "begin_date")
			endVal := findSourceField(sourceRow, "period_end", "end_date", "term_date", "expire_date")

			if startVal != nil && endVal != nil {
				startStr := fmt.Sprintf("%v", startVal)
				endStr := fmt.Sprintf("%v", endVal)
				start, err1 := tryParseDate(startStr)
				end, err2 := tryParseDate(endStr)
				if err1 == nil && err2 == nil {
					days := end.Sub(start).Hours() / 24
					granularity := "DETAILED"
					if days >= 350 && days <= 380 {
						granularity = "ANNUAL"
					}
					ctx.AddLineage("DetectGranularity", mapping.CanonicalColumn, fmtValue(value),
						fmt.Sprintf("granularity=%s (span=%.0f days)", granularity, days))
				}
			}

			return value, nil
		},
	}
}

// findSourceField looks for a field in the source row by trying multiple names.
func findSourceField(sourceRow map[string]interface{}, names ...string) interface{} {
	for _, name := range names {
		if v, ok := sourceRow[name]; ok && v != nil {
			return v
		}
		// Also try uppercase.
		upper := strings.ToUpper(name)
		if v, ok := sourceRow[upper]; ok && v != nil {
			return v
		}
	}
	return nil
}

// tryParseDate attempts to parse a date string using the known formats.
func tryParseDate(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	for _, layout := range dateFormats {
		t, err := time.Parse(layout, s)
		if err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("cannot parse date: %s", s)
}

// --- 8. DeduplicateQDRO (Priority 80) — P-08 ---

// qdroColumns are canonical columns related to QDRO (Qualified Domestic Relations Order).
var qdroColumns = map[string]bool{
	"qdro_flag": true, "qdro_indicator": true, "alternate_payee": true,
	"beneficiary_type": true,
}

// DeduplicateQDROHandler removes QDRO records that duplicate beneficiary data.
// If a row has qdro_flag set AND the same member already has a matching
// beneficiary record (detected via the source row's beneficiary_id), the
// handler marks it as a duplicate.
func DeduplicateQDROHandler() TransformHandler {
	return TransformHandler{
		Name:     "DeduplicateQDRO",
		Priority: 80,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			col := strings.ToLower(mapping.CanonicalColumn)
			if !qdroColumns[col] {
				return value, nil
			}

			// Check if this row is flagged as QDRO.
			qdroVal := findSourceField(sourceRow, "qdro_flag", "QDRO_FLAG", "qdro_indicator", "QDRO_INDICATOR")
			if qdroVal == nil {
				return value, nil
			}

			qdroStr := strings.ToLower(strings.TrimSpace(fmt.Sprintf("%v", qdroVal)))
			if qdroStr == "y" || qdroStr == "yes" || qdroStr == "1" || qdroStr == "true" {
				// Check if there's a beneficiary_id that indicates duplication.
				benID := findSourceField(sourceRow, "beneficiary_id", "BENEFICIARY_ID", "ben_id", "BEN_ID")
				if benID != nil {
					ctx.AddLineage("DeduplicateQDRO", mapping.CanonicalColumn, fmtValue(value),
						fmt.Sprintf("QDRO duplicate flagged (beneficiary_id=%v)", benID))
				}
			}

			return value, nil
		},
	}
}

// --- 9. ResolveAddress (Priority 90) — P-10 ---

// addressColumns are canonical columns holding address components.
var addressColumns = map[string]bool{
	"address_line1": true, "address_line2": true, "city": true,
	"state": true, "zip_code": true, "postal_code": true,
	"mailing_address": true, "street_address": true,
}

// addressPrioritySources lists source address prefixes in priority order.
// The first non-empty source wins.
var addressPrioritySources = []string{
	"mail_", // mailing address — highest priority
	"mailing_",
	"home_", // home address
	"residence_",
	"work_", // work address — lowest priority
	"business_",
}

// ResolveAddressHandler picks the authoritative address from potentially
// conflicting sources (mailing > home > work).
func ResolveAddressHandler() TransformHandler {
	return TransformHandler{
		Name:     "ResolveAddress",
		Priority: 90,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value != nil {
				return value, nil
			}

			col := strings.ToLower(mapping.CanonicalColumn)
			if !addressColumns[col] {
				return nil, nil
			}

			// Extract the address field suffix (e.g., "address_line1" → "address_line1").
			// Try finding a match from priority sources.
			for _, prefix := range addressPrioritySources {
				candidateKey := prefix + col
				v := findSourceField(sourceRow, candidateKey, strings.ToUpper(candidateKey))
				if v != nil {
					ctx.AddLineage("ResolveAddress", mapping.CanonicalColumn, "<nil>",
						fmt.Sprintf("resolved from %s%s=%v", prefix, col, v))
					return v, nil
				}
			}

			return nil, nil
		},
	}
}

// --- 10. MapHireDates (Priority 100) — P-11 ---

// hireDateColumns are canonical columns related to hire/employment dates.
var hireDateColumns = map[string]bool{
	"hire_date": true, "original_hire_date": true, "career_hire_date": true,
	"rehire_date": true, "spell_start_date": true,
}

// MapHireDatesHandler distinguishes career hire date from spell start date.
// In pension systems, "hire_date" in the source may mean either:
// - The original career start date (for benefit calculation)
// - The current employment spell start (for vesting)
// This handler resolves ambiguity by checking for multiple date fields.
func MapHireDatesHandler() TransformHandler {
	return TransformHandler{
		Name:     "MapHireDates",
		Priority: 100,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value == nil {
				return nil, nil
			}
			col := strings.ToLower(mapping.CanonicalColumn)
			if !hireDateColumns[col] {
				return value, nil
			}

			// If mapping to "hire_date" or "career_hire_date", check whether
			// the source also has a separate rehire or spell-start field.
			if col == "hire_date" || col == "career_hire_date" {
				rehire := findSourceField(sourceRow,
					"rehire_date", "REHIRE_DATE", "rehire_dt", "REHIRE_DT",
					"spell_start", "SPELL_START", "current_hire_date", "CURRENT_HIRE_DATE")
				if rehire != nil {
					// Both exist — the mapped value is the career hire date.
					ctx.AddLineage("MapHireDates", mapping.CanonicalColumn, fmtValue(value),
						fmt.Sprintf("confirmed as career hire (rehire/spell_start also present: %v)", rehire))
				}
			}

			if col == "spell_start_date" || col == "rehire_date" {
				career := findSourceField(sourceRow,
					"hire_date", "HIRE_DATE", "orig_hire_date", "ORIG_HIRE_DATE",
					"career_hire_date", "CAREER_HIRE_DATE")
				if career != nil {
					ctx.AddLineage("MapHireDates", mapping.CanonicalColumn, fmtValue(value),
						fmt.Sprintf("confirmed as spell start (career hire also present: %v)", career))
				}
			}

			return value, nil
		},
	}
}

// --- 11. DeriveDefaults (Priority 110) — NEW ---

// DeriveDefaultsHandler computes derivable values for missing fields.
// If a field is nil and the mapping has a DefaultValue, the default is applied.
// Also derives certain fields from related source data.
func DeriveDefaultsHandler() TransformHandler {
	return TransformHandler{
		Name:     "DeriveDefaults",
		Priority: 110,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			if value != nil {
				return value, nil
			}

			// Apply configured default if present.
			if mapping.DefaultValue != "" {
				ctx.AddLineage("DeriveDefaults", mapping.CanonicalColumn, "<nil>", mapping.DefaultValue)
				return mapping.DefaultValue, nil
			}

			// Derive full_name from first_name + last_name.
			col := strings.ToLower(mapping.CanonicalColumn)
			if col == "full_name" {
				first := findSourceField(sourceRow, "first_name", "FIRST_NAME", "fname", "FNAME")
				last := findSourceField(sourceRow, "last_name", "LAST_NAME", "lname", "LNAME")
				if first != nil && last != nil {
					derived := fmt.Sprintf("%v %v", first, last)
					ctx.AddLineage("DeriveDefaults", mapping.CanonicalColumn, "<nil>", derived)
					return derived, nil
				}
			}

			// Derive age from birth_date.
			if col == "age" {
				dob := findSourceField(sourceRow, "birth_date", "BIRTH_DATE", "dob", "DOB", "date_of_birth", "DATE_OF_BIRTH")
				if dob != nil {
					t, err := tryParseDate(fmt.Sprintf("%v", dob))
					if err == nil {
						age := int(time.Since(t).Hours() / 24 / 365.25)
						ctx.AddLineage("DeriveDefaults", mapping.CanonicalColumn, "<nil>", fmt.Sprintf("%d", age))
						return age, nil
					}
				}
			}

			return nil, nil
		},
	}
}

// --- 12. ValidateConstraints (Priority 120) — NEW ---

// ValidateConstraintsHandler checks NOT NULL, type, and range constraints
// before the row is loaded into the canonical schema.
// This should run last — after all transformations.
func ValidateConstraintsHandler() TransformHandler {
	return TransformHandler{
		Name:     "ValidateConstraints",
		Priority: 120,
		Apply: func(value interface{}, sourceRow map[string]interface{}, mapping FieldMapping, ctx *TransformContext) (interface{}, error) {
			// NOT NULL check for required fields.
			if value == nil && mapping.Required {
				ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, "<nil>", ExceptionMissingRequired,
					fmt.Sprintf("required column %q is NULL", mapping.CanonicalColumn))
				return nil, fmt.Errorf("required column %s is NULL", mapping.CanonicalColumn)
			}

			if value == nil {
				return nil, nil
			}

			// Type validation for string values in typed columns.
			target := strings.ToUpper(mapping.CanonicalType)
			s := fmt.Sprintf("%v", value)

			switch target {
			case "INTEGER":
				if _, ok := value.(int64); !ok {
					if _, ok := value.(int); !ok {
						// Try parsing — might be a string that was already coerced.
						if _, err := strconv.ParseInt(s, 10, 64); err != nil {
							ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, s, ExceptionInvalidFormat,
								fmt.Sprintf("value %q is not a valid integer", s))
							return nil, err
						}
					}
				}

			case "DECIMAL":
				if _, ok := value.(float64); !ok {
					if _, err := strconv.ParseFloat(s, 64); err != nil {
						ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, s, ExceptionInvalidFormat,
							fmt.Sprintf("value %q is not a valid decimal", s))
						return nil, err
					}
				}

			case "DATE":
				// Validate ISO date format after parsing.
				if _, err := time.Parse("2006-01-02", s); err != nil {
					// Also accept full ISO 8601.
					if _, err2 := time.Parse("2006-01-02T15:04:05Z07:00", s); err2 != nil {
						ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, s, ExceptionInvalidFormat,
							fmt.Sprintf("value %q is not a valid ISO date", s))
						return nil, err
					}
				}

			case "UUID":
				if !isValidUUID(s) {
					ctx.AddException("ValidateConstraints", mapping.CanonicalColumn, s, ExceptionInvalidFormat,
						fmt.Sprintf("value %q is not a valid UUID", s))
					return nil, fmt.Errorf("invalid UUID: %s", s)
				}
			}

			return value, nil
		},
	}
}
