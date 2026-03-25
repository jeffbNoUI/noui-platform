package mapper

import "sort"

// Registry holds all mapping templates indexed by concept tag.
type Registry struct {
	templates map[string]MappingTemplate
}

// NewRegistry creates a registry pre-loaded with all 18 concept tag templates.
func NewRegistry() *Registry {
	r := &Registry{templates: make(map[string]MappingTemplate)}
	r.registerAll()
	return r
}

// Get returns the template for a concept tag, or false if not found.
func (r *Registry) Get(conceptTag string) (MappingTemplate, bool) {
	t, ok := r.templates[conceptTag]
	return t, ok
}

// Tags returns all registered concept tags in sorted order.
func (r *Registry) Tags() []string {
	tags := make([]string, 0, len(r.templates))
	for tag := range r.templates {
		tags = append(tags, tag)
	}
	sort.Strings(tags)
	return tags
}

func (r *Registry) register(t MappingTemplate) {
	r.templates[t.ConceptTag] = t
}

func (r *Registry) registerAll() {
	// ----------------------------------------------------------------
	// Pension-relevant concepts with full slot definitions
	// ----------------------------------------------------------------

	// 1. employee-master → canonical "member" table
	r.register(MappingTemplate{
		ConceptTag:     "employee-master",
		CanonicalTable: "member",
		Description:    "Core member/participant demographics and plan enrollment",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "mbr_id", "emp_nbr", "emp_id", "empl_id", "employee_id", "participant_id", "legacy_member_number"},
			},
			{
				CanonicalColumn: "national_id",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"national_id", "natl_id", "ssn", "ssn_raw", "ssn_normalized", "social_security", "tax_id", "tin_last4"},
			},
			{
				CanonicalColumn: "birth_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"birth_date", "birth_dt", "dob", "date_of_birth", "birthdate"},
			},
			{
				CanonicalColumn: "first_name",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"first_name", "first_nm", "fname", "given_name"},
			},
			{
				CanonicalColumn: "last_name",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"last_name", "last_nm", "lname", "surname", "family_name"},
			},
			{
				CanonicalColumn: "original_hire_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"hire_date", "hire_dt", "original_hire_date", "date_of_hire", "employment_date", "original_membership_date", "retirement_system_entry_date", "membership_date", "enrollment_date", "system_entry_date", "participation_date"},
			},
			{
				CanonicalColumn: "plan_code",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"plan_code", "plan_cd", "plan_id", "plan_type"},
			},
			{
				CanonicalColumn: "plan_tier",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"plan_tier", "tier", "member_tier", "tier_code", "mbr_tier"},
			},
			{
				CanonicalColumn: "member_status",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"status", "status_code", "status_cd", "member_status", "member_status_code"},
			},
			{
				CanonicalColumn: "gender_code",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"gender", "gender_code", "sex", "sex_code", "gndr_cd"},
			},
			{
				CanonicalColumn: "email",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"email", "email_address", "email_addr", "contact_value"},
			},
			{
				CanonicalColumn: "phone",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"phone", "phone_number", "telephone", "phone_nbr"},
			},
		},
	})

	// 2. salary-history → canonical "earnings" table
	r.register(MappingTemplate{
		ConceptTag:     "salary-history",
		CanonicalTable: "earnings",
		Description:    "Salary and earnings records (annual and period-level)",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "emp_id", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "period_start",
				DataTypeFamily:  "DATE",
				Required:        false,
				ExpectedNames:   []string{"period_start", "earned_start", "pay_period_start", "start_date", "effective_date", "prd_start_dt", "period_begin_date", "pay_period_begin_date"},
			},
			{
				CanonicalColumn: "period_end",
				DataTypeFamily:  "DATE",
				Required:        false,
				ExpectedNames:   []string{"period_end", "earned_end", "pay_period_end", "end_date", "prd_end_dt", "period_end_date", "pay_period_end_date"},
			},
			{
				CanonicalColumn: "gross_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        true,
				ExpectedNames:   []string{"gross_amount", "salary_amount", "sal_amt", "compensation", "pay_amount", "gross_earn", "gross_pay", "reportable_earnings", "pensionable_pay", "compensation_earnable", "pensionable_compensation", "pensionable_salary", "earnable_compensation", "covered_wages", "creditable_compensation", "reportable_compensation", "base_pay", "annual_salary"},
			},
			{
				CanonicalColumn: "pensionable_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        false,
				ExpectedNames:   []string{"pensionable_amount", "base_salary", "base_amount", "covered_salary", "pension_earn", "pension_pay", "pensionable_earnings", "highest_average_salary", "average_monthly_salary", "final_average_compensation", "final_average_salary", "average_final_compensation", "final_rate_of_earnings", "average_monthly_compensation", "highest_average_compensation", "high_five_salary", "has", "ams", "fac", "fas", "afc", "fre", "amc", "hac"},
			},
			{
				CanonicalColumn: "granularity",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"granularity", "frequency", "pay_frequency", "period_type", "salary_granularity", "pay_freq_cd"},
			},
		},
	})

	// 3. employment-timeline → canonical "employment" table
	r.register(MappingTemplate{
		ConceptTag:     "employment-timeline",
		CanonicalTable: "employment",
		Description:    "Employment spells/segments with employer, job class, and status",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "employer_code",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"employer_code", "employer_id", "empr_cd", "org_code", "employer_number"},
			},
			{
				CanonicalColumn: "spell_start_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"spell_start", "segment_start", "start_date", "hire_date", "effective_date", "spell_start_date", "segment_start_date"},
			},
			{
				CanonicalColumn: "spell_end_date",
				DataTypeFamily:  "DATE",
				Required:        false,
				ExpectedNames:   []string{"spell_end", "segment_end", "end_date", "termination_date", "term_date", "spell_end_date", "segment_end_date"},
			},
			{
				CanonicalColumn: "job_class_code",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"job_class", "job_class_code", "position", "classification", "position_cd", "employee_class_code"},
			},
			{
				CanonicalColumn: "employment_status",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"employment_status", "employment_status_code", "emp_status", "spell_typ", "pay_status_code"},
			},
		},
	})

	// 4. benefit-deduction → canonical "contribution" table
	r.register(MappingTemplate{
		ConceptTag:     "benefit-deduction",
		CanonicalTable: "contribution",
		Description:    "Employee and employer contribution records",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "mbr_id", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "contribution_period",
				DataTypeFamily:  "DATE",
				Required:        false,
				ExpectedNames:   []string{"contribution_period", "period", "payroll_period", "effective_date", "contrib_prd", "contribution_begin_date"},
			},
			{
				CanonicalColumn: "ee_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        true,
				ExpectedNames:   []string{"ee_amount", "employee_contribution", "ee_contribution", "member_contribution", "ee_contrib", "ee_contrib_amt", "member_contribution_amount", "basic_member_contributions", "retirement_deductions", "member_deposits", "mandatory_contributions", "regular_contributions"},
			},
			{
				CanonicalColumn: "er_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        false,
				ExpectedNames:   []string{"er_amount", "employer_contribution", "er_contribution", "er_contrib", "er_contrib_amt", "employer_contribution_amount", "state_contribution", "city_contributions", "city_matching_funds", "normal_cost", "uniform_contribution_rate"},
			},
			{
				CanonicalColumn: "granularity",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"granularity", "contribution_granularity", "frequency", "pay_freq_cd"},
			},
		},
	})

	// 5. service-credit → canonical "service_credit" table
	r.register(MappingTemplate{
		ConceptTag:     "service-credit",
		CanonicalTable: "service_credit",
		Description:    "Credited service years including purchased, military, and transfer service",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "as_of_date",
				DataTypeFamily:  "DATE",
				Required:        false,
				ExpectedNames:   []string{"as_of_date", "effective_date", "service_date", "calculation_date", "as_of_dt", "service_begin_date"},
			},
			{
				CanonicalColumn: "credited_years_total",
				DataTypeFamily:  "DECIMAL",
				Required:        true,
				ExpectedNames:   []string{"credited_years_total", "service_units", "credited_service_years", "years_of_service", "yos", "svc_cr_bal", "service_credit", "credited_service", "creditable_service", "retirement_credit", "allowable_service", "qualifying_service_credit", "earned_service_credit", "contributing_months", "eligibility_points", "sc", "cs", "qsc"},
			},
			{
				CanonicalColumn: "service_type",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"service_type", "service_unit_type", "credit_type", "svc_typ_cd", "service_type_code", "purchased_service_credit", "buy_back", "redeposit", "reinstated_service", "military_service_credit", "userra_service_credit", "reciprocal_service", "transferred_service"},
			},
		},
	})

	// 6. beneficiary-designation → canonical "beneficiary" (future table)
	r.register(MappingTemplate{
		ConceptTag:     "beneficiary-designation",
		CanonicalTable: "beneficiary",
		Description:    "Beneficiary designations including primary/contingent and allocation percentages",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "beneficiary_name",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"beneficiary_name", "benef_name", "name", "first_nm", "last_nm", "first_name", "last_name"},
			},
			{
				CanonicalColumn: "relationship",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"relationship", "relationship_code", "relation", "relationship_type_code", "bene_typ_cd"},
			},
			{
				CanonicalColumn: "allocation_pct",
				DataTypeFamily:  "DECIMAL",
				Required:        false,
				ExpectedNames:   []string{"allocation_pct", "percentage", "share", "allocation", "share_pct", "percentage_allocation"},
			},
			{
				CanonicalColumn: "primary_flag",
				DataTypeFamily:  "BOOLEAN",
				Required:        false,
				ExpectedNames:   []string{"primary_flag", "is_primary", "primary", "contingent_flag"},
			},
		},
	})

	// 7. domestic-relations-order → canonical "dro" (future table)
	r.register(MappingTemplate{
		ConceptTag:     "domestic-relations-order",
		CanonicalTable: "dro",
		Description:    "Domestic relations orders (QDROs) splitting benefits to alternate payees",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "alternate_payee",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"alternate_payee", "alternate_payee_name", "payee", "ap_last_nm", "ap_first_nm"},
			},
			{
				CanonicalColumn: "order_type",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"order_type", "dro_type", "qdro_type", "share_typ", "order_type_code"},
			},
			{
				CanonicalColumn: "effective_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"effective_date", "order_date", "qdro_date", "ord_dt", "order_effective_date", "share_eff_dt"},
			},
			{
				CanonicalColumn: "status",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"status", "status_code", "dro_status", "ord_status", "order_status_code"},
			},
		},
	})

	// 8. benefit-payment → canonical "payment" table
	r.register(MappingTemplate{
		ConceptTag:     "benefit-payment",
		CanonicalTable: "payment",
		Description:    "Recurring and one-time benefit payment history",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "pay_period_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"pay_period_date", "payment_date", "pay_date", "check_date", "pay_prd_dt", "pay_period_begin_date"},
			},
			{
				CanonicalColumn: "gross_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        true,
				ExpectedNames:   []string{"gross_amount", "payment_amount", "gross_payment", "gross_amt", "benefit_amount", "monthly_benefit", "pension_payment", "retirement_benefit", "annuity_payment", "monthly_allowance", "benefit_payment_amount", "gross_benefit"},
			},
			{
				CanonicalColumn: "net_amount",
				DataTypeFamily:  "DECIMAL",
				Required:        true,
				ExpectedNames:   []string{"net_amount", "net_payment", "net_amt"},
			},
			{
				CanonicalColumn: "payment_status",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"payment_status", "pmt_status", "status", "payment_status_code"},
			},
		},
	})

	// 9. case-management → canonical "case" (future table)
	r.register(MappingTemplate{
		ConceptTag:     "case-management",
		CanonicalTable: "case",
		Description:    "Retirement and administrative case tracking",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "member_id",
				DataTypeFamily:  "INTEGER",
				Required:        true,
				ExpectedNames:   []string{"member_id", "mbr_nbr", "emp_nbr", "empl_id", "employee_id"},
			},
			{
				CanonicalColumn: "case_type",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"case_type", "type", "case_type_code"},
			},
			{
				CanonicalColumn: "opened_date",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"opened_date", "open_date", "created_date"},
			},
			{
				CanonicalColumn: "status",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"status", "status_code", "case_status", "case_status_code"},
			},
		},
	})

	// 10. payroll-run → reference data (employer payroll schedule)
	r.register(MappingTemplate{
		ConceptTag:     "payroll-run",
		CanonicalTable: "",
		Description:    "Payroll run schedule reference data; no direct canonical table but informs earnings/contribution period alignment",
		Slots: []TemplateSlot{
			{
				CanonicalColumn: "employer_id",
				DataTypeFamily:  "VARCHAR",
				Required:        true,
				ExpectedNames:   []string{"employer_id", "employer_code", "empr_cd", "org_code"},
			},
			{
				CanonicalColumn: "period_start",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"period_start", "pay_period_start", "pay_period_begin_date", "prd_start_dt"},
			},
			{
				CanonicalColumn: "period_end",
				DataTypeFamily:  "DATE",
				Required:        true,
				ExpectedNames:   []string{"period_end", "pay_period_end", "pay_period_end_date", "prd_end_dt"},
			},
			{
				CanonicalColumn: "pay_frequency",
				DataTypeFamily:  "VARCHAR",
				Required:        false,
				ExpectedNames:   []string{"pay_frequency", "frequency", "payroll_frequency_code", "pay_freq_cd"},
			},
		},
	})

	// ----------------------------------------------------------------
	// Non-pension concepts — registered with empty Slots
	// ----------------------------------------------------------------

	nonPension := []struct {
		tag  string
		desc string
	}{
		{"leave-balance", "Leave balance tracking; not applicable to pension migration"},
		{"attendance", "Attendance records; not applicable to pension migration"},
		{"training-record", "Training and certification records; not applicable to pension migration"},
		{"expense-claim", "Expense reimbursement claims; not applicable to pension migration"},
		{"performance-review", "Performance evaluations; not applicable to pension migration"},
		{"shift-schedule", "Shift and scheduling data; not applicable to pension migration"},
		{"loan-advance", "Loan and salary advance records; not applicable to pension migration"},
		{"audit-trail", "System audit trail; not applicable to pension migration"},
	}

	for _, np := range nonPension {
		r.register(MappingTemplate{
			ConceptTag:     np.tag,
			CanonicalTable: "",
			Description:    np.desc,
			Slots:          nil,
		})
	}
}
