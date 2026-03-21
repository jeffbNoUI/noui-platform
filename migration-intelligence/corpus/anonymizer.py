"""k-Anonymity quantization functions for corpus de-identification."""


def quantize_null_rate(rate: float) -> float:
    """Round to nearest 0.05 for k-anonymity."""
    return round(rate * 20) / 20


def quantize_cardinality(cardinality: int, row_count: int) -> str:
    """Bucket into LOW/MEDIUM/HIGH/UNIQUE."""
    ratio = cardinality / max(row_count, 1)
    if ratio > 0.95:
        return "UNIQUE"
    if ratio > 0.5:
        return "HIGH"
    if ratio > 0.1:
        return "MEDIUM"
    return "LOW"


def categorize_data_type(data_type: str) -> str:
    """Normalize data types to broad categories."""
    dt = data_type.lower()
    if any(t in dt for t in ("int", "float", "decimal", "numeric", "real", "double", "money")):
        return "NUMERIC"
    if any(t in dt for t in ("date", "time", "timestamp")):
        return "DATE"
    if any(t in dt for t in ("bool",)):
        return "BOOLEAN"
    if any(t in dt for t in ("char", "text", "varchar", "string", "nvarchar")):
        return "TEXT"
    return "OTHER"
