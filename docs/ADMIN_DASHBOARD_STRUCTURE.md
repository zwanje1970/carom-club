# 관리자 대시보드 구조 (코드 기준)

본 문서는 **현재 저장소의 실제 라우트·컴포넌트·API**만 근거로 작성했습니다. 추정·로드맵은 포함하지 않습니다.

**기준 파일**

- 사이드바 메뉴: `components/admin/adminMenuConfig.ts` (`getAdminMenuAside`, `getExpandedGroupIndex`, `SITE_CHILD_HREFS`)
- 사이드바 렌더: `components/admin/AdminLayoutSidebar.tsx`
- 레이아웃·권한: `app/admin/AdminLayoutServer.tsx`, `app/admin/layout.tsx`
- 구 메뉴(deprecated): `components/admin/adminMenu.ts` — 주석에 “`adminMenuConfig` 사용 권장”

---

## 1. 관리자 전체 메뉴 트리

### 1.1 사이드바에 노출되는 구조 (`getAdminMenuAside`)

| 1뎁스 | 2뎁스(또는 단일 링크) | 경로 |
|--------|----------------------|------|
| 대시보드 | — | `/admin` |
| 대회관리 | — | `/admin/tournaments` |
| 클라이언트 관리 | 클라이언트 목록 | `/admin/venues` |
| | 신청 관리 | `/admin/client-applications` |
| | 정산 | `/admin/fee-ledger` |
| 회원·권한 관리 | — | `/admin/members` |
| 콘텐츠 관리 | 페이지 섹션 관리 | `/admin/page-sections` |
| | 페이지 빌더 | `/admin/page-builder` |
| | 팝업 관리 | `/admin/popups` |
| | 공지 배너 관리 | `/admin/notice-bars` |
| 문의관리 | — | `/admin/inquiries` |
| 사이트관리 | 사이트관리 홈 | `/admin/site` |
| | 홈 화면 설정 | `/admin/site/home` |
| | 커뮤니티 설정 | `/admin/site/community` |
| | 문구 관리 | `/admin/site/copy` |
| | 디자인/브랜드 설정 | `/admin/site/settings` |
| | 기능 설정 | `/admin/site/features` |
| | 플랫폼 빌링 설정 | `/admin/settings/platform-billing` |

라벨 일부는 `getAdminCopy()` 결과(`copy`)로 덮어쓸 수 있습니다 (`L("menu.*", …)`).

### 1.2 사이드바 2뎁스에는 없으나 “사이트관리” 그룹 활성 구간에 포함되는 경로

`SITE_CHILD_HREFS` (`components/admin/adminMenuConfig.ts`)에 포함되어, 해당 URL에 있을 때 사이트관리 그룹이 펼쳐지지만 **위 표의 하위 링크 목록에는 없음** (허브·리다이렉트·직접 URL로만 진입하는 형태).

| 경로 | 비고 |
|------|------|
| `/admin/site/main` | 메인페이지 구성 허브 (`app/admin/site/main/page.tsx`) |
| `/admin/site/hero` | 히어로 설정 (`app/admin/site/hero/page.tsx`) |
| `/admin/site/footer` | 푸터 (`app/admin/site/footer/page.tsx`) |
| `/admin/site/design` | **`/admin/site/settings`로 redirect** (`app/admin/site/design/page.tsx`) |
| `/admin/site/components` | **`/admin/page-sections`로 redirect** (`app/admin/site/components/page.tsx`) |
| `/admin/site/header` | **`/admin/site/settings#header-menu-colors`로 redirect** (`app/admin/site/header/page.tsx`) |
| `/admin/settings`, `/admin/settings/*` | `getExpandedGroupIndex`에서 사이트관리 그룹(인덱스 6)과 연동 |

### 1.3 존재하나 사이드바 메뉴에 없는 주요 `/admin` 경로 (직접 URL·타 화면 링크)

`app/admin` 트리에 있으나 `getAdminMenuAside`에 없는 예시:

| 경로 | 파일 | 요약 |
|------|------|------|
| `/admin/login` | `app/admin/login/page.tsx` | 로그인 |
| `/admin/dashboard` | `app/admin/dashboard/page.tsx` | **`/admin`으로 redirect** |
| `/admin/me` | `app/admin/me/page.tsx` | (메뉴 미연결) |
| `/admin/brackets`, `/admin/participants` | 각 `page.tsx` | 대회 보조 화면 |
| `/admin/community/posts` | `app/admin/community/posts/page.tsx` | 커뮤니티 글 관리(플레이스홀더 성격) |
| `/admin/features` | `app/admin/features/page.tsx` | **기능 코드 목록**(요금제 연동 등) — `site/features`와 별개 |
| `/admin/listing-products`, `/admin/pricing-plans` | 각 디렉터리 | 상품·요금제 |
| `/admin/settings/features` | `app/admin/settings/features/page.tsx` | (메뉴 미연결) |
| `/admin/settings/admin-logs` | `app/admin/settings/admin-logs/page.tsx` | (메뉴 미연결) |
| `/admin/settings/system-status` | `app/admin/settings/system-status/page.tsx` | (메뉴 미연결) |
| `/admin/settings/backup` | `app/admin/settings/backup/page.tsx` | (메뉴 미연결) |
| `/admin/settings/notices` | `app/admin/settings/notices/page.tsx` | (메뉴 미연결) |
| `/admin/settings/system-text` | `app/admin/settings/system-text/page.tsx` | (메뉴 미연결) |
| `/admin/settings/labels` | `app/admin/settings/labels/page.tsx` | (메뉴 미연결) |
| `/admin/settings/featured-content` | `app/admin/settings/featured-content/page.tsx` | (메뉴 미연결) |
| `/admin/settings/integration` | `app/admin/settings/integration/page.tsx` | (메뉴 미연결) |
| `/admin/settings/system` | `app/admin/settings/system/page.tsx` | (메뉴 미연결) |
| `/admin/settings/notifications` | `app/admin/settings/notifications/page.tsx` | (메뉴 미연결) |
| `/admin/settings/site` | `app/admin/settings/site/page.tsx` | **`/admin/site/settings`로 redirect** |
| `/admin/settings/hero` | `app/admin/settings/hero/page.tsx` | **`/admin/site/hero`로 redirect** |
| `/admin/settings/footer` | `app/admin/settings/footer/page.tsx` | **`/admin/site/footer`로 redirect** |

---

## 2. 사이트관리 페이지 상세 구조

### 2.1 사이트관리 홈 `/admin/site`

**파일**: `app/admin/site/page.tsx`

- **역할**: 허브. 테마 색 미리보기, 활성 공지바/팝업 수, 홈 **CMS 섹션**(`slotType` 없는 `page === "home"`) 개수, 히어로/푸터 on/off 요약.
- **데이터 소스 (클라이언트 fetch)**:
  - `GET /api/admin/content/notice-bars`
  - `GET /api/admin/content/popups`
  - `GET /api/admin/content/page-sections` (전체 섹션; 홈 필터 시 **`!slotType`** 만 카운트·목록)
  - `GET /api/site-settings`
  - `GET /api/admin/site-settings/hero`
- **바로가기 카드**: `SHORTCUTS` 상수 — `settings`, `home`, `community`, `hero`, `features`, `platform-billing`, `notice-bars`, `popups`, `copy`, `footer` 등.

### 2.2 홈 화면 설정 `/admin/site/home`

**파일**: `app/admin/site/home/page.tsx`

- **하위 링크만**: `→ /admin/site/main` (메인페이지 구성), `→ /admin/site/hero` (히어로 설정).

### 2.3 메인페이지 구성 `/admin/site/main`

**파일**: `app/admin/site/main/page.tsx`

- **역할**: 홈에 대한 **개념적 순서 목록 + 편집 링크** (드래그 저장 없음).
- **데이터**: `GET /api/admin/content/page-sections` 후 `page === "home"` 필터, `sortOrder` 정렬.
- **구성**: JSON 히어로(링크 `hero` → `/admin/site/hero`), `main_visual_bg`+`image`가 아닌 홈 CMS 행(→ `/admin/page-sections/[id]/edit`), 고정 블록(대부분 → `/admin/site/components` = redirect to page-sections), copy/settings 링크, 푸터 링크.
- **하단 버튼**: `/admin/page-sections`, `/admin/site/components`.

### 2.4 히어로 설정 `/admin/site/hero`

**파일**: `app/admin/site/hero/page.tsx`

- **역할**: JSON 히어로 **정본** 편집. `HeroSettingsForm` (`app/admin/settings/hero/HeroSettingsForm.tsx`) 사용.
- **데이터**: 서버에서 `getPageSectionsForPage("home")`로 레거시 폴백용 이미지 CMS 행 존재 여부만 조회.
- **연결**: `lib/hero-settings`, `SiteSetting`의 `heroSettingsJson` 등(폼·API 구현 참고).

### 2.5 커뮤니티 설정 `/admin/site/community`

**파일**: `app/admin/site/community/page.tsx`

- **역할**: `minSolutionLevelForUser` 등 **커뮤니티 정책** (해법 제시 최소 레벨).
- **API**: `GET/PATCH /api/admin/site-settings/community-level`.

### 2.6 문구 관리 `/admin/site/copy`

**파일**: `app/admin/site/copy/page.tsx`

- **역할**: `ADMIN_COPY_GROUPS` 기반 **admin copy** + **system text** 목록/검색/일괄 치환 등.
- **API**: `GET /api/admin/copy`, `GET/PATCH /api/admin/system-text` 등 (파일 내 fetch 참고).
- **비고**: 레거시 히어로 copy 키는 기본 숨김(`showLegacyHeroKeys`); 히어로 정본은 `/admin/site/hero`.

### 2.7 디자인/브랜드 설정 `/admin/site/settings`

**파일**: `app/admin/site/settings/page.tsx`

- **섹션 (폼 내)**:
  - **브랜드**: 사이트명, 설명, 로고, primary/secondary 색.
  - **헤더·상단 메뉴 색상** (`id="header-menu-colors"`): 배경/글자/활성 색.
  - **홈 공통 동작**: `homeCarouselFlowSpeed` (홈 대회·당구장 가로 흐름 속도).
  - **가입·회원**: `withdrawRejoinDays`.
- **API**: `GET/PUT /api/site-settings` → `lib/site-settings` (`getSiteSettings` 등).

### 2.8 기능 설정 `/admin/site/features`

**파일**: `app/admin/site/features/page.tsx`

- **역할**: **사이트 기능 플래그** ON/OFF (`/api/admin/site-feature-flags`).
- **구분**: `/admin/features`의 “기능 코드·요금제” 관리와 **다른 메뉴·다른 API**.

### 2.9 플랫폼 빌링 설정 `/admin/settings/platform-billing`

**파일**: `app/admin/settings/platform-billing/page.tsx` (사이드바는 사이트관리 하위로 링크)

- **역할**: 대회 이용권·연회원 가격 등 (페이지 본문 기준).

### 2.10 리다이렉트 전용 (사이트관리 하위)

| 경로 | 동작 |
|------|------|
| `app/admin/site/design/page.tsx` | → `/admin/site/settings` |
| `app/admin/site/components/page.tsx` | → `/admin/page-sections` |
| `app/admin/site/header/page.tsx` | → `/admin/site/settings#header-menu-colors` |

---

## 3. 콘텐츠 관리 관련 구조

| 구분 | 관리 UI 경로 | 주요 API / 서비스 | 비고 |
|------|----------------|-------------------|------|
| **페이지 섹션 (CMS + 메타)** | `/admin/page-sections`, `/admin/page-sections/new`, `/admin/page-sections/[id]/edit` | `GET/POST/PATCH/DELETE /api/admin/content/page-sections`, 배치 정렬 `PATCH /api/admin/content/page-sections/reorder` | `lib/content/service.ts` — Prisma `PageSection` |
| **페이지 빌더 (홈·커뮤니티·대회 스택)** | `/admin/page-builder` | `GET/PATCH /api/admin/content/page-layout`, 미리보기 `GET /api/admin/content/page-preview-context` | 동일 `PageSection` 행; `slotType`·페이지별 **전체 순서** (`setPageSectionOrderForPage`) |
| **팝업** | `/admin/popups` | `/api/admin/content/popups` | `Popup` 모델, 페이지 노출 범위 라벨 `POPUP_PAGE_LABELS` (`lib/content/constants.ts`) |
| **공지 배너(공지바)** | `/admin/notice-bars` | `/api/admin/content/notice-bars` | `NoticeBar` 모델, `NOTICE_BAR_PAGE_LABELS` |
| **홈 “섹션” 허브 표시** | `/admin/site`, `/admin/site/main` | 위 page-sections / site-settings / hero API 조합 | 슬롯 행은 사이트 허브 통계에서 제외(`!slotType` 필터) |

### 3.1 순서 저장 경로 이중화 (코드 사실)

- **`PATCH /api/admin/content/page-sections/reorder`**: `page` + **`placement`** + `sectionIds` — 동일 placement 버킷 내 순서 (`reorderPageSections`).
- **`PATCH /api/admin/content/page-layout`** (`action: "reorder"`): `page`(home|community|tournaments) + **`orderedIds`** — **CMS+슬롯 단일 스택** 순서 (`setPageSectionOrderForPage`).

→ 같은 `PageSection` 테이블을 두 방식이 건드릴 수 있어 **페이지 빌더와 페이지 섹션 목록의 reorder가 개념적으로 겹침** (섹션 6·7 표 참고).

---

## 4. 홈 / 커뮤니티 / 대회 관련 관리자 기능 (페이지 구성 연관만)

| 기능 | 위치 | 공개 페이지와의 연결(코드 기준) | 페이지 빌더와 겹침 |
|------|------|--------------------------------|-------------------|
| JSON 히어로 편집 | `/admin/site/hero` | `getHeroSettings`, `HomeHero`, `PageSlotBlock` `hero` 슬롯 | 슬롯 `hero`와 **동일 데이터 축**; CMS 이미지 히어로는 폴백 |
| 홈 CMS 섹션 CRUD | `/admin/page-sections/*` | `PageSectionBlockRow`, `pageSections` / `pageBlocks` | 빌더와 **동일 행**; 편집은 주로 여기 |
| 홈·커뮤니티·대회 **블록 순서·슬롯** | `/admin/page-builder` | `getOrderedPageBlocksForPage`, `PageRenderer` | **직접 겹침** |
| 홈 메인 구성 안내 | `/admin/site/main` | 링크 허브만; 순서 저장 UI 없음 | 빌더·섹션 목록과 **진입점 분산** |
| 커뮤니티 정책(레벨) | `/admin/site/community` | 커뮤니티 권한/해법 등록 정책 | 빌더와 무관 |
| 커뮤니티 글 관리 | `/admin/community/posts` | 플레이스홀더 + 공개 `/community` 링크 | 빌더와 무관 |
| 문구(copy) | `/admin/site/copy` | `getAdminCopy`, 라벨·페이지 문구 | 슬롯 UI가 copy를 참조하는 부분과 **간접 연관** |
| 디자인/브랜드 | `/admin/site/settings` | `getSiteSettings`, 헤더·캐러셀 속도 등 | 페이지 빌더와 **분리 유지가 자연스러움** |
| 팝업·공지바 | `/admin/popups`, `/admin/notice-bars` | `ContentLayer` | 빌더의 `noticeOverlay` 슬롯은 **순서 마커** 성격 (`PageSlotBlock.tsx` 주석) |
| 대회 **콘텐츠 페이지** | 빌더에서 `tournamentList` 슬롯 | 공개 `/tournaments` `PageRenderer` | 겹침 |
| 대회 **운영 CRUD** | `/admin/tournaments`, `/admin/tournaments/[id]/…` | 대회 데이터 자체 | 빌더(레이아웃)와 **역할 분리** |

---

## 5. 전역 스타일/테마 관련 기능

| 항목 | 존재 여부 | 관리 위치 | 페이지 빌더와 분리 |
|------|-----------|-----------|---------------------|
| Primary/Secondary 색, 로고, 사이트명 | 예 | `/admin/site/settings` → `PUT /api/site-settings` | **분리 권장** (전역 브랜드) |
| 헤더 배경·메뉴 글자·활성 색 | 예 | 동일 + 앵커 `#header-menu-colors` | **분리 권장** |
| 홈 캐러셀(대회·당구장) 흐름 속도 | 예 | 동일 `homeCarouselFlowSpeed` | 홈 **고정 블록** 동작; 빌더 슬롯 `homeCarousels`와 **추후 연동 시** 정책 필요 |
| 푸터 스타일·내용 | 예 | `/admin/site/footer` (`FooterSettingsForm`) | **분리 권장** |
| JSON 히어로 레이아웃(높이·정렬 등) | 예 | `/admin/site/hero` | 콘텐츠/레이아웃 혼합 — 빌더 `hero` 슬롯과 **같은 히어로 설정** 사용 |

---

## 6. 중복/상충 가능성 분석

1. **동일 `PageSection`에 대한 순서 편집 이중화**  
   - placement 단위: `page-sections/reorder` + `PageSectionList` (`components/admin/page-sections/PageSectionList.tsx`).  
   - 페이지 전체 스택: `page-layout` reorder + `PageBuilderClient` (`components/admin/page-builder/PageBuilderClient.tsx`).  
   → 운영자가 **어느 화면이 최종 순서인지** 혼동할 수 있음.

2. **히어로**  
   - 정본: `/admin/site/hero` (JSON).  
   - 폴백: CMS 이미지 `main_visual_bg` (`page-sections` 편집).  
   - 공개 홈: 단독 `HomeHero` vs `PageRenderer` `hero` 슬롯 중복 방지 로직 (`app/page.tsx`).  
   → 문서·메뉴는 “히어로는 한 곳”을 강조하나, **빌더 슬롯 `hero`**까지 있으면 진입점이 늘어남.

3. **사이트 허브 통계 vs 실제 홈 구성**  
   - `/admin/site`의 “노출 섹션”은 **`page === "home"`且 `!slotType`** 만 집계.  
   - 빌더·공개는 **슬롯 포함 `pageBlocks`**.  
   → 대시보드 숫자와 **실제 홈 구조 인식**이 어긋날 수 있음.

4. **메인페이지 구성 (`/admin/site/main`)**  
   - 고정 블록 순서는 코드에 하드코딩; 실제 홈은 `PageRenderer`+`HomeDeferredSections` 등 복합.  
   - “컴포넌트” 링크는 `page-sections`로 redirect.  
   → **페이지 빌더와 화면 설명이 1:1로 맞지 않음**.

5. **기능 설정 이름 충돌**  
   - `/admin/site/features` (기능 플래그) vs `/admin/features` (기능 코드 CRUD) — **다른 경로·다른 목적**이나 명칭 유사.

---

## 7. 기능별 정리 표

| 기능명 | 현재 위치 | 현재 역할 | 페이지 빌더와 충돌? | 권장안 |
|--------|-----------|-----------|---------------------|--------|
| 사이드바 메뉴 구조 | `components/admin/adminMenuConfig.ts` | 전역 네비게이션 | 아니오 | 유지 |
| 대시보드 카운터 | `/admin` (`app/admin/page.tsx`) | 통계·바로가기 | 아니오 | 유지 |
| 사이트관리 허브 | `/admin/site` | 요약·바로가기 | 간접(통계 기준 불일치) | **통합 검토**: 슬롯 포함 지표 또는 설명 보강 |
| 홈 화면 설정 허브 | `/admin/site/home` | 하위 링크만 | 아니오 | 유지 |
| 메인페이지 구성 | `/admin/site/main` | 안내·링크 | 예(빌더·실제 렌더와 불일치) | **통합 또는 문구 정렬**: 빌더를 단일 진입점으로 안내 |
| 히어로(JSON) | `/admin/site/hero` | 히어로 정본 | 예(슬롯 `hero`와 동일 데이터 축) | **유지** + 빌더/문서에서 “정본” 명확화 |
| 커뮤니티 정책 | `/admin/site/community` | 레벨 등 정책 | 아니오 | 유지 |
| 문구 관리 | `/admin/site/copy` | copy + system text | 간접 | 유지 |
| 디자인/브랜드 | `/admin/site/settings` | 사이트 설정 JSON | 아니오 | **빌더와 분리 유지** |
| 사이트 기능 플래그 | `/admin/site/features` | ON/OFF | 아니오 | 유지 (이름만 `/admin/features`와 구분) |
| 플랫폼 빌링 | `/admin/settings/platform-billing` | 가격 정책 | 아니오 | 유지 |
| 페이지 섹션 목록 | `/admin/page-sections` | 전 페이지 CMS CRUD·placement별 reorder | **예** | **통합**: 빌더와 역할 문서화 또는 reorder 단일화 |
| 페이지 섹션 편집 | `/admin/page-sections/[id]/edit` | 콘텐츠 편집 | 아니오 | 유지 (빌더는 구조, 여기는 콘텐츠로 정리 가능) |
| 페이지 빌더 | `/admin/page-builder` | 홈·커뮤니티·대회 스택·슬롯 | **예** | 유지 + 섹션 reorder와 관계 명시 |
| 팝업 | `/admin/popups` | 레이어 팝업 | 슬롯 마커 수준 | 유지 |
| 공지바 | `/admin/notice-bars` | 상단 배너 | 슬롯 마커 수준 | 유지 |
| placement 기반 reorder API | `app/api/admin/content/page-sections/reorder/route.ts` | 버킷 내 순서 | **예** | **이동/통합** 후보 (빌더 전체 순서와 합의 필요) |
| page-layout reorder API | `app/api/admin/content/page-layout/route.ts` | 페이지별 전체 순서 | — | 유지(빌더 핵심) |
| 미리보기 컨텍스트 API | `app/api/admin/content/page-preview-context/route.ts` | 빌더 슬롯 데이터 | 아니오 | 유지 |
| 커뮤니티 글 관리 | `/admin/community/posts` | 플레이스홀더 | 아니오 | 유지 또는 제거는 별도 제품 결정 |
| 기능 코드 관리 | `/admin/features` | 권한·요금제용 코드 | 아니오 | 유지; 명칭 혼동 방지 |

---

## 문서 갱신 시 확인할 것

- `getAdminMenuAside` / `SITE_CHILD_HREFS` 변경 여부 (`components/admin/adminMenuConfig.ts`)
- `app/admin/site/page.tsx`의 통계 필터(`slotType` 제외 여부)
- `page-sections/reorder` vs `page-layout` reorder 동작 (`lib/content/service.ts`)
