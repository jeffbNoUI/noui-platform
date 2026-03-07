"""Prompt version tracking — snapshot and restore prompt configurations."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from ..config import PROMPT_VERSIONS_DIR


def save_prompt_version(
    system_prompt: str,
    few_shots: list[dict],
    metadata: dict | None = None,
    version_dir: Path | None = None,
) -> Path:
    """Save a prompt version as a timestamped JSON snapshot.

    Returns the path to the saved version file.
    """
    version_dir = version_dir or PROMPT_VERSIONS_DIR
    version_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    version_id = f"v_{ts}"
    path = version_dir / f"{version_id}.json"

    snapshot = {
        "version_id": version_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system_prompt": system_prompt,
        "few_shots": few_shots,
        "few_shot_count": len(few_shots),
        "prompt_length_chars": len(system_prompt),
        "metadata": metadata or {},
    }

    with path.open("w") as f:
        json.dump(snapshot, f, indent=2, default=str)

    # Update latest symlink
    latest = version_dir / "latest.json"
    if latest.exists() or latest.is_symlink():
        latest.unlink()
    # Write a copy as latest (symlinks are unreliable on Windows/WSL)
    with latest.open("w") as f:
        json.dump(snapshot, f, indent=2, default=str)

    return path


def load_prompt_version(version_id: str | None = None, version_dir: Path | None = None) -> dict:
    """Load a prompt version by ID or 'latest'."""
    version_dir = version_dir or PROMPT_VERSIONS_DIR

    if version_id is None or version_id == "latest":
        path = version_dir / "latest.json"
    else:
        path = version_dir / f"{version_id}.json"

    if not path.exists():
        raise FileNotFoundError(f"Prompt version not found: {path}")

    with path.open() as f:
        return json.load(f)


def list_prompt_versions(version_dir: Path | None = None) -> list[dict]:
    """List all saved prompt versions, newest first."""
    version_dir = version_dir or PROMPT_VERSIONS_DIR
    if not version_dir.exists():
        return []

    versions = []
    for p in sorted(version_dir.glob("v_*.json"), reverse=True):
        with p.open() as f:
            data = json.load(f)
        versions.append({
            "version_id": data["version_id"],
            "timestamp": data["timestamp"],
            "few_shot_count": data.get("few_shot_count", 0),
            "prompt_length_chars": data.get("prompt_length_chars", 0),
            "metadata": data.get("metadata", {}),
        })

    return versions
