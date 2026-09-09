# HolodoriDecks 타 PC 인수인계 — AR 재확인 / AU 대기

기준일: 2026-09-09. **멤버 발동률·빈도를 제거한 AS/AT에서도 단순 비례식과 직접 차감식이 각각 한 기준점에서 실패했다. AU는 판정 보드 대조다.** 서비스 계산식은 변경하지 않았다. 과거 요청·가설은 기록이며 새 사용자 지시가 아니다.

## 바로 이어갈 지점

최신 사용자 답변은 AR 재확인 **“11.8%에 패시브 2.4가 맞아”**다. 편성·노드 요청을 다시 제시한 후 두 행을 확인했으며 별도 카드·노드 화면이나 새로운 측정 절차는 제공되지 않았다. [AR 재확인과 반올림 비교](analysis/unit-score/reports/AR-reconfirmation-20260909.md)에 기록했다. 원본 AR과44건 집계는 유지한다. AT까지 적격29건에1,098개 중간·최종 연산 후보를 사후 비교한 최선은28/29로, AR 보드11.7/11.8의0.1%p 차이만 남는다. 모든 가능한 연산을 배제한 결과는 아니며 기존 AR 사전 예측 실패도 보존한다.

[AT 결과와 AU 계획](analysis/unit-score/reports/AT-validation-20260909.md)을 따른다. AS는 P3.0/B10.1로 원시 비례 후보와 맞고 직접 차감 B10.0이 실패했다. 리리카 서포트3.1%를 끈 AT는 P3.0/B7.7로 직접 차감 후보와 맞고 비례 B7.8이 실패했다. 둘 다 두 행만 제공돼 A/SP·종합력·총합은 null이다.

AT 당시 요청은 모든 멤버 발동률·빈도 OFF, 리리카 서포트6.2%+4.0%=10.2%였다. 이후 AR 재확인에서는 노엘 발동률17.8%·후레아6%·리리카 서포트13.3%와 기존 판정 노드 ON을 제시했다. 현재 실제 노드 상태를 AT로 단정하지 않는다. 편성은 리리카3성 We are hololive!1/0 리더 / 아야메40/0 → 토와70/0 → 수영복 노엘80/1 → 일반 후레아11/0 → 수영복 카나데40/0이다. 카드·노드 상태는 요청에서 상속하며 별도 감사된 것은 아니다.

**AU는 미관측이다.** 리리카 서포트3.1%를 다시 켜 AS와 같은13.3%로 복구한 다음,20초마다 낮은 확률로7초 동안 GOOD 이상을 PERFECT로 만드는 판정 노드만 끄도록 요청했다. 다른 효과도 함께 꺼야 하면 먼저 제약을 알려주도록 했다. AU는 AS와 판정 노드 하나만 다른 비교다.

AR 설정으로 되돌려 재측정했다면 AU 전에 노엘·후레아·카나데 발동률과 노엘 빈도 모두 OFF로 AS 기준을 복구해야 한다. AR 재확인 답변을 AU 결과로 해석하지 않는다.

판정 효과가 AS의 직접 차감 초과분을 설명한다면 P3.0/B10.0, AS와 표시 변화가 없다면 P3.0/B10.1이다. 모두 사전 가설이며 후자는 내부 정밀도를 유일하게 입증하지 않는다. 액티브75.2/SP43.9와 기본 세 종합력79,007/11,859/7,816은 유지 예측이다.

## 확인 범위와 미해결

누적44건·23개 멤버 조합, 액티브/SP는 제공된40건에서40/40, 기본 종합력 세부106개, 양의 패시브 원시 합계 후보 호환29건(사후14+후속15)이다. AK·AO·AS·AT는 두 스코어 행만 확인한 부분 관측이다.

- AP는 기존 비례 예측 성공, AQ는 정수 횟수식 실패다. 이후 중간 올림식의26/26 사후 재현은 AR 독립 예측0/1로 기각됐다. AR의 표시 합14.2는 배분 원금14.0에서 만들 수 없어 비율 조정으로 구제하지 않는다.
- 원시 평균 횟수 비례식은 AS에서 맞았지만 AT에서 실패했고, W·AA·AF·AI·AL의 과거 오차도 남는다. 직접 차감은 AT에 맞고 AS에 실패한다. 두 점의 공통 누락 효과 가능 범위는 관측 후 진단일 뿐 실제 판정 계수나 서비스 보정 상수가 아니다.
- 무패시브 G13.7/13.8, 서포트 의상 I/J/M, 미확인 리더 보드 U와 판정 기여는 별도 미해결이다. 보드 노드 내부 정밀도는 내장 master_refs에 없다.
- 보드·메모리·강화 종합력과 최종 유닛스코어·실제 곡 점수까지 계산 검증이 완료됐다고 확대하지 않는다. 서비스 계산식은 유지한다.

## 현재 사용하는 연구식

### 종합력

카드 성장은 `js/card-prepare.js`와 동봉된 master_refs를 사용한다. 다섯 멤버의 기본 p/t/s 합이 멤버 파라미터다. 리더 카드 자신의 파라미터와 멤버용 스킬은 리더 슬롯에서 제외한다.

- 의상 종합력: 멤버별·스탯별로 `ceil(기본 스탯 × 적용 의상 상승률 / 100)`을 계산해 합산한다.
- 패시브 종합력: 대상과 조건을 판정한 뒤 같은 멤버·같은 스탯에 적용되는 상승률을 합산하고 `ceil(기본 스탯 × 합산 상승률 / 100)`을 합산한다. 효과별로 먼저 올리면 중복 대상에서 과대 계산된다.
- 대상 우선순위의 기본 스탯 총합 선택은 기존 관측을 지지 근거로 사용한다. 서포트 대상의 동률 처리까지 확정된 것은 아니다. 최근 실험은 적격 대상이 정확히 둘인 편성을 사용해 이 모호함을 줄였다.
- 외부 계정 보너스를 주지 않은 `evaluateDeck`의 종합력은 여기서 비교하는 소계다. 누락된 보드·메모리·멤버 강화값을 0 실측으로 바꾸지 않는다.

### 액티브

`A_raw = (1/200) × Σ[t=1..200] {Σ[활성 구간 i] p_i v_i / max(1, Σ[활성 구간 i] p_i)}`

`A = ceil0.1(A_raw)`

카드 자체 주기·확률·지속시간·조건부 효과를 사용한다. 첫 판정은 카드 주기 경과 후이며 1초 단위, 표본 위상 1의 기존 연구 모형이다. 기본식에는 보드, 서포트 패시브, 의상, SP를 넣지 않는다. 조건 인원은 멤버 다섯 명 기준이다. 라이프 1000·콤보 800의 충족 가정은 실제 플레이 관측이 아니다.

구현: [dummy-model-lab.mjs](analysis/unit-score/dummy-model-lab.mjs)의 `integrate`와 [probe-sp-displayed-active-20260909.mjs](analysis/unit-score/probe-sp-displayed-active-20260909.mjs)의 `displayedActiveFeatures`.

### SP

`q_i = ceil0.01(카드 SP 서포트% × 지속시간 / 120)`

`R = Σ(조건이 충족된 카드 SP 발동률 상승%)`

`SP = ceil0.1(A × [Σq_i + R/20] / 100)`

퍼센트는 135, 40 같은 표시 숫자를 사용한다. 입력 A는 이미 0.1 단위로 올린 액티브다. 카드 SP 발동률과 홀로멤 보드 발동률을 혼동하지 않는다. 120·20·200 등의 상수는 재현 모형의 값이며 실제 내부 곡 길이나 발생 횟수의 증명은 아니다. 현재 표본은 일부 내부 올림 순서를 구분하지 못한다.

구현: [compare-sp-v-rounding-20260909.mjs](analysis/unit-score/compare-sp-v-rounding-20260909.mjs)의 `quantizedSupportSP`. W에서 미올림 43.1%·카드별 올림 43.2%·발동률 지속시간 가중 43.3%를 구분했고 실제 43.2%였다. AG는 표시 A 입력 44.3%를 지지하고 원시 A 44.2%·지속시간 가중 44.5%는 실패했다.

### 보드·패시브 합계

현재 보드 확장에서는 `p' = min(1, p × (1 + 발동률 보드%/100))`, `주기' = 주기 / (1 + 빈도 보드%/100)`을 사용하고 주기를 반올림하지 않는다. 과거 `dummy-model-lab`의 기본 board 옵션에 있는 주기 곱셈 방식과 다르다. 현재 재현은 아래 함수가 조정한 멤버를 기본 커널에 전달한다.

리리카인 경우 무조건 리더 서포트 13.3%를 수치 모형에 더한다. 코드의 `outfit` 인수 이름을 재사용하지만 이 13.3%의 출처는 **리더 보드**다. 판정 보정은 숫자로 추가하지 않았으며 기여가 0으로 증명된 것은 아니다.

`B_raw`: 보드만 반영한 액티브 모형 값. `BP_raw`: 보드와 대상별 서포트 패시브를 함께 반영한 값.

- 서포트 패시브가 없는 AC/AD/AE: `보드 = ceil0.1(B_raw) - ceil0.1(A_raw)`가 비교한 네 후보 중 생존했다.
- 양의 서포트 패시브: `S = BP_raw - A_raw`가 실제 두 원시 항목의 합이고 각각 0.1 올림된다고 가정할 때, 표시 합은 `ceil0.1(S)` 또는 그 값+0.1에 들어간다. 두 범위 호환성은 개별 효과량을 산출하는 공식이 아니다.

구현: [compare-board-ae-20260909.mjs](analysis/unit-score/compare-board-ae-20260909.mjs)의 `numericBoardResearch`. 스코어 서포트 의상인 I/J/M과 확인 범위 밖 리더 U는 이 보드 확장에서 제외한다.

### 기각 이력: 양의 패시브·보드 중간 올림 배분

먼저 Q=ceil0.1(BP_raw)−ceil0.1(A_raw)를 구한다. 카드별 w=p×효과량×지속시간/주기를 사용해 PW=Σ(w×패시브%), BW=Σ(w×100×[(1+r/100)(1+f/100)(1+L/100)−1])를 계산한다. Q를 PW:BW로 나눈 뒤 두 항목을 각각0.1 올림한다. 비율에서는 공통 길이가 약분되며, 가중치에 임의405초나 정수 발동 횟수를 넣지 않는다. 총합 액티브의200초 시간 모형은 유지한다.

[당시 후보 탐색](analysis/unit-score/probe-rounded-allocation-aq-20260909.mjs)은 AQ까지26/26건을 사후 재현했으나 수정 AR에서 독립 예측이 실패했다. 아래는 기각된 식의 이력이다. 횟수2종×정밀도5종×반올림3종×단계4종=120개 탐색과 당시 전부 맞았던 두 후보를 공개한다. 원시 차이+평균 횟수는21/26, 올림 차이+정수 횟수는24/26이었다. 이 사후 일치는 AR의 실패를 해소하지 않는다. 양쪽0.1 버림 후 차감도 당시 표본에서 같았으며 AR에서는 함께 탈락한다.

이전 [비례식 탐색](analysis/unit-score/probe-proportional-allocation-20260909.mjs)과 사전 예측은 수정하지 않는다. 새 식으로 과거 값이 재현돼도 이전 예측 실패를 성공으로 바꾸지 않는다. 무패시브 G, 의상 스코어 I/J/M, 미확인 리더 보드 U와 실제 곡은 이26건 검증 밖이다.

## 보드 입력과 화면 조건

다른 PC에서 입력했던 보드는 보존돼 있다. 최초 입력은 [board-context.json](analysis/unit-score/board-context.json), 추가 확인은 `analysis/unit-score/board-observations/`에 있다. 당시 보드 정보가 사라진 것이 아니며 현재 기본 액티브·SP와 보드 효과 연구에서 적용 위치를 구분한다.

| 멤버 캐릭터 | 발동률 노드 합 | 발동 빈도 노드 합 |
|---|---:|---:|
| 와타메 | 24.5% | 4% |
| 스이세이 | 0% | 0% |
| 토와 | 0% | 0% |
| 카나데 | 20% | 0% |
| 라덴 | 14% | 4% |
| 노엘 | 23.5% | 4% |
| 후레아 | 6% | 0% |
| 아야메 | 무조건 적용 0% | 무조건 적용 0% |

아야메는 가창자 조건일 때 적용되는 노란 계열만 해금됐다는 사용자 확인이다. 그 조건부 노드의 정확한 값은 미제공이며, 악곡 선택 전 계산에서 제외했다. 0은 모든 보드가 없다는 뜻이 아니다. 표는 과거 기본 입력이다. AT 당시에는 멤버 발동률·빈도 모두0%, 리리카 서포트10.2%였다. 이후 AR 재확인 설정과 혼동하지 않는다. AU 요청은 모든 멤버 발동률·빈도0%, 리리카 서포트13.3%와 판정 노드OFF다. 각 관측의 boardOverrides를 우선한다.

리리카 리더: 무조건 서포트 4.0+6.2+3.1=13.3%, 20초마다 낮은 확률로 7초 동안 GOOD 이상을 PERFECT로 바꾸는 판정 보정, 가창자로 포함될 때 전원 서포트 24%. 낮은 확률의 수치와 판정 노드의 편성 화면 기여는 미확정이다. 카나데·스이세이의 관련 **리더** 보드는 없다고 확인했다. 이를 멤버 보드도 없다는 뜻으로 확대하지 않는다.

W/X의 악곡 선택 전 편성 상세 화면은 직접 확인했다. 이후 편성은 이 계획을 이어받지만 매 표본의 화면을 새로 확인한 것은 아니다. 프로필도 관측별 명시 확인과 계획 상속을 원문 JSON에서 구분한다.

## 핵심 비교와 탈락한 가설

| 비교 | 관측/의미 |
|---|---|
| C→M, 리리카→아야메 | 같은 멤버에서 패시브 4.5→6.7%, A 78.4/SP 46.1 유지. M 의상 37.5%. 의상·리더 상호작용 의심을 유지하되 단순 60% 배율로 확정하지 않음 |
| W→X | 패시브 1.9→1.5%, 보드 17.3→6.9%. 리더 캐릭터·보드·의상이 함께 바뀌어 의상만의 대조가 아님 |
| X/Y/Z | 의상 종합력 43,945 / 49,934 / 비활성; A 75.5/SP 43.2/P 1.5/B 6.9 모두 같음 |
| Z→AA | 같은 라덴·와타메 서포트 8% 대상이어도 P 1.5→0.8%. 수혜자만의 함수 가설 탈락 |
| AC/AD/AE | 서포트 패시브 항목 없음. 보드 1.5/5.3/4.9%; 원시 차이의 올림/반올림/버림은 각각 다른 대조에서 실패 |
| AF | 후레아 서포트 실험: P 1.0+B 2.3=3.3%, 사전 합계 3.3/3.4 호환 |
| AG→AH | 노엘 서포트, 의상 비활성 리더 변경: P 1.7→2.2%, B 5.3→15.3% |
| AB→AI | P 1.8→2.2%, B 5.7→15.7%. 표시 P 공통 배율의 사전 P 2.3 및 조건부 B 15.5/15.6 탈락. 합계 17.9는 호환 |
| AA→AJ | P 0.8→1.5%, B 3.3→12.2%, A 71.1/SP 42.2 유지. 의상 비활성→50,131. 원시 배율/가산의 두 AJ 범위 모두 실패; 합계 13.7 호환 |
| AJ→AK | 같은 리리카 캐릭터의 파라미터 의상 50%→15% 계획. P 1.5/B 12.2 그대로 확인. A/SP·종합력은 미제공; 의상 활성/비활성 대조는 아님 |
| AM→AN | A75.2 유지, P1.7→1.6/B9.4→10.1/SP43.1→43.9. 기본 액티브·수혜자·리더만으로 정해지는 불변 가설 탈락; 보드/SP 원인 분리 불가 |
| AO→AP | 노엘 빈도4%만 추가 OFF 요청. P1.7→2.3/B9.4→12.1. 기존 비례식의 첫 사전 검증 일치; 빈도 해제로 합계가 증가하는 시간 모형 예측과 일치 |
| AP→AQ | 노엘 발동률2%만 추가 OFF 요청. P2.3/B12.0. 기존 P2.4 예측 실패; 이를 계기로 새 중간 올림 후보 탐색 |
| AN→AO | 카나데 발동률15%·5%만 OFF 요청. P1.6→1.7/B10.1→9.4. 타 조건 유지 시 발동률 보드의 간접 배분 영향 확인. A/SP·종합력은 미제공 |
| AI→AL | P2.2/B15.7 유지. 같은 리리카 캐릭터의 의상 비활성→15% 활성 대조. 표의 일곱 수치 확인, 총합은 미제공 |

Z/W·AG/AH·AB/AI의 세 의상 비활성 쌍이 허용한 원시값 배율은 `1.235294… < k < 1.294117…`, 가산량은 `0.4 < d < 0.5`였다. AA의 0.8%에서 AJ 배율형은 0.9/1.0/1.1%, 가산형은 1.2/1.3%를 예측했지만 실측 1.5%가 둘 다 벗어났다. 이전 세 쌍에 국한된 범위는 보존한다. 의상 독립성까지 포함한 AJ 가설의 실패이지, 원인이 의상이라고 유일하게 식별된 결과는 아니다.

과거 SP 전체 시간창 한계효과 모형, 양의 패시브에서 단순 단계 차감/공통 비례보정 등도 탈락 기록을 보존한다. 새 자료를 맞추려고 이전 예측을 덮어쓰거나 실패를 0.1%p 오차로 임의 처리하지 않는다. 상세 근거는 각 `reports/*-validation-20260909.md`와 고정 `experiments/`를 따른다.

## 원문·계산값을 구분하는 규칙

- 원본 2026-09-08 fixture는 11건(A/B/C/D/E/F/G/I/J/K/H)이다. 이후 M/O/P/Q/R/S/T/U/V/W/X/Y/Z/AA/AB/AC/AD/AE/AF/AG/AH/AI/AJ 23건을 합쳐 34건이다. L/N을 임의로 만들지 않는다.
- 이후 AK 두 항목 부분 관측을 추가해 35건이다. “패시브와 홀로멤 보드 모두 변화없어”는 AJ의 두 스코어 행만 확인한다. 다른 수치·총합을 예측으로 채우지 않는다.
- AL의 “전부 일치함”은 직전 일곱 숫자 확인이다. 이후 AM·AN의 직접 스크린샷 두 건을 추가해38건이다. 합계 후보 두 숫자를 각각 실측으로 만들지 않는다.
- AO는 새 관측별 boardOverrides로 카나데 발동률0을 기록했다. 과거 공통 보드 입력을 수정하지 않는다. 이후 AP/AQ/AR 이미지와 AS/AT 두 행 답변으로 누적44건이다. 각 조건은 요청에서 상속하며 AU는 미관측이다.
- 초기 fixture의 `leaderId`와 `memberIds`는 분리돼 있다. 구형 `validation-data.mjs` 어댑터의 `observation-E.json` 등은 리더가 memberIds 첫 칸에 포함된다. 형식을 혼용하지 않는다.
- 최신 Z는 `observations/Z-20260909-completed.json`. 초기 부분 입력 파일과 보충 파일도 보존하되 Z를 두 번 세지 않는다.
- 일반 후레아는 H에서 1/0, P 이후 해당 실험에서 11/0이다. 스냅샷 fixture를 일괄 수정하지 말고 관측별 프로필을 사용한다.
- U 전체 종합력 1,364,005 입력은 사용자가 **136,405**로 정정했다. 정정 근거를 보존한다.
- AC/AD/AE 패시브 항목 없음은 원문 숫자 null과 항목 존재 false로 남긴다. 비교용 복제본만 0으로 정규화한다.
- “나머지 일치”는 직전 표에서 명시한 기본 수치의 확인이다. 미제공 전체 종합력·총 스코어보너스·보드/메모리/강화 수치를 자동 확정하지 않는다. AJ도 전체 총합은 null이고 127.0%는 확인 항목의 산술 합이다.
- 인게임 설명은 효과 출처별 정의로 보존한다. 메모리는 보유 메모리 수에 따른 효과다. 정의만으로 독립 계산이나 공통 풀 배분을 증명하지 않는다. 사용자는 설명을 참고로 두고 실측 재현을 우선해 추정을 계속하길 원한다.

## 다른 PC에서 재현

Git의 `validation/unit-score-handoff-20260909` 브랜치를 내려받고 프로젝트 루트에서 Node.js 24 이상으로 다음을 실행한다. 이미 해당 브랜치에서 작업 중이면 로컬 변경을 보존한 뒤 최신 커밋을 받아 진행한다. 저장소를 받은 뒤 연구 재현에는 외부 패키지 설치나 네트워크가 필요 없다.

```powershell
node verify-handoff.mjs
```

이 명령은 최초 고정 연구143개와 후속 원문·소스·보고서·계획·스크린샷의 해시 및 수치 재현을 검사한다. 최신 집계는44건·멤버 조합23개·액티브/SP40/40·기본 종합력 세부106개·양의 패시브 합계 후보 호환29건이다. AU는 관측에 넣지 않는다.

최신 AR 재확인과29건 반올림 탐색은 `node scripts/test-validation-ar-reconfirmation.mjs`로 재현한다. AT와 미관측 AU 계획은 `node scripts/test-validation-at.mjs`로 재현한다. AS는 `node scripts/test-validation-as.mjs`를 사용한다. 과거 관측·계획 검사도 보존한다.

기존 서비스 계산의 회귀와 초기 연구 탐색까지 함께 재현하려면 다음을 실행한다.

```powershell
node scripts/run-scoring-validation.mjs --research-grid
```

프로젝트 루트에서 연구 결과 전체 JSON을 다시 보려면 다음을 사용한다.

```powershell
node analysis/unit-score/probe-rounded-allocation-aq-20260909.mjs
```

AK 실측은 기존 `baseline-passive-AK-20260909.json`을 수정하지 않고 새 원문 파일로 추가했다. 이후에도 보충 원문·새 비교 소스로 진행해 해시 잠금을 보존한다. `.gitattributes`는 고정 연구 자료의 바이트를 PC 간에 유지한다. 기존 관측·예측·연구 소스에 줄바꿈 일괄 변환이나 포맷 정리를 적용하지 않는다. 현재 재현 검사는 서비스 소스·데이터의 기준 스냅샷도 확인하므로 이를 변경하는 후속 작업은 이 검증 커밋을 보존하고 새 검증 기준을 별도로 마련한다.

## 파일 길잡이

| 위치 | 내용 |
|---|---|
| `HANDOFF_CURRENT.md` | 이 문서 — 현재 상태의 우선 진입점 |
| `analysis/unit-score/reports/AT-validation-20260909.md` | AS/AT 비교와 AU 판정 노드 계획 |
| `analysis/unit-score/experiments/baseline-judgment-AU-20260909.json` | 미관측 AU 고정 계획 |
| `analysis/unit-score/observation-catalog-AT-20260909.json` | 최신44건 목록 |
| `analysis/unit-score/reports/AS-validation-20260909.md` | AS 기준점과 당시 AT 계획 |
| `analysis/unit-score/reports/AQ-validation-20260909.md` | AQ의 기존 예측 실패·중간 올림 후보·AR 사전 예측 |
| `analysis/unit-score/experiments/baseline-rounded-AR-20260909.json` | 노드 제약으로 미실행된 최초 AR 계획 |
| `analysis/unit-score/reports/AR-validation-20260909.md` | 수정 AR의 기각 결과·AS 계획 |
| `analysis/unit-score/experiments/baseline-no-timing-AS-20260909.json` | 관측 전 AS 고정 예측 |
| `analysis/unit-score/observation-catalog-AR-20260909.json` | AR 시점42건 목록으로 연결 |
| `analysis/unit-score/observation-catalog-AQ-20260909.json` | AQ 관측에서 AP→AO→이전 목록으로 연결 |
| `analysis/unit-score/reports/AP-validation-20260909.md` | AP 성공과 당시 AQ 계획 |
| `analysis/unit-score/reports/AO-validation-20260909.md` | AO 확인·새 비례식·AP 사전 예측 |
| `analysis/unit-score/experiments/baseline-frequency-AP-20260909.json` | 관측 전 AP 고정 예측 |
| `analysis/unit-score/observation-catalog-AO-20260909.json` | AO 부분 관측과 보드 덮어쓰기 |
| `analysis/unit-score/probe-proportional-allocation-20260909.mjs` | 후보 탐색 재현; 미해결 네 건도 보존 |
| `analysis/unit-score/reports/AM-AN-validation-20260909.md` | AM·AN 두 스크린샷 비교와 조건부 범위 |
| `analysis/unit-score/observation-catalog-AM-AN-20260909.json` | 이전 AL 목록에 AM·AN 추가 |
| `analysis/unit-score/experiments/AM-AN-status-observed-20260909.json` | AM·AN 원문·이미지·연구 소스 해시 |
| `analysis/unit-score/reports/AL-validation-20260909.md` | AL 일치 결과와 해석 |
| `analysis/unit-score/reports/AM-AN-plan-20260909.md` | 관측 전에 고정한 두 편성·사전 예측 |
| `analysis/unit-score/experiments/baseline-passive-AM-AN-20260909.json` | 관측 전 AM·AN 고정 예측 — 실패도 보존 |
| `analysis/unit-score/observation-catalog-AL-20260909.json` | AJ→AK→AL 목록 연결 |
| `OBSERVATION_CATALOG_20260909.md` | AT까지44건의 내역 및 원문 위치 |
| `analysis/unit-score/reports/AK-validation-20260909.md` | AK 두 항목 일치와 해석의 한계 |
| `analysis/unit-score/reports/AL-plan-20260909.md` | 관측 전에 고정했던 AL 대조 계획 |
| `analysis/unit-score/experiments/baseline-passive-AL-20260909.json` | 관측 전 AL 고정 편성·예측·입력 해시 |
| `analysis/unit-score/reports/AK-comparison-20260909.json` | AK 시점의 재현과 집계 |
| `analysis/unit-score/observation-catalog-AK-20260909.json` | AJ 고정 목록을 참조하는 AK 추가분 |
| `analysis/unit-score/experiments/baseline-passive-AK-20260909.json` | 관측 전에 고정한 AK 예측·프로필·SHA-256 |
| `analysis/unit-score/experiments/AK-status-observed-20260909.json` | AK 확인 범위와 새 연구 파일의 해시 |
| `analysis/unit-score/observations/` | 이후 원문 관측, Z 보충, 사용자 확인 범위 |
| `analysis/unit-score/board-observations/`, `profile-observations/`, `ui-observations/` | 보드·프로필·인게임 설명 근거 |
| `scripts/fixtures/unit-observations-20260908.json` | 최초 11건의 고정 원본 |
| `verify-handoff.mjs`, `scripts/test-validation-aj-handoff.mjs`, `scripts/test-validation-ak.mjs` | Git 체크아웃용 재현·해시 검사 |
| `analysis/unit-score/imports/20260909-aj/` | 이번 동기화 기록, 원본 파일 목록·검사기·인수인계 문서 |
| `js/`, `data/`, `src/`, `scripts/`, `tests/`, `assets/` 등 | 실행 소스·데이터·기존 테스트·자산 |
| `SCORING_HANDOFF.md`, `SCORING_VALIDATION.md`, `analysis/unit-score/README.md` | 이전 시점 기록이 누적된 이력 문서 |

원본 전송 패키지에 등록된 523개 파일의 해시·크기는 모두 일치했다. 다만 목록 밖의 최상위 `HANDOFF_CURRENT.md` 한 개 때문에 원본 검사기의 파일 목록 일치 검사는 실패했다. 이 추가 파일은 등록된 프로젝트 내 문서와 바이트가 같았다. 원본 목록과 검사기, 해당 문서는 위 동기화 기록 폴더에 보존한다. 현재 Git용 검사기는 별도이며 원본 패키지 전체의 파일 개수를 검사하지 않는다.

원본의 `session-records/` 및 `.local/` 중복본을 새 관측으로 추가하지 않았다. 연구에 필요한 원문·카드·성장·보드 근거는 저장소에 포함돼 있으며, 특정 PC의 바탕화면 경로나 브라우저 localStorage, 설치 런타임에 의존하지 않는다.

서비스용 `js/score.js` 등의 계산식은 이번 연구 과정에서 바꾸지 않았다. 연구식과 검증 가설이 앱에 이미 적용됐다고 해석하지 않는다.
