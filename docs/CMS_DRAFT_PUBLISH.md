# CMS 초안·게시 (Draft / Publish)

## 1. 채택한 모델

**`CmsPageLayoutDraft` 테이블**에 페이지(`home` | `community` | `tournaments`)당 **하나의 JSON 스냅샷**(`sections`: `PageSection[]` 동일 스키마)을 저장한다.

- **공개( published )**: 기존 **`PageSection`** 행 — 공개 라우트·`getOrderedPageBlocksForPage` 등은 **변경 없이 DB만** 읽는다.
- **초안( draft )**: **`CmsPageLayoutDraft`** — 운영자가 빌더·CMS에서 수정할 때 **빌더 대상 페이지**에 대해서는 **여기에만** 먼저 반영된다.

### 왜 이 구조인가

- 기존 공개 조회 경로를 **한 줄도 바꿀 필요 없음** — 게시 시에만 `PageSection`에 동기화.
- `PageSection` 컬럼을 복제한 별도 테이블보다 **마이그레이션·동기화 부담이 적음**.
- 스냅샷은 **순서·슬롯·스타일 JSON·버튼·기간** 등 `PageSection`이 담는 모든 필드를 그대로 담을 수 있음 — 이후 카드 auto/manual·WYSIWYG HTML도 같은 blob 확장 가능.
- **버전 테이블**은 나중에 `CmsPageLayoutDraftHistory` 등으로 **감사/undo** 확장 가능(현재는 단일 초안만).

## 2. 읽기 분리

| 소비자 | 데이터 |
|--------|--------|
| 공개 사이트 (`getOrderedPageBlocksForPage`, `getPageSectionsForPage` 등) | **항상** `PageSection` (DB) |
| 관리자 페이지 빌더 목록·미리보기·CMS 편집(해당 페이지) | 초안 행이 있으면 **초안**, 없으면 **공개 DB**를 초기값으로 사용 |

`getPageSectionByIdForAdmin` / `getAllPageSections` / `getPageSectionsForAdminLayoutPage`는 초안을 병합한다.

## 3. 저장·게시 흐름

- **편집(순서·표시·구조·슬롯 스타일·POST page-sections 등)**  
  → `home` / `community` / `tournaments`이면 **`savePageSection` 등이 초안 스냅샷을 갱신** (DB `PageSection`은 게시 전까지 그대로일 수 있음).
- **저장 포맷**  
  → `{ schemaVersion: 1, sections: PageSection[] }` (레거시: `sections`만 배열로 저장된 행도 읽기 지원).
- **초안 정규화**  
  → `upsertDraftSections` / `ensureDraftFromPublished` 시 `normalizeTrustedSectionForDraft`로 `page` 고정·필드 기본값 보장.
- **게시**  
  → `POST /api/admin/content/cms-page-draft` `action: "publish"`  
  → `coercePageSectionFromDraftJson` + `assertPublishableDraftSections` 통과 후에만 `replacePageSectionsForPublishedPageInDb` 실행.  
  → 실패 시 `400` + `CmsDraftPublishValidationError` 메시지(`code`: `MISSING_ID`, `PAGE_MISMATCH`, `SORT_ORDER_MISMATCH`, `DUPLICATE_ID` 등).

### 게시 전 검증 요약

| 검사 | 설명 |
|------|------|
| 섹션 배열 | 각 원소는 객체, `id`·`type`·`placement`·`sortOrder` 등 필수 |
| `page` | JSON에 `page`가 있으면 대상 페이지와 일치해야 함(불일치 시 차단) |
| `sortOrder` | n개 섹션일 때 값은 정수이며, 정렬 시 정확히 `0…n-1` 퍼뮤테이션 |
| `id` | 중복 없음 |
| 열거형 | `type`, `placement`, `linkType`, `textAlign`, `slotType`, `internalPage` 등 허용 집합 검사 |
| DB 반영 | `replacePageSectionsForPublishedPageInDb`에서 upsert 시 **`page` 인자를 다시 덮어써** 다른 페이지 오염 방지 |
- **초안만 복사**  
  → `action: "ensureSave"` — 공개본을 그대로 초안 행으로 복사(이미 초안이 있으면 `{ created: false }`).
- **초기화**  
  → `action: "reset"` — 초안 행 삭제. 다음 편집 시 다시 공개본에서 로드.

## 4. API

| 경로 | 메서드 | 설명 |
|------|--------|------|
| `/api/admin/content/cms-page-draft?page=home` | GET | `hasDraft`, `updatedAt` |
| `/api/admin/content/cms-page-draft` | POST `{ action, page }` | `publish` \| `reset` \| `ensureSave` |

기존 `page-layout` PATCH / `page-sections` POST는 **유지**하되, 빌더 페이지에 대한 **캐시 무효화(revalidate)**는 **게시 시에만** 수행한다(편집만으로는 공개 HTML이 바뀌지 않음).

## 5. 미리보기

- **관리자 빌더 우측 `PageBuilderMobilePreview`**: 부모 state가 `GET page-layout` 결과(초안 우선)이므로 **초안 반영**.
- **공개 URL**: 초안과 무관.  
- **향후**: `?cmsPreview=draft` + 서명 토큰 또는 세션 게이트로 비운영자 미리보기 확장 가능.

## 6. 카드 auto/manual/mixed와의 연결

초안 JSON은 **`PageSection` 전체**를 담으므로, `slotConfigJson` / `sectionStyleJson` / 향후 카드 설정 필드가 같은 스냅샷에 포함되면 **게시 한 번에 공개에 반영**된다. 별도 카드 테이블을 도입할 경우에도 **스냅샷에 ID 참조** 또는 **임베드**를 선택하면 된다.

## 7. DB 마이그레이션

`prisma/migrations/20260331120000_cms_page_layout_draft/migration.sql` — `CmsPageLayoutDraft` 생성.

배포 시: `npx prisma migrate deploy` (또는 환경에 맞는 마이그레이션 절차).

## 8. 로컬 참고

Windows에서 `prisma generate`가 쿼리 엔진 파일 잠금(EPERM)으로 실패할 수 있음 — **개발 서버 중지 후** 재실행하거나 `FORCE_PRISMA_GENERATE=1` 사용.
