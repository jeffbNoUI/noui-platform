package validation

import (
	"strings"
	"testing"
)

func TestRequired(t *testing.T) {
	t.Run("non-empty passes", func(t *testing.T) {
		var errs Errors
		errs.Required("name", "Alice")
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("empty fails", func(t *testing.T) {
		var errs Errors
		errs.Required("name", "")
		if !errs.HasErrors() {
			t.Error("expected error for empty string")
		}
		if errs.Fields()[0].Field != "name" {
			t.Errorf("expected field 'name', got %q", errs.Fields()[0].Field)
		}
	})

	t.Run("whitespace-only fails", func(t *testing.T) {
		var errs Errors
		errs.Required("name", "   ")
		if !errs.HasErrors() {
			t.Error("expected error for whitespace-only string")
		}
	})
}

func TestMaxLen(t *testing.T) {
	t.Run("short passes", func(t *testing.T) {
		var errs Errors
		errs.MaxLen("name", "hi", 10)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("over-limit fails", func(t *testing.T) {
		var errs Errors
		errs.MaxLen("name", "hello world", 5)
		if !errs.HasErrors() {
			t.Error("expected error for over-limit string")
		}
	})
}

func TestMinLen(t *testing.T) {
	t.Run("long enough passes", func(t *testing.T) {
		var errs Errors
		errs.MinLen("password", "abcdef", 3)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("too short fails", func(t *testing.T) {
		var errs Errors
		errs.MinLen("password", "ab", 3)
		if !errs.HasErrors() {
			t.Error("expected error for too-short string")
		}
	})
}

func TestEnum(t *testing.T) {
	allowed := []string{"active", "inactive", "pending"}

	t.Run("valid passes", func(t *testing.T) {
		var errs Errors
		errs.Enum("status", "active", allowed)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("invalid fails", func(t *testing.T) {
		var errs Errors
		errs.Enum("status", "deleted", allowed)
		if !errs.HasErrors() {
			t.Error("expected error for invalid enum value")
		}
	})
}

func TestEnumOptional(t *testing.T) {
	allowed := []string{"active", "inactive"}

	t.Run("empty passes", func(t *testing.T) {
		var errs Errors
		errs.EnumOptional("status", "", allowed)
		if errs.HasErrors() {
			t.Errorf("expected no errors for empty value, got %v", errs.Fields())
		}
	})

	t.Run("valid passes", func(t *testing.T) {
		var errs Errors
		errs.EnumOptional("status", "active", allowed)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("invalid fails", func(t *testing.T) {
		var errs Errors
		errs.EnumOptional("status", "deleted", allowed)
		if !errs.HasErrors() {
			t.Error("expected error for invalid enum value")
		}
	})
}

func TestUUID(t *testing.T) {
	t.Run("valid UUID passes", func(t *testing.T) {
		var errs Errors
		errs.UUID("id", "550e8400-e29b-41d4-a716-446655440000")
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("invalid fails", func(t *testing.T) {
		var errs Errors
		errs.UUID("id", "not-a-uuid")
		if !errs.HasErrors() {
			t.Error("expected error for invalid UUID")
		}
	})

	t.Run("empty fails", func(t *testing.T) {
		var errs Errors
		errs.UUID("id", "")
		if !errs.HasErrors() {
			t.Error("expected error for empty UUID")
		}
	})
}

func TestUUIDOptional(t *testing.T) {
	t.Run("empty passes", func(t *testing.T) {
		var errs Errors
		errs.UUIDOptional("id", "")
		if errs.HasErrors() {
			t.Errorf("expected no errors for empty value, got %v", errs.Fields())
		}
	})

	t.Run("valid passes", func(t *testing.T) {
		var errs Errors
		errs.UUIDOptional("id", "550e8400-e29b-41d4-a716-446655440000")
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("invalid fails", func(t *testing.T) {
		var errs Errors
		errs.UUIDOptional("id", "bad-uuid")
		if !errs.HasErrors() {
			t.Error("expected error for invalid UUID")
		}
	})
}

func TestDateYMD(t *testing.T) {
	t.Run("valid date passes", func(t *testing.T) {
		var errs Errors
		errs.DateYMD("dob", "2024-01-15")
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("wrong format fails", func(t *testing.T) {
		var errs Errors
		errs.DateYMD("dob", "01/15/2024")
		if !errs.HasErrors() {
			t.Error("expected error for wrong date format")
		}
	})

	t.Run("invalid month fails", func(t *testing.T) {
		var errs Errors
		errs.DateYMD("dob", "2024-13-01")
		if !errs.HasErrors() {
			t.Error("expected error for invalid month")
		}
	})
}

func TestDateYMDOptional(t *testing.T) {
	t.Run("empty passes", func(t *testing.T) {
		var errs Errors
		errs.DateYMDOptional("dob", "")
		if errs.HasErrors() {
			t.Errorf("expected no errors for empty value, got %v", errs.Fields())
		}
	})

	t.Run("valid passes", func(t *testing.T) {
		var errs Errors
		errs.DateYMDOptional("dob", "2024-06-15")
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("invalid fails", func(t *testing.T) {
		var errs Errors
		errs.DateYMDOptional("dob", "not-a-date")
		if !errs.HasErrors() {
			t.Error("expected error for invalid date")
		}
	})
}

func TestPositiveInt(t *testing.T) {
	t.Run("positive passes", func(t *testing.T) {
		var errs Errors
		errs.PositiveInt("count", 5)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("zero fails", func(t *testing.T) {
		var errs Errors
		errs.PositiveInt("count", 0)
		if !errs.HasErrors() {
			t.Error("expected error for zero")
		}
	})

	t.Run("negative fails", func(t *testing.T) {
		var errs Errors
		errs.PositiveInt("count", -3)
		if !errs.HasErrors() {
			t.Error("expected error for negative")
		}
	})
}

func TestIntRange(t *testing.T) {
	t.Run("in-range passes", func(t *testing.T) {
		var errs Errors
		errs.IntRange("age", 25, 0, 150)
		if errs.HasErrors() {
			t.Errorf("expected no errors, got %v", errs.Fields())
		}
	})

	t.Run("below-range fails", func(t *testing.T) {
		var errs Errors
		errs.IntRange("age", -1, 0, 150)
		if !errs.HasErrors() {
			t.Error("expected error for below-range value")
		}
	})

	t.Run("above-range fails", func(t *testing.T) {
		var errs Errors
		errs.IntRange("age", 200, 0, 150)
		if !errs.HasErrors() {
			t.Error("expected error for above-range value")
		}
	})

	t.Run("boundary values pass", func(t *testing.T) {
		var errs Errors
		errs.IntRange("age", 0, 0, 150)
		errs.IntRange("age", 150, 0, 150)
		if errs.HasErrors() {
			t.Errorf("expected boundary values to pass, got %v", errs.Fields())
		}
	})
}

func TestPagination(t *testing.T) {
	t.Run("normal values", func(t *testing.T) {
		limit, offset := Pagination(10, 5, 100)
		if limit != 10 {
			t.Errorf("expected limit 10, got %d", limit)
		}
		if offset != 5 {
			t.Errorf("expected offset 5, got %d", offset)
		}
	})

	t.Run("negative offset clamps to 0", func(t *testing.T) {
		_, offset := Pagination(10, -5, 100)
		if offset != 0 {
			t.Errorf("expected offset 0, got %d", offset)
		}
	})

	t.Run("over-limit clamps", func(t *testing.T) {
		limit, _ := Pagination(500, 0, 100)
		if limit != 100 {
			t.Errorf("expected limit 100, got %d", limit)
		}
	})

	t.Run("zero limit defaults to 25", func(t *testing.T) {
		limit, _ := Pagination(0, 0, 100)
		if limit != 25 {
			t.Errorf("expected limit 25, got %d", limit)
		}
	})

	t.Run("negative limit defaults to 25", func(t *testing.T) {
		limit, _ := Pagination(-10, 0, 100)
		if limit != 25 {
			t.Errorf("expected limit 25, got %d", limit)
		}
	})
}

func TestErrorMessage(t *testing.T) {
	var errs Errors
	errs.Required("name", "")
	errs.Required("email", "")
	msg := errs.Error()
	if !strings.Contains(msg, "name") {
		t.Errorf("expected error message to contain 'name', got %q", msg)
	}
	if !strings.Contains(msg, "email") {
		t.Errorf("expected error message to contain 'email', got %q", msg)
	}
}

func TestMultipleErrors(t *testing.T) {
	var errs Errors
	errs.Required("name", "")
	errs.Required("email", "")
	errs.UUID("id", "bad")

	fields := errs.Fields()
	if len(fields) != 3 {
		t.Errorf("expected 3 errors, got %d", len(fields))
	}
	if !errs.HasErrors() {
		t.Error("expected HasErrors to be true")
	}
}
