# 경로 기반 이동 시스템 (3단계)

물리 엔진 없음. 공은 **지정된 폴리라인 위**에서만 이동한다.

## 모듈 분리

| 모듈 | 역할 |
|------|------|
| `lib/path-motion-geometry.ts` | 폴리라인 길이(px), 거리만큼 보간 (경로 기하) |
| `lib/path-motion-distance.ts` | `strokeTotal = base × cushionMult` → 수구/1목 각각 `× cueRetain` / `× objectTransfer` (`lib/thickness-power-split.ts`) |
| `lib/solution-path-motion.ts` | `NanguSolutionData` + 배치 → `PathMotionPlan`, 샘플 API |
| `hooks/useSolutionPathMotion.ts` | React에서 `progress01`에 따른 위치 |
| `lib/ball-speed-constants.ts` | 볼 스피드 1.0~5.0(0.5)·레일 매핑·레거시 동기화 |
| `lib/path-animation-timing.ts` | 스트로크 재생 시간 튜닝(`PATH_ANIMATION_TIMING`) |

## 이동 규칙

- **실제 이동 거리(한 스트로크)** = `min(moveDistancePx, pathLengthPx)`.
- 애니메이션 `progress01 ∈ [0,1]`일 때 폴리라인 위 거리 = `progress01 × min(moveDistancePx, pathLengthPx)`.

## 파라미터 (보정)

- **레일 표시 세기** (UI·문서용): 1~5레일 → `28, 43, 57, 69, 80` (`lib/rail-power-constants.ts`의 `RAIL_DISPLAY_POWER`).
- **내부 전용 보정** (애니메이션만): 같은 레일에 `×1.10, ×1.08, ×1.06, ×1.04, ×1.02` (`RAIL_ANIMATION_CORRECTION`).  
  `internalPower = 표시세기 × 내부보정` — 사용자 화면에는 28~80만 쓰고, 이동거리는 `internalPower` 기반으로 스케일.
- **볼 스피드 1.0~5.0 (0.5 단계)**: `BALL_SPEED_OPTIONS`, `ballSpeedToRailCount` — 저장 필드 `ballSpeed`, 거리 계산 시 `MoveDistanceParams`에서 **최우선**.
- **speedLevel 1~10 → 레일** (레거시): `speedLevelToRailCount` — `ballSpeed` 없을 때 사용.
- **cushionPathMultiplier**: 경로상 쿠션 스팟 개수 보정 (`computeCushionPathDistanceMultiplier`).
- **두께(충돌) 분배**: `strokeTotalPowerReferencePx`에 대해 `cuePower = total × cueRetain(thickness)`, `objectPower = total × objectTransfer(thickness)` (`computeCueMoveDistancePx` / `computeObjectMoveDistancePx`).  
  두꺼울수록 1목 거리↑·수구 거리↓, 얇을수록 반대. 뱅크는 0.5/0.5 중립.  
  수치 예: `4/16` → `thickness01FromSixteenths(4, 16)`; 에디터는 `thicknessOffsetX` → `thickness01FromOffsetX`.

- **애니메이션 시간**: `PathMotionPlan.animationDurationSec` / `animationDurationMs` — 기본은 세기 **레일 번호(1~5)** 기준.  
  기본은 레일 1에서 약 1초, 레일이 올라갈수록 증가. 값은 **`PATH_ANIMATION_TIMING`** 객체에서 조정 (시연 후 튜닝).  
  Trouble「경로 시연」숨김 시간은 `computePathPreviewDemoHoldMs` (스트로크 ms + `pathPreviewDemoPaddingMs`).
- **경로 시연 재생** (`useTroublePathPlayback`): 수구는 **전체** 빨간 `cuePlan` 폴리라인 끝까지 진행(1목 스팟에서 끊지 않음). **1목 object 페이즈**는 `computeCueProgress01ForFirstObjectHitAlongFullPath`로 구한 **첫 1목 공 스팟**까지의 거리 비율(`pHitFirst01`)에 도달한 시점부터 시작한다(마지막 ball 스팟 비율과 혼동하면 1목이 수구 시연 끝까지 밀림). 수구↔1목 **재충돌** 팝업만 `pWarnRecontactAfter01`(첫 충돌 직후 소구간 bump) 이후로 분리. 이후 수구는 빨간 끝점에 고정되고 1목만 파란 폴리라인(`sampleObjectMotion` 등). `cueDurationMs`·감속·τ는 빨간 길이만, `objectDurationMs`는 파란 길이만. 튜닝: `PATH_ANIMATION_TIMING.playbackLongEdgeOneWayMs`, `cuePlaybackSpotPauseMs` 등. E2E 디버그: `data-testid="trouble-e2e-playback-debug"`의 `data-timing-*` 속성(히트·완료·경고 시각 등).

상수는 `rail-power-constants.ts`, `ball-speed-constants.ts`, `path-motion-distance.ts`, `path-animation-timing.ts`, `thickness-power-split.ts`에서 조정.

## 재생 중 시각 옵션 (9단계)

- 애니메이션 **재생 중**에만 우측 상단 오버레이: 경로선 숨김/보이기, 그리드 숨김/보이기, 실사↔단순 보기 — **항상 현재 상태의 반대 라벨 1개**만 표시.
- 클릭 시 즉시 반영, **재생(rAF)은 중단하지 않음**. 재생 시작 시 옵션은 기본(경로·그리드 표시, 실사)으로 리셋.
- Trouble: `data-trouble-region="trouble-playback-view-controls"`, 액션 `trouble-playback-toggle-pathlines` 등 (`trouble-console-contract.ts`).
- **레이어**: `BilliardTableCanvas`에서 테이블 `z-0` → 경로 SVG `z-10` → 공 `z-20`(기본). 공은 항상 경로선 위. 1목 파란 선이 공 원 안에서 가려지지 않게 하려면 레이어를 올리지 않고 `NanguSolutionPathOverlay`에서 첫 선분 시작을 `outwardOffsetFromBallCenterTowardPointNorm`으로 공 외곽(반지름+margin px)만큼 밀어 그림(`lib/path-motion-geometry.ts`). `pathOverlayAboveBalls`는 예외용으로만 유지(난구 해법 기본은 `false`).

## 기본 경로 버튼 (8단계)

- **이전 경로선 삭제**: 마지막으로 추가한 스팟(수구/1목 구분)을 스택 순서로 Undo.
- **전체 경로선 삭제**: 수구·1목 경로·스팟·화살표 초기화, 공 배치는 유지. Trouble: `trouble-clear-all-paths` / 난구해결사 에디터는 동일 동작 버튼.
- **애니메이션 시연**: 현재 경로로 재생 (`useSolutionPathPlayback` / Trouble: `trouble-play-path`).

## 경로 재생 중 충돌 (7단계)

- Trouble 해법 편집기 `경로 재생`: 수구 경로 → (1목 경로가 있으면) 적색 경로 순서로 `PathMotionPlan` 기준 시간에 맞춰 이동.
- 이동 중 **다른 공과 중심거리 &lt; 2R − ε** 이면 즉시 정지, 경로선(오버레이)은 그대로 유지, 화면 중앙에 흰색 큰 글자로 **「충돌이」/「발생하였습니다.」** 두 줄, 다섯 번 깜빡인 뒤 사라지게 표시 (`CollisionWarningToast`). 재계산·새 경로 생성 없음.
- 판정·문구: `lib/path-playback-collision.ts`, `hooks/useTroublePathPlayback.ts`.

## 테이블 확대·패닝 (10단계)

- **전체 좌표계**: 플레이필드·쿠션·프레임(포인터)·공·스팟·경로선이 들어 있는 **고정 크기 월드**(`DEFAULT_TABLE_WIDTH` × `DEFAULT_TABLE_HEIGHT`)에 `transform: translate + scale` 한 번만 적용 (`components/nangu/SolutionTableZoomShell.tsx`, `lib/solution-table-zoom-math.ts`).
- **초점**: 선택한 공(경로 모드에서 탭) 또는 스팟 드래그 시작 시 캔버스 픽셀 `(fx, fy)`로 초점을 옮기고, 가능하면 뷰포트 중앙에 오도록 `translate` 보정. 사용자 **패닝**(`panX`/`panY`)은 별도.
- **조작**: `+` / `−`, 세로 **슬라이더**(배율 `SOLUTION_ZOOM_MIN`~`MAX`), **스페이스+좌클릭 드래그** 또는 **휠 클릭(중버튼) 드래그**로 이동.
- **좌표**: 화면 → 캔버스는 `viewportClientToCanvasPx` (뷰포트 기준 역투영). 해법 편집기의 `getNormalizedFromEvent`는 이 경로 + `isInsidePlayfield` + `pixelToNormalized`로 통일.
- **재생 중**: `interactionLocked`로 줌 UI·패닝 비활성화 (애니메이션 유지).
- **확대 시 빈 공간 패닝**: `zoomLevel > 1`일 때만, 포인터 다운 시 `classifySolutionPathPointerHit`로 공·스팟·세그먼트가 아닌 **빈 영역**이면 뷰포트가 즉시 `setPointerCapture` 후 드래그로 `panX`/`panY` 갱신. 이동 임계값 미만에서 손을 떼면 `onEmptyTap`으로 경로 점 추가(전체화면 에디터). 공/스팟·경로 세그먼트 히트 시에는 캡처하지 않아 오버레이가 기존대로 처리 (`SolutionTableZoomShell` + `lib/solution-path-pointer-classify.ts`).

## 핵심 원칙 (11단계)

이 기능은 **실제 물리 엔진이 아니라 경로 기반 시각화 시스템**이다. 구현·기획·리뷰 시 아래를 기준으로 판단한다.

- **경로 종속**: 공은 **항상 사용자가 그린 경로선(폴리라인) 위에서만** 이동한다. 궤적은 물리 시뮬레이션이 아니라 **경로 기하 + 진행률 보간**으로 결정된다.
- **결과 결정 요인**: 한 스트로크의 이동량·체감은 **세기(볼 스피드·레일) + 두께(수구/1목 분배) + 레일·쿠션 경로 보정** 등 **설명 가능한 파라미터**로 맞춘다 (`path-motion-distance.ts`, `thickness-power-split.ts`, `rail-power-constants.ts` 등).
- **UX 우선**: 경로와 애니메이션은 **설명 가능하고 조작 가능**해야 한다. 사용자가 의도·원인을 이해하고, 경로 편집·재생 옵션으로 행동을 예측할 수 있을 것.
- **단순함 > 실제 반사**: 복잡한 실제 반사·마찰 물리를 재현하기보다, **당구 교육·해법 제시**에 맞는 **이해하기 쉬운 동작**을 우선한다. 물리적 정밀도가 아니라 **의미 전달과 일관된 규칙**이 목표다.

## 최종 정의 (12단계)

본 시스템은 수구에서 시작된 스팟 기반 직선 경로를 따라 공이 이동하며, 세기, 두께, 레일 보정으로 결과가 결정되고, 플레이필드, 쿠션필드, 프레임필드를 포함한 테이블 전체 좌표계를 기반으로 확대 및 시각화가 이루어지는 경로 시뮬레이션 시스템이다.

## 전체화면 경로 편집 UX (13단계)

- **미리보기**(해법 화면의 배치도): **보기 전용**. 경로선·스팟은 표시만 하고, 스팟 생성·이동·경로 편집·줌·애니메이션은 하지 않는다. 탭/클릭 시 **전체화면 경로 편집**으로 진입.
- **전체화면만**: 스팟 생성·이동, 경로선 생성/수정, Trouble **1목 경로**, 확대/축소, 애니메이션 시연. 상단 **취소**(변경 폐기·복귀) / **완료**(경로 반영·복귀). `Escape` → 취소.
- **수구 경로 스팟 규칙** (`lib/cue-path-cushion-rules.ts`, `lib/cue-path-ray-resolve.ts`): 선은 항상 **수구**에서 시작. **수구 직후 첫 스팟**은 **1목 후보(수구를 제외한 두 공 중 탭에 가까운 쪽 중심)** 또는 **플레이필드·쿠션 안쪽 테두리**(`getNonCueBallNorms` + `snapCuePathTap`). **쿠션·프레임**을 탭하면 직전 점에서 탭으로 잇는 직선이 먼저 만나는 **쿠션 라인** 또는 **목적구 원 둘레**에 스팟이 잡힌다. 광선상 먼저 맞는 1목은 `cueFirstObjectHitAmongNormalized`로 계산. 이후 쿠션 체인은 테두리끼리만; 그 밖은 **end**(화살표). 난구 해법 저장 시 `reflectionObjectBall`로 재생 시 움직일 공(red/yellow/white)을 기록.
- 구현: `components/nangu/SolutionPathEditorFullscreen.tsx` — 난구해결사 `NanguSolutionEditor`·난구해법 `TroubleSolutionEditor` 모두 `presentation="noteBallPlacementFullscreen"`(당구노트 공배치와 동일한 `z-[9999]` 셸·`BallPlacementFullscreenContext`). Trouble **이미지 전용**(`ballPlacement` 없음)도 동일 셸에서 `layoutImageUrl` 배경(재생은 배치 없으면 비활성). 미리보기는 `useTableOrientation`으로 당구노트와 같은 가로세로 비율 전환.

## 사용 예

```ts
import { getPlayfieldRect, DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT } from "@/lib/billiard-table-constants";
import { buildCuePathMotionPlan, sampleCueMotion } from "@/lib/solution-path-motion";

const rect = getPlayfieldRect(DEFAULT_TABLE_WIDTH, DEFAULT_TABLE_HEIGHT);
const plan = buildCuePathMotionPlan(placement, solutionData, rect);
if (plan) {
  const pos = sampleCueMotion(plan, 0.5, rect); // 50% 진행 시 위치 (정규화·픽셀)
}
```
