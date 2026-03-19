package domain

import (
	"testing"
	"time"
)

func TestCalculatePERAChoiceWindow(t *testing.T) {
	tests := []struct {
		name         string
		hireDate     string
		planCode     string
		wantEligible bool
		wantCloses   string
		wantErr      bool
	}{
		{
			name:         "DB member — eligible, 60-day window",
			hireDate:     "2024-01-15",
			planCode:     "DB",
			wantEligible: true,
			wantCloses:   "2024-03-15",
		},
		{
			name:         "DC member — not eligible",
			hireDate:     "2024-01-15",
			planCode:     "DC",
			wantEligible: false,
		},
		{
			name:         "ORP member — not eligible",
			hireDate:     "2024-01-15",
			planCode:     "ORP",
			wantEligible: false,
		},
		{
			name:         "leap year — Feb hire, window spans across",
			hireDate:     "2024-02-01",
			planCode:     "DB",
			wantEligible: true,
			wantCloses:   "2024-04-01",
		},
		{
			name:         "year boundary — Nov hire, window into next year",
			hireDate:     "2024-11-15",
			planCode:     "DB",
			wantEligible: true,
			wantCloses:   "2025-01-14",
		},
		{
			name:     "invalid date",
			hireDate: "bad-date",
			planCode: "DB",
			wantErr:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			window, err := CalculatePERAChoiceWindow(tc.hireDate, tc.planCode)
			if tc.wantErr {
				if err == nil {
					t.Error("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if window.IsEligible != tc.wantEligible {
				t.Errorf("eligible: got %v, want %v", window.IsEligible, tc.wantEligible)
			}
			if tc.wantEligible && window.WindowCloses != tc.wantCloses {
				t.Errorf("window closes: got %q, want %q", window.WindowCloses, tc.wantCloses)
			}
			if window.WindowOpens != tc.hireDate {
				t.Errorf("window opens: got %q, want %q", window.WindowOpens, tc.hireDate)
			}
		})
	}
}

func TestIsWindowExpired(t *testing.T) {
	tests := []struct {
		name         string
		windowCloses string
		now          time.Time
		wantExpired  bool
	}{
		{
			name:         "before close date — not expired",
			windowCloses: "2024-03-15",
			now:          time.Date(2024, 3, 14, 12, 0, 0, 0, time.UTC),
			wantExpired:  false,
		},
		{
			name:         "on close date — not expired (expires end of day)",
			windowCloses: "2024-03-15",
			now:          time.Date(2024, 3, 15, 12, 0, 0, 0, time.UTC),
			wantExpired:  false,
		},
		{
			name:         "day after close — expired",
			windowCloses: "2024-03-15",
			now:          time.Date(2024, 3, 16, 0, 0, 0, 0, time.UTC),
			wantExpired:  true,
		},
		{
			name:         "well after close — expired",
			windowCloses: "2024-03-15",
			now:          time.Date(2024, 6, 1, 0, 0, 0, 0, time.UTC),
			wantExpired:  true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			expired, err := IsWindowExpired(tc.windowCloses, tc.now)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if expired != tc.wantExpired {
				t.Errorf("got expired=%v, want %v", expired, tc.wantExpired)
			}
		})
	}
}

func TestShouldSendReminder(t *testing.T) {
	tests := []struct {
		name       string
		closes     string
		now        time.Time
		daysBefore int
		wantSend   bool
	}{
		{
			name:       "too early for reminder",
			closes:     "2024-03-15",
			now:        time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC),
			daysBefore: 7,
			wantSend:   false,
		},
		{
			name:       "exactly 7 days before — send",
			closes:     "2024-03-15",
			now:        time.Date(2024, 3, 8, 0, 0, 0, 0, time.UTC),
			daysBefore: 7,
			wantSend:   true,
		},
		{
			name:       "after reminder date — send",
			closes:     "2024-03-15",
			now:        time.Date(2024, 3, 10, 0, 0, 0, 0, time.UTC),
			daysBefore: 7,
			wantSend:   true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			should, err := ShouldSendReminder(tc.closes, tc.now, tc.daysBefore)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if should != tc.wantSend {
				t.Errorf("got should=%v, want %v", should, tc.wantSend)
			}
		})
	}
}
