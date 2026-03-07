"""Failure analysis, few-shot selection, and prompt refinement."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from rich.console import Console
from rich.table import Table

from .config import PROMPT_VERSIONS_DIR
from .schemas import AggregateMetrics, ScenarioResult, Scenario, ALL_PANELS
from .prompts.few_shot_bank import (
    get_curated_examples,
    select_from_failures,
    save_few_shot_bank,
)
from .prompts.prompt_versions import save_prompt_version
from .prompts.system_prompt import build_system_prompt


# ---------------------------------------------------------------------------
# Failure analysis
# ---------------------------------------------------------------------------
class FailureAnalysis:
    """Analyzes failure patterns from evaluation results."""

    def __init__(self, results: list[ScenarioResult]):
        self.results = results
        self.failures = [r for r in results if not r.panels_exact_match or not r.alerts_exact_match]
        self.panel_failures = [r for r in results if not r.panels_exact_match]
        self.alert_failures = [r for r in results if not r.alerts_exact_match]

    @property
    def failure_rate(self) -> float:
        if not self.results:
            return 0.0
        return len(self.failures) / len(self.results)

    def top_error_types(self, n: int = 10) -> list[tuple[str, int]]:
        """Top N error types by frequency."""
        counts: Counter[str] = Counter()
        for r in self.failures:
            for et in r.error_types:
                counts[et] += 1
        return counts.most_common(n)

    def top_missing_panels(self, n: int = 10) -> list[tuple[str, int]]:
        """Most commonly missed panels."""
        counts: Counter[str] = Counter()
        for r in self.panel_failures:
            for p in r.missing_panels:
                counts[p] += 1
        return counts.most_common(n)

    def top_extra_panels(self, n: int = 10) -> list[tuple[str, int]]:
        """Most commonly over-predicted panels."""
        counts: Counter[str] = Counter()
        for r in self.panel_failures:
            for p in r.extra_panels:
                counts[p] += 1
        return counts.most_common(n)

    def top_missing_alerts(self, n: int = 10) -> list[tuple[str, int]]:
        """Most commonly missed alerts."""
        counts: Counter[str] = Counter()
        for r in self.alert_failures:
            for a in r.missing_alerts:
                counts[a] += 1
        return counts.most_common(n)

    def top_extra_alerts(self, n: int = 10) -> list[tuple[str, int]]:
        """Most commonly false-positive alerts."""
        counts: Counter[str] = Counter()
        for r in self.alert_failures:
            for a in r.extra_alerts:
                counts[a] += 1
        return counts.most_common(n)

    def failures_by_stratum(self) -> dict[str, int]:
        """Failure count by stratum."""
        counts: Counter[str] = Counter()
        for r in self.failures:
            counts[r.stratum] += 1
        return dict(counts.most_common())

    def unique_panel_configs(self) -> int:
        """Count unique panel configurations in failures."""
        configs = set()
        for r in self.failures:
            configs.add(tuple(sorted(r.expected.panels_shown)))
        return len(configs)

    def suggest_prompt_patches(self) -> list[dict]:
        """Generate prompt improvement suggestions based on failure patterns."""
        suggestions = []

        # View mode errors
        vm_errors = sum(1 for r in self.failures if "view_mode_error" in r.error_types)
        if vm_errors > 0:
            suggestions.append({
                "area": "View Mode Rules",
                "issue": f"{vm_errors} view mode errors",
                "suggestion": "Reinforce: ONLY contact_type determines view mode. "
                              "beneficiary/alternate_payee/external → crm, member → workspace.",
                "priority": "high",
            })

        # has_member errors
        hm_errors = sum(1 for r in self.failures if "has_member_error" in r.error_types)
        if hm_errors > 0:
            suggestions.append({
                "area": "has_member Derivation",
                "issue": f"{hm_errors} has_member errors",
                "suggestion": "Clarify: has_member = (contact_type == 'member') OR "
                              "(has_legacy_member_id == true). Either condition is sufficient.",
                "priority": "high",
            })

        # has_calculation errors
        hc_errors = sum(1 for r in self.failures if "has_calculation_error" in r.error_types)
        if hc_errors > 0:
            suggestions.append({
                "area": "has_calculation Derivation",
                "issue": f"{hc_errors} has_calculation errors",
                "suggestion": "Emphasize: has_calculation requires ALL of: has_member, vested, "
                              "AND status in (active, retired, deferred). Terminated members "
                              "NEVER have calculations.",
                "priority": "high",
            })

        # Panel dependency errors
        pd_errors = sum(1 for r in self.failures if "panel_dependency_error" in r.error_types)
        if pd_errors > 0:
            suggestions.append({
                "area": "Panel Dependencies",
                "issue": f"{pd_errors} dependency cascade errors",
                "suggestion": "Clarify dependency chain: case_journal visibility depends on "
                              "view_mode/open_conversations; ai_summary requires BOTH case_journal "
                              "visible AND employment_timeline visible; crm_note_form requires "
                              "case_journal visible.",
                "priority": "medium",
            })

        # Specific panel errors
        for panel, count in self.top_missing_panels(5):
            if count >= 3:
                suggestions.append({
                    "area": f"Panel: {panel}",
                    "issue": f"Missing in {count} scenarios",
                    "suggestion": f"Add emphasis or example for {panel} show condition.",
                    "priority": "medium",
                })

        for panel, count in self.top_extra_panels(5):
            if count >= 3:
                suggestions.append({
                    "area": f"Panel: {panel}",
                    "issue": f"False positive in {count} scenarios",
                    "suggestion": f"Tighten hide condition for {panel}.",
                    "priority": "medium",
                })

        # Alert errors
        for alert, count in self.top_missing_alerts(5):
            if count >= 3:
                suggestions.append({
                    "area": f"Alert: {alert}",
                    "issue": f"Missing in {count} scenarios",
                    "suggestion": f"Clarify trigger condition for {alert}.",
                    "priority": "low",
                })

        return suggestions


# ---------------------------------------------------------------------------
# Learning loop
# ---------------------------------------------------------------------------
def run_learning_loop(
    results: list[ScenarioResult],
    scenarios: list[Scenario],
    auto_apply: bool = False,
    console: Console | None = None,
) -> dict:
    """Analyze failures and produce refined prompt configuration.

    Returns dict with:
        - analysis: FailureAnalysis summary
        - few_shots: selected few-shot examples
        - suggestions: prompt patch suggestions
        - prompt_version_path: path if auto_apply saved a new version
    """
    console = console or Console()

    analysis = FailureAnalysis(results)

    console.print(f"\n[bold]Learning Loop Analysis[/bold]")
    console.print(f"Total scenarios: {len(results)}")
    console.print(f"Failures: {len(analysis.failures)} ({analysis.failure_rate:.1%})")
    console.print(f"Unique failing panel configs: {analysis.unique_panel_configs()}")

    # Print error types
    error_types = analysis.top_error_types()
    if error_types:
        err_table = Table(title="Top Error Types")
        err_table.add_column("Type", style="yellow")
        err_table.add_column("Count", justify="right")
        for et, count in error_types:
            err_table.add_row(et, str(count))
        console.print(err_table)

    # Print panel errors
    missing = analysis.top_missing_panels()
    extra = analysis.top_extra_panels()
    if missing or extra:
        panel_table = Table(title="Panel Errors")
        panel_table.add_column("Panel", style="cyan")
        panel_table.add_column("Missing", justify="right")
        panel_table.add_column("Extra", justify="right")
        missing_dict = dict(missing)
        extra_dict = dict(extra)
        all_panels = set(list(missing_dict.keys()) + list(extra_dict.keys()))
        for p in sorted(all_panels):
            panel_table.add_row(p, str(missing_dict.get(p, 0)), str(extra_dict.get(p, 0)))
        console.print(panel_table)

    # Print alert errors
    missing_alerts = analysis.top_missing_alerts()
    extra_alerts = analysis.top_extra_alerts()
    if missing_alerts or extra_alerts:
        alert_table = Table(title="Alert Errors")
        alert_table.add_column("Alert", style="cyan")
        alert_table.add_column("Missing", justify="right")
        alert_table.add_column("Extra", justify="right")
        ma_dict = dict(missing_alerts)
        ea_dict = dict(extra_alerts)
        all_alerts = set(list(ma_dict.keys()) + list(ea_dict.keys()))
        for a in sorted(all_alerts):
            alert_table.add_row(a, str(ma_dict.get(a, 0)), str(ea_dict.get(a, 0)))
        console.print(alert_table)

    # Select few-shot examples
    curated = get_curated_examples()
    auto_selected = select_from_failures(results, scenarios, max_examples=8)
    few_shots = curated + auto_selected

    console.print(f"\n[bold]Few-Shot Bank[/bold]")
    console.print(f"Curated: {len(curated)} | Auto-selected from failures: {len(auto_selected)} | Total: {len(few_shots)}")

    # Generate suggestions
    suggestions = analysis.suggest_prompt_patches()
    if suggestions:
        sug_table = Table(title="Prompt Improvement Suggestions")
        sug_table.add_column("Priority", style="bold")
        sug_table.add_column("Area")
        sug_table.add_column("Issue")
        sug_table.add_column("Suggestion", max_width=50)
        for s in suggestions:
            color = {"high": "red", "medium": "yellow", "low": "green"}.get(s["priority"], "white")
            sug_table.add_row(
                f"[{color}]{s['priority']}[/{color}]",
                s["area"], s["issue"], s["suggestion"],
            )
        console.print(sug_table)

    result = {
        "failure_count": len(analysis.failures),
        "failure_rate": analysis.failure_rate,
        "error_types": dict(error_types),
        "few_shot_count": len(few_shots),
        "suggestion_count": len(suggestions),
        "suggestions": suggestions,
        "few_shots": few_shots,
        "prompt_version_path": None,
    }

    # Auto-apply: save new prompt version with few-shots
    if auto_apply:
        system_prompt = build_system_prompt(few_shots)
        version_path = save_prompt_version(
            system_prompt=system_prompt,
            few_shots=few_shots,
            metadata={
                "failure_count": len(analysis.failures),
                "failure_rate": analysis.failure_rate,
                "auto_generated": True,
                "curated_examples": len(curated),
                "auto_selected_examples": len(auto_selected),
            },
        )
        # Also save the few-shot bank
        save_few_shot_bank(few_shots, PROMPT_VERSIONS_DIR / "few_shot_bank.json")

        console.print(f"\n[green]Saved new prompt version: {version_path.name}[/green]")
        result["prompt_version_path"] = str(version_path)

    return result
