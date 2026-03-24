# 난구 해법 — 직선 판정 vs 곡선 재생

## 분리 원칙

| 구분 | 데이터 | 비고 |
|------|--------|------|
| 판정·경고·clearance·1목 판정 | `pathPoints` / `objectPathPoints` (직선 꼭짓점) | 기존 로직 유지 |
| 표시·재생 이동 | `cuePathCurveControls` / `objectPathCurveControls` + 직선 꼭짓점으로 샘플링된 폴리라인 | `lib/path-bezier-playback.ts` |

## 수구 / 1목 곡선 playback 연결

1. `buildCuePathMotionPlan` / `buildObjectPathMotionPlan`에서 시연용 직선 폴리라인(`polyStraight`)을 만든 뒤, 세그먼트 키(`cueSegmentCurveKey` / `objectSegmentCurveKey`)에 대응하는 제어점이 있으면 **2차 베지어를 샘플링**해 `polylineNormalized`를 곡선으로 교체한다.
2. `useTroublePathPlayback`이 `cuePathCurveControls` / `objectPathCurveControls`를 옵션으로 넘긴다 (`SolutionPathEditorFullscreen`의 상태).
3. `sampleCueMotion` / `sampleObjectMotion`은 기존처럼 `plan.polylineNormalized` 위에서만 샘플하므로, 곡선이 있으면 공이 **실제로 곡선을 따라** 움직인다.

## 볼스피드 → 거리 (난구 재생)

- `lib/trouble-playback-distance.ts`의 `troubleTotalMovableDistancePx(rect, ballSpeed)`  
- 모델: \(n\)레일(볼스피드→`ballSpeedToRailCount`)일 때 단위 거리 \(n \times 100 \times 1.05\)를, 5레일 최대가 플레이필드 **긴 변**에 맞도록 선형 스케일한다.

## 두께 분배 (충돌 순간)

- `lib/trouble-thickness-split.ts` — `computeTroubleThicknessSplit`  
- \(L = \mathrm{hitSteps}/20\) (1~16 스텝), `objectTransfer = L`, `cueRetain = 1-L`  
- `thicknessOffsetX` → `thickness01FromOffsetX` → 1~16 스텝으로 양자화.

## 곡선 감속 (요구 11단계)

- 구간별 곡률 지표·계수는 `quadraticBezierCurvatureMetric` 및 주석으로 `path-bezier-playback.ts`에 두었으며, **재생 속도 곡선과의 결합은 미구현** (구간 종료 속도 × 계수 적용 시 `pathProgress`/τ 분리 설계 필요).

## 중간 정지 / 끝 정지

- `sampleMotionAlongPath`가 `moveDistancePx = min(경로 길이, 예산)`으로 캡하므로, 예산이 부족하면 경로 중간에서 멈춘다.  
- 난구 모드에서 예산은 `troubleTotalMovablePx × cueRetain` / `× objectTransfer`로 각각 캡된다.

## 수정·추가 파일

- `lib/path-bezier-playback.ts` — 베지어 샘플, 스팟 끝 꼭짓점 인덱스  
- `lib/trouble-playback-distance.ts` — 볼스피드 거리 모델  
- `lib/trouble-thickness-split.ts` — 두께 표(L=step/20)  
- `lib/solution-path-motion.ts` — 곡선 폴리라인, `spotEndVertexIndices`, 난구 거리/두께  
- `hooks/useTroublePathPlayback.ts` — 곡선 제어·`troublePlaybackModel` 전달  
- `components/nangu/SolutionPathEditorFullscreen.tsx` — 곡선 상태 전달  
