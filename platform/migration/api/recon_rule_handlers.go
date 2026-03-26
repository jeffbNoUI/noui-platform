package api

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/models"
)

// CreateReconRuleSet handles POST /api/v1/migration/engagements/{id}/recon-rules.
// Creates a new reconciliation rule set in DRAFT status.
func (h *Handler) CreateReconRuleSet(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var req models.CreateReconRuleSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	req.Label = strings.TrimSpace(req.Label)

	// Validate rules array non-empty.
	if len(req.Rules) == 0 {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "rules array must not be empty")
		return
	}

	// Validate each rule and generate rule_ids; check for duplicates.
	ruleIDs := make(map[string]bool, len(req.Rules))
	rules := make([]models.ReconRule, 0, len(req.Rules))
	for i, rr := range req.Rules {
		if rr.Tier < 1 || rr.Tier > 3 {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("rules[%d].tier must be 1, 2, or 3", i))
			return
		}
		if strings.TrimSpace(rr.CalcName) == "" {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("rules[%d].calc_name is required", i))
			return
		}
		if !models.ValidComparisonTypes[rr.ComparisonType] {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("rules[%d].comparison_type is invalid", i))
			return
		}
		if !models.ValidPriorities[rr.PriorityIfMismatch] {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("rules[%d].priority_if_mismatch is invalid", i))
			return
		}

		ruleID := fmt.Sprintf("%d_%s", rr.Tier, strings.TrimSpace(rr.CalcName))
		if ruleIDs[ruleID] {
			apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "DUPLICATE_RULE_ID",
				fmt.Sprintf("duplicate rule_id %q (tier %d + calc_name %q)", ruleID, rr.Tier, rr.CalcName))
			return
		}
		ruleIDs[ruleID] = true

		rules = append(rules, models.ReconRule{
			RuleID:             ruleID,
			Tier:               rr.Tier,
			CalcName:           strings.TrimSpace(rr.CalcName),
			ComparisonType:     rr.ComparisonType,
			ToleranceValue:     rr.ToleranceValue,
			PriorityIfMismatch: rr.PriorityIfMismatch,
			Enabled:            rr.Enabled,
		})
	}

	createdBy := tenantID(r) // In production, would be user ID from JWT
	result, err := migrationdb.CreateReconRuleSet(h.DB, engagementID, req.Label, createdBy, rules)
	if err != nil {
		slog.Error("failed to create recon rule set", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to create recon rule set")
		return
	}

	slog.Info("recon rule set created", "ruleset_id", result.RulesetID, "engagement_id", engagementID, "version", result.Version)

	// Audit log.
	if h.Audit != nil {
		afterJSON, _ := json.Marshal(result)
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engagementID,
			Actor:        createdBy,
			Action:       "create",
			EntityType:   "recon_rule_set",
			EntityID:     result.RulesetID,
			AfterState:   afterJSON,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusCreated, "migration", result)
}

// ActivateReconRuleSet handles POST /api/v1/migration/engagements/{id}/recon-rules/{rulesetId}/activate.
// Transitions DRAFT → ACTIVE. Supersedes any currently ACTIVE ruleset.
func (h *Handler) ActivateReconRuleSet(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	rulesetID := r.PathValue("rulesetId")
	if engagementID == "" || rulesetID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and ruleset id are required")
		return
	}

	result, err := migrationdb.ActivateReconRuleSet(h.DB, engagementID, rulesetID)
	if err != nil {
		if strings.Contains(err.Error(), "not DRAFT") {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "STATUS_CONFLICT", err.Error())
			return
		}
		slog.Error("failed to activate recon rule set", "error", err, "ruleset_id", rulesetID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to activate recon rule set")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", rulesetID))
		return
	}

	slog.Info("recon rule set activated", "ruleset_id", rulesetID, "engagement_id", engagementID, "version", result.Version)

	// Insert gate_transition record.
	tier1, tier2, tier3 := 0, 0, 0
	for _, rule := range result.Rules {
		switch rule.Tier {
		case 1:
			tier1++
		case 2:
			tier2++
		case 3:
			tier3++
		}
	}
	gateMetrics := map[string]float64{
		"ruleset_version": float64(result.Version),
		"rule_count":      float64(len(result.Rules)),
		"tier1_rules":     float64(tier1),
		"tier2_rules":     float64(tier2),
		"tier3_rules":     float64(tier3),
	}
	_, gtErr := migrationdb.CreateGateTransition(h.DB, models.PhaseGateTransition{
		EngagementID:     engagementID,
		FromPhase:        "RECON_RULES_DRAFT",
		ToPhase:          "RECON_RULES_ACTIVE",
		Direction:        "ADVANCE",
		GateMetrics:      gateMetrics,
		AIRecommendation: "",
		Overrides:        []string{},
		AuthorizedBy:     tenantID(r),
	})
	if gtErr != nil {
		slog.Error("failed to create gate transition for recon rule activation", "error", gtErr, "ruleset_id", rulesetID)
	}

	// Audit log.
	if h.Audit != nil {
		afterJSON, _ := json.Marshal(result)
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engagementID,
			Actor:        tenantID(r),
			Action:       "activate",
			EntityType:   "recon_rule_set",
			EntityID:     result.RulesetID,
			AfterState:   afterJSON,
		})
	}

	// WebSocket broadcast.
	h.broadcast(engagementID, "recon_rules_activated", map[string]interface{}{
		"ruleset_id": result.RulesetID,
		"version":    result.Version,
	})

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// ListReconRuleSets handles GET /api/v1/migration/engagements/{id}/recon-rules.
// Supports ?status= filter. Returns all rulesets, newest first.
func (h *Handler) ListReconRuleSets(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	var statusFilter *string
	if s := r.URL.Query().Get("status"); s != "" {
		if !models.ValidReconRuleSetStatuses[models.ReconRuleSetStatus(s)] {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
				fmt.Sprintf("invalid status filter %q", s))
			return
		}
		statusFilter = &s
	}

	results, err := migrationdb.ListReconRuleSets(h.DB, engagementID, statusFilter)
	if err != nil {
		slog.Error("failed to list recon rule sets", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to list recon rule sets")
		return
	}
	if results == nil {
		results = []models.ReconRuleSet{}
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", results)
}

// GetActiveReconRuleSet handles GET /api/v1/migration/engagements/{id}/recon-rules/active.
func (h *Handler) GetActiveReconRuleSet(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	result, err := migrationdb.GetActiveReconRuleSet(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get active recon rule set", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get active recon rule set")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", "no active ruleset found")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// GetReconRuleSet handles GET /api/v1/migration/engagements/{id}/recon-rules/{rulesetId}.
func (h *Handler) GetReconRuleSet(w http.ResponseWriter, r *http.Request) {
	rulesetID := r.PathValue("rulesetId")
	if rulesetID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "ruleset id is required")
		return
	}

	result, err := migrationdb.GetReconRuleSet(h.DB, rulesetID)
	if err != nil {
		slog.Error("failed to get recon rule set", "error", err, "ruleset_id", rulesetID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get recon rule set")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", rulesetID))
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// UpdateReconRuleSet handles PATCH /api/v1/migration/engagements/{id}/recon-rules/{rulesetId}.
// Only DRAFT rulesets can be updated — returns 409 otherwise.
func (h *Handler) UpdateReconRuleSet(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	rulesetID := r.PathValue("rulesetId")
	if engagementID == "" || rulesetID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and ruleset id are required")
		return
	}

	var req models.UpdateReconRuleSetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "INVALID_BODY", "invalid JSON body")
		return
	}

	// If rules are provided, validate and generate rule_ids.
	var parsedRules *[]models.ReconRule
	if req.Rules != nil {
		if len(*req.Rules) == 0 {
			apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "rules array must not be empty")
			return
		}
		ruleIDs := make(map[string]bool, len(*req.Rules))
		rules := make([]models.ReconRule, 0, len(*req.Rules))
		for i, rr := range *req.Rules {
			if rr.Tier < 1 || rr.Tier > 3 {
				apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
					fmt.Sprintf("rules[%d].tier must be 1, 2, or 3", i))
				return
			}
			if strings.TrimSpace(rr.CalcName) == "" {
				apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
					fmt.Sprintf("rules[%d].calc_name is required", i))
				return
			}
			if !models.ValidComparisonTypes[rr.ComparisonType] {
				apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
					fmt.Sprintf("rules[%d].comparison_type is invalid", i))
				return
			}
			if !models.ValidPriorities[rr.PriorityIfMismatch] {
				apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR",
					fmt.Sprintf("rules[%d].priority_if_mismatch is invalid", i))
				return
			}
			ruleID := fmt.Sprintf("%d_%s", rr.Tier, strings.TrimSpace(rr.CalcName))
			if ruleIDs[ruleID] {
				apiresponse.WriteError(w, http.StatusUnprocessableEntity, "migration", "DUPLICATE_RULE_ID",
					fmt.Sprintf("duplicate rule_id %q", ruleID))
				return
			}
			ruleIDs[ruleID] = true
			rules = append(rules, models.ReconRule{
				RuleID:             ruleID,
				Tier:               rr.Tier,
				CalcName:           strings.TrimSpace(rr.CalcName),
				ComparisonType:     rr.ComparisonType,
				ToleranceValue:     rr.ToleranceValue,
				PriorityIfMismatch: rr.PriorityIfMismatch,
				Enabled:            rr.Enabled,
			})
		}
		parsedRules = &rules
	}

	result, err := migrationdb.UpdateReconRuleSet(h.DB, rulesetID, req.Label, parsedRules)
	if err != nil {
		if strings.Contains(err.Error(), "not DRAFT") {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "STATUS_CONFLICT", err.Error())
			return
		}
		slog.Error("failed to update recon rule set", "error", err, "ruleset_id", rulesetID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to update recon rule set")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", rulesetID))
		return
	}

	// Audit log.
	if h.Audit != nil {
		afterJSON, _ := json.Marshal(result)
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engagementID,
			Actor:        tenantID(r),
			Action:       "update",
			EntityType:   "recon_rule_set",
			EntityID:     result.RulesetID,
			AfterState:   afterJSON,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// ArchiveReconRuleSet handles POST /api/v1/migration/engagements/{id}/recon-rules/{rulesetId}/archive.
// Transitions SUPERSEDED → ARCHIVED.
func (h *Handler) ArchiveReconRuleSet(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	rulesetID := r.PathValue("rulesetId")
	if engagementID == "" || rulesetID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id and ruleset id are required")
		return
	}

	result, err := migrationdb.ArchiveReconRuleSet(h.DB, rulesetID)
	if err != nil {
		if strings.Contains(err.Error(), "not SUPERSEDED") {
			apiresponse.WriteError(w, http.StatusConflict, "migration", "STATUS_CONFLICT", err.Error())
			return
		}
		slog.Error("failed to archive recon rule set", "error", err, "ruleset_id", rulesetID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to archive recon rule set")
		return
	}
	if result == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", rulesetID))
		return
	}

	// Audit log.
	if h.Audit != nil {
		afterJSON, _ := json.Marshal(result)
		h.Audit.Log(r.Context(), models.AuditEntry{
			EngagementID: engagementID,
			Actor:        tenantID(r),
			Action:       "archive",
			EntityType:   "recon_rule_set",
			EntityID:     result.RulesetID,
			AfterState:   afterJSON,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", result)
}

// DiffReconRuleSets handles GET /api/v1/migration/engagements/{id}/recon-rules/{rulesetId}/diff?compare_to={otherRulesetId}.
// Returns a structured diff of two rule sets.
func (h *Handler) DiffReconRuleSets(w http.ResponseWriter, r *http.Request) {
	rulesetID := r.PathValue("rulesetId")
	compareTo := r.URL.Query().Get("compare_to")

	if rulesetID == "" || compareTo == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "rulesetId and compare_to query parameter are required")
		return
	}

	if rulesetID == compareTo {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "cannot diff a ruleset with itself")
		return
	}

	from, err := migrationdb.GetReconRuleSet(h.DB, rulesetID)
	if err != nil {
		slog.Error("diff: failed to get from ruleset", "error", err, "ruleset_id", rulesetID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get ruleset")
		return
	}
	if from == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", rulesetID))
		return
	}

	to, err := migrationdb.GetReconRuleSet(h.DB, compareTo)
	if err != nil {
		slog.Error("diff: failed to get to ruleset", "error", err, "ruleset_id", compareTo)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "INTERNAL_ERROR", "failed to get comparison ruleset")
		return
	}
	if to == nil {
		apiresponse.WriteError(w, http.StatusNotFound, "migration", "NOT_FOUND", fmt.Sprintf("ruleset %s not found", compareTo))
		return
	}

	diff := computeReconRuleDiff(from, to)
	apiresponse.WriteSuccess(w, http.StatusOK, "migration", diff)
}

// computeReconRuleDiff computes the structural difference between two rule sets.
func computeReconRuleDiff(from, to *models.ReconRuleSet) models.ReconRuleDiff {
	diff := models.ReconRuleDiff{
		FromRulesetID: from.RulesetID,
		FromVersion:   from.Version,
		ToRulesetID:   to.RulesetID,
		ToVersion:     to.Version,
		Added:         []models.ReconRule{},
		Removed:       []models.ReconRule{},
		Modified:      []models.ReconRuleChange{},
	}

	fromMap := make(map[string]models.ReconRule, len(from.Rules))
	for _, rule := range from.Rules {
		fromMap[rule.RuleID] = rule
	}
	toMap := make(map[string]models.ReconRule, len(to.Rules))
	for _, rule := range to.Rules {
		toMap[rule.RuleID] = rule
	}

	// Added: in to but not from.
	for id, rule := range toMap {
		if _, exists := fromMap[id]; !exists {
			diff.Added = append(diff.Added, rule)
		}
	}

	// Removed: in from but not to.
	for id, rule := range fromMap {
		if _, exists := toMap[id]; !exists {
			diff.Removed = append(diff.Removed, rule)
		}
	}

	// Modified: in both but different.
	for id, fromRule := range fromMap {
		if toRule, exists := toMap[id]; exists {
			if fromRule.ComparisonType != toRule.ComparisonType ||
				fromRule.ToleranceValue != toRule.ToleranceValue ||
				fromRule.PriorityIfMismatch != toRule.PriorityIfMismatch ||
				fromRule.Enabled != toRule.Enabled {
				diff.Modified = append(diff.Modified, models.ReconRuleChange{
					RuleID: id,
					From:   fromRule,
					To:     toRule,
				})
			}
		}
	}

	return diff
}
