// Package api — employer-scoped member query handlers.
// These endpoints let employer portal users view their own members.
// The member↔employer linkage flows through CRM tables:
//
//	crm_organization → crm_org_contact → crm_contact(legacy_mbr_id) → MEMBER_MASTER
package api

import (
	"log/slog"
	"net/http"
	"strings"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/dataaccess/models"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/validation"
)

// EmployerMemberRoster returns a paginated list of members belonging to the given employer org.
func (h *Handler) EmployerMemberRoster(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataaccess", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataaccess", "INVALID_ORG_ID", errs.Error())
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 25), intParam(r, "offset", 0), 100)

	query := `
		SELECT m.member_id, m.first_name, m.last_name,
		       COALESCE(m.tier_cd, 0), COALESCE(d.dept_name, ''), m.status_cd,
		       COUNT(*) OVER() AS total_count
		FROM member_master m
		LEFT JOIN department_ref d ON m.dept_cd = d.dept_cd
		JOIN crm_contact cc ON cc.legacy_mbr_id = CAST(m.member_id AS TEXT)
		  AND cc.contact_type = 'member'
		JOIN crm_org_contact coc ON coc.contact_id = cc.contact_id
		WHERE coc.org_id = $1
		ORDER BY m.last_name, m.first_name
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, orgID, limit, offset)
	if err != nil {
		slog.Error("error querying employer member roster", "orgId", orgID, "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataaccess", "DB_ERROR", "Roster query failed")
		return
	}
	defer rows.Close()

	var results []models.MemberSearchResult
	var total int
	for rows.Next() {
		var m models.MemberSearchResult
		if err := rows.Scan(&m.MemberID, &m.FirstName, &m.LastName, &m.Tier, &m.Dept, &m.Status, &total); err != nil {
			slog.Error("error scanning roster row", "error", err)
			continue
		}
		results = append(results, m)
	}
	if results == nil {
		results = []models.MemberSearchResult{}
	}

	apiresponse.WritePaginated(w, "dataaccess", results, total, limit, offset)
}

// EmployerMemberSummary returns aggregate stats for an employer's member population.
func (h *Handler) EmployerMemberSummary(w http.ResponseWriter, r *http.Request) {
	orgID := r.PathValue("orgId")
	if orgID == "" {
		orgID = parsePathSegment(r.URL.Path, "employer")
	}
	if orgID == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataaccess", "INVALID_ORG_ID", "orgId is required")
		return
	}

	var errs validation.Errors
	errs.UUID("orgId", orgID)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "dataaccess", "INVALID_ORG_ID", errs.Error())
		return
	}

	query := `
		SELECT
		  COUNT(*) AS total_members,
		  COUNT(*) FILTER (WHERE m.status_cd = 'A') AS active_count,
		  COUNT(*) FILTER (WHERE m.status_cd = 'R') AS retired_count,
		  COUNT(*) FILTER (WHERE m.status_cd = 'T') AS terminated_count,
		  COUNT(*) FILTER (WHERE m.status_cd = 'D') AS deferred_count,
		  COUNT(*) FILTER (WHERE COALESCE(m.tier_cd, 0) = 1) AS tier1_count,
		  COUNT(*) FILTER (WHERE COALESCE(m.tier_cd, 0) = 2) AS tier2_count,
		  COUNT(*) FILTER (WHERE COALESCE(m.tier_cd, 0) = 3) AS tier3_count
		FROM member_master m
		JOIN crm_contact cc ON cc.legacy_mbr_id = CAST(m.member_id AS TEXT)
		  AND cc.contact_type = 'member'
		JOIN crm_org_contact coc ON coc.contact_id = cc.contact_id
		WHERE coc.org_id = $1`

	var s models.EmployerMemberSummary
	s.OrgID = orgID

	err := dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), query, orgID).Scan(
		&s.TotalMembers, &s.ActiveCount, &s.RetiredCount, &s.TerminatedCount, &s.DeferredCount,
		&s.Tier1Count, &s.Tier2Count, &s.Tier3Count,
	)
	if err != nil {
		slog.Error("error querying employer member summary", "orgId", orgID, "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "dataaccess", "DB_ERROR", "Summary query failed")
		return
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", s)
}

// parsePathSegment extracts the segment after the given key in a URL path.
// For example, parsePathSegment("/api/v1/employer/abc-123/members", "employer") returns "abc-123".
func parsePathSegment(path, key string) string {
	parts := strings.Split(path, "/")
	for i, p := range parts {
		if p == key && i+1 < len(parts) {
			return parts[i+1]
		}
	}
	return ""
}
