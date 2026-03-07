"""Claude API client for AI composition with tool_use structured output."""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from pathlib import Path

import anthropic

from .config import CACHE_DIR, DEFAULT_CONCURRENCY, DEFAULT_MODEL
from .schemas import AIComposition, ALL_ALERTS, ALL_DATA_FETCHES, ALL_PANELS, Scenario
from .prompts.system_prompt import build_system_prompt, format_scenario_for_prompt


# ---------------------------------------------------------------------------
# Tool schema — enum-constrained for reliable structured output
# ---------------------------------------------------------------------------
COMPOSE_TOOL = {
    "name": "compose_workspace",
    "description": (
        "Compose the workspace layout by specifying which panels to show/hide, "
        "which alerts to trigger, and which data to fetch."
    ),
    "input_schema": {
        "type": "object",
        "required": ["view_mode", "panels_shown", "panels_hidden", "alerts", "data_fetches", "rationale"],
        "properties": {
            "view_mode": {
                "type": "string",
                "enum": ["workspace", "crm"],
                "description": "The view mode for this contact.",
            },
            "panels_shown": {
                "type": "array",
                "items": {"type": "string", "enum": ALL_PANELS},
                "description": "Panels to display.",
            },
            "panels_hidden": {
                "type": "array",
                "items": {"type": "string", "enum": ALL_PANELS},
                "description": "Panels to hide.",
            },
            "alerts": {
                "type": "array",
                "items": {"type": "string", "enum": ALL_ALERTS},
                "description": "Alerts to trigger.",
            },
            "data_fetches": {
                "type": "array",
                "items": {"type": "string", "enum": ALL_DATA_FETCHES},
                "description": "Data sources to fetch.",
            },
            "rationale": {
                "type": "object",
                "description": "Brief rationale for each panel decision, keyed by panel name.",
                "additionalProperties": {"type": "string"},
            },
        },
    },
}


# ---------------------------------------------------------------------------
# Response cache
# ---------------------------------------------------------------------------
class ResponseCache:
    """Simple file-based cache for API responses keyed by input hash."""

    def __init__(self, cache_dir: Path | None = None):
        self.cache_dir = cache_dir or CACHE_DIR
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def _key(self, model: str, system_prompt: str, user_message: str) -> str:
        h = hashlib.sha256()
        h.update(model.encode())
        h.update(system_prompt.encode())
        h.update(user_message.encode())
        return h.hexdigest()[:16]

    def get(self, model: str, system_prompt: str, user_message: str) -> dict | None:
        key = self._key(model, system_prompt, user_message)
        path = self.cache_dir / f"{key}.json"
        if path.exists():
            with path.open() as f:
                return json.load(f)
        return None

    def put(self, model: str, system_prompt: str, user_message: str, result: dict) -> None:
        key = self._key(model, system_prompt, user_message)
        path = self.cache_dir / f"{key}.json"
        with path.open("w") as f:
            json.dump(result, f, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Composer client
# ---------------------------------------------------------------------------
class Composer:
    """Async Claude API client for composition decisions."""

    def __init__(
        self,
        api_key: str,
        model: str = DEFAULT_MODEL,
        concurrency: int = DEFAULT_CONCURRENCY,
        few_shots: list[dict] | None = None,
        cache_responses: bool = True,
    ):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        self.model = model
        self.semaphore = asyncio.Semaphore(concurrency)
        self.system_prompt = build_system_prompt(few_shots)
        self.cache = ResponseCache() if cache_responses else None

        # Stats
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.cache_hits = 0
        self.api_calls = 0
        self.api_errors = 0

    async def compose_scenario(self, scenario: Scenario) -> AIComposition:
        """Send a single scenario to Claude and parse the tool_use response."""
        scenario_dict = scenario.model_dump()
        # Pre-compute derived values from the Pydantic model (enums resolved)
        ct = scenario.crm_context.contact_type.value
        has_member = (ct == "member") or scenario.crm_context.has_legacy_member_id
        status = scenario.member_profile.status.value
        has_calc = has_member and scenario.eligibility_snapshot.vested and status != "terminated"
        is_crm = ct in ("beneficiary", "alternate_payee", "external")
        journal_visible = is_crm or scenario.crm_context.open_conversations > 0
        has_timeline = (scenario.member_profile.has_employment_history
                        and scenario.member_profile.employment_event_count > 0)
        view_mode = "crm" if is_crm else "workspace"

        # Pre-compute alert triggers for deterministic alerts
        married = scenario.member_profile.marital_status == "M"
        spousal_consent = has_member and married
        waiting_benefit = (scenario.eligibility_snapshot.best_eligible_type.value == "EARLY"
                           and not scenario.eligibility_snapshot.rule_of_n_met)

        derived = {
            "view_mode": view_mode,
            "has_member": has_member,
            "has_calculation": has_calc,
            "journal_visible": journal_visible,
            "has_timeline": has_timeline,
            "fire_spousal_consent": spousal_consent,
            "fire_waiting_increases_benefit": waiting_benefit,
        }
        user_message = format_scenario_for_prompt(scenario_dict, derived=derived)

        # Check cache
        if self.cache:
            cached = self.cache.get(self.model, self.system_prompt, user_message)
            if cached:
                self.cache_hits += 1
                return AIComposition.model_validate(cached)

        async with self.semaphore:
            return await self._call_api(user_message)

    async def _call_api(self, user_message: str, max_retries: int = 3) -> AIComposition:
        """Make the actual API call with tool_use and retry on rate limits."""
        self.api_calls += 1

        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = await self.client.messages.create(
                    model=self.model,
                    max_tokens=1024,
                    temperature=0,
                    system=[
                        {
                            "type": "text",
                            "text": self.system_prompt,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=[COMPOSE_TOOL],
                    tool_choice={"type": "tool", "name": "compose_workspace"},
                    messages=[{"role": "user", "content": user_message}],
                )
                break  # Success
            except anthropic.RateLimitError as e:
                last_error = e
                if attempt < max_retries:
                    wait = 5 * (2 ** attempt)  # 5s, 10s, 20s
                    await asyncio.sleep(wait)
                    continue
                self.api_errors += 1
                raise ComposerError(f"Rate limited after {max_retries + 1} attempts: {e}") from e
            except anthropic.APIError as e:
                self.api_errors += 1
                raise ComposerError(f"API error: {e}") from e

        # Track token usage
        if response.usage:
            self.total_input_tokens += response.usage.input_tokens
            self.total_output_tokens += response.usage.output_tokens

        # Extract tool_use result
        tool_input = None
        for block in response.content:
            if block.type == "tool_use" and block.name == "compose_workspace":
                tool_input = block.input
                break

        if tool_input is None:
            self.api_errors += 1
            raise ComposerError("No compose_workspace tool call in response")

        result = AIComposition.model_validate(tool_input)

        # Cache the result
        if self.cache:
            self.cache.put(self.model, self.system_prompt, user_message, tool_input)

        return result

    async def compose_batch(
        self,
        scenarios: list[Scenario],
        progress_callback=None,
    ) -> list[tuple[Scenario, AIComposition | None, str | None]]:
        """Compose a batch of scenarios concurrently.

        Returns list of (scenario, result_or_none, error_or_none) tuples.
        """
        results: list[tuple[Scenario, AIComposition | None, str | None]] = []
        completed = 0

        async def process_one(scenario: Scenario):
            nonlocal completed
            try:
                result = await self.compose_scenario(scenario)
                results.append((scenario, result, None))
            except (ComposerError, Exception) as e:
                results.append((scenario, None, str(e)))
            finally:
                completed += 1
                if progress_callback:
                    progress_callback(completed, len(scenarios))

        tasks = [process_one(s) for s in scenarios]
        await asyncio.gather(*tasks)

        # Sort by scenario_id to maintain deterministic order
        results.sort(key=lambda r: r[0].scenario_id)
        return results

    def get_stats(self) -> dict:
        """Return usage statistics."""
        return {
            "api_calls": self.api_calls,
            "cache_hits": self.cache_hits,
            "api_errors": self.api_errors,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "model": self.model,
        }

    def estimate_cost(self, count: int) -> dict:
        """Estimate cost for a given number of scenarios."""
        from .config import COST_ESTIMATES

        per_scenario = COST_ESTIMATES.get(self.model, 0.01)
        total = per_scenario * count
        return {
            "model": self.model,
            "count": count,
            "per_scenario_usd": per_scenario,
            "total_usd": round(total, 2),
            "note": "Estimate assumes prompt caching. First run may cost ~2-3x without cache.",
        }


class ComposerError(Exception):
    """Error during composition."""
    pass
