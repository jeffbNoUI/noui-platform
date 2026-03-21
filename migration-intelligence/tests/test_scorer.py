import pytest
from scorer.signal import (
    name_similarity, type_compatibility, null_rate_signal,
    cardinality_signal, composite_score, score_column, CANONICAL_COLUMNS,
)


class TestNameSimilarity:
    def test_exact_match(self):
        assert name_similarity("birth_date", "birth_date") >= 0.95

    def test_case_insensitive(self):
        assert name_similarity("BIRTH_DATE", "birth_date") >= 0.95

    def test_abbreviation(self):
        s = name_similarity("birth_dt", "birth_date")
        assert 0.5 <= s <= 0.95

    def test_unrelated(self):
        assert name_similarity("xyz_abc", "birth_date") < 0.4

    def test_different_name_same_concept(self):
        # "ssn" vs "national_id" -- low similarity (name-based only)
        assert name_similarity("ssn", "national_id") < 0.5


class TestTypeCompatibility:
    def test_same_family(self):
        assert type_compatibility("integer", "INTEGER") >= 0.9

    def test_decimal_match(self):
        assert type_compatibility("decimal(10,2)", "DECIMAL") >= 0.9

    def test_varchar_text(self):
        assert type_compatibility("text", "VARCHAR") >= 0.9

    def test_cross_family(self):
        assert type_compatibility("varchar(50)", "DATE") < 0.5

    def test_integer_decimal(self):
        score = type_compatibility("integer", "DECIMAL")
        assert 0.5 <= score <= 0.8  # compatible but not ideal

    def test_uuid_match(self):
        assert type_compatibility("uuid", "UUID") >= 0.9


class TestNullRateSignal:
    def test_low_nulls_required(self):
        assert null_rate_signal(0.0, True) >= 0.9

    def test_high_nulls_required(self):
        assert null_rate_signal(0.5, True) < 0.5

    def test_nulls_optional(self):
        assert null_rate_signal(0.5, False) >= 0.7


class TestCardinalitySignal:
    def test_high_cardinality_integer(self):
        assert cardinality_signal(490, 500, "INTEGER") >= 0.9

    def test_low_cardinality_integer(self):
        assert cardinality_signal(5, 500, "INTEGER") < 0.5

    def test_zero_rows(self):
        assert cardinality_signal(0, 0, "INTEGER") == 0.5

    def test_date_medium_cardinality(self):
        assert cardinality_signal(100, 500, "DATE") >= 0.8

    def test_decimal_high_cardinality(self):
        assert cardinality_signal(400, 500, "DECIMAL") >= 0.8


class TestCompositeScore:
    def test_all_high(self):
        signals = {
            "name_similarity": 0.95,
            "type_compatibility": 1.0,
            "null_rate": 1.0,
            "cardinality": 0.9,
            "corpus_match": 0.0,
        }
        score = composite_score(signals)
        assert score > 0.7

    def test_all_low(self):
        signals = {
            "name_similarity": 0.1,
            "type_compatibility": 0.1,
            "null_rate": 0.2,
            "cardinality": 0.3,
            "corpus_match": 0.0,
        }
        score = composite_score(signals)
        assert score < 0.3

    def test_empty_signals(self):
        assert composite_score({}) == 0.0


class TestScoreColumn:
    def test_prism_birth_dt(self):
        """PRISM BIRTH_DT should score high against canonical birth_date"""
        info = CANONICAL_COLUMNS["employee-master"]["birth_date"]
        score, signals = score_column(
            "BIRTH_DT", "varchar(10)", 0.0, 450, 500,
            "birth_date", info,
        )
        assert score > 0.6
        assert signals["name_similarity"] > 0.5

    def test_pas_birth_date(self):
        """PAS birth_date should score very high (pattern match)"""
        info = CANONICAL_COLUMNS["employee-master"]["birth_date"]
        score, signals = score_column(
            "birth_date", "date", 0.0, 450, 500,
            "birth_date", info,
        )
        assert score > 0.80  # corpus_match=0 drags composite down; 0.82 expected
        assert signals["name_similarity"] >= 0.95  # pattern match

    def test_unrelated_column(self):
        """Random column should score low against birth_date"""
        info = CANONICAL_COLUMNS["employee-master"]["birth_date"]
        score, _ = score_column(
            "account_balance", "decimal(10,2)", 0.02, 300, 500,
            "birth_date", info,
        )
        assert score < 0.4

    def test_salary_amount_scores_for_gross(self):
        """salary_amount should match to gross_amount via pattern"""
        info = CANONICAL_COLUMNS["salary-history"]["gross_amount"]
        score, signals = score_column(
            "salary_amount", "decimal(10,2)", 0.0, 490, 500,
            "gross_amount", info,
        )
        assert score > 0.7
        assert signals["name_similarity"] >= 0.95  # in expected_names

    def test_ssn_matches_national_id_via_pattern(self):
        """ssn should match national_id through expected_names pattern"""
        info = CANONICAL_COLUMNS["employee-master"]["national_id"]
        score, signals = score_column(
            "ssn", "varchar(11)", 0.01, 498, 500,
            "national_id", info,
        )
        assert score > 0.7
        assert signals["name_similarity"] >= 0.95  # pattern match

    def test_member_id_integer(self):
        """member_id with integer type should score very high"""
        info = CANONICAL_COLUMNS["employee-master"]["member_id"]
        score, signals = score_column(
            "mbr_nbr", "integer", 0.0, 500, 500,
            "member_id", info,
        )
        assert score > 0.8
        assert signals["name_similarity"] >= 0.95  # in expected_names
        assert signals["type_compatibility"] >= 0.9


class TestCanonicalColumns:
    def test_all_concepts_have_member_id(self):
        """Every concept should have a member_id canonical column"""
        for concept, columns in CANONICAL_COLUMNS.items():
            assert "member_id" in columns, f"{concept} missing member_id"

    def test_employee_master_has_required_columns(self):
        em = CANONICAL_COLUMNS["employee-master"]
        required = ["member_id", "national_id", "birth_date", "first_name", "last_name"]
        for col in required:
            assert col in em, f"employee-master missing {col}"

    def test_salary_history_has_amounts(self):
        sh = CANONICAL_COLUMNS["salary-history"]
        assert "gross_amount" in sh
        assert "pensionable_amount" in sh
