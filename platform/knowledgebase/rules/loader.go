package rules

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// LoadRuleFile reads a single YAML file and returns the parsed RuleFile.
func LoadRuleFile(path string) (*RuleFile, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading rule file %s: %w", path, err)
	}

	var rf RuleFile
	if err := yaml.Unmarshal(data, &rf); err != nil {
		return nil, fmt.Errorf("parsing rule file %s: %w", path, err)
	}

	return &rf, nil
}

// LoadRulesFromDir reads all .yaml and .yml files in dir and returns a flat
// slice of all rules found across all files.
func LoadRulesFromDir(dir string) ([]Rule, error) {
	files, err := yamlFilesInDir(dir)
	if err != nil {
		return nil, err
	}

	var all []Rule
	for _, f := range files {
		rf, err := LoadRuleFile(f)
		if err != nil {
			return nil, err
		}
		all = append(all, rf.Rules...)
	}

	return all, nil
}

// LoadRulesByDomain reads all .yaml and .yml files in dir and returns rules
// grouped by domain (from each file's metadata.domain field).
func LoadRulesByDomain(dir string) (map[string][]Rule, error) {
	files, err := yamlFilesInDir(dir)
	if err != nil {
		return nil, err
	}

	result := make(map[string][]Rule)
	for _, f := range files {
		rf, err := LoadRuleFile(f)
		if err != nil {
			return nil, err
		}
		domain := rf.Metadata.Domain
		result[domain] = append(result[domain], rf.Rules...)
	}

	return result, nil
}

// yamlFilesInDir returns all .yaml and .yml file paths in dir (non-recursive).
func yamlFilesInDir(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("reading directory %s: %w", dir, err)
	}

	var files []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ext := strings.ToLower(filepath.Ext(e.Name()))
		if ext == ".yaml" || ext == ".yml" {
			files = append(files, filepath.Join(dir, e.Name()))
		}
	}

	return files, nil
}
