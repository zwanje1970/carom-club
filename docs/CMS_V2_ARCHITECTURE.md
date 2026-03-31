# CMS v2 — 운영자 중심 사이트 구성 (목표 아키텍처)

## 1. 원칙

- 운영자(플랫폼 관리자)만 접근. 일반 사용자 UI와 라우트·데이터 편집 경로 분리.
- UI 용어: 블록, 카드, 영역 꾸미기. JSON·`slotBlock*` 등 내부 키는 노출하지 않음.

## 2. 정보 구조

```
페이지 (home | community | tournaments | …)
 └─ 블록[] (순서, 표시, 초안/게시)
      ├─ 레이아웃·스타일 (크기, 폭, 배경, 테두리)
      ├─ 내용 (WYSIWYG HTML, 이미지)
      ├─ CTA (내부/외부 링크)
      └─ 카드 (옵션)
            ├─ 카드 레이아웃 템플릿
            ├─ 카드 스타일
            └─ 데이터 출처: auto | manual | mixed
```

## 3. 데이터 흐름 (목표)

| 단계 | 설명 |
|------|------|
| 편집 | 초안(`draft`)은 DB 또는 KV에만 저장. 공개 라우트는 읽지 않음. |
| 게시 | `published` 스냅샷을 `PageSection` 등 기존 공개 소스에 반영(또는 단일 `page_manifest` 테이블로 통합). |
| 공개 | `PageRenderer`는 **게시된 스냅샷만** 사용. |

**구현 상태 (draft/publish):** `docs/CMS_DRAFT_PUBLISH.md` 참고. `CmsPageLayoutDraft` JSON 스냅샷 + 게시 시 `PageSection` 동기화.

현재 코드베이스는 `PageSection` + `sectionStyleJson` + 슬롯 타입이 혼재합니다. v2 완성 시 **단일 블록 스키마**로 정규화하거나, 어댑터로 기존 행을 생성하는 마이그레이션 스크립트가 필요합니다.

## 4. auto / manual / mixed

- **auto**: 대회·당구장·게시글 등 기존 API/DB에서 카드 필드만 읽음. 카드 필드 편집 비활성 + 「원본 관리」 링크.
- **manual**: 카드 배열을 블록에 직접 저장.
- **mixed**: 고정 카드 슬롯 + 나머지 슬롯은 auto 목록(순서·개수 옵션).

## 5. 구현 단계 (권장)

| 단계 | 범위 |
|------|------|
| **1** | 메인 페이지: 통합 관리 UI 셸, 블록 목록·순서·미리보기, 기존 API 연동. |
| **2** | 커뮤니티·대회 페이지 동일 패턴, 초안/게시 분리. |
| **3** | WYSIWYG 인라인, 카드 템플릿·mixed, undo, 템플릿 라이브러리. |
| **4** | 레거시 `sectionStyleJson` / 슬롯 분기 제거·단일 렌더러. |

## 6. 제거 대상 (4단계 이후)

- 중복 렌더 분기, `slotBlock*` 전용 UI 분산, 구 CMS 섹션과의 이중 편집 경로(마이그레이션 완료 후).

## 7. 확장 포인트

- `draftVersion` / `publishedVersion` 컬럼 또는 별도 테이블.
- 감사 로그(누가 언제 게시).
- Preview 토큰 쿼리(`?cmsPreview=draft`).

## 8. 현재 적용(1단계 스냅샷)

| 항목 | 설명 |
|------|------|
| 진입 | `사이트관리 → 콘텐츠 편집` → `app/(site)/admin/site/content/page.tsx` |
| UI | `components/admin/cms-v2/CmsSiteContentApp.tsx` → `PageBuilderClient` (`terminology="block"`) |
| 데이터 | 기존 `GET/PATCH /api/admin/content/page-layout`, `POST /api/admin/content/page-sections` |
| 미리보기 | `PageBuilderMobilePreview` (공개 `PageRenderer`와 동일 스택) |
| 목표 스키마 | `lib/cms-v2/types.ts` (초안·카드·모션 등 저장소 연동 전) |
| 문서 | 본 파일 |

**적용됨**: 초안/게시 분리(`CmsPageLayoutDraft`), 게시 시 `PageSection` 반영, 관리자 UI 툴바(`draftToolbar`).

**아직 미적용**: undo 스택, 인라인 WYSIWYG, 카드 auto/manual 전용 DB, 레거시 슬롯 제거.

## 9. 메인 전용 편집 프로토타입 (1단계 확장)

### 9-1. 이번 단계에서 실제 편집 가능한 필드

- 대상 페이지: `home`만.
- 대상 블록: `slotType`이 없는 CMS 블록(`text`/`image`/`cta`).
- 편집 필드(간편 편집 패널):
  - 제목(`title`)
  - 설명(`description`)
  - 대표 이미지 URL(`imageUrl`)
  - 대표 CTA 문구/링크(첫 번째 `buttons[0]`)
- 기존 표시 여부/순서 기능은 `PageBuilderClient`의 기존 구조 편집 흐름을 그대로 사용.

### 9-2. draft 저장 경로

1. 관리자 `사이트관리 → 콘텐츠 편집`에서 블록의 **내용 편집(간편)** 패널 오픈  
2. 저장 시 `POST /api/admin/content/page-sections` 호출  
3. `savePageSection` → 빌더 페이지(`home`)는 `CmsPageLayoutDraft`에만 저장  
4. 관리자 목록/미리보기는 draft 우선 조회이므로 저장 직후 반영

### 9-3. publish 반영 경로

- `CmsDraftToolbar`의 게시 액션(`POST /api/admin/content/cms-page-draft`, `action=publish`) 실행 시:
  - `CmsPageLayoutDraft` JSON → 검증 → `PageSection` 공개본 동기화
  - 공개 라우트는 게시된 `PageSection`만 읽으므로 게시 전에는 변경 없음

### 9-4. 공개 사이트 영향 범위

- 공개 렌더 경로(`PageRenderer`/공개 `PageSection` 읽기)는 변경하지 않는다.
- 관리자 편집 UI만 확장하므로, 게시 전 공개 사이트 동작은 기존과 동일하다.

### 9-5. 의도적으로 제외한 범위

- 전면 인라인 WYSIWYG
- 카드 auto/manual/mixed 편집 전면화
- undo/history 버전 관리
- community/tournaments 동일 UX 확장
- 레거시 슬롯/스키마 대공사

### 9-6. 다음 단계 권장 순서

1. 메인 간편 편집 필드에 이미지 업로드(파일→URL) 연결  
2. CTA 내부 링크(`internalPath`) 선택 UI 추가  
3. 사용자 검증 후 community/tournaments로 같은 패널 확장  
4. 그 다음에 WYSIWYG/카드 템플릿/undo 순서로 확장
