#!/usr/bin/env python3
"""Dispatch Pages when current main has neither a successful nor active deployment."""
from __future__ import annotations

import argparse
import json
import os
import subprocess


def github_api(path: str, *, method: str = "GET", payload: dict | None = None):
    command = ["gh", "api", "--method", method, path]
    if payload is not None:
        command += ["--input", "-"]
    result = subprocess.run(
        command, input=json.dumps(payload) if payload is not None else None,
        text=True, capture_output=True, check=True,
    )
    return json.loads(result.stdout) if result.stdout.strip() else None


def ensure_pages_deployment(repository: str, *, api=github_api) -> dict:
    prefix = f"repos/{repository}"
    head = api(f"{prefix}/commits/main")["sha"]
    runs = api(f"{prefix}/actions/workflows/pages.yml/runs?branch=main&per_page=100")["workflow_runs"]
    # Compare the most recent successful deployment, not any historical success:
    # a newer run could have deployed an older commit after a manual rerun.
    successes = [run for run in runs if run.get("conclusion") == "success"]
    latest = max(successes, key=lambda run: run["updated_at"], default=None)
    if latest and latest["head_sha"] == head:
        return {"dispatched": False, "head_sha": head, "reason": "already-deployed"}
    if any(run["head_sha"] == head and run["status"] != "completed" for run in runs):
        return {"dispatched": False, "head_sha": head, "reason": "deployment-active"}
    api(f"{prefix}/actions/workflows/pages.yml/dispatches", method="POST", payload={"ref": "main"})
    return {"dispatched": True, "head_sha": head, "reason": "deployment-needed"}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPOSITORY"))
    args = parser.parse_args()
    if not args.repo:
        parser.error("--repo or GITHUB_REPOSITORY is required")
    result = ensure_pages_deployment(args.repo)
    print(json.dumps(result))
    if output := os.environ.get("GITHUB_OUTPUT"):
        with open(output, "a", encoding="utf-8") as stream:
            stream.write(f"dispatched={str(result['dispatched']).lower()}\n")


if __name__ == "__main__":
    main()
