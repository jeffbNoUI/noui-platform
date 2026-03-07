"""Load, sample, and filter compose scenarios from JSONL."""

from __future__ import annotations

import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from .schemas import Scenario


def load_scenarios(path: str | Path) -> list[Scenario]:
    """Load all scenarios from a JSONL file."""
    path = Path(path)
    scenarios = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if line:
                scenarios.append(Scenario.model_validate_json(line))
    return scenarios


def sample_scenarios(
    scenarios: list[Scenario],
    count: int,
    strategy: str = "stratified",
    seed: int = 42,
    failure_ids: set[str] | None = None,
) -> list[Scenario]:
    """Sample scenarios using the specified strategy.

    Strategies:
        stratified   - proportional sampling across strata
        random       - uniform random
        boundary-heavy - over-sample boundary strata (2x weight)
        failures-only  - only include scenarios from failure_ids
    """
    if count >= len(scenarios):
        return scenarios

    rng = random.Random(seed)

    if strategy == "random":
        return rng.sample(scenarios, count)

    if strategy == "failures-only":
        if not failure_ids:
            return scenarios[:count]
        failed = [s for s in scenarios if s.scenario_id in failure_ids]
        if len(failed) <= count:
            return failed
        return rng.sample(failed, count)

    if strategy == "boundary-heavy":
        return _sample_weighted(scenarios, count, rng, boundary_weight=2.0)

    # Default: stratified
    return _sample_stratified(scenarios, count, rng)


def _sample_stratified(
    scenarios: list[Scenario], count: int, rng: random.Random
) -> list[Scenario]:
    """Proportional stratified sampling."""
    by_stratum: dict[str, list[Scenario]] = defaultdict(list)
    for s in scenarios:
        by_stratum[s.stratum].append(s)

    total = len(scenarios)
    result: list[Scenario] = []

    # If count < number of strata, pick top strata by size
    if count < len(by_stratum):
        top_strata = sorted(by_stratum.keys(), key=lambda s: len(by_stratum[s]), reverse=True)[:count]
        for stratum in top_strata:
            result.append(rng.choice(by_stratum[stratum]))
        rng.shuffle(result)
        return result[:count]

    # Allocate proportionally, at least 1 per non-empty stratum
    allocations: dict[str, int] = {}
    for stratum, group in by_stratum.items():
        allocations[stratum] = max(1, round(count * len(group) / total))

    # Adjust to hit exact count
    allocated = sum(allocations.values())
    strata_sorted = sorted(allocations.keys(), key=lambda s: len(by_stratum[s]), reverse=True)
    idx = 0
    while allocated > count:
        s = strata_sorted[idx % len(strata_sorted)]
        if allocations[s] > 1:
            allocations[s] -= 1
            allocated -= 1
        idx += 1
    while allocated < count:
        s = strata_sorted[idx % len(strata_sorted)]
        if allocations[s] < len(by_stratum[s]):
            allocations[s] += 1
            allocated += 1
        idx += 1

    for stratum, n in allocations.items():
        group = by_stratum[stratum]
        n = min(n, len(group))
        result.extend(rng.sample(group, n))

    rng.shuffle(result)
    return result[:count]


def _sample_weighted(
    scenarios: list[Scenario],
    count: int,
    rng: random.Random,
    boundary_weight: float = 2.0,
) -> list[Scenario]:
    """Weighted sampling with higher weight for boundary strata."""
    weights = []
    for s in scenarios:
        w = boundary_weight if s.stratum.startswith("boundary") else 1.0
        weights.append(w)

    # Use weighted sampling without replacement
    indices = list(range(len(scenarios)))
    selected_indices: list[int] = []
    remaining_weights = list(weights)

    for _ in range(min(count, len(scenarios))):
        chosen = rng.choices(indices, weights=remaining_weights, k=1)[0]
        selected_indices.append(chosen)
        remaining_weights[chosen] = 0  # Remove from future selection

    return [scenarios[i] for i in selected_indices]


def get_stratum_distribution(scenarios: list[Scenario]) -> dict[str, int]:
    """Count scenarios per stratum."""
    return dict(Counter(s.stratum for s in scenarios))


def get_tier_status_distribution(scenarios: list[Scenario]) -> dict[str, int]:
    """Count scenarios per tier x status combination."""
    return dict(Counter(
        f"tier{s.member_profile.tier}_{s.member_profile.status.value}"
        for s in scenarios
    ))
