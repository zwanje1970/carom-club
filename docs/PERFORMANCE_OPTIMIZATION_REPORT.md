# 속도 2배 개선 구조 작업 보고서

## 1. 수정 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `app/layout.tsx` | `getSiteSettings()` 제거 → `getCommonGlobalData()` 1회 사용. `generateMetadata`에서도 동일 함수로 title/description 조회. 레이아웃·메타데이터가 같은 캐시 키 공유. |
| `app/tournaments/[id]/page.tsx` | `getTournamentBasic(id)`와 `getCommonPageData("tournaments")`를 `Promise.all`로 병렬 호출. 기본정보와 공통 데이터 동시 조회로 첫 바이트 단축. |

---

## 2. 중복 조회 제거 내역

- **루트 레이아웃**: 이전에는 `generateMetadata()`와 `RootLayout`에서 각각 `getSiteSettings()` 호출. Next 요청 단위 중복 제거는 되지만, 호출 경로를 `getCommonGlobalData()`로 통일해 **copy + siteSettings**를 한 번에 조회하고 60초 캐시(`common-global-data`)로 재사용.
- **대회 상세**: 이전에는 `getTournamentBasic(id)` 완료 후 `getCommonPageData("tournaments")` 호출(순차). → **병렬화**로 동시 요청, 체감 지연 감소.

---

## 3. 캐시 적용 내역 (기존 유지·정리)

- **lib/common-page-data.ts**
  - `getCommonPageData(page)`: copy, siteSettings, noticeBars, popups, pageSections — **60초** `unstable_cache`, 키 `['common-page-data', page]`.
  - `getCommonGlobalData()`: copy, siteSettings — **60초** `unstable_cache`, 키 `['common-global-data']`.
- **lib/site-settings.ts**: `getSiteSettings()` — **60초** 캐시, 태그 `site-settings`, `common-page-data`.
- 공지/팝업/페이지섹션: `getNoticeBarsForPage`, `getPopupsForPage`, `getPageSectionsForPage`는 공통 데이터 조회 시 `Promise.all`로 한 번에 호출되며, 페이지별 common 캐시에 포함.

---

## 4. 상세 분리 내역 (기존 유지·정리)

- **대회 상세** (`app/tournaments/[id]/page.tsx`)
  - **먼저**: `getTournamentBasic(id)` — 기본정보만 (entries/rounds/brackets 제외).
  - **나중**: `TournamentDetailWithEntries`가 **Suspense**로 감싸져 엔트리 목록은 후속 로딩. `getTournamentEntries(id)`는 상세 내부에서 별도 호출.
- **홈** (`app/page.tsx`): `getCommonPageData("home")` + 히어로/섹션 즉시, **Suspense**로 `HomeDeferredSections`(대회/당구장 목록) 지연 로딩 — 기존 구조 유지.

---

## 5. select 최적화 내역

- **lib/db-tournaments.ts**: `getTournamentBasic`은 `TOURNAMENT_SELECT_BASIC` + 필수 relation만 사용. `getTournamentEntries`는 참가자 명단 전용으로 분리.
- 목록/상세 역할 분리 및 `_count` 사용 패턴은 기존대로 유지. 추가로 목록 전용 select 축소가 필요한 페이지는 “남은 병목 후보”에 정리.

---

## 6. dynamic import 적용 내역

- 현재 보고서 범위에서는 미적용.  
- **후보**: 에디터(RichEditor), 차트(admin 대시보드), 대진표 뷰어, 이미지 업로드/드래그 UI 등 — 별도 작업에서 `next/dynamic` 검토 권장.

---

## 7. 남은 병목 후보

- **커뮤니티 게시글 상세** (`app/community/posts/[id]/page.tsx`): 전체가 클라이언트 컴포넌트이고, 상세 데이터를 클라이언트에서 `fetch`. → 서버 페이지에서 기본정보(제목, 작성자, 날짜, 요약) 1회 조회 후 전달, 댓글/조회수는 Suspense 또는 클라이언트 후속 로딩으로 분리 시 체감 개선 가능.
- **관리자 시스템 상태** (`app/admin/settings/system-status/page.tsx`): 클라이언트에서 `/api/admin/system-status` 호출. → 서버 컴포넌트로 전환 후 `lib` 또는 API 로직을 서버에서 직접 호출해 첫 HTML에 데이터 포함 시 첫 페인트 개선 가능.
- **난구노트/커뮤니티 목록**: 목록에서 본문 전체 대신 excerpt만 조회하도록 select 정리 시 전송량·파싱 비용 감소.
- **세션**: 동일 요청 내에서 `getSession()` 다중 호출 구간은 API/페이지별로 존재. 레이아웃·페이지·자식에서 한 번만 호출하고 props로 내려주는 구조로 정리 시 세션 조회 비용 감소.

---

## 8. 체감 개선 포인트

- **첫 화면**: 루트 레이아웃이 공통 글로벌 데이터 1회 조회로 통합되어, 메타데이터·레이아웃이 같은 캐시를 쓰므로 캐시 적중 시 응답 일관 및 약간의 단축 기대.
- **대회 상세**: 기본정보와 공통 데이터를 병렬로 가져와, 이전 대비 한 번의 왕복 시간만큼 초기 로딩 단축.
- **홈**: 기존처럼 공통 데이터 1회 + Suspense로 대회/당구장 지연 로딩 유지 — 첫 페인트는 가볍게 유지.

---

## 9. 공통 데이터 사용 정리

- **getCommonPageData(page)**: 홈, 대회 목록/상세, 당구장, 커뮤니티 등 **페이지 단위**에서 copy·siteSettings·noticeBars·popups·pageSections가 필요할 때 1회만 호출하고, 하위에 props로 전달 권장.
- **getCommonGlobalData()**: 레이아웃·메타데이터처럼 **copy + siteSettings만** 필요할 때 사용. 60초 캐시로 동일 요청·다음 요청에서 재사용.
- 여러 컴포넌트가 각각 siteSettings/공지/팝업을 부르지 말고, **page 또는 layout에서 1회 호출 후 하위 전달** 원칙 유지.

---

## 10. 목표 대비 상태

- 첫 화면 HTML 생성 시 불필요한 중복 호출 감소: **레이아웃·메타데이터 통합 적용.**
- 공통 데이터 중복 조회 제거: **common-page-data / common-global-data 1회 조회 원칙 정리 및 적용.**
- 상세 페이지 “기본 먼저, 무거운 데이터 나중”: **대회 상세는 기존 Suspense + 병렬화로 유지·강화.**
- 서버 컴포넌트 중심: **홈/대회 상세는 서버; 커뮤니티 상세·관리자 일부는 후속 작업 후보.**
- 캐시: **60초 unstable_cache 유지.**
- 클라이언트는 상호작용 위주: **NotificationBanner 등 사용자별/상호작용 영역은 클라이언트 유지.**

추가로, **목록 select 최소화**, **커뮤니티/노트 상세 서버화**, **관리자 화면 섹션별 지연 로딩**, **dynamic import** 확대는 다음 단계에서 진행하면 됨.
