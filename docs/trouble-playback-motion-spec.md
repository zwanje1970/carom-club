# 난구 재생 — 출발·감속·두께 요구 및 구현 대응

에디터·재생 훅 작업 시 동일 전제를 쓴다. (세부 제약: `.cursor/rules/trouble-playback-constraints.mdc`, `trouble-playback-contact-sync.mdc`.)

## 1. 제품 요구(원문 정리)

1. 수구의 **원중심**이 **1목에 접촉된 스팟의 원중심**에 도착하면 **1목**은 움직여야 한다.
2. 수구가 **1목을 지나 더 진행**해서 **2목에 접촉된 스팟의 원중심**에 도착하면 **2목**은 움직여야 한다.
3. **수구**는 **거리에 대한 감속**이 있고 **두께에 대한 감속(분배)**이 있다. 수구의 **속도**와 **두께** 값은 **설정**에서 정한다.
4. **1목**은 수구 설정에서 정해진 **속도**와 **두께**에 의해 **속도(재생 시간)**와 **진행 거리**가 정해진다.
5. **1목 스팟을 지나면서** 감속이 진행된 수구는, **2목까지**의 진행에도 **같은 수구 타임라인에서 감속이 이어진다**(한 줄기 τ·이징).
6. **2목**은 수구의 **속도**와 **두께**에 의해 속도와 진행 거리가 정해진다. 이때 **수구와 2목의 두께는 8/16**으로 정한다.

## 2. 구현 대응(요약)

| 요구 | 코드·동작 |
|------|-----------|
| 1목 출발 = 수구 원중심 ↔ 1목 접촉 스팟 원중심 | `useTroublePathPlayback.ts` — `firstObjectCueHitSpotCenterNorm`, `reachedFirstObjectHit`(중심 정렬 + `dAlongRaw`/`dCue` 맞춤 거리). `cuePathSpotCenterNormForPlaybackIndex` |
| 2목 출발 = 수구가 2목 스팟 원중심(1목 지난 뒤) | 동 파일 — `resolveTroubleSecondObjectHitProgress01`(수구 `cuePlan`·수구 `pathPoints`), `reachedSecondObjectHit`. 2목 시작은 **수구** 거리·스팟만 사용 |
| 수구 거리 감속 | `easeOutCue`, 세그먼트 길이 비례 `cueSegmentTimesMs`, `distancePxAfterTimeMsAlongVariableEdgeTimes`, `dCue = cueCap × ratio` |
| 수구 두께·속도(설정) | `buildCuePathMotionPlan` 난구 분기: `troubleTotalMovable…`, `playbackThicknessLossRatioL`(L), `moveDistancePx` 예산, `ballSpeed`→`speedFactor`→`tCueTotalMs` |
| 1목 속도·거리 = 설정 | `objectStartSpeedScaleL = L`, `tObjTotalMs`, `objPlan.moveDistancePx` / `effectiveTravelPx` 등 `cuePlan`에서 넘어온 분배 |
| 수구 1목 이후에도 같은 감속 곡선 | 수구는 `wallMs ∈ [0, tCueTotalMs]` 단일 루프; 1목 출발 후에도 **같은** `easeOutCue`·`dAlongRaw`로 2목 스팟까지 진행 |
| 2목 두께 8/16 + 속도·거리 | `OBJECT2_FIXED_THICKNESS_RATIO = 8/16`, `object2StartSpeedScaleL`에 수구 **2목 도달 시점** `easeOutCue` 도함수 비 곱, `tObj2TotalMs`·`obj2Plan` 거리 |

## 3. 이징 지수 — 현행 코드 값

`lib/solver-engine/core/easing.ts`:

| 함수 | 형태 | 지수 **p** (현행) |
|------|------|-------------------|
| `easeOutCue` | `1 - (1-x)^p` | **1.45** |
| `easeOutObject` | 동일 | **2.35** |

`hooks/useTroublePathPlayback.ts`의 `easeOutCueDerivative01`는 `p * (1-x)^(p-1)` → **1.45 × (1-x)^0.45** (2목 시작 τ 속도 비율용, `easeOutCue`와 동기).

## 4. 검증 시 참고

- 이징 OFF: `NEXT_PUBLIC_DEBUG_DISABLE_PATH_PLAYBACK_EASING=true`
- ratio·cap 합성·세그먼트 시간 비례는 `trouble-playback-constraints.mdc` 고정 항목과 충돌 없이 유지할 것.
