package api

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/noui/platform/apiresponse"
	migrationdb "github.com/noui/platform/migration/db"
	"github.com/noui/platform/migration/intelligence"
	"github.com/noui/platform/migration/models"
	"github.com/noui/platform/migration/reconciler"
)

// tierToInt maps reconciliation tier constants to the integer values stored in
// the migration.reconciliation table.
func tierToInt(t reconciler.ReconciliationTier) int {
	switch t {
	case reconciler.Tier1StoredCalc:
		return 1
	case reconciler.Tier2PaymentHist:
		return 2
	case reconciler.Tier3Aggregate:
		return 3
	default:
		return 0
	}
}

// ReconcileBatch handles POST /api/v1/migration/batches/{id}/reconcile.
// It runs all three reconciliation tiers, persists results to the
// migration.reconciliation table, and returns the GateResult.
func (h *Handler) ReconcileBatch(w http.ResponseWriter, r *http.Request) {
	batchID := r.PathValue("id")
	if batchID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "batch id is required")
		return
	}

	// Run Tier 1: stored calculation reconciliation.
	tier1Results, err := reconciler.ReconcileTier1(h.DB, batchID, h.PlanConfig)
	if err != nil {
		slog.Error("tier1 reconciliation failed", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RECONCILE_ERROR", "tier 1 reconciliation failed")
		return
	}

	// Run Tier 2: payment history reconciliation.
	tier2Results, err := reconciler.ReconcileTier2(h.DB, batchID)
	if err != nil {
		slog.Error("tier2 reconciliation failed", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RECONCILE_ERROR", "tier 2 reconciliation failed")
		return
	}

	// Run Tier 3: aggregate benchmarks computed from canonical data.
	benchmarks := computeBenchmarks(h.DB, batchID)
	tier3Results, err := reconciler.ReconcileTier3(h.DB, batchID, benchmarks)
	if err != nil {
		slog.Error("tier3 reconciliation failed", "error", err, "batch_id", batchID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "RECONCILE_ERROR", "tier 3 reconciliation failed")
		return
	}

	// Combine all results and compute the gate.
	var allResults []reconciler.ReconciliationResult
	allResults = append(allResults, tier1Results...)
	allResults = append(allResults, tier2Results...)
	allResults = append(allResults, tier3Results...)

	gate := reconciler.ComputeGate(allResults)

	// Persist results — clear any prior run for this batch, then insert.
	if err := persistReconciliationResults(h.DB, batchID, allResults); err != nil {
		slog.Error("failed to persist reconciliation results", "error", err, "batch_id", batchID)
		// Non-fatal: return the gate result even if persistence fails.
	}

	// Call intelligence service for pattern detection (non-fatal).
	// Extract tenant ID before goroutine launch (request context won't be available later).
	if h.Analyzer != nil {
		tenantID := r.Header.Get("X-Tenant-ID") // fallback; prefer auth context when available
		go h.analyzePatterns(batchID, tenantID, allResults)
	}

	slog.Info("reconciliation completed",
		"batch_id", batchID,
		"weighted_score", gate.WeightedScore,
		"gate_passed", gate.GatePassed,
		"total_members", gate.TotalMembers,
		"tier1_count", len(tier1Results),
		"tier2_count", len(tier2Results),
		"tier3_count", len(tier3Results),
		"p1_unresolved", gate.P1Unresolved,
	)

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", gate)
}

// persistReconciliationResults writes reconciliation results to the
// migration.reconciliation table within a transaction.
func persistReconciliationResults(db *sql.DB, batchID string, results []reconciler.ReconciliationResult) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	// Clear prior results for this batch.
	if _, err := tx.Exec(`DELETE FROM migration.reconciliation WHERE batch_id = $1`, batchID); err != nil {
		return fmt.Errorf("clear prior results: %w", err)
	}

	// Assign priorities for persistence.
	prioritized := make(map[string]reconciler.Priority)
	for _, pr := range reconciler.PrioritizeResults(results) {
		prioritized[pr.MemberID+string(pr.Tier)] = pr.Priority
	}

	const insertSQL = `INSERT INTO migration.reconciliation
		(batch_id, member_id, tier, category, priority, calc_name,
		 legacy_value, recomputed_value, canonical_value, variance_amount,
		 suspected_domain, details)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`

	for _, r := range results {
		priority := prioritized[r.MemberID+string(r.Tier)]
		var priorityStr *string
		if priority != "" {
			s := string(priority)
			priorityStr = &s
		}

		// calc_name: use tier + suspected_domain for identification
		calcName := string(r.Tier)
		if r.SuspectedDomain != "" {
			calcName = calcName + ":" + r.SuspectedDomain
		}

		if _, err := tx.Exec(insertSQL,
			batchID,
			r.MemberID,
			tierToInt(r.Tier),
			string(r.Category),
			priorityStr,
			calcName,
			nullableStr(r.SourceValue),
			nullableStr(r.RecomputedValue),
			nullableStr(r.CanonicalValue),
			nullableStr(r.VarianceAmount),
			nullableStr(r.SuspectedDomain),
			nullableStr(r.Details),
		); err != nil {
			return fmt.Errorf("insert result for member %s: %w", r.MemberID, err)
		}
	}

	return tx.Commit()
}

// nullableStr returns nil for empty strings, pointer otherwise.
func nullableStr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

// GetReconciliation handles GET /api/v1/migration/engagements/{id}/reconciliation.
// Returns stored reconciliation results for the engagement.
func (h *Handler) GetReconciliation(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	records, err := getReconciliationRecords(h.DB, engagementID)
	if err != nil {
		slog.Error("failed to get reconciliation records", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get reconciliation records")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"records":       records,
		"count":         len(records),
	})
}

// getReconciliationRecords queries stored reconciliation results for an engagement.
func getReconciliationRecords(db *sql.DB, engagementID string) ([]map[string]any, error) {
	rows, err := db.Query(
		`SELECT r.recon_id, r.batch_id, r.member_id, r.tier, r.category, r.priority,
		        r.legacy_value, r.recomputed_value, r.variance_amount, r.suspected_domain, r.details
		 FROM migration.reconciliation r
		 JOIN migration.batch b ON b.batch_id = r.batch_id
		 WHERE b.engagement_id = $1
		 ORDER BY r.priority ASC NULLS LAST, r.category, r.member_id`,
		engagementID,
	)
	if err != nil {
		return nil, fmt.Errorf("query reconciliation: %w", err)
	}
	defer rows.Close()

	var records []map[string]any
	for rows.Next() {
		var reconID, batchID, memberID, category string
		var tier int
		var priority, legacyVal, recomputedVal, varianceAmt, domain, details *string
		if err := rows.Scan(&reconID, &batchID, &memberID, &tier, &category, &priority,
			&legacyVal, &recomputedVal, &varianceAmt, &domain, &details); err != nil {
			return nil, fmt.Errorf("scan reconciliation record: %w", err)
		}
		records = append(records, map[string]any{
			"recon_id":         reconID,
			"batch_id":         batchID,
			"member_id":        memberID,
			"tier":             tier,
			"category":         category,
			"priority":         priority,
			"legacy_value":     legacyVal,
			"recomputed_value": recomputedVal,
			"variance_amount":  varianceAmt,
			"suspected_domain": domain,
			"details":          details,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reconciliation rows: %w", err)
	}
	return records, nil
}

// GetP1Issues handles GET /api/v1/migration/engagements/{id}/reconciliation/p1.
// Returns only P1 (critical) reconciliation issues for the engagement.
func (h *Handler) GetP1Issues(w http.ResponseWriter, r *http.Request) {
	engagementID := r.PathValue("id")
	if engagementID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "migration", "VALIDATION_ERROR", "engagement id is required")
		return
	}

	rows, err := h.DB.Query(
		`SELECT r.recon_id, r.batch_id, r.member_id, r.tier, r.category,
		        r.legacy_value, r.recomputed_value, r.variance_amount, r.suspected_domain, r.details
		 FROM migration.reconciliation r
		 JOIN migration.batch b ON b.batch_id = r.batch_id
		 WHERE b.engagement_id = $1 AND r.priority = 'P1'
		 ORDER BY r.category, r.member_id`,
		engagementID,
	)
	if err != nil {
		slog.Error("failed to get P1 issues", "error", err, "engagement_id", engagementID)
		apiresponse.WriteError(w, http.StatusInternalServerError, "migration", "QUERY_FAILED", "failed to get P1 issues")
		return
	}
	defer rows.Close()

	var issues []map[string]any
	for rows.Next() {
		var reconID, batchID, memberID, category string
		var tier int
		var legacyVal, recomputedVal, varianceAmt, domain, details *string
		if err := rows.Scan(&reconID, &batchID, &memberID, &tier, &category,
			&legacyVal, &recomputedVal, &varianceAmt, &domain, &details); err != nil {
			slog.Error("scan P1 issue failed", "error", err)
			continue
		}
		issues = append(issues, map[string]any{
			"recon_id":         reconID,
			"batch_id":         batchID,
			"member_id":        memberID,
			"tier":             tier,
			"category":         category,
			"legacy_value":     legacyVal,
			"recomputed_value": recomputedVal,
			"variance_amount":  varianceAmt,
			"suspected_domain": domain,
			"details":          details,
		})
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "migration", map[string]any{
		"engagement_id": engagementID,
		"p1_issues":     issues,
		"count":         len(issues),
	})
}

// computeBenchmarks queries canonical tables to build Tier 3 aggregate
// benchmarks for a batch. Returns empty benchmarks on query errors so
// Tier 3 degrades gracefully rather than failing.
func computeBenchmarks(db *sql.DB, batchID string) reconciler.PlanBenchmarks {
	benchmarks := reconciler.PlanBenchmarks{}

	// Average salary by year from canonical_salaries.
	rows, err := db.Query(`
		SELECT EXTRACT(YEAR FROM period_start)::INT AS yr, AVG(amount::NUMERIC)
		FROM migration.canonical_salaries
		WHERE batch_id = $1
		GROUP BY yr`, batchID)
	if err == nil {
		defer rows.Close()
		benchmarks.AvgSalaryByYear = make(map[int]float64)
		for rows.Next() {
			var yr int
			var avg float64
			if rows.Scan(&yr, &avg) == nil {
				benchmarks.AvgSalaryByYear[yr] = avg
			}
		}
	}

	// Total contributions from canonical_contributions.
	var total float64
	if err := db.QueryRow(`
		SELECT COALESCE(SUM(amount::NUMERIC), 0)
		FROM migration.canonical_contributions
		WHERE batch_id = $1`, batchID).Scan(&total); err == nil {
		benchmarks.TotalContributions = total
	}

	// Member count by status from canonical_members.
	rows2, err := db.Query(`
		SELECT member_status, COUNT(*)
		FROM migration.canonical_members
		WHERE batch_id = $1
		GROUP BY member_status`, batchID)
	if err == nil {
		defer rows2.Close()
		benchmarks.MemberCountByStatus = make(map[string]int)
		for rows2.Next() {
			var status string
			var count int
			if rows2.Scan(&status, &count) == nil {
				benchmarks.MemberCountByStatus[status] = count
			}
		}
	}

	return benchmarks
}

// analyzePatterns calls the Python intelligence service to detect systematic
// mismatch patterns. Runs in a goroutine — errors are logged, not propagated.
func (h *Handler) analyzePatterns(batchID, tenantID string, results []reconciler.ReconciliationResult) {
	// Build mismatch records from non-MATCH results only.
	var mismatches []intelligence.MismatchRecord
	for _, r := range results {
		if r.Category == reconciler.CategoryMatch {
			continue
		}
		mismatches = append(mismatches, intelligence.MismatchRecord{
			MemberID:        r.MemberID,
			VarianceAmount:  r.VarianceAmount,
			SuspectedDomain: r.SuspectedDomain,
			MemberStatus:    string(r.MemberStatus),
			PlanCode:        "", // plan code not on individual results
			Category:        string(r.Category),
		})
	}

	if len(mismatches) == 0 {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	resp, err := h.Analyzer.AnalyzeMismatches(ctx, intelligence.AnalyzeMismatchesRequest{
		TenantID:              tenantID,
		ReconciliationResults: mismatches,
	})
	if err != nil {
		slog.Warn("intelligence pattern analysis failed", "error", err, "batch_id", batchID)
		return
	}

	// Convert intelligence response to model patterns.
	var patterns []models.ReconciliationPattern
	for i, p := range resp.Patterns {
		pat := models.ReconciliationPattern{
			SuspectedDomain:  p.SuspectedDomain,
			PlanCode:         p.PlanCode,
			Direction:        p.Direction,
			MemberCount:      p.MemberCount,
			MeanVariance:     p.MeanVariance,
			CoefficientOfVar: p.CV,
			AffectedMembers:  p.AffectedMembers,
		}
		if i < len(resp.Suggestions) {
			s := resp.Suggestions[i]
			pat.CorrectionType = &s.CorrectionType
			pat.AffectedField = &s.AffectedField
			pat.Confidence = &s.Confidence
			pat.Evidence = &s.Evidence
		}
		patterns = append(patterns, pat)
	}

	if len(patterns) == 0 {
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		slog.Warn("failed to begin pattern persist tx", "error", err, "batch_id", batchID)
		return
	}
	defer tx.Rollback()

	if err := migrationdb.PersistPatterns(tx, batchID, patterns); err != nil {
		slog.Warn("failed to persist patterns", "error", err, "batch_id", batchID)
		return
	}

	if err := tx.Commit(); err != nil {
		slog.Warn("failed to commit patterns", "error", err, "batch_id", batchID)
		return
	}

	slog.Info("intelligence patterns persisted",
		"batch_id", batchID,
		"pattern_count", len(patterns),
	)
}
