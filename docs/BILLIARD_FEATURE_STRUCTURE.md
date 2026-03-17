# 당구 관련 기능 구조 (당구노트 / 난구풀이 / 해법)

## 현재 구조 요약

### 공통 당구대 모듈 (`components/billiard/`)

- **BilliardTableCanvas**  
  당구대 캔버스(2:1, 플레이필드/쿠션/덴방, 공 3개·수구 표시).  
  ref: `getDataURL(includeGrid)`.

- **BilliardTableEditor**  
  공 선택 → 테이블 탭으로 이동, 수구(흰/노란) 지정, 플레이필드 내 공 배치.  
  ref: `getDataURL(includeGrid)`, `getSnapshot()` → `{ redBall, yellowBall, whiteBall, cueBall }`.  
  `children`으로 메모·저장 버튼 등 추가 UI.

- **좌표·규격**  
  `lib/billiard-table-constants.ts`: 2:1 테이블, 플레이필드 inset, 공 반지름, 정규화 0..1, `clampBallToPlayfield` 등.

### 당구노트 (구현됨)

- **페이지**: `app/community/notes/`, `new/`, `[id]/`, `[id]/edit/`.
- **편집**: `BilliardNoteEditor` = `BilliardTableEditor` + 메모 + 저장 버튼.
- **저장**: 테이블 이미지 업로드 → `BilliardNote` (redBallX/Y, yellowBallX/Y, whiteBallX/Y, cueBall, memo, imageUrl, visibility).

### 난구풀이 / 해법 작성 (미구현)

- 난구풀이·해법 화면이 생기면 **동일한** `BilliardTableEditor`(또는 `BilliardTableCanvas`)를 import해 재사용.
- 필요 시 `children`으로 문제 설명·해법 텍스트·저장 API 등만 추가.

### 경로 그리기

- 현재 **미구현**.  
- 추후 추가 시 경로 데이터는 **별도 필드/스키마**로 두고, 공 위치·수구·메모와 분리하는 것을 권장.  
  예: `pathSegments?: { from: {x,y}, to: {x,y} }[]` 또는 polyline 정규화 좌표 배열.  
  캔버스는 `BilliardTableCanvas` 확장 또는 오버레이로 경로만 그리면 됨.

### 저장 구조 (당구노트 기준)

- **BilliardNote**: redBallX/Y, yellowBallX/Y, whiteBallX/Y, cueBall("white"|"yellow"), memo, imageUrl, visibility, authorId.
- 공 배치: 플레이필드 내만 허용(공 반지름 기준 클램프).
- 수구: 흰공 또는 노란공만 지정.

## 재사용 방법 (난구풀이·해법)

```tsx
import { BilliardTableEditor } from "@/components/billiard";

// 해법 작성 예시
<BilliardTableEditor
  ref={editorRef}
  initialRed={...}
  initialCueBall="white"
>
  <div>해법 설명 입력...</div>
  <button onClick={onSubmit}>해법 제출</button>
</BilliardTableEditor>
```
