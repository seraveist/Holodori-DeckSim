from holodori_decksim.automation_gate import evaluate_card_asset_gate, evaluate_master_gate


def rows(prefix: str, count: int):
    return [{"id": f"{prefix}-{index:03d}"} for index in range(count)]


def chart_index(count: int, *, stale: int = 0):
    return {
        "chart_count": count,
        "stale_metadata_count": stale,
        "charts": {f"m{index:04d}:EXPERT": {} for index in range(count)},
    }


def runtime_index(count: int, *, rejected: int = 0):
    return {"runtimeExactCount": count, "rejectedAvailableCount": rejected}


def test_master_gate_accepts_normal_additive_update():
    result = evaluate_master_gate(
        previous_cards=rows("card", 174),
        current_cards=rows("card", 178),
        previous_characters=rows("chr", 62),
        current_characters=rows("chr", 62),
        previous_music=rows("music", 188),
        current_music=rows("music", 194),
        previous_chart_index=chart_index(752),
        current_chart_index=chart_index(776),
        previous_runtime_index=runtime_index(699),
        current_runtime_index=runtime_index(699, rejected=4),
    )
    assert result.safe is True
    assert result.reasons == ()


def test_master_gate_blocks_removal_and_large_growth():
    previous_cards = rows("card", 100)
    current_cards = previous_cards[1:] + rows("new-card", 30)
    result = evaluate_master_gate(
        previous_cards=previous_cards,
        current_cards=current_cards,
        previous_characters=rows("chr", 60),
        current_characters=rows("chr", 60),
        previous_music=rows("music", 100),
        current_music=rows("music", 100),
        previous_chart_index=chart_index(400),
        current_chart_index=chart_index(400),
        previous_runtime_index=runtime_index(350),
        current_runtime_index=runtime_index(350),
    )
    assert result.safe is False
    assert any("removed" in reason for reason in result.reasons)
    assert any("growth" in reason for reason in result.reasons)


def test_master_gate_blocks_runtime_regression():
    result = evaluate_master_gate(
        previous_cards=rows("card", 100),
        current_cards=rows("card", 100),
        previous_characters=rows("chr", 60),
        current_characters=rows("chr", 60),
        previous_music=rows("music", 100),
        current_music=rows("music", 100),
        previous_chart_index=chart_index(400),
        current_chart_index=chart_index(400),
        previous_runtime_index=runtime_index(350),
        current_runtime_index=runtime_index(300),
    )
    assert result.safe is False
    assert any("Runtime Exact coverage" in reason for reason in result.reasons)


def test_card_gate_accepts_small_complete_batch():
    report = {
        "imported_count": 4,
        "imported": [{"id": f"card-{index}"} for index in range(1, 5)],
        "public_repair_count": 0,
        "unresolved_count": 0,
        "after": {"missing_count": 0},
    }
    diff = [
        "A\tassets/cards/card-1.webp",
        "A\tassets/cards/card-2.webp",
        "A\tassets/cards/card-3.webp",
        "A\tassets/cards/card-4.webp",
        "M\tassets/card-portrait-sync.json",
    ]
    result = evaluate_card_asset_gate(report=report, diff_lines=diff)
    assert result.safe is True


def test_card_gate_blocks_deleted_assets_even_in_partial_batch():
    report = {
        "imported_count": 1,
        "imported": [{"id": "card-new"}],
        "public_repair_count": 0,
        "unresolved_count": 1,
        "unresolved": [{"id": "card-pending"}],
        "before": {"missing_count": 2},
        "after": {"missing_count": 1},
    }
    diff = ["D\tassets/cards/card-old.webp", "M\tassets/card-portrait-sync.json"]
    result = evaluate_card_asset_gate(report=report, diff_lines=diff)
    assert result.safe is False
    assert any("delete" in reason for reason in result.reasons)


def test_card_gate_requires_exact_output_paths_and_rejects_missing_diff():
    report = {"imported_count": 1, "imported": [{"id": "card-new"}]}
    for diff in ([], ["A\tassets/cards/card-other.webp"]):
        result = evaluate_card_asset_gate(report=report, diff_lines=diff)
        assert not result.safe
        assert any("staged WebP" in reason for reason in result.reasons)


def test_card_gate_accepts_staged_new_and_repaired_images(tmp_path):
    import subprocess
    cards = tmp_path / "assets/cards"
    cards.mkdir(parents=True)
    old = cards / "card-old.webp"
    old.write_bytes(b"old")
    def git(*args):
        return subprocess.run(["git", "-c", f"safe.directory={tmp_path.as_posix()}", *args],
            cwd=tmp_path, check=True, capture_output=True, text=True).stdout
    git("init", "--quiet")
    git("add", "assets/cards")
    git("-c", "user.name=Test", "-c", "user.email=test@example.invalid", "commit", "--quiet", "-m", "fixture")
    old.write_bytes(b"repaired")
    (cards / "card-new.webp").write_bytes(b"new")
    git("add", "--", "assets/cards")
    diff = git("diff", "--cached", "--name-status").splitlines()
    report = {"imported_count": 2, "public_repair_count": 1,
        "imported": [{"id": "card-old"}, {"id": "card-new"}],
        "before": {"missing_count": 1}, "after": {"missing_count": 0}}
    result = evaluate_card_asset_gate(report=report, diff_lines=diff)
    assert result.safe
    assert result.metrics["portrait_changes"] == 2


def test_card_gate_rejects_imported_id_also_reported_as_failed():
    report = {"imported_count": 1, "imported": [{"id": "card-new"}],
        "unresolved_count": 1, "unresolved": [{"id": "card-new", "status": "error"}]}
    result = evaluate_card_asset_gate(report=report, diff_lines=["A\tassets/cards/card-new.webp"])
    assert not result.safe
    assert any("also reported" in reason for reason in result.reasons)
