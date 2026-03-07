"""Terminal (rich) and markdown report generation."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from rich.console import Console
from rich.panel import Panel as RichPanel
from rich.table import Table

from .config import QUALITY_GATES, REPORTS_DIR, RESULTS_DIR
from .schemas import AggregateMetrics, ScenarioResult
from .evaluator import (
    aggregate_by_group,
    aggregate_results,
    by_stratum,
    by_tier,
    by_status,
)


# ---------------------------------------------------------------------------
# Results persistence
# ---------------------------------------------------------------------------
def save_results(
    results: list[ScenarioResult],
    metrics: AggregateMetrics,
    run_meta: dict,
    results_dir: Path | None = None,
) -> Path:
    """Save run results to a JSON file."""
    results_dir = results_dir or RESULTS_DIR
    results_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = results_dir / f"run_{ts}.json"

    data = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_meta": run_meta,
        "aggregate_metrics": metrics.model_dump(),
        "results": [r.model_dump() for r in results],
    }

    with path.open("w") as f:
        json.dump(data, f, indent=2, default=str)

    # Update latest
    latest = results_dir / "latest.json"
    with latest.open("w") as f:
        json.dump(data, f, indent=2, default=str)

    return path


def load_results(path: Path) -> tuple[list[ScenarioResult], AggregateMetrics, dict]:
    """Load results from a JSON file."""
    with path.open() as f:
        data = json.load(f)

    results = [ScenarioResult.model_validate(r) for r in data["results"]]
    metrics = AggregateMetrics.model_validate(data["aggregate_metrics"])
    run_meta = data.get("run_meta", {})
    return results, metrics, run_meta


# ---------------------------------------------------------------------------
# Terminal report (rich)
# ---------------------------------------------------------------------------
def print_terminal_report(
    results: list[ScenarioResult],
    metrics: AggregateMetrics,
    run_meta: dict | None = None,
    quality_gate: str = "pre-production",
    compare_metrics: AggregateMetrics | None = None,
    console: Console | None = None,
):
    """Print a rich terminal report."""
    console = console or Console()

    gate = QUALITY_GATES.get(quality_gate, QUALITY_GATES["pre-production"])
    run_meta = run_meta or {}

    # Header
    console.print()
    console.print(RichPanel.fit(
        f"[bold]Compose-Sim Report[/bold]\n"
        f"Model: {run_meta.get('model', '?')} | "
        f"Scenarios: {metrics.total_scenarios} | "
        f"Gate: {gate.phase}",
        border_style="blue",
    ))

    # Overall accuracy table
    table = Table(title="Overall Accuracy", show_header=True)
    table.add_column("Metric", style="cyan")
    table.add_column("Value", justify="right")
    table.add_column("Threshold", justify="right")
    table.add_column("Status", justify="center")
    if compare_metrics:
        table.add_column("Delta", justify="right")

    def _gate_row(label, value, threshold, compare_val=None):
        status = "[green]PASS[/green]" if value >= threshold else "[red]FAIL[/red]"
        row = [label, f"{value:.1%}", f"{threshold:.0%}", status]
        if compare_metrics:
            if compare_val is not None:
                delta = value - compare_val
                color = "green" if delta >= 0 else "red"
                row.append(f"[{color}]{delta:+.1%}[/{color}]")
            else:
                row.append("-")
        table.add_row(*row)

    _gate_row("View Mode", metrics.view_mode_accuracy, gate.view_mode,
              compare_metrics.view_mode_accuracy if compare_metrics else None)
    _gate_row("Panels (exact)", metrics.panels_exact_accuracy, gate.panels_exact,
              compare_metrics.panels_exact_accuracy if compare_metrics else None)
    _gate_row("Alerts (exact)", metrics.alerts_exact_accuracy, gate.alerts_exact,
              compare_metrics.alerts_exact_accuracy if compare_metrics else None)

    console.print(table)

    # Detail metrics
    detail = Table(title="Detail Metrics", show_header=True)
    detail.add_column("Metric", style="cyan")
    detail.add_column("Value", justify="right")
    detail.add_row("Panels Jaccard", f"{metrics.panels_mean_jaccard:.4f}")
    detail.add_row("Panels Precision", f"{metrics.panels_mean_precision:.4f}")
    detail.add_row("Panels Recall", f"{metrics.panels_mean_recall:.4f}")
    detail.add_row("Alerts Jaccard", f"{metrics.alerts_mean_jaccard:.4f}")
    detail.add_row("Alerts Precision", f"{metrics.alerts_mean_precision:.4f}")
    detail.add_row("Alerts Recall", f"{metrics.alerts_mean_recall:.4f}")
    detail.add_row("Fetches (exact)", f"{metrics.fetches_exact_accuracy:.1%}")
    detail.add_row("Fetches Jaccard", f"{metrics.fetches_mean_jaccard:.4f}")
    detail.add_row("Composite Score", f"{metrics.mean_composite_score:.4f}")
    if metrics.api_errors:
        detail.add_row("[red]API Errors[/red]", f"[red]{metrics.api_errors}[/red]")
    console.print(detail)

    # Error type breakdown
    if metrics.error_type_counts:
        err_table = Table(title="Error Type Breakdown", show_header=True)
        err_table.add_column("Error Type", style="yellow")
        err_table.add_column("Count", justify="right")
        err_table.add_column("Rate", justify="right")
        for et, count in sorted(metrics.error_type_counts.items(), key=lambda x: -x[1]):
            rate = count / metrics.total_scenarios
            err_table.add_row(et, str(count), f"{rate:.1%}")
        console.print(err_table)

    # Per-tier breakdown
    tier_metrics = aggregate_by_group(results, by_tier)
    if tier_metrics:
        tier_table = Table(title="By Tier", show_header=True)
        tier_table.add_column("Tier", style="cyan")
        tier_table.add_column("Count", justify="right")
        tier_table.add_column("Panels", justify="right")
        tier_table.add_column("Alerts", justify="right")
        tier_table.add_column("View Mode", justify="right")
        for tier, m in tier_metrics.items():
            tier_table.add_row(
                tier, str(m.total_scenarios),
                f"{m.panels_exact_accuracy:.1%}",
                f"{m.alerts_exact_accuracy:.1%}",
                f"{m.view_mode_accuracy:.1%}",
            )
        console.print(tier_table)

    # Per-status breakdown
    status_metrics = aggregate_by_group(results, by_status)
    if status_metrics:
        status_table = Table(title="By Status", show_header=True)
        status_table.add_column("Status", style="cyan")
        status_table.add_column("Count", justify="right")
        status_table.add_column("Panels", justify="right")
        status_table.add_column("Alerts", justify="right")
        for status, m in status_metrics.items():
            status_table.add_row(
                status, str(m.total_scenarios),
                f"{m.panels_exact_accuracy:.1%}",
                f"{m.alerts_exact_accuracy:.1%}",
            )
        console.print(status_table)

    # Top failures
    failures = [r for r in results if not r.panels_exact_match or not r.alerts_exact_match]
    if failures:
        console.print(f"\n[bold]Top Failures[/bold] ({len(failures)} total)")
        top = sorted(failures, key=lambda r: r.composite_score)[:10]
        fail_table = Table(show_header=True)
        fail_table.add_column("ID")
        fail_table.add_column("Stratum")
        fail_table.add_column("Score", justify="right")
        fail_table.add_column("Missing Panels")
        fail_table.add_column("Extra Panels")
        fail_table.add_column("Missing Alerts")
        fail_table.add_column("Extra Alerts")
        for r in top:
            fail_table.add_row(
                r.scenario_id, r.stratum, f"{r.composite_score:.3f}",
                ", ".join(r.missing_panels) or "-",
                ", ".join(r.extra_panels) or "-",
                ", ".join(r.missing_alerts) or "-",
                ", ".join(r.extra_alerts) or "-",
            )
        console.print(fail_table)

    # Quality gate verdict
    passes = (
        metrics.view_mode_accuracy >= gate.view_mode
        and metrics.panels_exact_accuracy >= gate.panels_exact
        and metrics.alerts_exact_accuracy >= gate.alerts_exact
    )
    if passes:
        console.print(f"\n[bold green]QUALITY GATE PASSED ({gate.phase})[/bold green]")
    else:
        console.print(f"\n[bold red]QUALITY GATE FAILED ({gate.phase})[/bold red]")

    console.print()


# ---------------------------------------------------------------------------
# Markdown report
# ---------------------------------------------------------------------------
def generate_markdown_report(
    results: list[ScenarioResult],
    metrics: AggregateMetrics,
    run_meta: dict | None = None,
    quality_gate: str = "pre-production",
    compare_metrics: AggregateMetrics | None = None,
    reports_dir: Path | None = None,
) -> Path:
    """Generate a markdown report and save to reports directory."""
    reports_dir = reports_dir or REPORTS_DIR
    reports_dir.mkdir(parents=True, exist_ok=True)

    gate = QUALITY_GATES.get(quality_gate, QUALITY_GATES["pre-production"])
    run_meta = run_meta or {}

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    path = reports_dir / f"report_{ts}.md"

    lines = []
    lines.append(f"# Compose-Sim Report — {ts}")
    lines.append("")
    lines.append(f"- **Model**: {run_meta.get('model', '?')}")
    lines.append(f"- **Scenarios**: {metrics.total_scenarios}")
    lines.append(f"- **Quality Gate**: {gate.phase}")
    lines.append(f"- **Prompt Version**: {run_meta.get('prompt_version', 'N/A')}")
    lines.append("")

    # Overall accuracy
    lines.append("## Overall Accuracy")
    lines.append("")
    lines.append("| Metric | Value | Threshold | Status |")
    lines.append("|--------|-------|-----------|--------|")

    def _md_row(label, value, threshold):
        status = "PASS" if value >= threshold else "**FAIL**"
        return f"| {label} | {value:.1%} | {threshold:.0%} | {status} |"

    lines.append(_md_row("View Mode", metrics.view_mode_accuracy, gate.view_mode))
    lines.append(_md_row("Panels (exact)", metrics.panels_exact_accuracy, gate.panels_exact))
    lines.append(_md_row("Alerts (exact)", metrics.alerts_exact_accuracy, gate.alerts_exact))
    lines.append("")

    # Detail metrics
    lines.append("## Detail Metrics")
    lines.append("")
    lines.append("| Metric | Value |")
    lines.append("|--------|-------|")
    lines.append(f"| Panels Jaccard | {metrics.panels_mean_jaccard:.4f} |")
    lines.append(f"| Panels Precision | {metrics.panels_mean_precision:.4f} |")
    lines.append(f"| Panels Recall | {metrics.panels_mean_recall:.4f} |")
    lines.append(f"| Alerts Jaccard | {metrics.alerts_mean_jaccard:.4f} |")
    lines.append(f"| Alerts Precision | {metrics.alerts_mean_precision:.4f} |")
    lines.append(f"| Alerts Recall | {metrics.alerts_mean_recall:.4f} |")
    lines.append(f"| Fetches (exact) | {metrics.fetches_exact_accuracy:.1%} |")
    lines.append(f"| Composite Score | {metrics.mean_composite_score:.4f} |")
    if metrics.api_errors:
        lines.append(f"| API Errors | {metrics.api_errors} |")
    lines.append("")

    # Comparison delta
    if compare_metrics:
        lines.append("## Delta vs Previous Run")
        lines.append("")
        lines.append("| Metric | Current | Previous | Delta |")
        lines.append("|--------|---------|----------|-------|")
        for label, curr, prev in [
            ("Panels (exact)", metrics.panels_exact_accuracy, compare_metrics.panels_exact_accuracy),
            ("Alerts (exact)", metrics.alerts_exact_accuracy, compare_metrics.alerts_exact_accuracy),
            ("View Mode", metrics.view_mode_accuracy, compare_metrics.view_mode_accuracy),
            ("Composite", metrics.mean_composite_score, compare_metrics.mean_composite_score),
        ]:
            delta = curr - prev
            lines.append(f"| {label} | {curr:.1%} | {prev:.1%} | {delta:+.1%} |")
        lines.append("")

    # Error breakdown
    if metrics.error_type_counts:
        lines.append("## Error Breakdown")
        lines.append("")
        lines.append("| Error Type | Count | Rate |")
        lines.append("|------------|-------|------|")
        for et, count in sorted(metrics.error_type_counts.items(), key=lambda x: -x[1]):
            rate = count / metrics.total_scenarios
            lines.append(f"| {et} | {count} | {rate:.1%} |")
        lines.append("")

    # Per-tier
    tier_metrics = aggregate_by_group(results, by_tier)
    if tier_metrics:
        lines.append("## By Tier")
        lines.append("")
        lines.append("| Tier | Count | Panels | Alerts | View Mode |")
        lines.append("|------|-------|--------|--------|-----------|")
        for tier, m in tier_metrics.items():
            lines.append(
                f"| {tier} | {m.total_scenarios} | "
                f"{m.panels_exact_accuracy:.1%} | {m.alerts_exact_accuracy:.1%} | "
                f"{m.view_mode_accuracy:.1%} |"
            )
        lines.append("")

    # Top failures
    failures = [r for r in results if not r.panels_exact_match or not r.alerts_exact_match]
    if failures:
        top = sorted(failures, key=lambda r: r.composite_score)[:20]
        lines.append(f"## Top Failures ({len(failures)} total)")
        lines.append("")
        for r in top:
            lines.append(f"### {r.scenario_id} ({r.stratum})")
            lines.append(f"- Composite: {r.composite_score:.3f}")
            if r.missing_panels:
                lines.append(f"- Missing panels: {', '.join(r.missing_panels)}")
            if r.extra_panels:
                lines.append(f"- Extra panels: {', '.join(r.extra_panels)}")
            if r.missing_alerts:
                lines.append(f"- Missing alerts: {', '.join(r.missing_alerts)}")
            if r.extra_alerts:
                lines.append(f"- Extra alerts: {', '.join(r.extra_alerts)}")
            if r.error_types:
                lines.append(f"- Error types: {', '.join(r.error_types)}")
            lines.append("")

    # Quality gate verdict
    passes = (
        metrics.view_mode_accuracy >= gate.view_mode
        and metrics.panels_exact_accuracy >= gate.panels_exact
        and metrics.alerts_exact_accuracy >= gate.alerts_exact
    )
    verdict = "PASSED" if passes else "FAILED"
    lines.append(f"## Quality Gate: **{verdict}** ({gate.phase})")
    lines.append("")

    content = "\n".join(lines)
    with path.open("w") as f:
        f.write(content)

    return path
