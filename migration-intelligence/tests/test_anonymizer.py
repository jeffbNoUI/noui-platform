"""Tests for k-anonymity quantization functions."""

import pytest
from corpus.anonymizer import categorize_data_type, quantize_cardinality, quantize_null_rate


class TestQuantizeNullRate:
    """test_quantize_null_rate_boundaries"""

    def test_zero(self):
        assert quantize_null_rate(0.0) == 0.0

    def test_small_rounds_down(self):
        assert quantize_null_rate(0.01) == 0.0

    def test_midpoint_rounds_to_even(self):
        # Python uses banker's rounding: 0.025 * 20 = 0.5, rounds to 0 (even)
        assert quantize_null_rate(0.025) == 0.0

    def test_just_above_boundary(self):
        assert quantize_null_rate(0.03) == 0.05

    def test_half(self):
        assert quantize_null_rate(0.5) == 0.5

    def test_one(self):
        assert quantize_null_rate(1.0) == 1.0


class TestQuantizeCardinality:
    """test_quantize_cardinality_*"""

    def test_unique(self):
        # ratio > 0.95 -> UNIQUE
        assert quantize_cardinality(960, 1000) == "UNIQUE"
        assert quantize_cardinality(100, 100) == "UNIQUE"

    def test_high(self):
        # ratio 0.51-0.95 -> HIGH
        assert quantize_cardinality(510, 1000) == "HIGH"
        assert quantize_cardinality(950, 1000) == "HIGH"

    def test_medium(self):
        # ratio 0.11-0.50 -> MEDIUM
        assert quantize_cardinality(120, 1000) == "MEDIUM"
        assert quantize_cardinality(500, 1000) == "MEDIUM"

    def test_low(self):
        # ratio <= 0.10 -> LOW
        assert quantize_cardinality(100, 1000) == "LOW"
        assert quantize_cardinality(10, 1000) == "LOW"
        assert quantize_cardinality(0, 1000) == "LOW"

    def test_zero_rows(self):
        # 0 rows -> LOW (no division by zero)
        assert quantize_cardinality(0, 0) == "LOW"
        assert quantize_cardinality(5, 0) == "UNIQUE"  # 5/1 > 0.95


class TestCategorizeDataType:
    """test_categorize_data_type"""

    def test_varchar_is_text(self):
        assert categorize_data_type("varchar(255)") == "TEXT"

    def test_nvarchar_is_text(self):
        assert categorize_data_type("nvarchar(100)") == "TEXT"

    def test_text_is_text(self):
        assert categorize_data_type("text") == "TEXT"

    def test_char_is_text(self):
        assert categorize_data_type("char(10)") == "TEXT"

    def test_integer_is_numeric(self):
        assert categorize_data_type("integer") == "NUMERIC"

    def test_float_is_numeric(self):
        assert categorize_data_type("float") == "NUMERIC"

    def test_decimal_is_numeric(self):
        assert categorize_data_type("decimal(10,2)") == "NUMERIC"

    def test_money_is_numeric(self):
        assert categorize_data_type("money") == "NUMERIC"

    def test_timestamp_is_date(self):
        assert categorize_data_type("timestamp") == "DATE"

    def test_datetime_is_date(self):
        assert categorize_data_type("datetime") == "DATE"

    def test_date_is_date(self):
        assert categorize_data_type("date") == "DATE"

    def test_boolean_is_boolean(self):
        assert categorize_data_type("boolean") == "BOOLEAN"

    def test_bool_is_boolean(self):
        assert categorize_data_type("bool") == "BOOLEAN"

    def test_blob_is_other(self):
        assert categorize_data_type("blob") == "OTHER"

    def test_unknown_is_other(self):
        assert categorize_data_type("xml") == "OTHER"
