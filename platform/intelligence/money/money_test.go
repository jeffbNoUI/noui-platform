package money

import (
	"encoding/json"
	"testing"
)

func TestNew(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"0", "0.00"},
		{"100", "100.00"},
		{"10639.45", "10639.45"},
		{"-500.50", "-500.50"},
		{"0.01", "0.01"},
		{"1633.07", "1633.07"},
	}
	for _, tt := range tests {
		m := New(tt.input)
		if got := m.String(); got != tt.expected {
			t.Errorf("New(%q).String() = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestFromFloat64(t *testing.T) {
	tests := []struct {
		input    float64
		expected string
	}{
		{0.0, "0.00"},
		{10639.45, "10639.45"},
		{7330.72, "7330.72"},
		{7347.62, "7347.62"},
		{5000.00, "5000.00"},
		{52000.0, "52000.00"},
	}
	for _, tt := range tests {
		m := FromFloat64(tt.input)
		if got := m.Round().String(); got != tt.expected {
			t.Errorf("FromFloat64(%v).Round().String() = %q, want %q", tt.input, got, tt.expected)
		}
	}
}

func TestArithmetic(t *testing.T) {
	a := New("7347.62")
	b := New("2333.24")

	// Add
	sum := a.Add(b)
	if got := sum.Round().String(); got != "9680.86" {
		t.Errorf("Add = %s, want 9680.86", got)
	}

	// Sub
	diff := a.Sub(b)
	if got := diff.Round().String(); got != "5014.38" {
		t.Errorf("Sub = %s, want 5014.38", got)
	}

	// Mul by scalar: 7347.62 × 0.015 × 21.17
	// Hand calc: 7347.62 × 0.015 = 110.21430, × 21.17 = 2333.236731 → $2,333.24
	// (The old float64 gave $2,332.96 — $0.28 off due to IEEE 754 imprecision)
	product := a.Mul(0.015)
	product = product.Mul(21.17)
	if got := product.Round().String(); got != "2333.24" {
		t.Errorf("7347.62 × 0.015 × 21.17 = %s, want 2333.24", got)
	}
}

func TestRound_HalfUp(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"1633.074", "1633.07"},
		{"1633.075", "1633.08"}, // half-up rounds up
		{"1633.076", "1633.08"},
		{"2332.955", "2332.96"},
		{"100.005", "100.01"},
		{"0.00", "0.00"},
		{"-1633.075", "-1633.08"}, // negative half-up
	}
	for _, tt := range tests {
		m := New(tt.input)
		if got := m.Round().String(); got != tt.expected {
			t.Errorf("Round(%s) = %s, want %s", tt.input, got, tt.expected)
		}
	}
}

func TestMarshalJSON(t *testing.T) {
	m := New("10639.45")
	data, err := json.Marshal(m)
	if err != nil {
		t.Fatal(err)
	}
	// Should be a quoted string: "10639.45"
	if string(data) != `"10639.45"` {
		t.Errorf("JSON = %s, want %q", string(data), "10639.45")
	}
}

func TestUnmarshalJSON_String(t *testing.T) {
	var m Money
	err := json.Unmarshal([]byte(`"10639.45"`), &m)
	if err != nil {
		t.Fatal(err)
	}
	if got := m.String(); got != "10639.45" {
		t.Errorf("Unmarshal string = %s, want 10639.45", got)
	}
}

func TestUnmarshalJSON_Number(t *testing.T) {
	// Backwards compat: accept bare JSON numbers
	var m Money
	err := json.Unmarshal([]byte(`10639.45`), &m)
	if err != nil {
		t.Fatal(err)
	}
	if got := m.Round().String(); got != "10639.45" {
		t.Errorf("Unmarshal number = %s, want 10639.45", got)
	}
}

func TestBenefitCalculation_Kim(t *testing.T) {
	// Case 2: Jennifer Kim exact calculation chain
	// Hand calc: $7,347.62 × 0.015 = $110.2143
	//            $110.2143 × 21.17 = $2,333.236731
	//            Rounded: $2,333.24
	// Reduced:   $2,333.236731 × 0.70 = $1,633.265712 → $1,633.27
	// NOTE: float64 gave $2,332.96 / $1,633.07 — both were wrong
	ams := FromFloat64(7347.62)
	gross := ams.Mul(0.015).Mul(21.17)

	if got := gross.Round().String(); got != "2333.24" {
		t.Errorf("Kim gross = %s, want 2333.24", got)
	}

	reduced := gross.Mul(0.70)
	if got := reduced.Round().String(); got != "1633.27" {
		t.Errorf("Kim reduced = %s, want 1633.27", got)
	}
}

func TestBenefitCalculation_Martinez(t *testing.T) {
	// Case 1: Robert Martinez
	// AMS: $7,330.72 × 0.020 × 28.75 = gross, no reduction
	ams := FromFloat64(7330.72)
	gross := ams.Mul(0.020).Mul(28.75)

	if got := gross.Round().String(); got != "4215.16" {
		t.Errorf("Martinez gross = %s, want 4215.16", got)
	}
}

func TestDeathBenefit_Installments(t *testing.T) {
	amount := FromInt(5000)
	inst50 := amount.Div(50.0)
	inst100 := amount.Div(100.0)

	if got := inst50.Round().String(); got != "100.00" {
		t.Errorf("5000/50 = %s, want 100.00", got)
	}
	if got := inst100.Round().String(); got != "50.00" {
		t.Errorf("5000/100 = %s, want 50.00", got)
	}
}

func TestIPR(t *testing.T) {
	// Kim: 18.17 earned years × $12.50 = $227.13
	earned := 18.17
	rate := FromFloat64(12.50)
	result := rate.Mul(earned)

	if got := result.Round().String(); got != "227.13" {
		t.Errorf("IPR = %s, want 227.13", got)
	}
}
