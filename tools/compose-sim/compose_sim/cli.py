"""Click CLI: run, report, learn commands."""

from __future__ import annotations

import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from .config import (
    DEFAULT_MODEL,
    HAIKU_MODEL,
    RESULTS_DIR,
    RunConfig,
    SCENARIOS_PATH,
)

console = Console()


@click.group()
@click.version_option(package_name="compose-sim")
def cli():
    """AI Composition Simulation Framework.

    Evaluate and refine LLM-driven UI composition against ground truth scenarios.
    """
    pass


# ---------------------------------------------------------------------------
# run
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--count", "-n", default=10, help="Number of scenarios to evaluate.")
@click.option("--model", "-m", default=DEFAULT_MODEL, help="Claude model to use.")
@click.option(
    "--sample-strategy", "-s",
    type=click.Choice(["stratified", "random", "boundary-heavy", "failures-only"]),
    default="stratified",
    help="Sampling strategy.",
)
@click.option("--scenarios", type=click.Path(exists=True), default=None, help="Path to scenarios JSONL.")
@click.option("--concurrency", "-c", default=10, help="Max concurrent API calls.")
@click.option("--cost-estimate", is_flag=True, help="Show cost estimate without calling API.")
@click.option("--quality-gate", default="pre-production", type=click.Choice(["initial", "stabilization", "pre-production"]))
@click.option("--prompt-version", default=None, help="Prompt version ID to use.")
@click.option("--no-cache", is_flag=True, help="Disable response cache.")
@click.option("--seed", default=42, help="Random seed for sampling.")
def run(count, model, sample_strategy, scenarios, concurrency, cost_estimate, quality_gate, prompt_version, no_cache, seed):
    """Run composition evaluation against Claude API."""
    from .scenarios import load_scenarios, sample_scenarios
    from .composer import Composer
    from .evaluator import evaluate_scenario, evaluate_error_result, aggregate_results
    from .reporter import save_results, print_terminal_report
    from .prompts.few_shot_bank import load_few_shot_bank
    from .prompts.prompt_versions import load_prompt_version

    scenarios_path = scenarios or str(SCENARIOS_PATH)

    console.print(f"[bold]Loading scenarios from {scenarios_path}...[/bold]")
    all_scenarios = load_scenarios(scenarios_path)
    console.print(f"Loaded {len(all_scenarios)} scenarios")

    sampled = sample_scenarios(all_scenarios, count, strategy=sample_strategy, seed=seed)
    console.print(f"Sampled {len(sampled)} scenarios (strategy: {sample_strategy})")

    # Load few-shots from prompt version or bank
    few_shots = []
    if prompt_version:
        try:
            pv = load_prompt_version(prompt_version)
            few_shots = pv.get("few_shots", [])
            console.print(f"Using prompt version: {pv.get('version_id', '?')} ({len(few_shots)} few-shots)")
        except FileNotFoundError:
            console.print(f"[yellow]Prompt version '{prompt_version}' not found, using base prompt[/yellow]")
    else:
        from .config import PROMPT_VERSIONS_DIR
        bank_path = PROMPT_VERSIONS_DIR / "few_shot_bank.json"
        few_shots = load_few_shot_bank(bank_path)
        if few_shots:
            console.print(f"Loaded {len(few_shots)} few-shot examples from bank")

    # Cost estimate
    config = RunConfig(
        model=model,
        concurrency=concurrency,
        count=len(sampled),
        sample_strategy=sample_strategy,
        scenarios_path=scenarios_path,
        quality_gate=quality_gate,
        prompt_version=prompt_version,
        cache_responses=not no_cache,
        few_shot_count=len(few_shots),
    )

    composer = Composer(
        api_key=config.api_key,
        model=model,
        concurrency=concurrency,
        few_shots=few_shots if few_shots else None,
        cache_responses=not no_cache,
    )

    estimate = composer.estimate_cost(len(sampled))
    console.print(f"\n[dim]Cost estimate: ${estimate['total_usd']:.2f} "
                  f"(${estimate['per_scenario_usd']:.3f}/scenario, {estimate['model']})[/dim]")

    if cost_estimate:
        console.print("\n[yellow]--cost-estimate flag set. Exiting without API calls.[/yellow]")
        return

    if not config.api_key:
        console.print("[red]Error: ANTHROPIC_API_KEY not set. Export it or pass via env.[/red]")
        sys.exit(1)

    # Run evaluation
    console.print(f"\n[bold]Running {len(sampled)} scenarios against {model}...[/bold]")

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TaskProgressColumn(),
        console=console,
    ) as progress:
        task = progress.add_task("Composing...", total=len(sampled))

        def on_progress(completed, total):
            progress.update(task, completed=completed)

        batch_results = asyncio.run(composer.compose_batch(sampled, progress_callback=on_progress))

    # Evaluate
    scenario_results: list = []
    for scenario, result, error in batch_results:
        if error:
            scenario_results.append(evaluate_error_result(scenario, error))
        else:
            scenario_results.append(evaluate_scenario(scenario, result))

    metrics = aggregate_results(scenario_results)

    # Save results
    stats = composer.get_stats()
    run_meta = {
        "model": model,
        "count": len(sampled),
        "sample_strategy": sample_strategy,
        "quality_gate": quality_gate,
        "prompt_version": prompt_version,
        "few_shot_count": len(few_shots),
        "seed": seed,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        **stats,
    }

    results_path = save_results(scenario_results, metrics, run_meta)
    console.print(f"\n[green]Results saved to {results_path}[/green]")

    # Print terminal report
    print_terminal_report(scenario_results, metrics, run_meta, quality_gate)

    # Stats summary
    console.print(f"[dim]API calls: {stats['api_calls']} | "
                  f"Cache hits: {stats['cache_hits']} | "
                  f"Errors: {stats['api_errors']} | "
                  f"Tokens: {stats['total_input_tokens']:,} in / {stats['total_output_tokens']:,} out[/dim]")


# ---------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--results", "-r", type=click.Path(exists=True), default=None, help="Path to results JSON.")
@click.option("--compare", type=click.Path(exists=True), default=None, help="Previous results for delta comparison.")
@click.option("--quality-gate", default="pre-production", type=click.Choice(["initial", "stabilization", "pre-production"]))
@click.option("--markdown", is_flag=True, help="Also generate markdown report.")
def report(results, compare, quality_gate, markdown):
    """Generate a report from run results."""
    from .reporter import load_results, print_terminal_report, generate_markdown_report

    # Default to latest
    results_path = Path(results) if results else RESULTS_DIR / "latest.json"
    if not results_path.exists():
        console.print("[red]No results file found. Run `compose-sim run` first.[/red]")
        sys.exit(1)

    scenario_results, metrics, run_meta = load_results(results_path)

    compare_metrics = None
    if compare:
        _, compare_metrics, _ = load_results(Path(compare))

    print_terminal_report(scenario_results, metrics, run_meta, quality_gate, compare_metrics)

    if markdown:
        md_path = generate_markdown_report(
            scenario_results, metrics, run_meta, quality_gate, compare_metrics,
        )
        console.print(f"[green]Markdown report saved to {md_path}[/green]")


# ---------------------------------------------------------------------------
# learn
# ---------------------------------------------------------------------------
@cli.command()
@click.option("--results", "-r", type=click.Path(exists=True), default=None, help="Path to results JSON.")
@click.option("--auto-apply", is_flag=True, help="Automatically save refined prompt version.")
def learn(results, auto_apply):
    """Analyze failures and refine the prompt."""
    from .reporter import load_results
    from .scenarios import load_scenarios
    from .learner import run_learning_loop

    # Load results
    results_path = Path(results) if results else RESULTS_DIR / "latest.json"
    if not results_path.exists():
        console.print("[red]No results file found. Run `compose-sim run` first.[/red]")
        sys.exit(1)

    scenario_results, metrics, run_meta = load_results(results_path)

    # Load full scenario set for few-shot selection
    scenarios_path = run_meta.get("scenarios_path") or str(SCENARIOS_PATH)
    # Only load scenarios matching the result IDs for efficiency
    result_ids = {r.scenario_id for r in scenario_results}

    console.print(f"[bold]Loading scenarios for few-shot selection...[/bold]")
    all_scenarios = load_scenarios(scenarios_path)
    relevant = [s for s in all_scenarios if s.scenario_id in result_ids]

    result = run_learning_loop(
        results=scenario_results,
        scenarios=relevant,
        auto_apply=auto_apply,
        console=console,
    )

    if not auto_apply and result["failure_count"] > 0:
        console.print("\n[yellow]Tip: Run with --auto-apply to save refined prompt version.[/yellow]")


if __name__ == "__main__":
    cli()
