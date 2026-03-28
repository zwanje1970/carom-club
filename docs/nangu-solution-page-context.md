# 난구해결사 · 경로선 그리기 페이지 컨텍스트

> 목적: 이후 기능 추가·수정 시 **기존 로직을 깨지 않기 위한** 코드 기준 문서.  
> 원칙: 아래는 **저장소 코드를 직접 읽어 정리**했다. 불확실한 추정은 **「확인 필요」**로 표시한다.

---

## 1. 페이지 개요

### 역할 (정확히)

- **난구(nangu) 해법 작성 UI**에서, 사용자가 **수구 진행 경로(스팟 폴리라인)** 를 그리는 **전체화면 편집기**다.
- 진입 경로: `NanguSolutionEditor`가 `fullScreenEditMode === true`일 때 `SolutionPathEditorFullscreen`을 `variant="nangu"`로 렌더한다.
- 연결 라우트(코드 기준):  
  - `app/community/nangu/[id]/solution/new/NanguSolutionNewClient.tsx`  
  - `app/community/nangu/[id]/solution/[solutionId]/edit/NanguSolutionEditClient.tsx`  
  둘 다 `NanguSolutionEditor` 사용.

### 수행 기능

| 기능 | 구현 위치(요약) |
|------|------------------|
| 수구 경로 스팟 추가·이동·삭제·세그먼트 삽입 | `SolutionPathEditorFullscreen` 상태 + `lib/cue-path-cushion-rules` 등 |
| 경로선·스팟 **SVG 렌더** | `NanguSolutionPathOverlay` |
| 당구대·공 **Canvas** | `NanguReadOnlyLayout` → `BilliardTableCanvas` |
| 핀치/팬 **줌** | `SolutionTableZoomShell` + `solution-table-zoom-context` (`zoomCtxRef`) |
| 경로 **재생(애니메이션)** | `useSolutionPathPlayback` (= `useTroublePathPlayback` re-export) — `requestAnimationFrame` 루프 |
| 미리보기(전체화면 아님) | `NanguSolutionEditor` 본문에서 `NanguReadOnlyLayout` + `NanguSolutionPathOverlay` (`pathMode={false}`) |

**nangu 전용 제약(코드):** `SolutionPathEditorFullscreen`에서 `showObjectPath = variant === "trouble"` 이므로 **nangu에서는 1목(object) 경로 UI·데이터가 사용되지 않는다** (`objectPathPoints`는 부모가 `[]`로 넘김, 오버레이에도 빈 배열 전달). 재생 훅에는 `EMPTY_NANGU_OBJECT_PATH_POINTS`가 넘어간다.

---

## 2. 관련 파일 구조

| 경로 | 역할 |
|------|------|
| `app/community/nangu/[id]/solution/new/NanguSolutionNewClient.tsx` | 새 해법 페이지 클라이언트 셸 |
| `app/community/nangu/[id]/solution/[solutionId]/edit/NanguSolutionEditClient.tsx` | 해법 수정 페이지 클라이언트 셸 |
| `components/nangu/NanguSolutionEditor.tsx` | 해법 폼·설정·undo 스냅샷(`editor`). **전체화면 경로 편집** 시 `SolutionPathEditorFullscreen` 마운트, `key={pathFsKey}`. |
| `components/nangu/SolutionPathEditorFullscreen.tsx` | **경로 전체화면의 단일 진입 컴포넌트** (nangu / trouble 공용). 상태·재생·줌·오버레이 props 집결. |
| `components/nangu/NanguSolutionPathOverlay.tsx` | **SVG 오버레이**: 경로 polyline/곡선/스팟/포인터 처리. |
| `components/nangu/NanguReadOnlyLayout.tsx` | `BilliardTableCanvas` 래퍼. `betweenTableAndBallsLayer`로 경로 SVG를 **테이블과 공 사이**에 끼움. |
| `components/billiard/BilliardTableCanvas.tsx` | 테이블(z-0) / children 경로(z-10 또는 z-30) / 공(z-20) 레이어 분리 (`splitBallLayer`). |
| `components/nangu/SolutionTableZoomShell.tsx` | 뷰포트 줌·팬, `zoomApiRef`로 `viewportClientToCanvasPx` 제공. |
| `components/nangu/solution-table-zoom-context.tsx` | 줌 컨텍스트 타입·Provider (오버레이가 좌표 변환에 사용). |
| `components/nangu/PathPlaybackViewOverlay.tsx` | 재생 중 경로선/그리드/단순보기 토글 UI (재생 중에만 표시). |
| `hooks/useSolutionPathPlayback.ts` | `useTroublePathPlayback` re-export 한 줄. |
| `hooks/useTroublePathPlayback.ts` | **재생 rAF 루프**, `ballNormOverrides` / `ballNormOverridesLiveRef`, 충돌·타이밍. |
| `lib/cue-path-cushion-rules.ts` | 스팟 스냅·추가·중복 방지 등. |
| `lib/solution-path-geometry.ts` | `resolveEffectiveFirstObjectCollisionFromCuePath` 등 (1목 충돌 후보 — nangu에서도 수구 경로 검증에 사용). |
| `lib/solution-path-pointer-classify.ts` | 포인터 히트 분류 (오버레이와 공유 개념). |
| `hooks/useSolutionPathMotion.ts` | `buildCuePathMotionPlan` 기반 **별도 진행률 UI용** 훅. **`SolutionPathEditorFullscreen`에서는 import/사용 없음** (확인: grep 기준). |

---

## 3. 상태(State) 구조

### 3.1 부모 `NanguSolutionEditor` (경로와 직접 연결되는 부분)

| State | 역할 |
|-------|------|
| `editor` (`NanguSolutionEditorUndoSnapshot`) | `pathPoints`, `cuePathCurveNodes`, `objectPathCurveNodes`, 설정값 등 **저장 단위** 스냅샷. |
| `undoStack` | 에디터 전체 undo. |
| `fullScreenEditMode` | `true`일 때만 `SolutionPathEditorFullscreen` 표시. |
| `pathFsKey` | `enterFullScreenEdit` 시 증가 → **전체화면 에디터 리마운트**로 내부 state 초기화. |
| `panelSettings` / `settingsPanelOpen` 등 | 설정 패널; 전체화면에 `settingsValue` 등으로 전달. |

**핵심:** 전체화면 안의 `pathPoints`는 초기값으로 `editor.pathPoints`를 받지만, **확인(`onConfirm`) 시에만** `commit`으로 부모 `editor`에 반영된다.

### 3.2 `SolutionPathEditorFullscreen` — React `useState` 전부

| State | 역할 | nangu에서의 비고 |
|-------|------|------------------|
| **`pathPoints`** | 수구 경로 스팟 배열 (`NanguPathPoint[]`). | **핵심 데이터** |
| `objectPathPoints` | 1목 경로 스팟. | `nangu`는 부모가 `[]`만 넘김·UI 미사용 |
| `pathMode` | 수구 경로 편집 모드. | nangu: `troublePathEditLayer` 대신 사용 |
| `objectPathMode` | 1목 경로 편집 모드. | nangu에선 비활성 유지 effect |
| `troublePathEditLayer` | `"cue" \| "object" \| null` | **`variant === "trouble"`일 때만** 의미 |
| `pathUndoStack` | 경로 전용 undo 스택 (`PathEditorPairSnapshot[]`). | |
| `cuePathCurveControls` / `objectPathCurveControls` | 곡선 표시용 제어점 (trouble). | nangu: 오버레이에 빈 배열 전달 |
| `cuePathCurveNodes` / `objectPathCurveNodes` | 곡선 노드. | nangu는 부모에서 온 초기값만 동기화 |
| `troubleCurveEditMode` | trouble 전용 곡선 편집 토글. | |
| `undoLimitToastVisible` | 경로 undo 한계 토스트. | |
| `zoomFocusOverlay` | 오버레이 모드 줌 초점 (캔버스 px). `isNoteShell`이면 `playfieldCenterCanvas`로 대체. | |
| `viewportMdUp` | `(min-width: 768px)` | 노트 전체화면 orientation 계산 보조 |
| `leftPathDrawerOpen` / `rightPathDrawerOpen` | 드로어 열림. | |
| `troubleDrawerDragPx` / `troubleDrawerDragging` | trouble 우측 드로어 스와이프. | |
| `troubleLeftDrawerOpen` / `troubleLeftDrawerDragPx` / `troubleLeftDrawerDragging` | trouble 좌측 드로어. | |
| `pathSaveFeedback` | 저장 피드백. | |
| `menuInfoFeedback` | 메뉴 안내 문자열. | |
| `spotMagnifierEnabled` | 스팟 돋보기 설정. | `NanguSolutionPathOverlay`에 `magnifierEnabled` |
| `tableGridOn` / `tableDrawStyle` | 편집 중 테이블 표시. | 재생 중이면 `playback*` 값이 우선 |
| `cueSpotOn` / `cueBallChoice` / `cuePickerOpen` | 수구 종류·스팟 표시. | |
| **`cuePathActiveSpotId` / `objectPathActiveSpotId`** | 활성 스팟 id (오버레이와 동기화). | path 길이 변경 시 null로 리셋 effect |
| **`playbackPathLinesVisible` / `playbackGridVisible` / `playbackDrawStyle`** | 재생 중 전용 표시 옵션. | |
| **`playbackRate`** | `0.5 \| 1` — `useSolutionPathPlayback`에 전달. | |
| `resetConfirmOpen` / `thicknessNotSetDialogOpen` | 다이얼로그. | |

**Ref 동기화 (렌더 최신값 보장):** `pathPointsRef`, `objectPathPointsRef`, `cueCurveControlsRef`, `objectCurveControlsRef`, `cueCurveNodesRef`, `objectCurveNodesRef` — 각각 해당 state와 `useEffect`로 동기화. undo 스냅샷·콜백에서 최신 참조용.

### 3.3 `useSolutionPathPlayback` 반환(편집기가 소비)

| 이름 | 역할 |
|------|------|
| **`pathPlayback.isPlaybackActive`** | 재생 중이면 줌 상호작용 잠금, 오버레이 일부 동작 제한. |
| **`pathPlayback.ballNormOverrides`** | 재생 종료 후·일시 정지 등 **커밋된** 공 norm (state). |
| **`pathPlayback.ballNormOverridesLiveRef`** | rAF 루프가 매 프레임 갱신 — **캔버스가 읽어 그리는 live 위치**. |
| `playbackPhase` | `"idle" \| "cue" \| "object"`. |
| `startPlayback` / `resetPlayback` | 재생 시작·중단. |
| `canPlayback` | 재생 가능 여부. |
| `collisionMessage` / `dismissCollisionMessage` | 충돌 경고. |
| 기타 `playbackTimingDebug`, `playbackReflectionMeta`, `cuePlaybackPathDebug` … | 디버그·메타. |

### 3.4 `NanguSolutionPathOverlay` — 로컬 UI state

| State | 역할 |
|-------|------|
| `draggingId` / `draggingObjectId` | 수구/1목 스팟 드래그 중 id. |
| `draggingCurve` | 곡선 핸들 드래그 `{ kind, key }`. |
| `spotMagnifier` | 돋보기 위치 (client + canvas). |
| `spotPrecisionUi` | 스팟 정밀 이동 UI. |
| `pathFineTuneTarget` / `pathFineTuneMagnifier` / `pathFineTuneMagOffset` | 곡선·스팟 **미세조정** 모달/패드. |

다수의 `useRef`는 드래그·롱프레스·포인터 캡처·미세조정 타이머용 (상세는 파일 257행대~).

### 영향 관계 (요약)

- `pathPoints` 변경 → prune 곡선 노드 effect → `cueToFirstObjectHit` 재계산 → 레이어 강제 cue effect → 오버레이 세그먼트·히트 영역 변경.
- `pathPlayback.isPlaybackActive` → `SolutionTableZoomShell.interactionLocked`, 경로선 표시 `playbackPathLinesVisible`, `NanguReadOnlyLayout`의 `ballNormOverrides` / `LiveRef`.
- 줌: `getNormalizedFromEvent` / `getPointerAimFromEvent`가 **`zoomCtxRef.current`** 에 의존 → 스팟 좌표와 일치해야 함.

---

## 4. 렌더링 구조

### 트리 (nangu 전체화면, `layoutForCue` 있을 때)

```
SolutionTableZoomShell
  └─ (zoom) fragment
       ├─ div (테이블 영역)
       │    └─ NanguReadOnlyLayout
       │         └─ BilliardTableCanvas (splitBallLayer=true)
       │              ├─ canvas z-0  — 당구대
       │              ├─ div z-10   — children = NanguSolutionPathOverlay (SVG 경로·스팟·곡선 핸들)
       │              └─ canvas z-20 pointer-events-none — 공
       └─ PathPlaybackViewOverlay (재생 중, !isNoteShell)
```

- `NanguReadOnlyLayout` props: `pathOverlayAboveBalls={false}` (기본) → 주석대로 **공이 경로 위**(z-20 > z-10). 1목 가시성은 SVG에서 시작점 보정 등으로 처리 (`BilliardTableCanvas` 주석 1163~1167행).
- `betweenTableAndBallsLayer`에만 오버레이를 넣는 패턴이 **난구 해법 표준**.

### 좌표계

- 저장·스냅·충돌: **landscape 플레이필드 norm** (`DEFAULT_TABLE_WIDTH` × `DEFAULT_TABLE_HEIGHT` 기준 `getPlayfieldRect`).
- `orientation === "portrait"`: 캔버스 가로세로 **스왑** (`tableCanvasW/H`), `getNormalizedFromEvent`에서 `portraitToLandscapeNorm`으로 **내부는 항상 landscape norm**.

---

## 5. 사용자 입력 흐름

1. **포인터 다운** → `NanguSolutionPathOverlay` 내부 `classifySolutionPathPointerHit` 등으로 히트 종류 결정 → 스팟 드래그 / 빈 플레이필드 탭 / 쿠션·프레임 aim / 곡선 핸들 등 분기.
2. **플레이필드 탭 (norm)** → `onAddPoint` → `runCueAppend` — `cuePathAppendWouldDuplicateExistingSpot`, 디바운스 `CUE_PLAYFIELD_APPEND_DEBOUNCE_MS`, `pushPathUndoSnapshot` 조건은 각 핸들러 참조.
3. **줌 영역 빈 탭** → `onPathAppendPointerDown(pointerId)`로 `suppressZoomEmptyTapPointerIdRef` 설정 — 확대 뷰 `onEmptyTap`과 **이중 추가 방지** (주석 307~313행).
4. **스팟 드래그** → `onPathSpotDragStart` → `pushPathUndoSnapshot` → `onMovePoint` / `moveCuePathSpotById`.
5. **재생 버튼** → `handlePlayTap` → `pathPlayback.startPlayback()` 또는 `resetPathPlayback()`.
6. **설정** → `SettingsPanel` 등은 동일 파일 하단/드로어에서 `settingsValue` 변경 → `playbackBallSpeed`·`thicknessOffsetX` 등이 재생 훅 옵션으로 전달.

---

## 6. 애니메이션 구조 (핵심)

### requestAnimationFrame

- **경로 스팟 “깜빡임”:** `NanguSolutionPathOverlay` 주석대로 **SMIL `<animate>`** (`SPOT_BLINK_CYCLE_MS`) — **rAF/setState 아님** (파일 상단 56~63행 부근).
- **공 위치 재생:** **사용함.** `hooks/useTroublePathPlayback.ts` 내부 `startPlayback` → `stepPlayback` → 매 프레임 `requestAnimationFrame(stepPlayback)` (예: 910, 928행).
- **루프 안에서 `ballNormOverrides`는 ref로만 갱신** (`writeBallNormOverridesRefOnly` / 주석: “rAF 루프 전용: ref만 갱신, setState 없음”).  
  `BilliardTableCanvas`는 `ballNormOverridesLiveRef`를 읽어 **재생 중 공 위치 갱신**.

### 재생 흐름

- **시작:** `startPlayback` — `playbackBundleRef.current` 스냅샷 사용, `commitPlaybackPhase("cue")`, `isPlayingRef.current = true`, 첫 `requestAnimationFrame(stepPlayback)`.
- **정지/리셋:** `resetPlayback` / `cancelRaf` — `cancelAnimationFrame`, phase idle, 커밋 오버라이드 null.
- **속도:** `playbackRate` 옵션 → 훅 내부 duration 계산에 반영 (훅 내부 상세 식은 **수정 시** `.cursor/rules/trouble-playback-constraints.mdc` 준수).
- **종료 후:** `PLAYBACK_RESTORE_DELAY_MS`(3000ms) 타이머로 최종 위치 표시 후 배치 복귀 (922~925행 부근).

### 난구(nangu)에서의 재생 데이터

- `objectPathPoints: variant === "trouble" ? objectPathPoints : EMPTY_NANGU_OBJECT_PATH_POINTS` — **nangu는 항상 빈 1목 경로**로 재생 데이터가 구성된다.

### 절대 임의 변경 시 위험한 이유

- 거리·시간·이징·세그먼트 비례는 **트러블 재생 정책**과 공유된다. 변경 시 난구/트러블 **양쪽** 시각·물리 일관성이 깨질 수 있다. 문서화된 제약: `.cursor/rules/trouble-playback-constraints.mdc`, `docs/NANGU_SOLUTION_ROLLOUT.md`(롤아웃 정책).

---

## 7. useEffect 및 주요 로직

### `SolutionPathEditorFullscreen.tsx`

| 의존성 (요약) | 역할 | 잘못 수정 시 |
|---------------|------|----------------|
| `[pathPoints]` / `[objectPathPoints]` | ref 동기화 | undo/스냅샷 꼬임 |
| `[cuePathCurveControls]` 등 4개 | 곡선 ref 동기화 | 곡선 undo 불일치 |
| `[pathPoints, objectPathPoints]` | `pruneCuePathCurveControls` 등 곡선 정리 | 세그먼트와 곡선 불일치 |
| `[]` (cleanup) | undo 토스트 타이머 해제 | 메모리 누수 |
| `[viewportMdUp]` | matchMedia | orientation 오판 |
| `[troubleDrawerDragPx]` 등 | 드로어 ref 동기화 | 스와이프 깨짐 |
| `[rightPathDrawerOpen]` | 드로어 열릴 때 drag px 초기화 | 위치 점프 |
| `[troubleLeftDrawerOpen]` | 좌측 동일 | 동일 |
| `[ballPlacement?.cueBall]` | cueBallChoice 동기화 | 수구 색 불일치 |
| `[pathPoints.length]` | `cuePathActiveSpotId` null | 활성 스팟 고아 |
| `[objectPathPoints.length]` | `objectPathActiveSpotId` null | 동일 |
| `[isNoteShell, playfieldCenterCanvas]` | 줌 포커스를 중앙으로 | 빈 탭 줌 어긋남 |
| verbose 로그 | `[variant, settingsValue, ...]` | 동작 없음 |
| `[pathPlayback.isPlaybackActive, tableDrawStyle]` | 재생 시작 시 `playbackDrawStyle` 동기화 | 재생 뷰 스타일 불일치 |
| `[isNoteShell, ballPlacementFullscreen]` | fullscreen API | 노트 셸 깨짐 |
| `[isNoteShell, variant]` | 노트 셸에서 레이어 초기화 | 편집 레이어 오류 |
| `[layoutForCue, cueToFirstObjectHit, ...]` | 1목 미확정 시 수구 레이어 유지 | object 모드 오동작 |
| `[pathPoints.length, variant]` | 수구 경로 0이면 object 경로·모드 초기화 | 빈 상태 불일치 |
| `[onCancel, onUndoPathClick, ...]` | Ctrl+Z undo, Escape 취소/드로어 닫기 | 단축키 깨짐 |

### `useTroublePathPlayback.ts`

| 의존성 | 역할 |
|--------|------|
| pathPoints, objectPathPoints, ballPlacement, ballSpeed, … (긴 배열) | 입력 변경 시 **`resetPlayback`** — 편집·재생 동기화 |
| cleanup | 언마운트 시 rAF·타이머 정리 |

### `NanguSolutionPathOverlay.tsx`

| 의존성 | 역할 |
|--------|------|
| `[pathFineTuneMagOffset]` | ref 미러 |
| `[pathFineTuneTarget]` | ref 미러 |
| `[]` cleanup | 곡선 롱프레스·스팟 정밀·미세조정 타이머 정리 |
| `[pathFineTuneStep]` | `pathFineTuneMoveRef` 갱신 |
| `[pathFineTuneTarget]` | 오프셋 초기화 |
| `[pathMode, objectPathMode, pathFineTuneTarget, ...]` | 편집 모드 꺼지면 미세조정 UI 종료 |

---

## 8. 절대 수정 금지 영역 (강조)

| 영역 | 파일·심볼 | 이유 |
|------|-----------|------|
| 재생 시간·거리·이징 | `hooks/useTroublePathPlayback.ts`, `lib/trouble-playback-rail-timing.ts`, `lib/solver-engine/core/equal-edge-timing.ts`, `easeOutCue` / `easeOutObject` | 워크스페이스 규칙 `trouble-playback-constraints.mdc` — **시각·물리 계약** |
| rAF 루프 내 setState 패턴 | `useTroublePathPlayback` `stepPlayback` | 성능·재생 상태 불일치 |
| 세그먼트 길이 비례 시간 | `buildSegmentTimesMsProportionalToLength` 사용처 | 동일 |
| 충돌 판정 | `lib/path-playback-collision.ts`, 훅 내 `cuePhaseCollisionWithOthers` 등 | 재생 신뢰도 |
| nangu 1목 경로 비활성 가정 | `EMPTY_NANGU_OBJECT_PATH_POINTS`, `showObjectPath` | 여기를 nangu에서 켜면 **미검증 경로** |

---

## 9. 확장 가능 영역

- **새 UI 오버레이:** `SolutionTableZoomShell` 자식 `fragment` 안, **테이블 div 밖**에 `absolute` 레이어 추가 — `pointer-events`와 `z-index`만 기존 패턴과 맞추면 됨.
- **읽기 전용 표시:** `NanguSolutionEditor` 미리보기 블록처럼 `pathMode={false}` 인 오버레이만 추가.
- **전체화면과 데이터 공유:** 반드시 `onConfirm` / `commit` 경로로 부모 스냅샷 갱신 — **내부 state만 바꾸고 저장하지 않으면** 해법 JSON에 반영 안 됨.

---

## 10. 데이터 흐름 요약

```
[사용자 포인터]
  → NanguSolutionPathOverlay (분류·SVG)
  → 콜백 (onAddPoint, onMovePoint, …)
  → SolutionPathEditorFullscreen setState (pathPoints, …)
  → 재렌더 → 오버레이 + NanguReadOnlyLayout

[재생]
  → handlePlayTap → useTroublePathPlayback.startPlayback
  → rAF stepPlayback → ballNormOverridesLiveRef 갱신
  → BilliardTableCanvas가 ref 읽어 공 위치 갱신
  → 종료 후 committedBallNormOverrides / 타이머 복귀

[저장]
  → onConfirm → NanguSolutionEditor commit → editor.pathPoints 등 반영 → submit 시 payload
```

---

## 11. 주의사항

- **nangu vs trouble:** 동일 컴포넌트이나 `variant`에 따라 곡선·object 경로·재생 입력이 다름. **nangu만 고치는 패치가 trouble에 영향**을 줄 수 있음.
- **줌 좌표:** `getNormalizedFromEvent`가 null이면 스팟 추가 안 됨 — 줌 컨텍스트 미초기화 버그로 자주 연결됨.
- **이중 탭 방지:** `onPathAppendPointerDown` + 디바운스 ref — 제거 시 스팟 중복 추가.
- **`useSolutionPathMotion`:** 이름이 비슷하지만 **이 전체화면 페이지의 재생과는 별계** — 혼동 금지.
- **문서 미기재 세부:** `NanguSolutionPathOverlay`의 개별 포인터 핸들러 전체 분기·`handlePointerDown` 이상 길이는 **파일 직접 열람** 권장 (확인 필요: 라인별 분기를 여기서 전부 열거하지 않음).

---

## 부록: `presentation` prop

- `noteBallPlacementFullscreen`: `isNoteShell === true` — 노트/난구 전체화면 셸 레이아웃·드로어·Escape 동작 등이 분기됨.
- `overlay`: 일반 오버레이 모드.

(정의: `SolutionPathEditorFullscreenProps.presentation`.)
