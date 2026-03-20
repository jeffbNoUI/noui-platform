package api

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/knowledgebase/rules"
)

// RulesHandler serves file-backed rule definitions, test reports, and demo
// cases through the standard API response envelope. Data is cached in memory
// and refreshed on a configurable TTL.
type RulesHandler struct {
	rulesDir    string
	casesDir    string
	reportPath  string
	mappingPath string
	cacheTTL    time.Duration

	mu          sync.RWMutex
	rulesCache  []rules.Rule
	domainCache map[string][]rules.Rule
	reportCache *rules.TestReport
	casesCache  []rules.DemoCase
	cacheTime   time.Time
}

// NewRulesHandler creates a RulesHandler that loads rules from rulesDir,
// demo cases from casesDir, and test reports from reportPath + mappingPath.
func NewRulesHandler(rulesDir, casesDir, reportPath, mappingPath string, cacheTTL time.Duration) *RulesHandler {
	return &RulesHandler{
		rulesDir:    rulesDir,
		casesDir:    casesDir,
		reportPath:  reportPath,
		mappingPath: mappingPath,
		cacheTTL:    cacheTTL,
	}
}

// RegisterRoutes registers rule definition, test report, and demo case routes.
func (h *RulesHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/v1/kb/rules/definitions", h.ListRuleDefinitions)
	mux.HandleFunc("GET /api/v1/kb/rules/definitions/{ruleId}", h.GetRuleDefinition)
	mux.HandleFunc("GET /api/v1/kb/test-report", h.GetTestReport)
	mux.HandleFunc("GET /api/v1/kb/test-report/{ruleId}", h.GetTestReportForRule)
	mux.HandleFunc("GET /api/v1/kb/demo-cases", h.ListDemoCases)
	mux.HandleFunc("GET /api/v1/kb/demo-cases/{caseId}", h.GetDemoCase)
}

// refresh reloads cached data if the TTL has expired. Uses double-checked
// locking: acquires RLock first to check, upgrades to write lock only when
// a refresh is actually needed.
func (h *RulesHandler) refresh() error {
	h.mu.RLock()
	if time.Since(h.cacheTime) < h.cacheTTL {
		h.mu.RUnlock()
		return nil
	}
	h.mu.RUnlock()

	h.mu.Lock()
	defer h.mu.Unlock()

	// Double-check after acquiring write lock.
	if time.Since(h.cacheTime) < h.cacheTTL {
		return nil
	}

	// Load rules.
	allRules, err := rules.LoadRulesFromDir(h.rulesDir)
	if err != nil {
		slog.Error("failed to load rules", "dir", h.rulesDir, "error", err)
		return err
	}

	domainRules, err := rules.LoadRulesByDomain(h.rulesDir)
	if err != nil {
		slog.Error("failed to load rules by domain", "dir", h.rulesDir, "error", err)
		return err
	}

	// Load test report.
	report, err := rules.LoadTestReport(h.reportPath, h.mappingPath)
	if err != nil {
		slog.Error("failed to load test report", "path", h.reportPath, "error", err)
		return err
	}

	// Load demo cases.
	cases, err := rules.LoadDemoCases(h.casesDir)
	if err != nil {
		slog.Error("failed to load demo cases", "dir", h.casesDir, "error", err)
		return err
	}

	// Enrich rules with test status from report.
	for i := range allRules {
		if summary, ok := report.ByRule[allRules[i].ID]; ok {
			lastRun := report.LastRun
			allRules[i].TestStatus = &rules.TestStatus{
				Total:   summary.Total,
				Passing: summary.Passing,
				Failing: summary.Failing,
				Skipped: summary.Skipped,
				LastRun: &lastRun,
			}
		}
	}

	// Enrich domain-grouped rules too.
	for domain := range domainRules {
		slice := domainRules[domain]
		for i := range slice {
			if summary, ok := report.ByRule[slice[i].ID]; ok {
				lastRun := report.LastRun
				slice[i].TestStatus = &rules.TestStatus{
					Total:   summary.Total,
					Passing: summary.Passing,
					Failing: summary.Failing,
					Skipped: summary.Skipped,
					LastRun: &lastRun,
				}
			}
		}
	}

	h.rulesCache = allRules
	h.domainCache = domainRules
	h.reportCache = report
	h.casesCache = cases
	h.cacheTime = time.Now()

	slog.Info("rules cache refreshed",
		"rules", len(allRules),
		"domains", len(domainRules),
		"tests", report.Total,
		"demoCases", len(cases),
	)

	return nil
}

// ListRuleDefinitions returns all rule definitions, optionally filtered by
// ?domain= query parameter.
func (h *RulesHandler) ListRuleDefinitions(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load rule definitions")
		return
	}

	domain := r.URL.Query().Get("domain")

	h.mu.RLock()
	defer h.mu.RUnlock()

	var result []rules.Rule
	if domain != "" {
		result = h.domainCache[domain]
		if result == nil {
			result = []rules.Rule{}
		}
	} else {
		result = h.rulesCache
		if result == nil {
			result = []rules.Rule{}
		}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", result)
}

// GetRuleDefinition returns a single rule definition by ID.
func (h *RulesHandler) GetRuleDefinition(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load rule definitions")
		return
	}

	ruleID := r.PathValue("ruleId")

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, rule := range h.rulesCache {
		if rule.ID == ruleID {
			apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", rule)
			return
		}
	}

	apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "Rule definition not found: "+ruleID)
}

// GetTestReport returns the full test report.
func (h *RulesHandler) GetTestReport(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load test report")
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", h.reportCache)
}

// GetTestReportForRule returns the test report summary for a specific rule ID.
func (h *RulesHandler) GetTestReportForRule(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load test report")
		return
	}

	ruleID := r.PathValue("ruleId")

	h.mu.RLock()
	defer h.mu.RUnlock()

	summary, ok := h.reportCache.ByRule[ruleID]
	if !ok {
		apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "No test results for rule: "+ruleID)
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", summary)
}

// ListDemoCases returns all demo cases.
func (h *RulesHandler) ListDemoCases(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load demo cases")
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	result := h.casesCache
	if result == nil {
		result = []rules.DemoCase{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", result)
}

// GetDemoCase returns a single demo case by case ID.
func (h *RulesHandler) GetDemoCase(w http.ResponseWriter, r *http.Request) {
	if err := h.refresh(); err != nil {
		apiresponse.WriteError(w, http.StatusInternalServerError, "knowledgebase", "LOAD_ERROR", "Failed to load demo cases")
		return
	}

	caseID := r.PathValue("caseId")

	h.mu.RLock()
	defer h.mu.RUnlock()

	for _, dc := range h.casesCache {
		if dc.CaseID == caseID {
			apiresponse.WriteSuccess(w, http.StatusOK, "knowledgebase", dc)
			return
		}
	}

	apiresponse.WriteError(w, http.StatusNotFound, "knowledgebase", "NOT_FOUND", "Demo case not found: "+caseID)
}
