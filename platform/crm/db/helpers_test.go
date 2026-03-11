package db

import (
	"database/sql"
	"testing"
	"time"
)

// ─── nullStringToPtr ─────────────────────────────────────────────────────────

func TestNullStringToPtr_Valid(t *testing.T) {
	ns := sql.NullString{String: "hello", Valid: true}
	got := nullStringToPtr(ns)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid NullString")
	}
	if *got != "hello" {
		t.Errorf("expected %q, got %q", "hello", *got)
	}
}

func TestNullStringToPtr_Invalid(t *testing.T) {
	ns := sql.NullString{String: "garbage", Valid: false}
	got := nullStringToPtr(ns)
	if got != nil {
		t.Errorf("expected nil for invalid NullString, got %q", *got)
	}
}

func TestNullStringToPtr_EmptyValid(t *testing.T) {
	ns := sql.NullString{String: "", Valid: true}
	got := nullStringToPtr(ns)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid empty NullString")
	}
	if *got != "" {
		t.Errorf("expected empty string, got %q", *got)
	}
}

// ─── nullTimeToPtr ───────────────────────────────────────────────────────────

func TestNullTimeToPtr_Valid(t *testing.T) {
	now := time.Date(2025, 6, 15, 10, 30, 0, 0, time.UTC)
	nt := sql.NullTime{Time: now, Valid: true}
	got := nullTimeToPtr(nt)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid NullTime")
	}
	if !got.Equal(now) {
		t.Errorf("expected %v, got %v", now, *got)
	}
}

func TestNullTimeToPtr_Invalid(t *testing.T) {
	nt := sql.NullTime{Time: time.Now(), Valid: false}
	got := nullTimeToPtr(nt)
	if got != nil {
		t.Errorf("expected nil for invalid NullTime, got %v", *got)
	}
}

func TestNullTimeToPtr_ZeroTimeValid(t *testing.T) {
	nt := sql.NullTime{Time: time.Time{}, Valid: true}
	got := nullTimeToPtr(nt)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid zero NullTime")
	}
	if !got.IsZero() {
		t.Errorf("expected zero time, got %v", *got)
	}
}

// ─── nullBoolToPtr ───────────────────────────────────────────────────────────

func TestNullBoolToPtr_ValidTrue(t *testing.T) {
	nb := sql.NullBool{Bool: true, Valid: true}
	got := nullBoolToPtr(nb)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid NullBool")
	}
	if *got != true {
		t.Errorf("expected true, got %v", *got)
	}
}

func TestNullBoolToPtr_ValidFalse(t *testing.T) {
	nb := sql.NullBool{Bool: false, Valid: true}
	got := nullBoolToPtr(nb)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid false NullBool")
	}
	if *got != false {
		t.Errorf("expected false, got %v", *got)
	}
}

func TestNullBoolToPtr_Invalid(t *testing.T) {
	nb := sql.NullBool{Bool: true, Valid: false}
	got := nullBoolToPtr(nb)
	if got != nil {
		t.Errorf("expected nil for invalid NullBool, got %v", *got)
	}
}

// ─── nullInt64ToIntPtr ───────────────────────────────────────────────────────

func TestNullInt64ToIntPtr_Valid(t *testing.T) {
	ni := sql.NullInt64{Int64: 42, Valid: true}
	got := nullInt64ToIntPtr(ni)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid NullInt64")
	}
	if *got != 42 {
		t.Errorf("expected 42, got %d", *got)
	}
}

func TestNullInt64ToIntPtr_ValidZero(t *testing.T) {
	ni := sql.NullInt64{Int64: 0, Valid: true}
	got := nullInt64ToIntPtr(ni)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid zero NullInt64")
	}
	if *got != 0 {
		t.Errorf("expected 0, got %d", *got)
	}
}

func TestNullInt64ToIntPtr_ValidNegative(t *testing.T) {
	ni := sql.NullInt64{Int64: -7, Valid: true}
	got := nullInt64ToIntPtr(ni)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid negative NullInt64")
	}
	if *got != -7 {
		t.Errorf("expected -7, got %d", *got)
	}
}

func TestNullInt64ToIntPtr_Invalid(t *testing.T) {
	ni := sql.NullInt64{Int64: 999, Valid: false}
	got := nullInt64ToIntPtr(ni)
	if got != nil {
		t.Errorf("expected nil for invalid NullInt64, got %d", *got)
	}
}

// ─── nullFloat64ToPtr ────────────────────────────────────────────────────────

func TestNullFloat64ToPtr_Valid(t *testing.T) {
	nf := sql.NullFloat64{Float64: 3.14, Valid: true}
	got := nullFloat64ToPtr(nf)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid NullFloat64")
	}
	if *got != 3.14 {
		t.Errorf("expected 3.14, got %f", *got)
	}
}

func TestNullFloat64ToPtr_ValidZero(t *testing.T) {
	nf := sql.NullFloat64{Float64: 0.0, Valid: true}
	got := nullFloat64ToPtr(nf)
	if got == nil {
		t.Fatal("expected non-nil pointer for valid zero NullFloat64")
	}
	if *got != 0.0 {
		t.Errorf("expected 0.0, got %f", *got)
	}
}

func TestNullFloat64ToPtr_Invalid(t *testing.T) {
	nf := sql.NullFloat64{Float64: 99.9, Valid: false}
	got := nullFloat64ToPtr(nf)
	if got != nil {
		t.Errorf("expected nil for invalid NullFloat64, got %f", *got)
	}
}
