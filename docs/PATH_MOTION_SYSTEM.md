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

- **애니메이션 시간**: `PathMotionPlan.animationDurationSec` / `animationDurationMs` — 세기 **레일 번호(1~5)** 기준.  
  기본은 레일 1에서 약 1초, 레일이 올라갈수록 증가. 값은 **`PATH_ANIMATION_TIMING`** 객체에서 조정 (시연 후 튜닝).  
  Trouble「경로 시연」숨김 시간은 `computePathPreviewDemoHoldMs` (스트로크 ms + `pathPreviewDemoPaddingMs`).

상수는 `rail-power-constants.ts`, `ball-speed-constants.ts`, `path-motion-distance.ts`, `path-animation-timing.ts`, `thickness-power-split.ts`에서 조정.

## 경로 재생 중 충돌 (7단계)

- Trouble 해법 편집기 `경로 재생`: 수구 경로 → (1목 경로가 있으면) 적색 경로 순서로 `PathMotionPlan` 기준 시간에 맞춰 이동.
- 이동 중 **다른 공과 중심거리 &lt; 2R − ε** 이면 즉시 정지, 경로선(오버레이)은 그대로 유지, 문구 **「충돌이 발생하였습니다.」** 표시 (`CollisionWarningToast`). 재계산·새 경로 생성 없음.
- 판정·문구: `lib/path-playback-collision.ts`, `hooks/useTroublePathPlayback.ts`.

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
