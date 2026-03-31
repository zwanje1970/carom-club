# 페이지 빌더·섹션 구조 편집 롤아웃 상세 보고서

**작성 목적**: 홈·커뮤니티·대회 중심의 **페이지 섹션 구조 편집**을 관리자에서 단계적으로 도입한 작업의 **상세 내역**을 한 문서로 보존한다.

**적용 원칙 (반복 준수)**:

- 난구(트러블) **재생/풀이 로직**, **대진표 로직** 코드는 변경하지 않는다.
- 기존 관리·공개 UI를 **한 번에 제거하지 않고**, 신규 흐름을 **추가·병행**한다.
- **완전 자유형 웹 에디터**(임의 HTML·WYSIWYG 전면화)로 확장하지 않는다. 1차는 **구조·메타·순서** 중심이다.
- 난구 재생 관련 **거리/시간/이징** 안정화 규칙이 있는 모듈은 **해당 이슈 없이** 건드리지 않는다.

---

## 1단계: 데이터 모델·타입 (PageSection 구조 슬롯)

### 목표

- 페이지별 섹션 행을 **CMS 블록**과 **구조 슬롯**으로 구분할 수 있는 필드를 모델에 반영한다.
- 이후 렌더·관리자 빌더가 동일한 타입 체계를 쓰도록 한다.

### 주요 내용

- `PageSection`에 **`slotType`**(`PageSectionSlotType` | null), **`slotConfigJson`**(슬롯별 소량 JSON) 개념이 반영되어 있다.
- Prisma `PageSection` 테이블과 마이그레이션, `lib/content/db-content.ts`의 upsert/조회가 위 필드를 다룬다.
- `types/page-section.ts`, `types/section-layout-slot.ts` 등에서 슬롯 종류·별칭을 정리한다.

### 참고 파일

- `prisma/schema.prisma` (PageSection 관련 필드)
- `types/page-section.ts`
- `types/section-layout-slot.ts`
- `lib/content/db-content.ts`

---

## 2단계: 콘텐츠 서비스·관리자용 페이지별 목록

### 목표

- **공개용** CMS 목록(`slotType` 없음, 가시성·기간 필터)과 **관리자 레이아웃용** 전체 목록을 분리한다.
- 동일 `page` 안에서 `sortOrder` 기준 정렬을 일관되게 유지한다.

### 주요 내용

- `getPageSectionsForPage`: 공개 CMS 스택용 (`slotType` 없는 행 등 기존 정책).
- `getPageSectionsForAdminLayoutPage`: 빌더용 — 해당 `page`의 **모든** 섹션(숨김·기간 무관), `sortOrder` 우선, 필요 시 `placement` 보조 정렬.
- `setPageSectionOrderForPage` / DB: 동일 `page`의 `orderedIds`가 DB의 해당 페이지 행 id 집합과 **정확히 일치**할 때만 `sortOrder`를 0…n-1로 재부여.

### 참고 파일

- `lib/content/service.ts` — `getPageSectionsForAdminLayoutPage`, `setPageSectionOrderForPage`, `compareSectionsForAdminLayout` 등
- `lib/content/db-content.ts` — `setPageSectionOrderForPageInDb`

---

## 3단계: 공개 렌더 진입점 `PageRenderer`

### 목표

- 섹션 배열을 **한 루프**에서 처리하는 공용 진입점을 두고, 슬롯은 **단계적으로** 실제 UI에 연결한다.

### 동작 요약

- `components/content/PageRenderer.tsx`: `blocks`를 순회.
  - **`slotType` 없음**: `PageSectionBlockRow` → `ImageSection` / `TextSection` / `CtaSection` (`embedded` 등 기존 패턴).
  - **`slotType` 있음**: 현재는 **빈 `Fragment`**(키만 유지). 향후 슬롯별 고정 컴포넌트 매핑 예정.
- `PageSectionBlockRow`는 `PageSectionsRenderer`와 공유해 CMS 행 렌더를 통일한다.

### 참고 파일

- `components/content/PageRenderer.tsx`
- `components/content/PageSectionBlockRow.tsx`
- `components/content/PageSectionsRenderer.tsx` (기존 CMS 전용 진입점 유지)

---

## 4단계: 관리자 페이지 빌더 1차 (`/admin/page-builder`)

### 목표

- **구조 편집 최소 기능**을 한 화면에서 수행: 페이지 선택, 목록, 순서, 표시, 삭제, 단순 추가.

### 화면 기능

| 기능 | 설명 |
|------|------|
| 페이지 선택 | `home` / `community` / `tournaments` |
| 섹션 목록 | 선택 페이지의 전체 행(관리자용) |
| 순서 변경 | 위/아래 버튼 → `PATCH` `reorder` |
| 표시/숨김 | `PATCH` `visibility` |
| 삭제 | `DELETE` `/api/admin/content/page-sections?id=` 후 남은 행으로 `reorder` |
| 추가 | CMS(텍스트·이미지·CTA) 또는 구조 슬롯 — `POST` `/api/admin/content/page-sections` |

### API: `GET` / `PATCH` `/api/admin/content/page-layout`

- **GET** `?page=home|community|tournaments` → `getPageSectionsForAdminLayoutPage(page)` JSON 배열.
- **PATCH** `action: "reorder"` — `{ page, orderedIds }` — DB에서 해당 `page`의 id 집합과 불일치 시 `409` 등.
- **PATCH** `action: "visibility"` — `{ id, isVisible }`.

### 관리자 메뉴

- `components/admin/adminMenuConfig.ts` — **콘텐츠 관리 → 페이지 빌더** (`/admin/page-builder`), `CONTENT_CHILD_HREFS`에 경로 포함.
- `components/admin/adminMenu.ts` — 동기화, 복사 키 `menu.pageBuilder`.

### 참고 파일

- `app/admin/page-builder/page.tsx`
- `components/admin/page-builder/PageBuilderClient.tsx`
- `components/admin/page-builder/SectionEditor.tsx` (초기에는 버튼 정렬만; 5단계에서 DnD 확장)
- `app/api/admin/content/page-layout/route.ts`
- `lib/content/page-layout-admin.ts` — 추가용 `buildPageLayoutSectionPayload`

---

## 5단계: `SectionEditor` + @dnd-kit 드래그 정렬

### 목표

- **안정적인 라이브러리**(`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`)로 **순서만** 드래그 변경.
- 버튼·링크와 포인터 충돌을 줄인다.

### 구현 요약

- `SectionEditor`: `DndContext` + `SortableContext` + `verticalListSortingStrategy`.
- **드래그 핸들**(세로 줄 아이콘)에만 `PointerSensor`(이동 거리 8px) + `KeyboardSensor`(`sortableKeyboardCoordinates`) 연결.
- `onDragEnd`: `arrayMove` 후 부모 `onReorderCommit` → 기존과 동일하게 **`PATCH` `reorder`**.
- 저장 실패 시 **이전 `rows` 스냅샷 복구** + `load()` 재동기화. `rowsRef`로 연속 조작 시 참조 꼬임 완화.

### 패키지

- `package.json` 의존성: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`.

### 참고 파일

- `components/admin/page-builder/SectionEditor.tsx`

---

## 6단계: 모바일 미리보기 (실제 `PageRenderer`)

### 목표

- **실제 `PageRenderer`**로 “수정 → 바로 확인”에 가깝게 좁은 뷰포트에서 CMS 스택을 본다.

### 동작 요약

- `PageBuilderMobilePreview`: 부모의 **`rows` 상태**를 입력으로 `useMemo`로 필터.
- 필터 조건은 공개 CMS에 가깝게: **`!slotType` + `isVisible` + 노출 기간(`startAt`/`endAt`)** 내.
- **로딩 중**(`loading === true`)에는 미리보기 입력을 비워 페이지 전환 시 이전 페이지 데이터가 섞이지 않게 함.
- 약 **390px** 폭 프레임 + 스크롤 영역, `bg-site-bg` / `text-site-text`로 사이트 토큰 활용.

### 참고 파일

- `components/admin/page-builder/PageBuilderMobilePreview.tsx`
- `components/admin/page-builder/PageBuilderClient.tsx` (2열 그리드 + 미리보기 열)

---

## 7단계: 복제·다른 페이지 이동·구조 설정(확장)

### 목표

- 복제, 타 빌더 페이지로 이동, **placement·노출 기간** 등 구조 메타를 빌더에서 편집.

### 기능

| 기능 | API / 동작 |
|------|------------|
| 구조 설정 | `PATCH` `updateStructure` — `placement`, `startAt`, `endAt`(null 허용) |
| 이동 | `PATCH` `moveSection` — `targetPage`; 원 페이지는 DB 사용 시 남은 행으로 순서 재압축 |
| 복제 | `PATCH` `duplicateSection` — 새 id, 버튼 id 재발급, 제목 `(복사)`, 대상 페이지 맨 뒤 `sortOrder` |

### UI

- `SectionRowTools`: 행 하단 패널(구조 / 이동 / 복제).
- `SectionEditor`에 **`renderRowBelow`**로 패널 삽입.

### 참고 파일

- `components/admin/page-builder/SectionRowTools.tsx`
- `lib/content/service.ts` — `movePageSectionToPage`, `duplicatePageSection`, `updatePageSectionStructure`, `stripSectionForSave`
- `app/api/admin/content/page-layout/route.ts` — 위 action 분기 및 `revalidatePath`

---

## 8단계: sectionType·슬롯별 `pageKey` 검증

### 목표

- **잘못된 페이지 배치**를 클라이언트 선택지 제한 + **서버 검증**으로 방지한다.

### 규칙 (`lib/content/page-section-page-rules.ts`)

| 구분 | 허용 `page` (빌더 키: home, community, tournaments) |
|------|------------------------------------------------------|
| CMS (`slotType` 없음) | 세 페이지 모두 |
| `hero`, `homeCarousels`, `quickMenu` | `home`만 |
| `postList`, `nanguList` | `community`만 |
| `tournamentList` | `tournaments`만 |
| `noticeOverlay`, `cmsPageSections` | 세 페이지 모두 |

### 적용 지점

- **POST** `/api/admin/content/page-sections`: 저장 전 `assertPageSectionAllowedOnPage` — 위반 시 **400** + `pageNotAllowedMessage()`.
- **PATCH** `moveSection` / `duplicateSection`: 서비스 레이어에서 동일 규칙 위반 시 에러 코드 → HTTP 매핑.
- 빌더 **섹션 추가** 슬롯 옵션: `getAllowedBuilderPageOptions`로 **현재 빌더 페이지에 맞는 슬롯만** 표시.

### 참고 파일

- `lib/content/page-section-page-rules.ts`
- `lib/content/service.ts` — `assertPageSectionAllowedOnPage`
- `app/api/admin/content/page-sections/route.ts`

---

## 9단계: 운영·품질 정리

### 타입·상태

- 빌더의 `page` 상태를 **`PageBuilderKey`**로 한정해 `getAllowedBuilderPageOptions(...).includes(page)` 등 타입 안전성 확보.

### 캐시 무효화

- `page-layout` / `page-sections` 저장·삭제·이동·복제 후 `revalidatePath`로 `/`, `/community`, `/tournaments` 등 관련 레이아웃 갱신.

### DB 미연결(mock) 환경

- `setPageSectionOrderForPage` 등은 DB 없을 때 **no-op**에 가깝게 동작할 수 있어, **순서 영속**은 DB 연결을 전제로 한다. (기존 CMS POST mock 한계와 동일 계열.)

---

## 알려진 한계·후속 과제

1. **슬롯 행**은 `PageRenderer`에서 아직 **시각적 미리보기 없음** — 정책상 빈 조각.
2. **상세 편집**에서 본문·이미지를 저장한 뒤, 빌더 목록은 **재조회 전** 스냅샷이 남을 수 있음.
3. **venues / mypage**는 빌더 페이지 선택에 포함되지 않으나, **POST 검증**은 전역 `page`에 대해 슬롯·CMS 조합을 막는다.

---

## 주요 파일 인덱스 (빠른 탐색)

| 영역 | 경로 |
|------|------|
| 규칙 | `lib/content/page-section-page-rules.ts` |
| 서비스 | `lib/content/service.ts`, `lib/content/db-content.ts` |
| 빌더 API | `app/api/admin/content/page-layout/route.ts` |
| 섹션 CRUD API | `app/api/admin/content/page-sections/route.ts` |
| 빌더 페이지 | `app/admin/page-builder/page.tsx` |
| 클라이언트 | `components/admin/page-builder/PageBuilderClient.tsx` |
| DnD 목록 | `components/admin/page-builder/SectionEditor.tsx` |
| 행 도구 패널 | `components/admin/page-builder/SectionRowTools.tsx` |
| 미리보기 | `components/admin/page-builder/PageBuilderMobilePreview.tsx` |
| 공개 렌더 | `components/content/PageRenderer.tsx` |
| 메뉴 | `components/admin/adminMenuConfig.ts`, `components/admin/adminMenu.ts` |

---

*본 문서는 롤아웃 시점의 구현을 기준으로 하며, 이후 코드 변경 시 해당 커밋/PR과 함께 갱신하는 것을 권장한다.*
