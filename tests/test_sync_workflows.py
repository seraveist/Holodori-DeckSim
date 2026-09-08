"""Exercise the publication conditions in the actual workflow definitions."""
from pathlib import Path
import re

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[1]


def workflow(name):
    return yaml.load((ROOT / ".github/workflows" / name).read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def condition(expression, values):
    # These workflows use only boolean operators, comparisons and status checks.
    expression = re.sub(r"\b(?:needs|steps|inputs|github)\.[\w.]+", lambda match: repr(values.get(match[0], "")), expression)
    expression = expression.replace("always()", "True").replace("cancelled()", "False")
    expression = expression.replace("&&", " and ").replace("||", " or ")
    expression = re.sub(r"!(?!=)", " not ", expression)
    expression = re.sub(r"\btrue\b", "True", expression)
    expression = re.sub(r"\bfalse\b", "False", expression)
    return bool(eval(expression.strip(), {"__builtins__": {}}, {}))


def test_master_validation_is_called_directly_on_generated_commit():
    jobs = workflow("sync-master-data.yml")["jobs"]
    validate = jobs["validate_sync"]
    assert validate["uses"] == "./.github/workflows/validate.yml"
    assert validate["with"]["checkout_ref"] == "${{ needs.sync.outputs.head_sha }}"
    assert "validate_sync" in jobs["merge"]["needs"]
    checkout = workflow("validate.yml")["jobs"]["validate"]["steps"][0]
    assert checkout["with"]["ref"] == "${{ inputs.checkout_ref || github.sha }}"
    assert "--event pull_request" not in str(jobs)


@pytest.mark.parametrize("diff,merged,sync_result,dry_run,expected", [
    ("true", "success", "success", False, True),
    ("false", "skipped", "success", False, True),
    ("true", "failure", "success", False, False),
    ("true", "skipped", "success", False, False),
    ("false", "skipped", "failure", False, False),
    ("true", "success", "success", True, False),
])
def test_data_deployment_does_not_depend_on_portrait_result(diff, merged, sync_result, dry_run, expected):
    job = workflow("sync-master-data.yml")["jobs"]["deploy"]
    assert set(job["needs"]) == {"sync", "merge"}
    assert "sync-card-assets" not in str(job)
    assert condition(job["if"], {"github.event_name": "schedule", "inputs.dry_run": dry_run,
        "needs.sync.result": sync_result, "needs.merge.result": merged,
        "needs.sync.outputs.has_diff": diff}) is expected


@pytest.mark.parametrize("pending,errors", [(0, 0), (1, 0), (0, 1), (1, 1)])
def test_partial_images_can_be_committed_and_merged_before_reporting_errors(pending, errors):
    steps = workflow("sync-card-assets.yml")["jobs"]["sync"]["steps"]
    by_id = {step["id"]: step for step in steps if "id" in step}
    values = {"github.event_name": "schedule", "inputs.dry_run": False,
        "steps.diff.outputs.has_diff": "true", "steps.gate.outputs.safe": "true",
        "steps.sync_assets.outputs.pending_count": str(pending),
        "steps.sync_assets.outputs.error_count": str(errors), "steps.asset_pr.outputs.number": "42"}
    for step in (by_id["asset_commit"], by_id["asset_pr"], by_id["auto_merge"]):
        assert condition(step["if"], values)
    failure = next(index for index, step in enumerate(steps) if step.get("name") == "Report source failures after publishing verified portraits")
    assert failure > steps.index(by_id["auto_merge"])
    assert failure > steps.index(by_id["pages"])
    assert "git diff --cached --name-status" in by_id["diff"]["run"]


def test_portrait_schedule_runs_twice_daily_in_korean_time():
    assert workflow("sync-card-assets.yml")["on"]["schedule"] == [{"cron": "0 2,14 * * *"}]
