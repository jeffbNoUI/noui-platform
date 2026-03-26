package db

import (
	"testing"
)

func TestVersionLabelRegex(t *testing.T) {
	valid := []string{"v1.0", "v2.1", "v10.20", "v0.1"}
	for _, label := range valid {
		if !versionLabelRe.MatchString(label) {
			t.Errorf("expected %q to be valid, but it was rejected", label)
		}
	}

	invalid := []string{"1.0", "v1", "v1.0.0", "va.b", "v 1.0", "V1.0", "", "v1.", "v.1"}
	for _, label := range invalid {
		if versionLabelRe.MatchString(label) {
			t.Errorf("expected %q to be invalid, but it was accepted", label)
		}
	}
}
