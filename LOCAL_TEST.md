# Holodori DeckSim 로컬 테스트

이 문서는 v1.1 계열 공개 전후의 수동 회귀 테스트 기준입니다.

## 1. 준비

요구 환경:

- Node.js 24 이상
- Python 3.11 이상

```bash
python -m pip install -e '.[test]'
node scripts/build-i18n.mjs
node scripts/build-chart-index.mjs
python scripts/validate-generated-data.py
python -m pytest -q
node scripts/test-chart-scoring.mjs
node scripts/test-targeted-passive-support.mjs
node scripts/test-passive-stat-rounding.mjs
node scripts/test-passive-target-priority.mjs
node scripts/test-support-stacking.mjs
node scripts/test-generic-order.mjs
node scripts/test-song-representative-order.mjs
node scripts/test-card-preparation.mjs
node scripts/test-simulation-targets.mjs
node scripts/test-collision-choice.mjs
node scripts/test-exact-global-search.mjs
node scripts/test-exact-pruning.mjs
node scripts/test-beam-search.mjs
node scripts/test-exact-runtime-source.mjs
node scripts/test-optimization-session.mjs
node scripts/test-chart-abort.mjs
node scripts/test-browser-smoke.mjs
python -m http.server 8000
```

Windows에서 `python` 명령이 없다면 `py -m http.server 8000`을 사용합니다. 브라우저에서 `http://localhost:8000/`을 엽니다.

GitHub Actions와 동일한 자동 브라우저 smoke는 `node scripts/test-browser-smoke.mjs`로 별도 실행할 수 있습니다.

## 2. 초기 로드 / 저장 상태

1. 앱이 오류 배너 없이 로드되는지 확인합니다.
2. `편성하기` / `내 보유 카드` 탭 전환이 정상인지 확인합니다.
3. 카드·캐릭터·악곡 데이터가 정상 표시되는지 확인합니다.
4. 새로고침 후 보유 카드·레벨·개화·프리셋·언어·테마가 유지되는지 확인합니다.

## 3. 언어 / 테마 / Typography

1. 한국어 / English / 日本語 전환 시 UI와 카드·캐릭터·악곡·스킬 문구가 함께 바뀌는지 확인합니다.
2. 헤더 테마 버튼으로 라이트 ↔ 다크가 즉시 전환되고 새로고침 후 유지되는지 확인합니다.
3. 프리셋 / 선택 팝업 / 보유 카드 / 결과 카드의 캐릭터명·카드명·Lv/개화 계층이 동일한지 확인합니다.
4. 결과 카드에서 리더 배지 유무와 관계없이 텍스트 시작 높이가 멤버 카드와 일치하는지 확인합니다.
5. Windows 100% / 125% / 150% 또는 브라우저 확대에서 작은 글씨가 심하게 번지지 않는지 확인합니다.
6. 모바일/좁은 화면에서도 카드 텍스트 계층이 데스크톱과 동일하게 유지되는지 확인합니다.

## 4. 보유 카드 / 프리셋

1. 검색·희귀도·타입·보유 상태·정렬 필터가 정상 동작하는지 확인합니다.
2. 보유/미보유, 레벨, 개화 0~5, JSON 내보내기/가져오기를 확인합니다.
3. 리더 프리셋은 리더로 유지되어야 합니다.
4. 멤버 프리셋은 최종 5명에 포함되되, 멤버 프리셋을 예를 들어 `멤버 4`에 지정해도 해당 위치에 고정되지 않는지 확인합니다.
5. 리더/멤버 분리 옵션과 프리셋 초기화를 확인합니다.

## 5. 시뮬레이션 목표 / 플레이 기준

시뮬레이션 목표는 `최고 유닛 스코어`, `최고 잠재 스코어` 두 개뿐이어야 합니다.

1. 악곡 미선택/선택에서 각각 유닛 스코어·예상 평균과 잠재 유닛 스코어·근사 최대 기준으로 TOP 5가 바뀌는지 확인합니다.
2. AUTO가 정상 선택되는지 확인합니다.
3. 수동 기준은 `Manual PERFECT FC`로 표시되는지 확인합니다.
4. Manual PERFECT FC가 PERFECT 계수와 콤보 보너스를 사용하고 AUTO는 AUTO 계수·콤보 보너스 없음으로 표시되는지 확인합니다.

악곡 미선택에서는 같은 리더·멤버 조합이 중복되지 않고, 공통 채보에서 잠재 점수가 가장 높은 순서 하나만 표시되어야 합니다. 상세의 `잠재 기준 추천 배치`와 `공통 채보 잠재 스코어`, 가정한 SP 5개 지점을 확인합니다. 기본 유닛스코어와 잠재 유닛스코어는 인게임 비교 기준을 유지합니다. 멤버 프리셋의 카드 포함은 유지되며 순서는 바뀔 수 있습니다. 악곡을 선택하면 해당 곡의 시간축과 계산 목표를 사용하고 공통 채보 안내는 사라져야 합니다.

악곡 선택 시에도 같은 리더·멤버 5명 조합당 결과는 하나입니다. `최고 유닛 스코어`는 그 곡의 예상 평균이 최대인 순서를, `최고 잠재 스코어`는 잠재 점수가 최대인 순서를 표시합니다. 표시된 다른 지표도 해당 순서의 값이며, 서로 다른 순서의 최고 평균·최고 잠재를 한 결과에 섞지 않습니다. Exact/Master/Estimated 및 AUTO/Manual의 두 목표를 120개 순열 전수 계산과 비교하는 회귀를 포함합니다.

## 6. Local Exact / Runtime Exact

### Local Exact

`m0049 / EXPERT`를 선택합니다.

1. `실제 채보 노트·SP 순서 반영` 안내가 표시되는지 확인합니다.
2. SP1~SP5에 실제 카드명과 시작/종료 시각이 표시되는지 확인합니다.
3. 프리셋 멤버가 포함되면서 SP 순서에 따라 다른 위치로 재배치될 수 있는지 확인합니다.

### Runtime Exact

`m0001 / EXPERT` 등 Local Exact 이외의 Runtime Exact 등록 채보를 선택합니다.

1. Network 탭에서 `holodori-chart-timelines.json` 요청이 발생하는지 확인합니다.
2. 요청 헤더가 `Range: bytes=...`인지 확인합니다.
3. 응답이 `206 Partial Content`이고 `Content-Range`가 요청 구간과 일치하는지 확인합니다.
4. 전체 source가 아니라 선택 채보 범위만 전송되는지 확인합니다.
5. 결과가 `실제 채보 노트·SP 순서 반영` 상태인지 확인합니다.
6. 최종 5인 SP1~SP5 순서가 재최적화되는지 확인합니다.

2026-09-08 snapshot에서는 Runtime Exact 호환 채보가 699 / 796입니다. Local/Runtime Exact를 사용할 수 없는 채보는 Master fallback으로 계산합니다.

### Fail-soft fallback

DevTools에서 Runtime Exact source 요청을 차단한 뒤 같은 곡을 다시 계산합니다.

1. 계산 자체가 실패하지 않아야 합니다.
2. `Master 풀콤보 노트 수 반영 · SP 타이밍 근사`로 내려가야 합니다.
3. 앱 전체 오류 배너가 발생하지 않아야 합니다.

## 7. Exact 진단 일치 / 대상 Passive Support

1. Exact 곡 상세 결과의 예상 발동 횟수·확률·커버율이 실제 SP 발동률 구간과 일치하는지 확인합니다.
2. 개인/팀 타임라인이 실제 액티브 판정 시각을 사용하는지 확인합니다.
3. 대상 지정 Passive Active-Skill-Effect-Up이 실제 대상 멤버의 액티브에만 적용되는지 확인합니다.

## 8. Worker / UI 응답성 / stale 요청

보유 카드를 충분히 많이 등록하고 Runtime Exact 곡을 계산합니다.

1. 계산 중 버튼이 비활성화되고 완료 후 다시 활성화되는지 확인합니다.
2. 계산 중에도 스크롤·페이지 애니메이션이 장시간 멈추지 않는지 확인합니다.
3. DevTools에서 module Worker가 생성되는지 확인합니다.
4. Worker 미지원 환경에서는 동일 계산 코어의 동기 fallback으로 결과가 나오는지 확인합니다.
5. Runtime Exact 요청이 진행 중일 때 악곡·목표·프리셋 중 하나를 바꾸면 기존 Range 요청이 취소되는지 확인합니다.
6. 설정 변경 후 새 계산 B를 완료한 다음 이전 계산 A가 늦게 종료되어도 B의 TOP 5·상태 문구·계산 버튼 상태가 지워지거나 덮어써지지 않는지 확인합니다.

## 9. 결과 / 모바일

1. TOP 1~5와 리더 + 멤버 5장이 정상 표시되는지 확인합니다.
2. 예상 평균/근사 최대, 종합력, P/T/S, 스코어 보너스 산식이 표시되는지 확인합니다.
3. 스킬 툴팁과 개인/팀 발동 타임라인이 정상인지 확인합니다.
4. 600px 이하에서 프리셋/보유 카드가 2열이고 결과 6장은 좌우 스크롤되는지 확인합니다.
5. 모달과 결과 헤더가 화면 밖으로 벗어나지 않는지 확인합니다.

## 10. 데이터 동기화

GitHub Actions의 `Sync Holodori master data`를 `dry_run=true`로 실행해 최신 upstream을 검증할 수 있습니다.

Master 변경 시 workflow는 `chart-index.json` 이후 pinned Runtime Exact corpus를 현재 Master와 다시 대조해 `exact-runtime-index.json`도 재생성해야 합니다. 새 `chartHash` 또는 노트 수와 맞지 않는 Runtime entry는 새 index에서 제외되어야 합니다.

```bash
holodori-sync --force
node scripts/build-i18n.mjs
node scripts/build-chart-index.mjs
python scripts/validate-generated-data.py
python -m pytest -q
node scripts/test-chart-scoring.mjs
node scripts/test-targeted-passive-support.mjs
node scripts/test-card-preparation.mjs
node scripts/test-simulation-targets.mjs
node scripts/test-collision-choice.mjs
node scripts/test-exact-global-search.mjs
node scripts/test-exact-pruning.mjs
node scripts/test-beam-search.mjs
node scripts/test-exact-runtime-source.mjs
node scripts/test-optimization-session.mjs
node scripts/test-chart-abort.mjs
```

## 11. 1차 실측 회귀 (2026-09-08)

다른 PC의 간편 재현은 `node scripts/run-scoring-validation.mjs`로 실행합니다. 추가 설치 없이 Node.js 24 이상과 저장소 데이터만 사용합니다. 분석 전체 탐색은 `--research-grid`를 붙이며, 다음 L/M/N 편성·사전 예측·관측 기록 방법은 [SCORING_HANDOFF.md](SCORING_HANDOFF.md)를 따릅니다.

`node scripts/test-unit-observations.mjs`로 H 추가 후 화면 11건의 종합력과 반복 관측을 재현합니다. `--json`을 붙이면 남은 보너스 오차를 포함한 비교 결과를 JSON으로 출력합니다. 자세한 범위는 [계산식 1차 검증 기록](SCORING_VALIDATION.md)을 참고합니다. 계산 결과 상단의 추정값 안내는 악곡 선택 여부와 관계없이 한국어·영어·일본어로 표시되어야 합니다.

## 12. 릴리스 metadata

현재 버전은 `VERSION`, `pyproject.toml`, package `__version__`, README, CHANGELOG가 동일해야 합니다. `python -m pytest -q`의 release metadata 테스트와 `.github/workflows/release.yml`이 공개 버전 정합성을 검증합니다.

`main` 병합 후 `.github/workflows/pages.yml`이 핵심 검증을 다시 수행하고 Pages를 배포합니다. 성공한 Pages 배포에 대해 VERSION tag/release가 아직 없으면 `.github/workflows/release.yml`이 해당 배포 커밋을 태그하고 GitHub Release를 생성합니다.
