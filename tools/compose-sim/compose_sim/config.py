"""Configuration for compose-sim."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = PROJECT_ROOT.parent

SCENARIOS_PATH = REPO_ROOT / "database" / "seed" / "compose-scenarios.jsonl"
RESULTS_DIR = PROJECT_ROOT / "results"
REPORTS_DIR = PROJECT_ROOT / "reports"
CACHE_DIR = PROJECT_ROOT / "cache"
PROMPT_VERSIONS_DIR = PROJECT_ROOT / "prompt_versions"


# ---------------------------------------------------------------------------
# Model defaults
# ---------------------------------------------------------------------------
DEFAULT_MODEL = "claude-sonnet-4-6"
HAIKU_MODEL = "claude-haiku-4-5-20251001"

# Concurrency
DEFAULT_CONCURRENCY = 3
MAX_CONCURRENCY = 25

# Cost per scenario estimates (USD, with prompt caching)
COST_ESTIMATES = {
    "claude-sonnet-4-6": 0.012,
    "claude-haiku-4-5-20251001": 0.003,
    # Legacy model IDs (still accepted by API)
    "claude-sonnet-4-20250514": 0.012,
    "claude-haiku-4-5-20241022": 0.003,
}


# ---------------------------------------------------------------------------
# Quality thresholds
# ---------------------------------------------------------------------------
@dataclass
class QualityGate:
    panels_exact: float = 0.95
    alerts_exact: float = 0.90
    view_mode: float = 0.99
    phase: str = "pre-production"


QUALITY_GATES = {
    "initial": QualityGate(panels_exact=0.80, alerts_exact=0.70, view_mode=0.95, phase="initial"),
    "stabilization": QualityGate(panels_exact=0.90, alerts_exact=0.85, view_mode=0.98, phase="stabilization"),
    "pre-production": QualityGate(panels_exact=0.95, alerts_exact=0.90, view_mode=0.99, phase="pre-production"),
}


# ---------------------------------------------------------------------------
# Run config
# ---------------------------------------------------------------------------
@dataclass
class RunConfig:
    model: str = DEFAULT_MODEL
    concurrency: int = DEFAULT_CONCURRENCY
    count: int = 10
    sample_strategy: str = "stratified"
    scenarios_path: str = ""
    api_key: str = ""
    quality_gate: str = "pre-production"
    prompt_version: str | None = None
    cache_responses: bool = True
    few_shot_count: int = 0

    def __post_init__(self):
        if not self.scenarios_path:
            self.scenarios_path = str(SCENARIOS_PATH)
        if not self.api_key:
            self.api_key = os.environ.get("ANTHROPIC_API_KEY", "")
