package rules

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// DemoCase represents a pension demo/acceptance test case.
type DemoCase struct {
	CaseID      string                 `json:"caseId"`
	Description string                 `json:"description"`
	Member      DemoCaseMember         `json:"member"`
	RetDate     string                 `json:"retDate"`
	Inputs      map[string]interface{} `json:"inputs"`
	Expected    map[string]interface{} `json:"expected"`
	TestPoints  []string               `json:"testPoints"`
	Full        map[string]interface{} `json:"full"`
}

// DemoCaseMember represents the member section of a demo case.
type DemoCaseMember struct {
	MemberID  interface{} `json:"memberId"`
	FirstName string      `json:"firstName"`
	LastName  string      `json:"lastName"`
	DOB       string      `json:"dob"`
	HireDate  string      `json:"hireDate"`
	Tier      interface{} `json:"tier"`
}

// LoadDemoCases reads all .json files from dir, parsing each into a DemoCase.
// If dir does not exist, returns nil (not an error).
func LoadDemoCases(dir string) ([]DemoCase, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var cases []DemoCase
	for _, entry := range entries {
		if entry.IsDir() {
			// Demo cases are in subdirectories, each containing test-fixture.json.
			fixturePath := filepath.Join(dir, entry.Name(), "test-fixture.json")
			dc, err := loadDemoCaseFile(fixturePath)
			if err != nil {
				continue // skip directories without a valid fixture
			}
			cases = append(cases, *dc)
			continue
		}
		// Also support flat .json files.
		if strings.HasSuffix(entry.Name(), ".json") {
			dc, err := loadDemoCaseFile(filepath.Join(dir, entry.Name()))
			if err != nil {
				continue
			}
			cases = append(cases, *dc)
		}
	}

	return cases, nil
}

func loadDemoCaseFile(path string) (*DemoCase, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Parse full raw JSON first.
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	dc := &DemoCase{
		Full: raw,
	}

	// Extract top-level fields from raw map (snake_case keys).
	if v, ok := raw["case_id"].(string); ok {
		dc.CaseID = v
	}
	if v, ok := raw["description"].(string); ok {
		dc.Description = v
	}
	if v, ok := raw["retirement_date"].(string); ok {
		dc.RetDate = v
	}

	// Parse member.
	if memberRaw, ok := raw["member"].(map[string]interface{}); ok {
		dc.Member = DemoCaseMember{
			MemberID:  memberRaw["member_id"],
			FirstName: strVal(memberRaw, "first_name"),
			LastName:  strVal(memberRaw, "last_name"),
			DOB:       strVal(memberRaw, "dob"),
			HireDate:  strVal(memberRaw, "hire_date"),
			Tier:      memberRaw["tier"],
		}
	}

	// Inputs — raw map.
	if v, ok := raw["inputs"].(map[string]interface{}); ok {
		dc.Inputs = v
	}

	// Expected — merge all expected_* sections into one map.
	dc.Expected = make(map[string]interface{})
	for key, val := range raw {
		if strings.HasPrefix(key, "expected_") {
			section := strings.TrimPrefix(key, "expected_")
			dc.Expected[section] = val
		}
	}

	// Test points.
	if tpRaw, ok := raw["test_points"].([]interface{}); ok {
		for _, tp := range tpRaw {
			if s, ok := tp.(string); ok {
				dc.TestPoints = append(dc.TestPoints, s)
			}
		}
	}

	return dc, nil
}

func strVal(m map[string]interface{}, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}
