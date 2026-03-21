# 난구해결사 — 해법 제시 콘솔 지시문 (Cursor / 디자인 교체용)

## 목적

- 콘솔 UI를 **SVG·이미지·레이아웃 변경**해도 **해법 입력·저장 동작**은 그대로 유지한다.
- 스타일(`className`), 마크업 구조, 버튼 문구는 자유롭게 바꿀 수 있다.
- **기능 계약**은 `components/trouble/trouble-console-contract.ts`의 **`data-trouble-*` / `data-trouble-action`** 과 연결된 로직으로 고정한다.

## 고정 계약 (변경 금지)

1. **저장 페이로드**  
   - `TroubleSolutionEditor`의 `onSubmit({ content, solutionData })` 형태.  
   - `solutionData`는 `NanguSolutionData` (`lib/nangu-types.ts`) 스키마를 따른다.

2. **상태와의 연결**  
   - 두께/뱅크/당점/백·팔로우/스피드/경로점 배열은 컴포넌트 내부 state; UI는 이 state를 **같은 setter/핸들러**로 갱신해야 한다.

3. **진행경로**  
   - `pathMode === true`일 때만 테이블 영역 클릭이 스팟 추가.  
   - `경로 입력 시작/중` 토글, `전체선 삭제`는 기존 핸들러 유지.

4. **제출**  
   - 최종 등록은 `<form onSubmit={handleSubmit}>` 또는 동일 로직 호출.  
   - `data-trouble-action="trouble-submit-solution"` 을 가진 **submit** 컨트롤이 있어야 테스트/에이전트가 찾을 수 있다.

## 스킨 교체 시 작업 순서

1. `trouble-console-contract.ts`의 문자열 값은 **바꾸지 않는다** (바꿀 경우 문서·테스트·SVG 같이 갱신).
2. 새 SVG/버튼으로 감쌀 때, **실제 클릭 요소** 또는 그 부모에 동일 `data-trouble-action`을 부여한다.
3. `data-trouble-console="trouble-solution-console"` 루트는 한 번만 유지한다.
4. 접근성: `aria-label` 등은 추가 가능하나, **기존 폼/버튼 타입**(`type="submit"` 등)을 깨지 않는다.

## 영역 식별자 (`data-trouble-region`)

| region 값 | 역할 |
|-----------|------|
| `trouble-readonly-layout` | 원본 배치 + 경로 오버레이 |
| `trouble-path-toolbar` | 경로 입력 토글·전체 삭제 |
| `trouble-settings` | 해법 설정 탭·패널 |
| `trouble-explanation` | 해설 입력 |
| `trouble-collision-warning` | 경로 재생 중 충돌 경고 토스트 |
| `trouble-playback-view-controls` | 재생 중 경로선/그리드/실사 토글 오버레이 |

## 액션 식별자 (`data-trouble-action`)

| action 값 | 동작 |
|-----------|------|
| `trouble-toggle-path-mode` | 경로 입력 모드 on/off |
| `trouble-clear-path` | (레거시 식별자) — UI는 `trouble-clear-all-paths` 사용 |
| `trouble-undo-last-path-spot` | 마지막 추가 스팟·선 Undo |
| `trouble-clear-all-paths` | 수구·1목 경로·스팟·화살표 전체 삭제 (공 배치 유지) |
| `trouble-panel-thickness` | 두께 패널 활성화 |
| `trouble-panel-spin` | 당점 패널 |
| `trouble-panel-backstroke` | 백스트로크 |
| `trouble-panel-followstroke` | 팔로우 |
| `trouble-panel-speed` | 볼스피드 |
| `trouble-panel-path` | 진행경로 안내 패널 |
| `trouble-submit-solution` | 해법 등록 제출 |
| `trouble-play-path` | 애니메이션 시연 (수구→1목, 충돌 시 정지) |
| `trouble-dismiss-collision` | 충돌 메시지 닫기 |
| `trouble-playback-toggle-pathlines` | 재생 중 경로선 표시 토글 |
| `trouble-playback-toggle-grid` | 재생 중 그리드 표시 토글 |
| `trouble-playback-toggle-drawstyle` | 재생 중 실사/단순보기 토글 |

## 관련 파일

- `components/trouble/TroubleSolutionEditor.tsx` — 콘솔 본체
- `app/community/trouble/[postId]/solution/new/page.tsx` — API 연동 페이지
- `app/api/community/trouble/[postId]/solutions/route.ts` — POST 저장

## 에이전트용 한 줄 요약

> SVG/디자인만 교체하고, `trouble-console-contract.ts`의 `data-*`와 `onSubmit`/`handleSubmit`·state 업데이트 경로는 절대 끊지 말 것.
