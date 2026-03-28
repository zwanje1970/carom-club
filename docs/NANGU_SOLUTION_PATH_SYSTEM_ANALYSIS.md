# Nangu Solution Path System Analysis

## 1. 핵심 파일 목록

### 타입 / 저장 구조

- `lib/types/shared-types.ts`
  - `NanguBallPlacement`, `NanguPathPoint`, `NanguCurveNode`, `NanguSolutionPath` 정의
- `lib/types/solver-types.ts`
  - `NanguSolutionData` 정의
- `lib/nangu-types.ts`
  - 실제로는 타입 재export 허브이며, 위 타입들을 기존 import 경로로 유지
- `prisma/schema.prisma`
  - `NanguPost.ballPlacementJson`
  - `NanguSolution.dataJson`
  - `TroubleShotPost.ballPlacementJson`
  - `TroubleShotSolution.solutionDataJson`

### 작성 / 수정 화면

- `components/nangu/NanguSolutionEditor.tsx`
  - 난구해결사 해법 작성/수정용 에디터
- `components/trouble/TroubleSolutionEditor.tsx`
  - trouble 해법 작성/수정용 에디터
- `components/nangu/SolutionPathEditorFullscreen.tsx`
  - Nangu / Trouble 공용 전체화면 경로 편집기
- `components/nangu/NanguSolutionPathOverlay.tsx`
  - 경로선, 스팟, 곡선 핸들 렌더 및 포인터 편집 처리
- `lib/solution-editor-hydrate.ts`
  - persisted solution data를 작성 state로 복원

### 저장 API

- `app/api/community/nangu/[id]/solutions/route.ts`
  - 난구 해법 생성
- `app/api/community/nangu/[id]/solutions/[solutionId]/route.ts`
  - 난구 해법 수정
- `app/api/community/trouble/[postId]/solutions/route.ts`
  - trouble 해법 생성
- `app/api/community/trouble/[postId]/solutions/[solutionId]/route.ts`
  - trouble 해법 수정

### 보기 / 렌더

- `app/community/nangu/[id]/page.tsx`
  - 난구 상세에서 `dataJson` 파싱 후 클라이언트로 전달
- `app/community/nangu/[id]/NanguPostDetailClient.tsx`
  - 난구 상세 해법 렌더
- `components/nangu/NanguSolutionLayerCanvas.tsx`
  - 저장된 난구 해법 경로선 렌더
- `lib/community-post-detail-server.ts`
  - trouble 해법 목록 조회 시 `solutionDataJson` 파싱
- `components/community/CommunityPostDetailView.tsx`
  - trouble 상세 화면

### 재생 / 애니메이션

- `hooks/useTroublePathPlayback.ts`
  - 실제 재생 핵심 훅
- `hooks/useSolutionPathPlayback.ts`
  - `useTroublePathPlayback` 재export
- `lib/solver-engine/policies/trouble-playback-solution-data.ts`
  - 현재 편집 state를 재생용 `NanguSolutionData`로 재구성
- `lib/solution-path-motion.ts`
  - playback용 polyline / motion plan 생성
- `lib/solution-path-types.ts`
  - 직선 segment 구성 함수
- `lib/path-curve-display.ts`
  - curve key 규약 및 prune / clone 유틸
- `lib/solution-path-geometry.ts`
  - 수구 첫 충돌 / 1목 충돌 판정

### 기타 관련 유틸

- `lib/trouble-solution-data-to-overlay.ts`
  - trouble solution JSON을 overlay용 point 구조로 바꾸는 유틸
  - 이번 확인 범위에서는 `CommunityPostDetailView.tsx`에서 직접 사용되는 코드는 찾지 못함

## 2. 구조 개요

현재 구조는 하나의 전역 경로 원본을 계속 들고 가는 방식이 아니라, 단계별로 원본이 바뀌는 구조다.

실제 코드 기준 단계별 구분:

1. 작성 중
   - Nangu: `NanguSolutionEditor` 내부 `editor` state가 원본
   - Trouble: `TroubleSolutionEditor` 내부 `pathPoints`, `objectPathPoints` 등이 원본
2. 전체화면 편집 중
   - `SolutionPathEditorFullscreen` 내부 state가 임시 원본
   - 부모 state의 복사본을 편집
3. 저장 직전
   - 작성 state를 `NanguSolutionData`로 조립
4. 저장 후
   - DB의 `dataJson` / `solutionDataJson` 문자열이 persisted 원본
5. 보기 화면
   - persisted JSON을 `JSON.parse()`한 객체가 렌더 원본
6. 재생 화면
   - 현재 편집 state를 다시 가공해 만든 playback용 파생 데이터 사용

중요한 구조적 사실:

- 경로의 기본 모델은 "연속 stroke"가 아니라 "스팟 배열"이다.
- 수구 자체는 `pathPoints`에 저장되지 않는다.
- 1목 경로는 `objectPathPoints` 또는 `reflectionPath`로 별도 관리된다.
- 곡선은 segment별 제어점 기반이며, 직선 경로와 분리되어 저장된다.
- Trouble 쪽은 작성 state, persisted JSON, playback용 재구성 데이터의 의미가 완전히 동일하지 않다.

## 3. 데이터 구조

### 3.1 공 배치 타입

파일: `lib/types/shared-types.ts`

```ts
export interface NanguBallPlacement {
  redBall: { x: number; y: number };
  yellowBall: { x: number; y: number };
  whiteBall: { x: number; y: number };
  cueBall: CueBallType;
}
```

설명:

- 모든 공 좌표는 정규화 좌표 `0..1`
- `cueBall`은 실제 수구가 `white`인지 `yellow`인지 표시
- 문제 공배치 원본은 Nangu / Trouble 모두 이 구조를 JSON 문자열로 저장

### 3.2 경로 포인트 타입

파일: `lib/types/shared-types.ts`

```ts
export interface NanguPathPoint {
  id: string;
  x: number;
  y: number;
  type: "ball" | "cushion" | "free" | "end";
}
```

설명:

- 경로 편집기는 자유 연속선이 아니라 스팟 배열을 저장
- `id`는 편집, 삭제, 이동, curve key 연결에 사용
- `type`은 스팟의 의미를 나타냄
  - `ball`
  - `cushion`
  - `free`
  - `end`

### 3.3 곡선 노드 타입

파일: `lib/types/shared-types.ts`

```ts
export interface NanguCurveNode {
  segmentKey: string;
  x: number;
  y: number;
}
```

설명:

- 곡선은 스팟 자체가 아니라 "segment"에 붙는다
- `segmentKey`는 어느 선분의 제어점인지 식별한다

### 3.4 저장용 경로 타입

파일: `lib/types/shared-types.ts`

```ts
export interface NanguSolutionPath {
  points: { x: number; y: number }[];
  pointsWithType?: NanguPathPoint[];
}
```

설명:

- `points`는 레거시 호환 좌표 배열
- `pointsWithType`가 있으면 상세 타입 정보가 살아 있는 경로
- 복원 시 `pointsWithType`가 우선 사용된다

### 3.5 전체 해법 데이터 타입

파일: `lib/types/solver-types.ts`

```ts
export interface NanguSolutionData {
  isBankShot: boolean;
  thicknessOffsetX?: number;
  tipX?: number;
  tipY?: number;
  spinX?: number;
  spinY?: number;
  paths: NanguSolutionPath[];
  reflectionPath?: NanguSolutionPath;
  reflectionObjectBall?: ObjectBallColorKey;
  backstrokeLevel?: number;
  followStrokeLevel?: number;
  ballSpeed?: number;
  speedLevel?: number;
  speed?: number;
  depth?: number;
  explanationText?: string;
  cuePathDisplayCurves?: PathSegmentCurveControl[];
  objectPathDisplayCurves?: PathSegmentCurveControl[];
  cuePathCurveNodes?: NanguCurveNode[];
  objectPathCurveNodes?: NanguCurveNode[];
  settings?: SolutionSettingsValue;
}
```

경로선 관련 핵심 필드:

- `paths`
  - 수구 경로
- `reflectionPath`
  - 1목 경로
- `reflectionObjectBall`
  - 1목 경로에서 실제 움직이는 공
- `cuePathDisplayCurves`
- `objectPathDisplayCurves`
- `cuePathCurveNodes`
- `objectPathCurveNodes`

## 4. 작성 흐름

### 4.1 Nangu 새 작성

파일 흐름:

- `app/community/nangu/[id]/solution/new/page.tsx`
- `components/nangu/NanguSolutionEditor.tsx`
- `components/nangu/SolutionPathEditorFullscreen.tsx`
- `components/nangu/NanguSolutionPathOverlay.tsx`

실제 흐름:

1. `NanguSolutionNewPage`가 `/api/community/nangu/${postId}`를 호출
2. 응답에서 `ballPlacement`, `title`, `content`를 읽는다
3. `NanguSolutionEditor`가 렌더된다
4. `NanguSolutionEditor` 내부에서
   - `createInitialNanguSnapshotFromEditorProps(initialSolutionData, initialPersistedSettings)` 호출
   - `const [editor, setEditor] = useState(...)` 생성
5. 경로 편집은 `SolutionPathEditorFullscreen`에서 수행한다
6. fullscreen 내부에서
   - `pathPoints`
   - `objectPathPoints`
   - `cuePathCurveControls`
   - `objectPathCurveControls`
   - `cuePathCurveNodes`
   - `objectPathCurveNodes`
   를 state로 관리한다
7. 저장 버튼을 누르면 fullscreen `onConfirm(...)`이 부모 에디터에 결과를 넘긴다
8. 최종적으로 `NanguSolutionEditor.handleSubmit()`이 `NanguSolutionData`를 조립한다
9. `POST /api/community/nangu/[id]/solutions`로 전송한다

### 4.2 Trouble 새 작성

파일 흐름:

- `app/community/trouble/[postId]/solution/new/page.tsx`
- `components/trouble/TroubleSolutionEditor.tsx`
- `components/nangu/SolutionPathEditorFullscreen.tsx`
- `components/nangu/NanguSolutionPathOverlay.tsx`

실제 흐름:

1. `TroubleSolutionNewPage`가 `/api/community/trouble/${postId}` 호출
2. 응답에서
   - `ballPlacement`
   - `layoutImageUrl`
   - `title`
   - `content`
   를 읽는다
3. `TroubleSolutionEditor` 렌더
4. `createTroubleSolutionEditorInitialState(...)`로 초기 state 구성
5. 내부 state는 각각 분리되어 존재한다
   - `pathPoints`
   - `objectPathPoints`
   - `cuePathDisplayCurves`
   - `objectPathDisplayCurves`
   - `cuePathCurveNodes`
   - `objectPathCurveNodes`
   - `explanationText`
6. fullscreen 편집기에서 경로를 수정한다
7. fullscreen `onConfirm(...)`으로 부모 state에 반영한다
8. `TroubleSolutionEditor.handleSubmit()`이 `solutionData`를 조립한다
9. `POST /api/community/trouble/[postId]/solutions`로 전송한다

### 4.3 실제 경로 편집 동작 위치

핵심 파일: `components/nangu/SolutionPathEditorFullscreen.tsx`

실제 포인트 관련 함수:

- `runCueAppend()`
- `runCueAppendAim()`
- `addObjectPathPoint()`
- `movePathPoint()`
- `removePathPoint()`
- `insertPathPointBetween()`
- `insertPathPointBetweenAim()`
- `moveObjectPathPoint()`
- `removeObjectPathPoint()`
- `insertObjectPathPointBetween()`
- `insertObjectPathPointBetweenAim()`

실제 오버레이 이벤트 연결:

- `NanguSolutionPathOverlay` props로 전달
- `onAddPoint`
- `onAddObjectPoint`
- `onMovePoint`
- `onRemovePoint`
- `onInsertBetween`
- `onMoveObjectPoint`
- `onRemoveObjectPoint`
- `onInsertObjectBetween`

즉 작성 흐름의 실질적인 경로 생성/편집은 `SolutionPathEditorFullscreen.tsx`와 `NanguSolutionPathOverlay.tsx`의 결합으로 이루어진다.

## 5. 저장 / DB 구조

### 5.1 Nangu 문제 / 해법 저장

파일: `prisma/schema.prisma`

```prisma
model NanguPost {
  id                String   @id @default(cuid())
  authorId          String
  title             String
  content           String   @db.Text
  ballPlacementJson String   @db.Text
  adoptedSolutionId String?  @unique
}

model NanguSolution {
  id       String @id @default(cuid())
  postId   String
  authorId String
  title    String?
  comment  String? @db.Text
  dataJson String  @db.Text
}
```

설명:

- 문제 공배치 원본은 `ballPlacementJson`
- 해법 경로선 원본은 `dataJson`
- 둘 다 DB JSON 타입이 아니라 `String @db.Text`
- 서버에서 `JSON.stringify(...)` 후 저장

### 5.2 Trouble 문제 / 해법 저장

파일: `prisma/schema.prisma`

```prisma
model TroubleShotPost {
  id                 String   @id @default(cuid())
  postId             String   @unique
  sourceNoteId       String?
  layoutImageUrl     String?
  ballPlacementJson  String?  @db.Text
  difficulty         String?
  acceptedSolutionId String?
}

model TroubleShotSolution {
  id               String   @id @default(cuid())
  troubleShotPostId String
  authorId         String
  title            String?
  content          String   @db.Text
  solutionImageUrl String?
  solutionDataJson String?  @db.Text
}
```

설명:

- problem 쪽 원본은 `ballPlacementJson` 또는 `layoutImageUrl`
- trouble 해법 경로선 원본은 `solutionDataJson`

### 5.3 실제 API 요청 body

#### Nangu 생성 / 수정

파일:

- `app/community/nangu/[id]/solution/new/page.tsx`
- `app/community/nangu/[id]/solution/[solutionId]/edit/page.tsx`

요청 body:

```json
{
  "title": null,
  "comment": "설명 또는 null",
  "data": {
    "...NanguSolutionData": "실제 저장 구조"
  }
}
```

서버 API:

- `app/api/community/nangu/[id]/solutions/route.ts`
- `app/api/community/nangu/[id]/solutions/[solutionId]/route.ts`

서버 저장 방식:

- `dataJson: JSON.stringify(data)`

#### Trouble 생성 / 수정

파일:

- `app/community/trouble/[postId]/solution/new/page.tsx`
- `app/community/trouble/[postId]/solution/[solutionId]/edit/page.tsx`

요청 body:

```json
{
  "content": "설명 텍스트",
  "solutionData": {
    "...NanguSolutionData": "실제 저장 구조"
  }
}
```

서버 API:

- `app/api/community/trouble/[postId]/solutions/route.ts`
- `app/api/community/trouble/[postId]/solutions/[solutionId]/route.ts`

서버 저장 방식:

- `solutionDataJson: JSON.stringify(solutionData)`

### 5.4 Trouble 저장 시 `reflectionPath` 조립 방식

파일: `components/trouble/TroubleSolutionEditor.tsx`

`handleSubmit()` 내부에서:

1. `pathPoints`를 `paths[0]`로 만든다
2. `objectPathPoints`가 있고 `firstObjectBallKey`가 결정되면
3. `ballPlacement`에서 해당 공 중심 좌표 `startNorm`을 구한다
4. `reflectionPath.points`를
   - `[startNorm, ...objectPathPoints.map(...)]`
   로 만든다
5. `reflectionObjectBall`도 함께 저장한다

즉 Trouble 작성 시 persisted `reflectionPath`의 첫 점은 편집 state의 `objectPathPoints[0]`이 아니라, 해법 작성 시점의 계산된 공 중심점이다.

## 6. 불러오기 / 복원 흐름

### 6.1 Nangu 상세 보기 복원

파일:

- `app/community/nangu/[id]/page.tsx`

실제 흐름:

1. DB에서 `NanguSolution.dataJson` 조회
2. `JSON.parse(s.dataJson)` 수행
3. 결과를 `solutions[].data`로 `NanguPostDetailClient`에 전달

이 단계에서는 추가 변환 없이 persisted JSON 파싱 결과를 그대로 사용한다.

### 6.2 Trouble 상세 보기 복원

파일:

- `lib/community-post-detail-server.ts`

실제 흐름:

1. DB에서 `TroubleShotSolution.solutionDataJson` 조회
2. 값이 있으면 `JSON.parse(s.solutionDataJson)` 수행
3. 결과를 `TroubleSolutionListItem.solutionData`에 담는다

이번 확인 범위 기준:

- `components/community/CommunityPostDetailView.tsx`는 `solutionData`를 로드하지만
- trouble 경로선을 이 데이터로 직접 렌더하는 코드는 확인하지 못했다

즉 trouble 상세에서는 persisted 경로 JSON이 조회되기는 하나, 현재 메인 상세 뷰에서는 텍스트/이미지 중심으로 사용되고 있다.

### 6.3 수정 화면 복원

파일:

- `lib/solution-editor-hydrate.ts`

#### Nangu 복원

- `hydrateNanguEditorSnapshotFromPartial(data)`

핵심 동작:

1. `data.paths?.[0]`를 읽는다
2. `pathPointsFromFirstPath(path)` 호출
3. `pointsWithType`가 있으면 그대로 복사
4. 없으면 `points`만으로 `id: restored-${i}`를 새로 부여해 `NanguPathPoint[]` 복원
5. `cuePathCurveNodes`, `objectPathCurveNodes`는 clone해서 복원

#### Trouble 복원

- `hydrateTroubleSolutionEditorFromPartial(data, options)`

핵심 동작:

1. `data.paths?.[0]` -> `pathPoints`
2. `data.reflectionPath` -> `objectPathPoints`
3. `cuePathDisplayCurves`, `objectPathDisplayCurves` 복원
4. `cuePathCurveNodes`, `objectPathCurveNodes` 복원

중요:

- `objectPathPointsFromReflection(ref)`는 `reflectionPath.points` 전체를 복원한다
- 저장 시 prepend된 첫 점을 별도로 제거하지 않는다

이 부분은 Trouble 저장 구조와 복원 구조의 의미 차이를 만들 수 있는 지점이다.

### 6.4 에디터 초기화 흐름

#### Nangu

- `createInitialNanguSnapshotFromEditorProps(initialSolutionData, initialPersistedSettings)`
- 내부적으로 `hydrateNanguEditorSnapshotFromPartial(...)`

#### Trouble

- `createTroubleSolutionEditorInitialState(initialSolutionData, initialPersistedSettings, initialContent)`
- 내부적으로 `hydrateTroubleSolutionEditorFromPartial(...)`

즉 수정 화면은 persisted JSON을 바로 편집하지 않고, 반드시 hydrate를 거쳐 작성 state로 복사한 후 편집한다.

## 7. 상세 보기 렌더 구조

### 7.1 Nangu 상세 보기

파일 흐름:

- `app/community/nangu/[id]/page.tsx`
- `app/community/nangu/[id]/NanguPostDetailClient.tsx`
- `components/nangu/NanguSolutionLayerCanvas.tsx`

실제 렌더 구조:

1. `page.tsx`에서 `JSON.parse(s.dataJson)`
2. `NanguPostDetailClient`가 `solutions[].data`를 받음
3. 해법 카드 확장 시
   - `BilliardTableCanvas`
   - `NanguSolutionLayerCanvas`
   를 함께 렌더
4. `NanguSolutionLayerCanvas`는
   - `data.paths`
   - `data.reflectionPath`
   를 읽고 그대로 선을 그린다

`NanguSolutionLayerCanvas` 내부 핵심:

- `data.paths?.forEach((path) => drawPath(path.points, cuePathColor))`
- `if (data.reflectionPath?.points?.length) drawPath(data.reflectionPath.points, objectPathColor)`

즉 Nangu 상세 보기의 경로 렌더는 persisted `NanguSolutionData`를 직접 소비한다.

### 7.2 Trouble 상세 보기

파일 흐름:

- `lib/community-post-detail-server.ts`
- `components/community/CommunityPostDetailView.tsx`

실제 렌더 구조:

1. 서버에서 `solutionDataJson` 파싱
2. `CommunityPostDetailView`에 `troubleSolutions` 전달
3. 각 해법에서
   - 제목
   - 작성자
   - `solutionImageUrl`
   - `content`
   - 채택 / GOOD / BAD / 투표 버튼
   를 렌더

이번 확인 범위에서 trouble 상세 화면은:

- `solutionData`를 로드하지만
- `NanguSolutionLayerCanvas` 같은 경로 렌더러에 연결하지 않는다

즉 Trouble 상세 보기의 저장 경로 JSON은 현재 구조상 메인 상세 UI의 경로선 렌더 원본으로 직접 쓰이지 않는다.

## 8. 애니메이션 / 재생 흐름

### 8.1 호출 위치

파일: `components/nangu/SolutionPathEditorFullscreen.tsx`

재생 훅 호출:

```ts
const pathPlayback = useSolutionPathPlayback({
  ballPlacement: layoutForCue,
  pathPoints,
  objectPathPoints: variant === "trouble" ? objectPathPoints : EMPTY_NANGU_OBJECT_PATH_POINTS,
  ballSpeed: playbackBallSpeed,
  isBankShot,
  thicknessOffsetX,
  ignorePhysics: Boolean(settingsValue?.ignorePhysics),
  cuePathCurveControls: variant === "trouble" ? cuePathCurveControls : undefined,
  cuePathCurveNodes: variant === "trouble" ? cuePathCurveNodes : undefined,
  objectPathCurveControls: variant === "trouble" ? objectPathCurveControls : undefined,
  objectPathCurveNodes: variant === "trouble" ? objectPathCurveNodes : undefined,
  collisionWarningsEnabled:
    variant === "trouble" && objectPathEditing && objectPathPoints.length >= 1,
  playbackRate,
});
```

즉 재생은 persisted JSON이 아니라 "현재 편집 state"를 입력으로 받는다.

### 8.2 실제 재생 훅

파일: `hooks/useTroublePathPlayback.ts`

핵심 입력:

- `ballPlacement`
- `pathPoints`
- `objectPathPoints`
- `ballSpeed`
- `isBankShot`
- `thicknessOffsetX`
- `cuePathCurveControls`
- `cuePathCurveNodes`
- `objectPathCurveControls`
- `objectPathCurveNodes`

핵심 파생 단계:

1. `buildTroublePlaybackSolutionData(...)`
2. `buildCuePathMotionPlan(...)`
3. `buildObjectPathMotionPlanWithStartVertex(...)`
4. `startPlayback()`에서 `requestAnimationFrame` 루프 수행
5. 결과 좌표는 `ballNormOverrides`로 반환

출력:

- `ballNormOverrides`
- `playbackPhase`
- `startPlayback()`
- `resetPlayback()`
- `playbackTimingDebug`
- 경로 디버그 / 거리 디버그 정보

### 8.3 playback용 데이터 재구성

파일: `lib/solver-engine/policies/trouble-playback-solution-data.ts`

함수:

- `buildTroublePlaybackSolutionData(params)`

입력:

- `ballPlacement`
- `pathPoints`
- `objectPathPoints`
- `ballSpeed`
- `isBankShot`
- `thicknessOffsetX`
- `rect`

출력:

- `NanguSolutionData | null`

핵심 동작:

1. `pathPoints`를 `paths[0]`로 변환
2. `resolveEffectiveFirstObjectCollisionFromCuePath(...)`로 충돌점 계산
3. `resolveTroubleFirstObjectBallKey(...)`로 실제 맞은 공 계산
4. `objectPathPoints`가 있으면 `reflectionPath`를 다시 조립
5. 이때 `reflectionPath.points[0]`은 저장 시와 다르게 충돌점 `effectiveContact.collision`이다

즉 playback용 `reflectionPath`는 persisted JSON의 `reflectionPath`와 동일하지 않을 수 있다.

### 8.4 직선 / 곡선과 재생의 관계

파일: `lib/solution-path-motion.ts`

핵심 사실:

- 기본 polyline은 직선 spot 배열에서 시작한다
- `visualizationPlayback` + curve data가 있으면
  - `buildCueCurvedPlaybackPolyline(...)`
  - `buildObjectCurvedPlaybackPolyline(...)`
  를 사용해 curved polyline을 만든다
- 하지만 주석과 로직상 충돌/판정은 직선 `pathPoints` 기준을 유지한다

코드상 주석:

- `난구: 재생만 곡선 — pathPoints와 별도의 표시용 베지어 제어점(판정·경고는 직선 유지)`

즉 현재 코드 기준으로 curve는:

- 렌더에 사용된다
- Trouble playback 경로 샘플링에도 사용될 수 있다
- 하지만 충돌 판정 원본은 직선 pathPoints다

## 9. 상태 관리 및 source of truth

### 9.1 작성 중 source of truth

#### Nangu

파일: `components/nangu/NanguSolutionEditor.tsx`

작성 중 단일 원본:

- `editor`

그 안의 핵심 경로 필드:

- `editor.pathPoints`
- `editor.cuePathCurveNodes`
- `editor.objectPathCurveNodes`

`initialSolutionData`는 초기값일 뿐, 작성 시작 후 원본이 아니다.

#### Trouble

파일: `components/trouble/TroubleSolutionEditor.tsx`

작성 중 단일 원본:

- `pathPoints`
- `objectPathPoints`
- `cuePathDisplayCurves`
- `objectPathDisplayCurves`
- `cuePathCurveNodes`
- `objectPathCurveNodes`

즉 trouble은 단일 객체 state가 아니라 여러 state 조각이 합쳐져 source of truth 역할을 한다.

### 9.2 fullscreen 편집 중 source of truth

파일: `components/nangu/SolutionPathEditorFullscreen.tsx`

fullscreen 내부 원본:

- `pathPoints`
- `objectPathPoints`
- `cuePathCurveControls`
- `objectPathCurveControls`
- `cuePathCurveNodes`
- `objectPathCurveNodes`

이 값들은 부모로부터 받은 `initial*` props의 복사본이다.

즉 fullscreen은:

- 부모 state를 복사해 들어감
- 내부에서 편집
- `onConfirm()` 시 부모 state로 되돌려 씀

### 9.3 저장 후 source of truth

저장 후 persisted 원본:

- Nangu: `NanguSolution.dataJson`
- Trouble: `TroubleShotSolution.solutionDataJson`

이 시점부터 브라우저 state는 원본이 아니고, DB persisted 문자열이 원본이다.

### 9.4 보기 화면 source of truth

- 상세 보기에서는 DB에서 읽은 문자열을 `JSON.parse()`한 결과가 렌더 원본이다

### 9.5 playback source of truth

- playback은 persisted JSON 자체가 아니라 현재 편집 state 입력값을 기준으로 동작
- `playbackData`는 원본이 아니라 파생 데이터

## 10. 데이터 변환 지점

실제 코드상 복사/변환 지점은 다음과 같다.

### 10.1 props -> editor state

- `createInitialNanguSnapshotFromEditorProps(...)`
- `createTroubleSolutionEditorInitialState(...)`

의미:

- 부모 props는 초기 hydrate 입력값
- editor state로 복사 후 편집 시작

### 10.2 부모 state -> fullscreen state

파일: `components/nangu/SolutionPathEditorFullscreen.tsx`

- `initialPathPoints`
- `initialObjectPathPoints`
- `initialCuePathDisplayCurves`
- `initialObjectPathDisplayCurves`
- `initialCuePathCurveNodes`
- `initialObjectPathCurveNodes`

의미:

- 부모 작성 state를 fullscreen 편집기 내부 state로 복사

### 10.3 fullscreen state -> 부모 state

- `onConfirm({ pathPoints, objectPathPoints, ... })`

의미:

- fullscreen 편집 결과를 부모 작성 state로 되돌려 반영

### 10.4 작성 state -> 저장 payload

#### Nangu

파일: `components/nangu/NanguSolutionEditor.tsx`

- `pathPoints` -> `paths[0].points`
- `pathPoints` -> `paths[0].pointsWithType`
- curve nodes -> `cuePathCurveNodes`, `objectPathCurveNodes`

#### Trouble

파일: `components/trouble/TroubleSolutionEditor.tsx`

- `pathPoints` -> `paths[0]`
- `objectPathPoints` -> `reflectionPath`
- `firstObjectBallKey` -> `reflectionObjectBall`

### 10.5 저장 payload -> DB 문자열

#### Nangu

- `JSON.stringify(data)` -> `dataJson`

#### Trouble

- `JSON.stringify(solutionData)` -> `solutionDataJson`

### 10.6 DB 문자열 -> parsed object

#### Nangu

- `JSON.parse(s.dataJson)`

#### Trouble

- `JSON.parse(s.solutionDataJson)`

### 10.7 parsed object -> edit state

파일: `lib/solution-editor-hydrate.ts`

- `pointsWithType` 있으면 그대로 path point 복원
- 없으면 `points`에서 새 `id` 생성하여 path point 복원
- `reflectionPath`에서 trouble `objectPathPoints` 복원

### 10.8 edit state -> playback data

파일: `lib/solver-engine/policies/trouble-playback-solution-data.ts`

- 현재 `pathPoints`, `objectPathPoints`를 다시 `NanguSolutionData` 형태로 재조립
- 충돌점과 실제 맞은 공을 다시 계산

### 10.9 playback data -> motion plan

파일: `lib/solution-path-motion.ts`

- `buildCuePathMotionPlan(...)`
- `buildObjectPathMotionPlan(...)`
- `buildObjectPathMotionPlanWithStartVertex(...)`

## 11. 작성 화면 vs 보기 화면 차이

### 작성 화면

특징:

- 편집 가능한 state 존재
- fullscreen 편집기 존재
- 포인트 추가/삽입/삭제/이동 가능
- 곡선 핸들 편집 가능
- undo / clear / reset 있음
- Trouble는 playback 가능

실제 작성 UI 핵심:

- `NanguSolutionEditor`
- `TroubleSolutionEditor`
- `SolutionPathEditorFullscreen`
- `NanguSolutionPathOverlay`

### 보기 화면

#### Nangu

- persisted `dataJson`을 파싱해서 그대로 렌더
- 경로선 표시 있음
- 편집 state 없음
- 상세 카드에서 `NanguSolutionLayerCanvas` 사용

#### Trouble

- persisted `solutionDataJson`을 파싱해서 읽어오긴 함
- 이번 확인 범위 기준 메인 상세 UI에서는 경로선 렌더 코드가 보이지 않음
- 텍스트/이미지/채택/투표 중심

즉 작성 화면은 stateful editor 구조이고, 보기 화면은 persisted data 소비 구조다.

## 12. 노드 편집 / 삭제 / 초기화 구조

핵심 파일: `components/nangu/SolutionPathEditorFullscreen.tsx`

### 12.1 포인트 이동 / 삭제 / 삽입

- `movePathPoint(id, norm)`
- `removePathPoint(id)`
- `insertPathPointBetween(segmentIndex, norm)`
- `insertPathPointBetweenAim(segmentIndex, aim)`
- `moveObjectPathPoint(id, norm)`
- `removeObjectPathPoint(id)`
- `insertObjectPathPointBetween(segmentIndex, norm)`
- `insertObjectPathPointBetweenAim(segmentIndex, aim)`

### 12.2 curve 제거 / 초기화

- `removeCueDisplayCurve(key)`
- `removeObjectDisplayCurve(key)`
- `straightenAllDisplayCurves()`

### 12.3 전체 초기화

- `clearAllPaths()`
- `resetPlacementAndPaths()`

실제 초기화 대상:

- `pathPoints`
- `objectPathPoints`
- `cuePathCurveControls`
- `objectPathCurveControls`
- `cuePathCurveNodes`
- `objectPathCurveNodes`

### 12.4 undo

- `pushPathUndoSnapshot(...)`
- `onUndoPathClick()`

undo snapshot에는 다음이 함께 들어간다:

- cue path points
- object path points
- cue curves
- object curves
- cue curve nodes
- object curve nodes

즉 경로 편집 관련 되돌리기는 단순 포인트만이 아니라 곡선 정보까지 포함한 복합 snapshot 구조다.

## 13. 손그림/자유그리기 관련 여부

이번 확인 범위에서 손그림 또는 자유그리기 stroke 저장 구조는 찾지 못했다.

실제 현재 구조:

- 클릭 / 탭 기반 spot 추가
- 드래그 기반 spot 이동
- 더블탭 기반 중간 삽입
- aim / ray 기반 삽입
- curve handle 드래그 기반 곡선 제어

찾은 관련 구조:

- `onAddPoint`
- `onInsertBetween`
- `onMovePoint`
- `onRemovePoint`
- `onAddObjectPoint`
- `onMoveObjectPoint`
- `onRemoveObjectPoint`
- `onUpsertCueDisplayCurve`
- `onMoveCueDisplayCurve`
- `onRemoveCueDisplayCurve`

찾지 못한 것:

- freehand stroke array 저장 필드
- raw pointer trail 저장 필드
- 손그림 전용 API body
- 자유그리기 전용 mode 상태

즉 실제 코드 기준 경로 시스템은 손그림이 아니라 "스팟 기반 polyline 편집기"다.

## 14. 민감한 연결부 (위험 지점)

### 14.1 가장 민감한 공유 편집기

- `components/nangu/SolutionPathEditorFullscreen.tsx`

이유:

- Nangu / Trouble 공용
- 포인트 편집
- object path 편집
- curve 편집
- undo
- clear/reset
- playback 연결
이 한 파일에 집중되어 있다.

여기서 path state 구조나 confirm payload를 잘못 바꾸면 새 작성, 수정, Trouble 재생이 같이 깨질 가능성이 높다.

### 14.2 playback 핵심

- `hooks/useTroublePathPlayback.ts`
- `lib/solver-engine/policies/trouble-playback-solution-data.ts`
- `lib/solution-path-motion.ts`

이유:

- 현재 편집 state를 playback용으로 다시 조립
- 거리 / 시간 / easing / 충돌 경고가 연결
- workspace 규칙상 trouble playback 로직은 안정화 영역으로 간주되어 변경 금지 항목이 있음

특히 잘못 건드리면 위험한 항목:

- 거리 모델
- 세그먼트 시간 비율
- easing 적용 위치
- 1목 시작 시점 판정

### 14.3 geometry / object collision

- `lib/solution-path-geometry.ts`

이유:

- 수구 첫 충돌 판정
- 실제 polyline이 충돌점에 닿는지 판정
- object path 활성화 기준

이 함수 결과가:

- trouble object path 편집 허용
- playback reflection object 선택
- collision 관련 로직
에 연결된다.

### 14.4 hydrate 규약

- `lib/solution-editor-hydrate.ts`

이유:

- persisted JSON -> editor state 복원 규약이 여기 있다
- `pointsWithType` / `points` fallback 처리
- trouble `reflectionPath` -> `objectPathPoints` 복원

여기를 바꾸면 수정 화면 복원과 구버전 데이터 호환이 깨질 수 있다.

### 14.5 Trouble의 1목 경로 의미 차이

문제 지점:

- `components/trouble/TroubleSolutionEditor.tsx`
- `lib/solution-editor-hydrate.ts`
- `lib/solver-engine/policies/trouble-playback-solution-data.ts`

이유:

현재 실제 코드상 Trouble의 1목 경로는 단계마다 시작점 해석이 다르다.

- 작성 state: `objectPathPoints`
- persisted `reflectionPath`: 공 중심 prepend 방식으로 저장
- playback `reflectionPath`: 충돌점 prepend 방식으로 재구성

이 차이를 정리하지 않은 채 구조를 수정하면,

- 새 작성 저장
- 수정 화면 복원
- playback
- 상세 보기

중 하나 이상이 어긋날 가능성이 높다.

### 14.6 curve key 규약

- `lib/path-curve-display.ts`
- `components/nangu/NanguSolutionPathOverlay.tsx`
- `lib/solution-path-motion.ts`

이유:

- segmentKey 규약을 공유
- overlay 렌더
- hit test
- remove / prune
- playback curved polyline
가 모두 같은 key 체계에 의존

key 규약이 깨지면 curve 표시와 저장 데이터 재사용이 동시에 깨질 수 있다.

## 15. 향후 수정 영향 예상 포인트

### 15.1 source of truth 통일 시 영향

현재 구조는 단계마다 원본이 바뀌므로, source of truth를 단일화하려면 다음 영역이 모두 영향받는다.

- `NanguSolutionEditor`
- `TroubleSolutionEditor`
- `SolutionPathEditorFullscreen`
- `solution-editor-hydrate`
- create / edit API payload 조립
- playback input 조립

특히 fullscreen이 부모 state 복사본으로 동작하는 현재 구조를 바꾸면 undo / cancel / confirm UX까지 같이 재설계가 필요하다.

### 15.2 Trouble reflectionPath 정리 시 영향

만약 Trouble의 1목 경로 시작점을 하나로 통일하려면 다음을 같이 조정해야 한다.

- 저장 시 `reflectionPath` 생성 방식
- 수정 시 `objectPathPoints` 복원 방식
- playback용 `buildTroublePlaybackSolutionData()`
- trouble 상세 보기에서 향후 path 렌더 추가 시 사용하는 구조

이 부분은 가장 먼저 정합성 설계가 필요하다.

### 15.3 curve 저장 구조 변경 시 영향

변경 영향 범위:

- `PathSegmentCurveControl`
- `NanguCurveNode`
- overlay 렌더
- curve handle hit test
- playback용 curved polyline 생성
- hydrate 복원

curve를 완전히 표시 전용으로 제한할지, playback 경로까지 포함한 구조로 계속 둘지 먼저 결정해야 한다.

### 15.4 view 구조 확장 시 영향

현재 Trouble 상세는 `solutionData`를 렌더 경로선으로 거의 쓰지 않는다.

향후 Trouble 상세에 실제 path 렌더를 붙이면 검토해야 할 것:

- persisted `reflectionPath`의 의미
- `solutionImageUrl`와 path overlay의 우선순위
- 공 중심 시작점 vs 충돌점 시작점 표시 기준
- note image 기반 post와 ballPlacement 기반 post의 렌더 방식 차이

### 15.5 기존 기능을 깨뜨릴 가능성이 높은 수정 패턴

다음 수정은 특히 위험하다.

- `NanguPathPoint.type` 의미 변경
- `pointsWithType` 제거 또는 무시
- `segmentKey` 규약 변경
- Trouble 저장 시 `reflectionPath` 조립 방식 변경
- hydrate에서 `reflectionPath` 복원 규약 변경
- playback에서 거리 / 시간 / easing 모델 변경
- fullscreen 편집기에서 `onConfirm` payload 구조 변경

즉 향후 구조 수정은 "저장 구조", "복원 규약", "playback 재구성", "overlay 렌더"를 함께 본 뒤 순차적으로 진행해야 한다.
