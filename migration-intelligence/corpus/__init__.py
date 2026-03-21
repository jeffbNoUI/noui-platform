"""Corpus abstraction — de-identified shared learning from analyst decisions."""

from .abstractor import CorpusEntry, FeatureAbstractor
from .anonymizer import categorize_data_type, quantize_cardinality, quantize_null_rate
from .store import AnalystDecision, DecisionStore

__all__ = [
    "AnalystDecision",
    "CorpusEntry",
    "DecisionStore",
    "FeatureAbstractor",
    "categorize_data_type",
    "quantize_cardinality",
    "quantize_null_rate",
]
