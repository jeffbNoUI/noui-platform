// Package api implements HTTP handlers for the DERP data connector service.
// All data access goes through this service — no other service queries the database directly.
package api

import (
	"database/sql"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/noui/platform/apiresponse"
	"github.com/noui/platform/dataaccess/models"
	"github.com/noui/platform/dbcontext"
	"github.com/noui/platform/validation"
)

// Handler holds dependencies for API handlers.
type Handler struct {
	DB *sql.DB
}

// NewHandler creates a Handler with the given database connection.
func NewHandler(db *sql.DB) *Handler {
	return &Handler{DB: db}
}

// RegisterRoutes sets up all API routes on the given mux.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", h.HealthCheck)
	mux.HandleFunc("GET /api/v1/members/search", h.SearchMembers)
	mux.HandleFunc("GET /api/v1/members/{id}", h.GetMember)
	mux.HandleFunc("GET /api/v1/members/{id}/employment", h.GetEmploymentHistory)
	mux.HandleFunc("GET /api/v1/members/{id}/salary", h.GetSalaryHistory)
	mux.HandleFunc("GET /api/v1/members/{id}/salary/ams", h.GetAMS)
	mux.HandleFunc("GET /api/v1/members/{id}/beneficiaries", h.GetBeneficiaries)
	mux.HandleFunc("GET /api/v1/members/{id}/dro", h.GetDRO)
	mux.HandleFunc("GET /api/v1/members/{id}/contributions", h.GetContributions)
	mux.HandleFunc("GET /api/v1/members/{id}/service-credit", h.GetServiceCredit)
}

// HealthCheck returns service health status.
func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	apiresponse.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "dataaccess",
		"version": "0.1.0",
	})
}

// SearchMembers returns members matching a name or ID query.
func (h *Handler) SearchMembers(w http.ResponseWriter, r *http.Request) {
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_QUERY", "q parameter is required")
		return
	}

	var errs validation.Errors
	errs.MaxLen("q", q, 200)
	if errs.HasErrors() {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_REQUEST", errs.Error())
		return
	}

	limit, _ := validation.Pagination(intParam(r, "limit", 10), 0, 50)

	likePattern := "%" + strings.ToLower(q) + "%"

	query := `
		SELECT m.member_id, m.first_name, m.last_name,
		       COALESCE(m.tier_cd, 0), COALESCE(d.dept_name, ''), m.status_cd
		FROM member_master m
		LEFT JOIN department_ref d ON m.dept_cd = d.dept_cd
		WHERE LOWER(m.last_name) LIKE $1
		   OR LOWER(m.first_name) LIKE $1
		   OR CAST(m.member_id AS TEXT) = $2
		ORDER BY m.last_name, m.first_name
		LIMIT $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, likePattern, q, limit)
	if err != nil {
		slog.Error("error searching members", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Search query failed")
		return
	}
	defer rows.Close()

	results := []models.MemberSearchResult{}
	for rows.Next() {
		var m models.MemberSearchResult
		if err := rows.Scan(&m.MemberID, &m.FirstName, &m.LastName, &m.Tier, &m.Dept, &m.Status); err != nil {
			slog.Error("error scanning search result", "error", err)
			continue
		}
		results = append(results, m)
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", results)
}

// GetMember returns member profile with current employment info.
func (h *Handler) GetMember(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	query := `
		SELECT m.MEMBER_ID, m.FIRST_NAME, m.LAST_NAME, m.MIDDLE_NAME,
		       m.DOB, m.GENDER, m.MARITAL_STAT, m.HIRE_DT, m.TERM_DATE,
		       m.REHIRE_DT, m.STATUS_CD, m.TIER_CD, m.DEPT_CD, m.POS_CD,
		       m.MEDICARE_FLAG, m.EMAIL,
		       d.DEPT_NAME, p.POS_TITLE
		FROM MEMBER_MASTER m
		LEFT JOIN DEPARTMENT_REF d ON m.DEPT_CD = d.DEPT_CD
		LEFT JOIN POSITION_REF p ON m.POS_CD = p.POS_CD
		WHERE m.MEMBER_ID = $1`

	var member models.Member
	var middleName, gender, maritalStat, deptCode, posCode sql.NullString
	var medicareFlag, email, deptName, posTitle sql.NullString
	var termDate, rehireDate sql.NullTime

	err = dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), query, memberID).Scan(
		&member.MemberID, &member.FirstName, &member.LastName, &middleName,
		&member.DOB, &gender, &maritalStat, &member.HireDate, &termDate,
		&rehireDate, &member.StatusCode, &member.TierCode, &deptCode, &posCode,
		&medicareFlag, &email, &deptName, &posTitle,
	)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, "MEMBER_NOT_FOUND",
			"No member found with ID "+strconv.Itoa(memberID))
		return
	}
	if err != nil {
		slog.Error("error querying member", "memberID", memberID, "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}

	member.MiddleName = nullStr(middleName)
	member.Gender = nullStr(gender)
	member.MaritalStat = nullStr(maritalStat)
	member.DeptCode = nullStr(deptCode)
	member.PosCode = nullStr(posCode)
	member.MedicareFlag = nullStr(medicareFlag)
	member.Email = nullStr(email)
	member.DeptName = nullStr(deptName)
	member.PosTitle = nullStr(posTitle)
	if termDate.Valid {
		member.TermDate = &termDate.Time
	}
	if rehireDate.Valid {
		member.RehireDate = &rehireDate.Time
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", member)
}

// GetEmploymentHistory returns employment events for a member.
func (h *Handler) GetEmploymentHistory(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 100), intParam(r, "offset", 0), 200)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       EMPL_HIST_ID, MEMBER_ID, EVENT_TYPE, EVENT_DT,
		       DEPT_CD, POS_CD, SALARY_ANNUAL, SEPARATION_CD, SEPARATION_RSN
		FROM EMPLOYMENT_HIST
		WHERE MEMBER_ID = $1
		ORDER BY EVENT_DT ASC
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID, limit, offset)
	if err != nil {
		slog.Error("error querying employment history", "memberID", memberID, "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var events []models.EmploymentEvent
	total := 0
	for rows.Next() {
		var e models.EmploymentEvent
		var deptCD, posCD, sepCD, sepRsn sql.NullString
		var salary sql.NullFloat64

		if err := rows.Scan(&total, &e.EventID, &e.MemberID, &e.EventType, &e.EventDate,
			&deptCD, &posCD, &salary, &sepCD, &sepRsn); err != nil {
			slog.Error("error scanning employment row", "error", err)
			continue
		}

		e.DeptCode = nullStr(deptCD)
		e.PosCode = nullStr(posCD)
		e.SeparationCD = nullStr(sepCD)
		e.SeparationRsn = nullStr(sepRsn)
		if salary.Valid {
			e.AnnualSalary = &salary.Float64
		}
		events = append(events, e)
	}

	apiresponse.WritePaginated(w, "dataaccess", events, total, limit, offset)
}

// GetSalaryHistory returns salary records for a member with optional date filtering.
func (h *Handler) GetSalaryHistory(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 100), intParam(r, "offset", 0), 500)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       SALARY_ID, MEMBER_ID, PAY_PERIOD_END, PAY_PERIOD_NUM,
		       ANNUAL_SALARY, GROSS_PAY, PENSIONABLE_PAY, OT_PAY,
		       LEAVE_PAYOUT_AMT, FURLOUGH_DEDUCT, FY_YEAR
		FROM SALARY_HIST
		WHERE MEMBER_ID = $1`

	args := []interface{}{memberID}
	argIdx := 2

	if from := r.URL.Query().Get("from"); from != "" {
		query += fmt.Sprintf(" AND PAY_PERIOD_END >= $%d", argIdx)
		args = append(args, from)
		argIdx++
	}
	if to := r.URL.Query().Get("to"); to != "" {
		query += fmt.Sprintf(" AND PAY_PERIOD_END <= $%d", argIdx)
		args = append(args, to)
		argIdx++
	}

	query += fmt.Sprintf(" ORDER BY PAY_PERIOD_END ASC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, args...)
	if err != nil {
		slog.Error("error querying salary", "memberID", memberID, "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var records []models.SalaryRecord
	total := 0
	for rows.Next() {
		var s models.SalaryRecord
		var pensionablePay sql.NullFloat64

		if err := rows.Scan(&total, &s.SalaryID, &s.MemberID, &s.PayPeriodEnd, &s.PayPeriodNum,
			&s.AnnualSalary, &s.GrossPay, &pensionablePay, &s.OTPay,
			&s.LeavePayoutAmt, &s.FurloughDeduct, &s.FYYear); err != nil {
			slog.Error("error scanning salary row", "error", err)
			continue
		}

		if pensionablePay.Valid {
			s.PensionablePay = pensionablePay.Float64
		}
		records = append(records, s)
	}

	apiresponse.WritePaginated(w, "dataaccess", records, total, limit, offset)
}

// GetAMS calculates the Average Monthly Salary for a member.
// The AMS window size is determined by tier: Tiers 1&2 = 36 months, Tier 3 = 60 months.
func (h *Handler) GetAMS(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	// Get member tier to determine window size
	var tierCode int
	var hireDate time.Time
	err = dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(),
		"SELECT TIER_CD, HIRE_DT FROM MEMBER_MASTER WHERE MEMBER_ID = $1", memberID,
	).Scan(&tierCode, &hireDate)
	if err == sql.ErrNoRows {
		apiresponse.WriteError(w, http.StatusNotFound, "MEMBER_NOT_FOUND",
			"No member found with ID "+strconv.Itoa(memberID))
		return
	}
	if err != nil {
		slog.Error("error querying member tier", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}

	// RULE-AMS-WINDOW: Tiers 1&2 = 36 months, Tier 3 = 60 months
	windowMonths := 36
	if tierCode == 3 {
		windowMonths = 60
	}

	// Aggregate salary data by month
	query := `
		SELECT TO_CHAR(PAY_PERIOD_END, 'YYYY-MM') AS year_month,
		       SUM(COALESCE(PENSIONABLE_PAY, GROSS_PAY)) AS pensionable,
		       SUM(COALESCE(LEAVE_PAYOUT_AMT, 0)) AS leave_payout
		FROM SALARY_HIST
		WHERE MEMBER_ID = $1
		GROUP BY TO_CHAR(PAY_PERIOD_END, 'YYYY-MM')
		ORDER BY year_month ASC`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID)
	if err != nil {
		slog.Error("error querying salary for AMS", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var monthlyTotals []models.MonthlyTotal
	for rows.Next() {
		var mt models.MonthlyTotal
		if err := rows.Scan(&mt.YearMonth, &mt.PensionablePay, &mt.LeavePayoutAmt); err != nil {
			slog.Error("error scanning monthly total", "error", err)
			continue
		}

		// RULE-LEAVE-PAYOUT: Only include leave payout for members hired before Jan 1, 2010
		leaveEligible := hireDate.Before(time.Date(2010, 1, 1, 0, 0, 0, 0, time.UTC))
		if leaveEligible {
			mt.TotalForAMS = mt.PensionablePay + mt.LeavePayoutAmt
		} else {
			mt.TotalForAMS = mt.PensionablePay
		}

		monthlyTotals = append(monthlyTotals, mt)
	}

	if len(monthlyTotals) == 0 {
		apiresponse.WriteError(w, http.StatusNotFound, "NO_SALARY_DATA",
			"No salary records found for member "+strconv.Itoa(memberID))
		return
	}

	// Find the highest consecutive N-month window
	// RULE-AMS-CALC: Sliding window over consecutive months
	bestAMS := 0.0
	bestStart := 0
	bestEnd := 0

	for i := 0; i <= len(monthlyTotals)-windowMonths; i++ {
		sum := 0.0
		for j := i; j < i+windowMonths; j++ {
			sum += monthlyTotals[j].TotalForAMS
		}
		avg := sum / float64(windowMonths)
		if avg > bestAMS {
			bestAMS = avg
			bestStart = i
			bestEnd = i + windowMonths - 1
		}
	}

	// If we don't have enough months for a full window, use all available
	if len(monthlyTotals) < windowMonths {
		sum := 0.0
		for _, mt := range monthlyTotals {
			sum += mt.TotalForAMS
		}
		bestAMS = sum / float64(len(monthlyTotals))
		bestStart = 0
		bestEnd = len(monthlyTotals) - 1
	}

	// Check leave payout inclusion and furlough in window
	leavePayoutIncluded := false
	leavePayoutTotal := 0.0
	furloughInWindow := false

	windowTotals := monthlyTotals[bestStart : bestEnd+1]
	for _, mt := range windowTotals {
		if mt.LeavePayoutAmt > 0 {
			leavePayoutIncluded = true
			leavePayoutTotal += mt.LeavePayoutAmt
		}
	}

	// Calculate AMS without leave payout to determine impact
	leavePayoutImpact := 0.0
	if leavePayoutIncluded {
		sumWithout := 0.0
		for _, mt := range windowTotals {
			sumWithout += mt.PensionablePay
		}
		amsWithout := sumWithout / float64(windowMonths)
		leavePayoutImpact = bestAMS - amsWithout
	}

	result := models.AMSResult{
		WindowMonths:      windowMonths,
		WindowStart:       monthlyTotals[bestStart].YearMonth,
		WindowEnd:         monthlyTotals[bestEnd].YearMonth,
		Amount:            bestAMS,
		LeavePayoutIncl:   leavePayoutIncluded,
		LeavePayoutAmt:    leavePayoutTotal,
		LeavePayoutImpact: leavePayoutImpact,
		FurloughInWindow:  furloughInWindow,
		MonthlyTotals:     windowTotals,
	}

	apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", result)
}

// GetBeneficiaries returns current beneficiary designations for a member.
func (h *Handler) GetBeneficiaries(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 100), intParam(r, "offset", 0), 100)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       BENE_ID, MEMBER_ID, BENE_TYPE, FIRST_NAME, LAST_NAME,
		       RELATIONSHIP, DOB, ALLOC_PCT, EFF_DT, END_DT
		FROM BENEFICIARY
		WHERE MEMBER_ID = $1 AND END_DT IS NULL
		ORDER BY BENE_TYPE, EFF_DT
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID, limit, offset)
	if err != nil {
		slog.Error("error querying beneficiaries", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var benes []models.Beneficiary
	total := 0
	for rows.Next() {
		var b models.Beneficiary
		var rel sql.NullString
		var dob, endDt sql.NullTime

		if err := rows.Scan(&total, &b.BeneID, &b.MemberID, &b.BeneType, &b.FirstName,
			&b.LastName, &rel, &dob, &b.AllocPct, &b.EffDate, &endDt); err != nil {
			slog.Error("error scanning beneficiary row", "error", err)
			continue
		}

		b.Relationship = nullStr(rel)
		if dob.Valid {
			b.DOB = &dob.Time
		}
		if endDt.Valid {
			b.EndDate = &endDt.Time
		}
		benes = append(benes, b)
	}

	apiresponse.WritePaginated(w, "dataaccess", benes, total, limit, offset)
}

// GetDRO returns domestic relations order records for a member.
func (h *Handler) GetDRO(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 50), intParam(r, "offset", 0), 50)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       DRO_ID, MEMBER_ID, COURT_ORDER_NUM, MARRIAGE_DT, DIVORCE_DT,
		       ALT_PAYEE_FIRST, ALT_PAYEE_LAST, ALT_PAYEE_DOB,
		       DIVISION_METHOD, DIVISION_VALUE, STATUS
		FROM DRO_MASTER
		WHERE MEMBER_ID = $1
		ORDER BY RECEIVED_DT
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID, limit, offset)
	if err != nil {
		slog.Error("error querying DRO", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var dros []models.DRORecord
	total := 0
	for rows.Next() {
		var d models.DRORecord
		var courtOrderNum sql.NullString
		var marriageDt, divorceDt, altPayeeDOB sql.NullTime

		if err := rows.Scan(&total, &d.DROID, &d.MemberID, &courtOrderNum, &marriageDt,
			&divorceDt, &d.AltPayeeFirst, &d.AltPayeeLast, &altPayeeDOB,
			&d.DivisionMethod, &d.DivisionValue, &d.Status); err != nil {
			slog.Error("error scanning DRO row", "error", err)
			continue
		}

		d.CourtOrderNum = nullStr(courtOrderNum)
		if marriageDt.Valid {
			d.MarriageDate = &marriageDt.Time
		}
		if divorceDt.Valid {
			d.DivorceDate = &divorceDt.Time
		}
		if altPayeeDOB.Valid {
			d.AltPayeeDOB = &altPayeeDOB.Time
		}
		dros = append(dros, d)
	}

	apiresponse.WritePaginated(w, "dataaccess", dros, total, limit, offset)
}

// GetContributions returns contribution records and summary for a member.
func (h *Handler) GetContributions(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	query := `
		SELECT COALESCE(SUM(EE_CONTRIB), 0),
		       COALESCE(SUM(ER_CONTRIB), 0),
		       COALESCE(SUM(INTEREST_AMT), 0),
		       COUNT(*)
		FROM CONTRIBUTION_HIST
		WHERE MEMBER_ID = $1`

	var summary models.ContributionSummary
	summary.MemberID = memberID

	err = dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), query, memberID).Scan(
		&summary.TotalEE, &summary.TotalER, &summary.TotalInterest, &summary.PeriodCount,
	)
	if err != nil {
		slog.Error("error querying contributions", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}

	// Get latest balances
	balQuery := `
		SELECT COALESCE(EE_BALANCE, 0), COALESCE(ER_BALANCE, 0)
		FROM CONTRIBUTION_HIST
		WHERE MEMBER_ID = $1
		ORDER BY PAY_PERIOD_END DESC
		LIMIT 1`

	dbcontext.DB(r.Context(), h.DB).QueryRowContext(r.Context(), balQuery, memberID).Scan(&summary.CurrentEEBal, &summary.CurrentERBal)

	apiresponse.WriteSuccess(w, http.StatusOK, "dataaccess", summary)
}

// GetServiceCredit returns service credit records and summary for a member.
func (h *Handler) GetServiceCredit(w http.ResponseWriter, r *http.Request) {
	memberID, err := parseMemberID(r)
	if err != nil {
		apiresponse.WriteError(w, http.StatusBadRequest, "INVALID_MEMBER_ID", "Member ID must be a positive integer")
		return
	}

	limit, offset := validation.Pagination(intParam(r, "limit", 100), intParam(r, "offset", 0), 100)

	query := `
		SELECT COUNT(*) OVER() AS total_count,
		       SVC_CREDIT_ID, MEMBER_ID, CREDIT_TYPE, BEGIN_DT, END_DT,
		       YEARS_CREDITED, COST, PURCHASE_DT, STATUS
		FROM SVC_CREDIT
		WHERE MEMBER_ID = $1 AND STATUS = 'ACTIVE'
		ORDER BY CREDIT_TYPE, BEGIN_DT
		LIMIT $2 OFFSET $3`

	rows, err := dbcontext.DB(r.Context(), h.DB).QueryContext(r.Context(), query, memberID, limit, offset)
	if err != nil {
		slog.Error("error querying service credit", "error", err)
		apiresponse.WriteError(w, http.StatusInternalServerError, "DB_ERROR", "Database query failed")
		return
	}
	defer rows.Close()

	var credits []models.ServiceCredit
	summary := models.ServiceCreditSummary{MemberID: memberID}
	total := 0

	for rows.Next() {
		var sc models.ServiceCredit
		var beginDt, endDt, purchaseDt sql.NullTime
		var cost sql.NullFloat64

		if err := rows.Scan(&total, &sc.SvcCreditID, &sc.MemberID, &sc.CreditType,
			&beginDt, &endDt, &sc.YearsCredited, &cost, &purchaseDt, &sc.Status); err != nil {
			slog.Error("error scanning service credit row", "error", err)
			continue
		}

		if beginDt.Valid {
			sc.BeginDate = &beginDt.Time
		}
		if endDt.Valid {
			sc.EndDate = &endDt.Time
		}
		if cost.Valid {
			sc.Cost = &cost.Float64
		}
		if purchaseDt.Valid {
			sc.PurchaseDate = &purchaseDt.Time
		}

		// Accumulate by type
		switch sc.CreditType {
		case "EARNED":
			summary.EarnedYears += sc.YearsCredited
		case "PURCHASED":
			summary.PurchasedYears += sc.YearsCredited
		case "MILITARY":
			summary.MilitaryYears += sc.YearsCredited
		case "LEAVE":
			summary.LeaveYears += sc.YearsCredited
		}

		credits = append(credits, sc)
	}

	summary.TotalYears = summary.EarnedYears + summary.PurchasedYears +
		summary.MilitaryYears + summary.LeaveYears
	// CRITICAL: Eligibility years = earned only (for Rule of 75/85, IPR)
	summary.EligibilityYears = summary.EarnedYears
	// Benefit years = earned + purchased (for benefit formula)
	summary.BenefitYears = summary.EarnedYears + summary.PurchasedYears

	result := struct {
		Credits []models.ServiceCredit      `json:"credits"`
		Summary models.ServiceCreditSummary `json:"summary"`
	}{
		Credits: credits,
		Summary: summary,
	}

	apiresponse.WritePaginated(w, "dataaccess", result, total, limit, offset)
}

// --- Helper functions ---

func parseMemberID(r *http.Request) (int, error) {
	idStr := r.PathValue("id")
	if idStr == "" {
		idStr = strings.TrimPrefix(r.URL.Path, "/api/v1/members/")
		idStr = strings.Split(idStr, "/")[0]
	}
	id, err := strconv.Atoi(idStr)
	if err != nil {
		return 0, err
	}
	var errs validation.Errors
	errs.PositiveInt("member_id", id)
	if errs.HasErrors() {
		return 0, fmt.Errorf(errs.Error())
	}
	return id, nil
}

func nullStr(ns sql.NullString) string {
	if ns.Valid {
		return ns.String
	}
	return ""
}

func intParam(r *http.Request, name string, defaultVal int) int {
	s := r.URL.Query().Get(name)
	if s == "" {
		return defaultVal
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return defaultVal
	}
	return v
}
