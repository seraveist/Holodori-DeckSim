from __future__ import annotations

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys

import pytest

import holodori_decksim.public_card_art as public
from holodori_decksim.automation_gate import evaluate_card_asset_gate


@pytest.fixture
def sync_cli():
    path = Path(__file__).resolve().parents[1] / "scripts/sync-card-assets.py"
    spec = importlib.util.spec_from_file_location("card_asset_cli_test", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def sources(tmp_path, monkeypatch):
    from PIL import Image

    cards = tmp_path / "cards.json"
    cards.write_text(json.dumps([
        {"id": f"card-{name}", "asset_id": name, "rarity": 5} for name in ("one", "two")
    ]), encoding="utf-8")
    assets = tmp_path / "assets/cards"
    assets.mkdir(parents=True)
    provenance = tmp_path / "assets/card-portrait-sync.json"
    report = tmp_path / "report.json"
    output = io.BytesIO()
    Image.new("RGB", (768, 432), "blue").save(output, format="WEBP")
    image = output.getvalue()
    available = {"card-one"}
    requests = []

    def request(url, **_):
        if url.endswith("card-art-manifest.json"):
            return json.dumps({"assets": [
                {"cardId": card_id, "illustration": {
                    "localPath": f"/game/illustrations/{card_id}.webp",
                    "width": 768, "height": 432, "sha256": hashlib.sha256(image).hexdigest(),
                }} for card_id in sorted(available)
            ]}).encode()
        requests.append(url)
        return image

    monkeypatch.setattr(public, "resolve_public_art_commit", lambda *_: "a" * 40)
    monkeypatch.setattr(public, "_request_bytes", request)
    monkeypatch.setattr(sys, "argv", ["sync-card-assets.py", "--sync", "--cards", str(cards),
        "--assets-dir", str(assets), "--provenance", str(provenance), "--report", str(report)])
    return {"cards": cards, "assets": assets, "provenance": provenance, "report": report,
            "available": available, "requests": requests}


def fail_octo(**_):
    raise RuntimeError("403 Forbidden: https://example.invalid/asset/v2/pub/a/5/list/0")


def read_report(sources):
    return json.loads(sources["report"].read_text(encoding="utf-8"))


def test_partial_import_is_publishable_and_next_run_only_retries_missing(sync_cli, sources, monkeypatch):
    monkeypatch.setattr(sync_cli, "sync_missing_portraits", fail_octo)
    assert sync_cli.main() == 2
    report = read_report(sources)
    assert (report["imported_count"], report["pending_count"], report["error_count"]) == (1, 1, 0)
    assert (sources["assets"] / "card-one.webp").is_file()
    assert evaluate_card_asset_gate(report=report, diff_lines=[
        "A\tassets/cards/card-one.webp", "A\tassets/card-portrait-sync.json",
    ]).safe
    first_image = (sources["assets"] / "card-one.webp").read_bytes()

    sources["available"].add("card-two")
    assert sync_cli.main() == 0
    report = read_report(sources)
    assert [item["id"] for item in report["imported"]] == ["card-two"]
    assert report["after"]["missing_count"] == 0
    assert (sources["assets"] / "card-one.webp").read_bytes() == first_image
    assert len(sources["requests"]) == 2
    assert sync_cli.main() == 0
    assert read_report(sources)["imported_count"] == 0
    assert len(sources["requests"]) == 2


def test_real_fallback_error_does_not_discard_successful_public_import(sync_cli, sources, monkeypatch):
    def unavailable(**_):
        raise TimeoutError("Octo temporarily unavailable")
    monkeypatch.setattr(sync_cli, "sync_missing_portraits", unavailable)
    assert sync_cli.main() == 1
    report = read_report(sources)
    assert (report["imported_count"], report["error_count"]) == (1, 1)
    assert evaluate_card_asset_gate(report=report, diff_lines=["A\tassets/cards/card-one.webp"]).safe


def test_failed_existing_repair_is_not_reported_as_success(sync_cli, sources, monkeypatch):
    sources["cards"].write_text(json.dumps([{"id": "card-one", "asset_id": "one", "rarity": 5}]))
    old = sources["assets"] / "card-one.webp"
    old.write_bytes(b"legacy square image")
    sources["provenance"].write_text(json.dumps({"cards": {"card-one": {
        "source_type": "public-card-art-snapshot", "width": 300, "height": 300,
    }}}))
    def invalid(*_):
        raise ValueError("source SHA-256 mismatch")
    monkeypatch.setattr(public, "_validate_source_webp", invalid)
    assert sync_cli.main() == 1
    report = read_report(sources)
    assert report["unresolved_count"] == report["error_count"] == 1
    assert report["after"]["missing_count"] == 0
    assert "SHA-256" in report["unresolved"][0]["reason"]
    assert old.read_bytes() == b"legacy square image"


def test_public_source_outage_still_attempts_octo(sync_cli, sources, monkeypatch):
    def unavailable(*_):
        raise TimeoutError("public API unavailable")
    monkeypatch.setattr(public, "resolve_public_art_commit", unavailable)
    called = []
    def fallback(**kwargs):
        called.append(kwargs)
        before = sync_cli.audit_portraits(kwargs["cards_path"], kwargs["assets_dir"])
        for item in before["missing"]:
            (kwargs["assets_dir"] / f"{item['id']}.webp").write_bytes(b"fallback")
        return {"asset_tool_repository": "test", "asset_tool_commit": "b" * 40,
            "before": before, "after": sync_cli.audit_portraits(kwargs["cards_path"], kwargs["assets_dir"]),
            "imported_count": 2, "imported": before["missing"], "unresolved_count": 0, "unresolved": []}
    monkeypatch.setattr(sync_cli, "sync_missing_portraits", fallback)
    assert sync_cli.main() == 0
    assert len(called) == 1
    report = read_report(sources)
    assert report["public_unresolved_count"] == 2
    assert report["unresolved_count"] == 0


def test_public_validation_error_is_not_downgraded_to_pending(sync_cli):
    public_result = {"imported": [], "unresolved": [
        {"id": "bad", "status": "error", "reason": "SHA-256 mismatch"},
        {"id": "pending", "status": "pending", "reason": "card illustration missing from public snapshot manifest"},
    ]}
    octo = {"imported": [], "unresolved": [{"id": "bad"}, {"id": "pending"}],
            "fallback_error": "403 Forbidden /asset/v2/pub/a/5/list/0"}
    merged = sync_cli._merge_unresolved(public_result, octo)
    assert {item["id"]: item["status"] for item in merged} == {"bad": "error", "pending": "pending"}
