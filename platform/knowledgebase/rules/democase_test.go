package rules

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadDemoCases_RealFixtures(t *testing.T) {
	// Use the actual demo-cases directory.
	demoCasesDir := filepath.Join("..", "..", "..", "domains", "pension", "demo-cases")

	// Verify the directory exists before testing.
	if _, err := os.Stat(demoCasesDir); os.IsNotExist(err) {
		t.Skipf("Demo cases directory not found at %s", demoCasesDir)
	}

	cases, err := LoadDemoCases(demoCasesDir)
	if err != nil {
		t.Fatalf("LoadDemoCases returned error: %v", err)
	}

	if len(cases) < 1 {
		t.Fatal("Expected at least 1 demo case, got 0")
	}

	for _, dc := range cases {
		t.Run(dc.CaseID, func(t *testing.T) {
			if dc.CaseID == "" {
				t.Error("CaseID should not be empty")
			}
			if dc.Description == "" {
				t.Error("Description should not be empty")
			}
			if dc.Member.FirstName == "" {
				t.Error("Member.FirstName should not be empty")
			}
			if dc.Member.LastName == "" {
				t.Error("Member.LastName should not be empty")
			}
			if dc.Member.MemberID == nil {
				t.Error("Member.MemberID should not be nil")
			}
			if dc.Member.Tier == nil {
				t.Error("Member.Tier should not be nil")
			}
			if dc.RetDate == "" {
				t.Error("RetDate should not be empty")
			}
			if len(dc.TestPoints) == 0 {
				t.Error("TestPoints should not be empty")
			}
			if dc.Full == nil {
				t.Error("Full raw JSON should not be nil")
			}
			if len(dc.Expected) == 0 {
				t.Error("Expected should not be empty")
			}
			if len(dc.Inputs) == 0 {
				t.Error("Inputs should not be empty")
			}
		})
	}

	// Verify we loaded all 4 cases.
	if len(cases) != 4 {
		t.Errorf("Expected 4 demo cases, got %d", len(cases))
	}
}

func TestLoadDemoCases_EmptyDir(t *testing.T) {
	tmpDir := t.TempDir()
	cases, err := LoadDemoCases(tmpDir)
	if err != nil {
		t.Fatalf("LoadDemoCases returned error: %v", err)
	}
	if len(cases) != 0 {
		t.Errorf("Expected 0 cases from empty dir, got %d", len(cases))
	}
}

func TestLoadDemoCases_NonexistentDir(t *testing.T) {
	cases, err := LoadDemoCases("/nonexistent/path/demo-cases")
	if err != nil {
		t.Fatalf("Expected no error for missing dir, got: %v", err)
	}
	if cases != nil {
		t.Errorf("Expected nil for missing dir, got %d cases", len(cases))
	}
}
