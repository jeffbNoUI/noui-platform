# Pension Concepts + Cross-Domain Signal Broadening — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 6 pension-specific concept definitions and broaden 3 existing HR concepts to cross-tag pension equivalents, proving cross-domain generalization of the signal-based tagger.

**Architecture:** New concept definitions follow the same additive-scoring pattern (ConceptDef with SignalDef slices). Existing HR concepts get wider signal patterns (more column name patterns, "member" alongside "employee"). All work in `connector/tagger/` — types.go, concepts.go, tagger_test.go. No changes to signals.go, scorer.go, or tagger.go.

**Tech Stack:** Go, existing signal helpers (columnsMatching, hasColumnPair, tableNameContains, etc.)

**Key files:**
- `connector/tagger/types.go` — ConceptTag constants (add 6 new)
- `connector/tagger/concepts.go` — ConceptDef functions (broaden 3, add 6)
- `connector/tagger/tagger_test.go` — Unit tests (add ~10 new)
- `connector/tagger/testdata/minimal.json` — Fixture (no changes needed)
- `connector/service/main.go` — Unified service (no code changes, just E2E validation)

**Test command:** `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`

---

### Task 1: Add 6 New ConceptTag Constants

**Files:**
- Modify: `connector/tagger/types.go:26-39`

**Step 1: Add the new constants after the existing 12**

Add these 6 constants after `ConceptLoanAdvance`:

```go
ConceptBeneficiaryDesignation ConceptTag = "beneficiary-designation"
ConceptServiceCredit          ConceptTag = "service-credit"
ConceptDomesticRelationsOrder ConceptTag = "domestic-relations-order"
ConceptBenefitPayment         ConceptTag = "benefit-payment"
ConceptCaseManagement         ConceptTag = "case-management"
ConceptAuditTrail             ConceptTag = "audit-trail"
```

**Step 2: Run existing tests to verify no regression**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All 16 existing tests PASS (adding constants doesn't break anything)

**Step 3: Commit**

```bash
git add connector/tagger/types.go
git commit -m "[tagger] Add 6 pension concept tag constants"
```

---

### Task 2: Broaden employee-master Signals

**Files:**
- Modify: `connector/tagger/concepts.go:27-101` (employeeMasterConcept function)

**Step 1: Write cross-domain test**

Add to `connector/tagger/tagger_test.go`:

```go
func TestEmployeeMasterCrossDomain_MemberMaster(t *testing.T) {
	// MEMBER_MASTER from DERP pension schema — abbreviated column names
	table := makeTable("MEMBER_MASTER", []schema.ColumnInfo{
		pk("MEMBER_ID"),
		col("SSN", "varchar"),
		col("FIRST_NAME", "varchar"),
		col("LAST_NAME", "varchar"),
		col("MIDDLE_NAME", "varchar"),
		col("DOB", "date"),
		col("GENDER", "char"),
		col("MARITAL_STAT", "char"),
		col("HIRE_DT", "date"),
		col("TERM_DATE", "date"),
		col("STATUS_CD", "varchar"),
		col("TIER_CD", "smallint"),
		col("DEPT_CD", "varchar"),
		col("POS_CD", "varchar"),
		col("UNION_CD", "varchar"),
		col("CREATE_DT", "timestamp"),
		col("LAST_UPD_DT", "timestamp"),
	}, nil)

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptEmployeeMaster) {
		t.Errorf("expected employee-master tag for MEMBER_MASTER, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestEmployeeMasterCrossDomain -v`
Expected: FAIL — MEMBER_MASTER doesn't match current ERPNext-specific signals

**Step 3: Broaden employeeMasterConcept signals**

In `connector/tagger/concepts.go`, modify `employeeMasterConcept()`:

1. `table_name:employee_core` signal — add "member" to include list; add "beneficiary", "payment", "credit", "svc", "dro", "contrib", "case", "transaction", "log" to exclude list:
```go
return tableNameContainsButNot(t,
    []string{"employee", "member"},
    []string{"checkin", "separation", "transfer", "promotion",
        "benefit", "tax", "incentive", "onboard", "boarding",
        "grievance", "referral", "training", "skill", "feedback",
        "advance", "cost", "group", "property", "external",
        "internal", "education", "health", "other_income",
        "performance", "detail",
        "beneficiary", "payment", "credit", "svc", "dro",
        "contrib", "case", "transaction", "log"},
)
```

2. `columns:identity` signal — add "dob" to patterns:
```go
matches := columnsMatching(t, []string{
    "first_name", "last_name", "employee_name",
    "date_of_birth", "gender", "dob",
})
```

3. `columns:employment_status` signal — add abbreviated patterns:
```go
return hasColumnPair(t,
    []string{"status", "employment_type", "status_cd"},
    []string{"date_of_joining", "joining_date", "hire_date", "hire_dt"},
)
```

4. `columns:org_structure` signal — add abbreviated patterns:
```go
matches := columnsMatching(t, []string{"department", "designation", "company", "dept_cd", "pos_cd"})
```

**Step 4: Run test to verify it passes**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestEmployeeMaster -v`
Expected: PASS for both original TestEmployeeMasterTag and new TestEmployeeMasterCrossDomain_MemberMaster

**Step 5: Run all tests for regression**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Broaden employee-master signals for pension cross-domain"
```

---

### Task 3: Broaden salary-history Signals

**Files:**
- Modify: `connector/tagger/concepts.go:103-176` (salaryHistoryConcept function)
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write cross-domain test**

Add to `connector/tagger/tagger_test.go`:

```go
func TestSalaryHistoryCrossDomain_SalaryHist(t *testing.T) {
	// SALARY_HIST from DERP pension schema
	table := makeTable("SALARY_HIST", []schema.ColumnInfo{
		pk("SALARY_ID"),
		col("MEMBER_ID", "integer"),
		col("PAY_PERIOD_END", "date"),
		col("PAY_PERIOD_NUM", "integer"),
		col("ANNUAL_SALARY", "numeric"),
		col("GROSS_PAY", "numeric"),
		col("PENSIONABLE_PAY", "numeric"),
		col("OT_PAY", "numeric"),
		col("LEAVE_PAYOUT_AMT", "numeric"),
		col("FURLOUGH_DEDUCT", "numeric"),
		col("FY_YEAR", "integer"),
		col("CREATE_DT", "timestamp"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptSalaryHistory) {
		t.Errorf("expected salary-history tag for SALARY_HIST, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestSalaryHistoryCrossDomain -v`
Expected: FAIL

**Step 3: Broaden salaryHistoryConcept signals**

In `connector/tagger/concepts.go`, modify `salaryHistoryConcept()`:

1. `columns:compensation` — add pension patterns:
```go
matches := columnsMatching(t, []string{
    "gross_pay", "net_pay", "total_deduction", "base_gross_pay",
    "base_net_pay", "total_earning", "salary_amount",
    "payroll_frequency", "salary_structure",
    "annual_salary", "pensionable_pay", "ot_pay",
})
```

2. `columns:monetary_pair` — add "deduct" to catch abbreviated forms:
```go
return hasColumnPair(t,
    []string{"gross", "base_pay", "total_earning", "annual_salary"},
    []string{"net", "deduction", "take_home", "deduct"},
)
```

3. `link:employee` — add "member":
```go
if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
    return true, ev
}
return hasColumnLinkToTableLike(t, []string{"employee", "member"})
```

**Step 4: Run test to verify it passes**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestSalaryHistory -v`
Expected: PASS for both original and cross-domain

**Step 5: Run all tests for regression**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Broaden salary-history signals for pension cross-domain"
```

---

### Task 4: Broaden employment-timeline Signals

**Files:**
- Modify: `connector/tagger/concepts.go:307-362` (employmentTimelineConcept function)
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write cross-domain test**

```go
func TestEmploymentTimelineCrossDomain_EmploymentHist(t *testing.T) {
	// EMPLOYMENT_HIST from DERP pension schema
	table := makeTable("EMPLOYMENT_HIST", []schema.ColumnInfo{
		pk("EMPL_HIST_ID"),
		col("MEMBER_ID", "integer"),
		col("EVENT_TYPE", "varchar"),
		col("EVENT_DT", "date"),
		col("DEPT_CD", "varchar"),
		col("POS_CD", "varchar"),
		col("SALARY_ANNUAL", "numeric"),
		col("SEPARATION_CD", "varchar"),
		col("SEPARATION_RSN", "varchar"),
		col("NOTES", "text"),
		col("CREATE_DT", "timestamp"),
		col("CREATE_USER", "varchar"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptEmploymentTimeline) {
		t.Errorf("expected employment-timeline tag for EMPLOYMENT_HIST, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestEmploymentTimelineCrossDomain -v`
Expected: FAIL

**Step 3: Broaden employmentTimelineConcept signals**

1. `table_name:lifecycle` — add "employment_hist" and generic "employment" with exclusions. Actually, to avoid conflicting with employee-master, use `tableNameContainsButNot` instead of `tableNameContains`:
```go
Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
    // First check original patterns
    if found, ev := tableNameContains(t, []string{
        "promotion", "transfer", "separation", "onboarding",
        "termination", "rehire",
    }); found {
        return true, ev
    }
    // Also match employment_hist / empl_hist (pension pattern)
    return tableNameContainsButNot(t,
        []string{"employment_hist", "empl_hist"},
        []string{"employment_type"},
    )
},
```

2. `columns:lifecycle_date` — add pension event patterns:
```go
matches := columnsMatching(t, []string{
    "promotion_date", "transfer_date", "relieving_date",
    "resignation", "effective_date", "boarding_status",
    "event_dt", "event_type", "separation_cd",
})
```

3. `link:employee` — add "member":
```go
if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
    return true, ev
}
return hasColumnLinkToTableLike(t, []string{"employee", "member"})
```

**Step 4: Run tests**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestEmploymentTimeline -v`
Expected: PASS for both original and cross-domain

**Step 5: Run all tests for regression**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Broaden employment-timeline signals for pension cross-domain"
```

---

### Task 5: Add beneficiary-designation Concept

**Files:**
- Modify: `connector/tagger/concepts.go` (add function + wire into DefaultConcepts)
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestBeneficiaryDesignationTag(t *testing.T) {
	table := makeTable("BENEFICIARY", []schema.ColumnInfo{
		pk("BENE_ID"),
		col("MEMBER_ID", "integer"),
		col("BENE_TYPE", "varchar"),
		col("FIRST_NAME", "varchar"),
		col("LAST_NAME", "varchar"),
		col("RELATIONSHIP", "varchar"),
		col("DOB", "date"),
		col("SSN", "varchar"),
		col("ALLOC_PCT", "numeric"),
		col("EFF_DT", "date"),
		col("END_DT", "date"),
		col("SUPERSEDED_BY", "integer"),
		col("CREATE_DT", "timestamp"),
		col("CREATE_USER", "varchar"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptBeneficiaryDesignation) {
		t.Errorf("expected beneficiary-designation tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Run test to verify it fails**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestBeneficiaryDesignation -v`
Expected: FAIL

**Step 3: Add beneficiaryDesignationConcept function**

Add to `connector/tagger/concepts.go`:

```go
func beneficiaryDesignationConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptBeneficiaryDesignation,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:beneficiary",
				Description: "Table name contains beneficiary/bene terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContains(t, []string{"beneficiary", "bene_"})
				},
			},
			{
				Name:        "columns:allocation",
				Description: "Has allocation/percentage/share columns for benefit split",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"relationship", "alloc_pct", "percentage", "share",
						"allocation", "bene_type",
					})
					if len(matches) >= 2 {
						return true, fmt.Sprintf("beneficiary columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "columns:supersede_pattern",
				Description: "Has effective/end date or supersede pattern (versioned designations)",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnPair(t,
						[]string{"eff_dt", "effective_date", "start_date"},
						[]string{"end_dt", "superseded_by", "end_date", "terminated_date"},
					)
				},
			},
			{
				Name:        "link:member_employee",
				Description: "Has link to member or employee entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
						return true, ev
					}
					return hasColumnLinkToTableLike(t, []string{"employee", "member"})
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()` — add `beneficiaryDesignationConcept()` to the returned slice.

**Step 4: Run test to verify it passes**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -run TestBeneficiaryDesignation -v`
Expected: PASS

**Step 5: Run all tests for regression**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All tests PASS

**Step 6: Commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add beneficiary-designation concept"
```

---

### Task 6: Add service-credit Concept

**Files:**
- Modify: `connector/tagger/concepts.go`
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestServiceCreditTag(t *testing.T) {
	table := makeTable("SVC_CREDIT", []schema.ColumnInfo{
		pk("SVC_CREDIT_ID"),
		col("MEMBER_ID", "integer"),
		col("CREDIT_TYPE", "varchar"),
		col("BEGIN_DT", "date"),
		col("END_DT", "date"),
		col("YEARS_CREDITED", "numeric"),
		col("MONTHS_CREDITED", "integer"),
		col("COST", "numeric"),
		col("PURCHASE_DT", "date"),
		col("STATUS", "varchar"),
		col("NOTES", "text"),
		col("CREATE_DT", "timestamp"),
		col("CREATE_USER", "varchar"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptServiceCredit) {
		t.Errorf("expected service-credit tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Run test to verify it fails, then implement**

Concept function:

```go
func serviceCreditConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptServiceCredit,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:service_credit",
				Description: "Table name contains service credit terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContains(t, []string{"svc_credit", "service_credit"})
				},
			},
			{
				Name:        "columns:credit_duration",
				Description: "Has service credit duration columns (years, months credited)",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"years_credited", "credit_years", "service_years",
						"months_credited", "credit_months", "service_months",
					})
					if len(matches) >= 1 {
						return true, fmt.Sprintf("credit duration columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "columns:credit_type",
				Description: "Has credit type classification column",
				Weight:      1.0,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnMatching(t, []string{"credit_type"})
				},
			},
			{
				Name:        "pattern:date_range",
				Description: "Has date range columns (service period)",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					// Standard hasDateRangePattern + pension-specific begin_dt/end_dt
					if found, ev := hasDateRangePattern(t); found {
						return true, ev
					}
					return hasColumnPair(t,
						[]string{"begin_dt"},
						[]string{"end_dt"},
					)
				},
			},
			{
				Name:        "link:member_employee",
				Description: "Has link to member or employee entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
						return true, ev
					}
					return hasColumnLinkToTableLike(t, []string{"employee", "member"})
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()`.

**Step 3: Run tests, commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add service-credit concept"
```

---

### Task 7: Add domestic-relations-order Concept

**Files:**
- Modify: `connector/tagger/concepts.go`
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestDomesticRelationsOrderTag(t *testing.T) {
	table := makeTable("DRO_MASTER", []schema.ColumnInfo{
		pk("DRO_ID"),
		col("MEMBER_ID", "integer"),
		col("COURT_ORDER_NUM", "varchar"),
		col("MARRIAGE_DT", "date"),
		col("DIVORCE_DT", "date"),
		col("ALT_PAYEE_FIRST", "varchar"),
		col("ALT_PAYEE_LAST", "varchar"),
		col("ALT_PAYEE_SSN", "varchar"),
		col("ALT_PAYEE_DOB", "date"),
		col("DIVISION_METHOD", "varchar"),
		col("DIVISION_VALUE", "numeric"),
		col("STATUS", "varchar"),
		col("RECEIVED_DT", "date"),
		col("APPROVED_DT", "date"),
		col("NOTES", "text"),
		col("CREATE_DT", "timestamp"),
		col("CREATE_USER", "varchar"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptDomesticRelationsOrder) {
		t.Errorf("expected domestic-relations-order tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Implement**

```go
func domesticRelationsOrderConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptDomesticRelationsOrder,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:dro",
				Description: "Table name contains DRO or domestic relations terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContains(t, []string{"dro", "domestic_relation", "qdro"})
				},
			},
			{
				Name:        "columns:court_order_payee",
				Description: "Has court order and alternate payee columns",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnPair(t,
						[]string{"court_order", "order_num"},
						[]string{"alt_payee", "alternate_payee", "payee"},
					)
				},
			},
			{
				Name:        "columns:marital_dates",
				Description: "Has marriage/divorce date columns",
				Weight:      1.0,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"marriage", "divorce", "marital",
					})
					if len(matches) >= 1 {
						return true, fmt.Sprintf("marital columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "columns:division",
				Description: "Has benefit division method/value columns",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnMatching(t, []string{"division_method", "division_value", "division_pct"})
				},
			},
			{
				Name:        "link:member_employee",
				Description: "Has link to member or employee entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
						return true, ev
					}
					return hasColumnLinkToTableLike(t, []string{"employee", "member"})
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()`.

**Step 3: Run tests, commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add domestic-relations-order concept"
```

---

### Task 8: Add benefit-payment Concept

**Files:**
- Modify: `connector/tagger/concepts.go`
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestBenefitPaymentTag(t *testing.T) {
	table := makeTable("BENEFIT_PAYMENT", []schema.ColumnInfo{
		pk("PAYMENT_ID"),
		col("MEMBER_ID", "integer"),
		col("EFF_DT", "date"),
		col("PAYMENT_TYPE", "varchar"),
		col("GROSS_MONTHLY", "numeric"),
		col("REDUCTION_PCT", "numeric"),
		col("NET_AFTER_DRO", "numeric"),
		col("DRO_DEDUCT", "numeric"),
		col("JS_FACTOR", "numeric"),
		col("IPR_AMT", "numeric"),
		col("FED_TAX_WHLD", "numeric"),
		col("STATE_TAX_WHLD", "numeric"),
		col("NET_PAYMENT", "numeric"),
		col("DEATH_BENEFIT_INST", "numeric"),
		col("STATUS", "varchar"),
		col("LAST_PAID_DT", "date"),
		col("CREATE_DT", "timestamp"),
		col("MODIFY_DT", "timestamp"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptBenefitPayment) {
		t.Errorf("expected benefit-payment tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Implement**

```go
func benefitPaymentConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptBenefitPayment,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:benefit_payment",
				Description: "Table name contains benefit_payment or pension_payment terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContainsButNot(t,
						[]string{"benefit_payment", "pension_payment"},
						[]string{"benefit_claim", "benefit_application"},
					)
				},
			},
			{
				Name:        "columns:payment_detail",
				Description: "Has payment type and gross/net payment columns",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"payment_type", "gross_monthly", "net_payment",
						"payment_amount", "monthly_benefit",
					})
					if len(matches) >= 2 {
						return true, fmt.Sprintf("payment columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "type_ratio:decimal",
				Description: "High ratio of decimal/numeric columns (financial payments)",
				Weight:      1.0,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					ratio := decimalColumnRatio(t)
					if ratio > 0.30 {
						return true, fmt.Sprintf("%.0f%% of columns are decimal/numeric", ratio*100)
					}
					return false, ""
				},
			},
			{
				Name:        "columns:last_paid",
				Description: "Has last paid or payment date column",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnMatching(t, []string{"last_paid", "payment_date", "paid_dt"})
				},
			},
			{
				Name:        "link:member_employee",
				Description: "Has link to member or employee entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
						return true, ev
					}
					return hasColumnLinkToTableLike(t, []string{"employee", "member"})
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()`.

**Step 3: Run tests, commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add benefit-payment concept"
```

---

### Task 9: Add case-management Concept

**Files:**
- Modify: `connector/tagger/concepts.go`
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestCaseManagementTag(t *testing.T) {
	table := makeTable("CASE_HIST", []schema.ColumnInfo{
		pk("CASE_ID"),
		col("MEMBER_ID", "integer"),
		col("CASE_TYPE", "varchar"),
		col("CASE_STATUS", "varchar"),
		col("PRIORITY", "smallint"),
		col("ASSIGNED_TO", "varchar"),
		col("OPEN_DT", "date"),
		col("TARGET_DT", "date"),
		col("CLOSE_DT", "date"),
		col("RESOLUTION", "text"),
		col("NOTES", "text"),
		col("CREATE_DT", "timestamp"),
		col("MODIFY_DT", "timestamp"),
		col("MODIFY_USER", "varchar"),
	}, []schema.ForeignKey{
		fk("MEMBER_ID", "MEMBER_MASTER", "MEMBER_ID"),
	})

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptCaseManagement) {
		t.Errorf("expected case-management tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Implement**

```go
func caseManagementConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptCaseManagement,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:case",
				Description: "Table name contains case/ticket/work_item terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContains(t, []string{"case", "ticket", "work_item"})
				},
			},
			{
				Name:        "columns:case_classification",
				Description: "Has case type and case status columns",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnPair(t,
						[]string{"case_type", "ticket_type", "request_type"},
						[]string{"case_status", "ticket_status", "request_status"},
					)
				},
			},
			{
				Name:        "columns:assignment",
				Description: "Has assignment and resolution columns",
				Weight:      1.0,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"assigned_to", "assignee", "resolution",
					})
					if len(matches) >= 1 {
						return true, fmt.Sprintf("case workflow columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "columns:case_dates",
				Description: "Has case lifecycle dates (open, close, target)",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					matches := columnsMatching(t, []string{
						"open_dt", "close_dt", "target_dt",
						"opened_date", "closed_date", "priority",
					})
					if len(matches) >= 2 {
						return true, fmt.Sprintf("case date columns: %v", matches)
					}
					return false, ""
				},
			},
			{
				Name:        "link:member_employee",
				Description: "Has link to member or employee entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					if found, ev := fkReferencesTableLike(t, []string{"employee", "member"}); found {
						return true, ev
					}
					return hasColumnLinkToTableLike(t, []string{"employee", "member"})
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()`.

**Step 3: Run tests, commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add case-management concept"
```

---

### Task 10: Add audit-trail Concept

**Files:**
- Modify: `connector/tagger/concepts.go`
- Modify: `connector/tagger/tagger_test.go`

**Step 1: Write test**

```go
func TestAuditTrailTag(t *testing.T) {
	table := makeTable("TRANSACTION_LOG", []schema.ColumnInfo{
		pk("LOG_ID"),
		col("TABLE_NAME", "varchar"),
		col("RECORD_ID", "integer"),
		col("MEMBER_ID", "integer"),
		col("ACTION", "varchar"),
		col("OLD_VALUES", "text"),
		col("NEW_VALUES", "text"),
		col("CHANGED_BY", "varchar"),
		col("CHANGED_DT", "timestamp"),
		col("APP_MODULE", "varchar"),
		col("SESSION_ID", "varchar"),
	}, nil)

	concepts := DefaultConcepts()
	tags, scores, _ := AssignTags(table, []schema.TableInfo{table}, concepts)

	if !hasTag(tags, ConceptAuditTrail) {
		t.Errorf("expected audit-trail tag, got tags=%v scores=%v", tags, scores)
	}
}
```

**Step 2: Implement**

```go
func auditTrailConcept() ConceptDef {
	return ConceptDef{
		Tag:       ConceptAuditTrail,
		Threshold: 3.0,
		Signals: []SignalDef{
			{
				Name:        "table_name:audit_log",
				Description: "Table name contains audit/transaction log terms",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return tableNameContains(t, []string{
						"transaction_log", "audit_log", "audit_trail",
						"change_log", "history_log",
					})
				},
			},
			{
				Name:        "columns:change_tracking",
				Description: "Has action/event type and old/new value columns",
				Weight:      1.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnPair(t,
						[]string{"action", "event_type", "operation"},
						[]string{"old_value", "new_value", "old_values", "new_values"},
					)
				},
			},
			{
				Name:        "columns:actor",
				Description: "Has changed_by/performed_by actor column",
				Weight:      1.0,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnMatching(t, []string{
						"changed_by", "performed_by", "modified_by", "updated_by",
					})
				},
			},
			{
				Name:        "columns:entity_reference",
				Description: "Has table_name/record_id columns referencing the changed entity",
				Weight:      0.5,
				Detect: func(t schema.TableInfo, _ []schema.TableInfo) (bool, string) {
					return hasColumnPair(t,
						[]string{"table_name", "entity_type", "object_type"},
						[]string{"record_id", "entity_id", "object_id"},
					)
				},
			},
		},
	}
}
```

Wire into `DefaultConcepts()`.

Note: audit-trail has NO `link:member_employee` signal because audit logs track all entities, not just members.

**Step 3: Run tests, commit**

```bash
git add connector/tagger/concepts.go connector/tagger/tagger_test.go
git commit -m "[tagger] Add audit-trail concept"
```

---

### Task 11: Run Full Test Suite + Regression Check

**Step 1: Run all tagger tests**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./tagger/ -v`
Expected: All tests PASS (16 existing + ~10 new = ~26 tests)

**Step 2: Run all connector tests (tagger + introspect + monitor + dashboard)**

Run: `cd C:\Users\jeffb\noui-connector-lab\connector && go test ./... -v`
Expected: All 74+ tests PASS

**Step 3: If any failures, fix and re-run**

---

### Task 12: E2E Validation Against DERP Database

**Prerequisite:** DERP PostgreSQL must be running on port 5432 (from noui-derp-poc docker compose).

**Step 1: Run the unified service against DERP database**

Run:
```bash
cd C:\Users\jeffb\noui-connector-lab\connector && go run ./service/ \
  --driver postgres \
  --dsn "postgres://derp:derp@127.0.0.1:5432/derp?sslmode=disable" \
  --db public \
  --port 8096
```

**Step 2: Verify schema/tags endpoint**

Run (in separate terminal):
```bash
curl -s http://localhost:8096/api/v1/schema/tags | python -m json.tool
```

Expected: 12 tables discovered, 9 tables tagged:
- MEMBER_MASTER → employee-master
- SALARY_HIST → salary-history
- EMPLOYMENT_HIST → employment-timeline
- BENEFICIARY → beneficiary-designation
- SVC_CREDIT → service-credit
- DRO_MASTER → domestic-relations-order
- BENEFIT_PAYMENT → benefit-payment
- CASE_HIST → case-management
- TRANSACTION_LOG → audit-trail
- DEPARTMENT_REF, POSITION_REF, CONTRIBUTION_HIST → verify no false tags

**Step 3: Stop the service (Ctrl+C)**

---

### Task 13: E2E Regression Against PostgreSQL HR Target

**Prerequisite:** PostgreSQL HR target must be running on port 5433.

**Step 1: Run service against HR target**

Run:
```bash
cd C:\Users\jeffb\noui-connector-lab\connector && go run ./service/ \
  --driver postgres \
  --dsn "postgres://hrlab:hrlab@127.0.0.1:5433/hrlab?sslmode=disable" \
  --db public \
  --port 8097
```

**Step 2: Verify schema/tags endpoint**

Run:
```bash
curl -s http://localhost:8097/api/v1/schema/tags | python -m json.tool
```

Expected: Same 6 HR concept tags as Session 10 (no regressions). Verify the original 12 tables still get the same tags they got before.

**Step 3: Stop the service (Ctrl+C)**

---

### Task 14: Update BUILD_HISTORY.md + Final Commit

**Step 1: Add session entry to BUILD_HISTORY.md**

Document:
- 6 new pension concepts added
- 3 existing HR concepts broadened for cross-domain
- Test counts (new total)
- E2E results against DERP and HR targets
- Cross-domain tagging verification results

**Step 2: Commit everything**

```bash
git add -A
git commit -m "[tagger] Add pension concepts, broaden HR cross-domain signals"
```

**Step 3: Push**

```bash
git push origin HEAD
```
