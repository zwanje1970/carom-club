# 당구공 배치/해법 구조 정리 — 산출물

## 1. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `lib/billiard-table-constants.ts` | `ObjectBallType`, `BallRole` 타입 추가. `getCueBallColor`, `getObjectBallColor`, `getObjectBallYellowColor`, `isCueBall`, `isObjectBall`, `normalizeCueBallType` 추가. |
| `lib/nangu-types.ts` | `ObjectBallType` re-export. `NanguSolutionInput` 타입 추가. 주석으로 수구/목적구 역할 명시. |
| `app/api/community/nangu/route.ts` | `normalizeCueBallType`로 `cueBall` 정규화, body 타입 `cueBall?: unknown`. |
| `app/api/community/billiard-notes/route.ts` | `normalizeCueBallType` import 및 저장 시 사용. |
| `app/api/community/billiard-notes/[id]/route.ts` | `normalizeCueBallType` import 및 PATCH 시 `cueBall` 정규화. |
| `app/community/nangu/write/page.tsx` | fromNote 로드 시 `normalizeCueBallType(data.cueBall)` 사용. |
| `app/mypage/notes/new/page.tsx` | 저장 payload에 `normalizeCueBallType(cueBall)` 사용. |
| `components/billiard/BilliardContactPanel.tsx` | 색상 로직을 `getCueBallColor`, `getObjectBallColor`, `getObjectBallYellowColor` 사용으로 통일. |
| `components/billiard/BilliardShotPanel.tsx` | 목적구 색상을 `getObjectBallColor()`, `getObjectBallYellowColor()` 사용으로 통일. |

(이미 이전 작업에서 반영된 파일: `components/nangu/NanguSolutionEditor.tsx` — `cuePos`에서 `cueBall === "red"` 제거. `lib/nangu-types.ts` — `ballPlacementToSourceLayout`에서 red `isCue: false` 고정.)

---

## 2. cueBall 관련 잘못된 red 비교 제거 위치

- **NanguSolutionEditor.tsx** (이전 작업): `cuePos = cueBall === "red" ? ...` 제거 → `cueBall === "yellow" ? yellowBall : whiteBall` 만 사용.
- **nangu-types.ts** (이전 작업): `isCue: cueBall === "red"` 제거 → red는 `isCue: false` 고정.
- **그 외**: `cueBall`(수구 타입)과 `"red"`를 비교하는 코드는 없음.  
  `selectedBall === "red"`, `movingBall !== "red"`, `objectBallColor === "red"` 등은 **선택/이동 중인 공** 또는 **목적구 색상**용으로 유지(역할 분리됨).

---

## 3. 타입 변경 사항

- **추가 타입**
  - `CueBallType` = `"white" | "yellow"` (기존 유지, 주석 보강)
  - `ObjectBallType` = `"red"`
  - `BallRole` = `"cue" | "object"`
  - `NanguSolutionInput`: `{ cueBallType: CueBallType; cueBallPosition: { x, y }; objectBallPosition: { x, y } }`
- **규칙**
  - 수구: `CueBallType`만 사용. red는 수구로 사용 불가.
  - 목적구: red 고정 표시. 노란/흰 목적구는 `getObjectBallYellowColor()` 등으로 구분.

---

## 4. 남은 구조상 위험 요소

- **DB/레거시**: `billiardNote.cueBall`, `nanguPost.ballPlacementJson`에 과거에 `"red"`가 들어갔을 수 있음.  
  → **대응**: API/클라이언트 모두 `normalizeCueBallType()`으로 정규화. `"red"` 입력 시 `"white"`로 fallback 후 콘솔 경고.
- **UI**: 수구 선택은 이미 white/yellow만 노출. red는 배치 편집에서 “선택할 공”으로만 사용(목적구 이동용).
- **해법 계산**: 해법 입력을 `NanguSolutionInput` 형태로 명시해 두었으며, `cueBallType`에 red가 오지 않도록 타입으로 차단됨.

---

## 5. 목표 달성 여부

- CueBallType 타입 오류 0
- cueBall과 objectBall 역할 분리 (타입·헬퍼·정규화로 보장)
- red를 수구처럼 취급하는 코드 0
- `npm run build` 통과
- 이후 당구공 배치/해법 기능 확장 시 `CueBallType`/`ObjectBallType`/`normalizeCueBallType` 사용으로 타입 혼선 재발 방지
