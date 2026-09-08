import importlib.util
from pathlib import Path

import pytest


path = Path(__file__).resolve().parents[1] / "scripts/ensure-pages-deployment.py"
spec = importlib.util.spec_from_file_location("pages_deployment_test", path)
deployment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(deployment)


def run(sha, *, status="completed", conclusion="success", updated="2026-09-08T01:00:00Z"):
    return {"head_sha": sha, "status": status, "conclusion": conclusion, "updated_at": updated}


@pytest.mark.parametrize("runs,expected", [
    ([], True),
    ([run("current")], False),
    ([run("old")], True),
    ([run("current", conclusion="failure"), run("old")], True),
    ([run("current", status="queued", conclusion=None), run("old")], False),
    ([run("current", status="in_progress", conclusion=None)], False),
    ([run("current"), run("old", updated="2026-09-08T02:00:00Z")], True),
])
def test_missing_or_failed_deployment_is_retried_without_duplicate_runs(runs, expected):
    calls = []
    def api(path, *, method="GET", payload=None):
        calls.append((path, method, payload))
        if path.endswith("commits/main"):
            return {"sha": "current"}
        if method == "GET":
            return {"workflow_runs": runs}
    result = deployment.ensure_pages_deployment("owner/repo", api=api)
    assert result["dispatched"] is expected
    dispatches = [call for call in calls if call[1] == "POST"]
    assert dispatches == ([("repos/owner/repo/actions/workflows/pages.yml/dispatches", "POST", {"ref": "main"})] if expected else [])
