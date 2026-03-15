# 캐롬클럽 2차 성능 최적화 보고서

## 1. 어떤 페이지가 가장 느렸는지

| 페이지 | 체감 병목 | 주된 원인 |
|--------|------------|-----------|
| **메인(홈)** | 첫 화면이 3~4초 후에야 채워짐 | 서버에서 copy + noticeBars + popups + pageSections + hero + siteSettings + **DB(대회/당구장)** 를 한꺼번에 기다린 뒤 HTML 전송. DB가 블로킹. |
| **당구장 목록** | "가까운 당구장을 불러오는 중" 때문에 목록이 비어 보임 | 위치 권한 대기 중에는 `loading=true` 로만 두어, 서버에서 받은 목록을 안 보여줌. |
| **대회 목록/상세** | 첫 요청 시 서버 응답 지연 | copy + sections + DB 한 번에 조회. revalidate 60으로 캐시 후에는 완화됨. |
| **공개 대회 상세** | 상세 페이지 DB include 과다 | tournament + organization + rule + entries + matchVenues 등 한 번에 로드. |
| **관리자/클라이언트** | Tiptap 등 편집기, 대진표 UI | hydration 비용이 큰 클라이언트 컴포넌트 다수. |

---

## 2. 병목 원인 분류

- **서버 병목**: 메인·대회·당구장 목록의 **DB 조회**가 첫 바이트 전에 완료될 때까지 대기. copy/sections 등 캐시 가능한 데이터와 한꺼번에 기다림.
- **클라이언트(hydration) 병목**: **ContentLayer(팝업)**, **HomeSectionsWithLocation**(위치 요청), **Tiptap/대진표** 등이 초기 JS와 함께 로드되어 첫 페인트·인터랙션 지연.
- **이미지 병목**: 목록 카드/배너에서 원본 이미지 사용, 일부 `<img>` 미교체로 LCP·대역폭 부담.
- **위치 로딩 병목**: 당구장 목록에서 위치 허용 전까지 **기본 목록을 숨기고** "불러오는 중"만 표시해 첫 화면이 비어 보임.

---

## 3. 적용한 수정 내역

### 3.1 메인 페이지: 즉시 표시 / 후속 로딩 분리

- **변경**: DB(대회·당구장)를 **Suspense 스트리밍**으로 분리.
  - **즉시 표시**: `getAdminCopy`, `getNoticeBarsForPage`, `getPopupsForPage`, `getPageSectionsForPage`, `getHeroSettings`, `getSiteSettings` 만 먼저 조회 후 **ContentLayer + HomeHero + PageSectionsRenderer** 까지 즉시 전송.
  - **후속 로딩**: `HomeDeferredSections`(async 서버 컴포넌트)에서 **getTournamentsListRaw(4)**, **getVenuesListRaw(4)** 만 조회 후 스트리밍. fallback 으로 `HomeSectionsSkeleton` 노출.
- **초기 데이터량**: 대회 6개→**4개**, 당구장 6개→**4개**. 하단에 "대회 전체 보기", "당구장 전체 보기" 링크 추가.
- **파일**: `app/page.tsx`, `components/home/HomeDeferredSections.tsx`, `components/home/HomeSectionsSkeleton.tsx` (신규).

### 3.2 당구장 소개 페이지: 위치 기반 로딩 개선

- **변경**: 서버에서 받은 **기본 당구장 목록을 항상 먼저 표시**. 위치 권한은 백그라운드에서 요청.
  - `loading` → **`locationRefining`** 으로 변경: "가까운 당구장을 불러오는 중" 대신 **"가까운 순으로 정렬 중…"** 만 위치 응답 후 잠깐 표시.
  - 목록은 처음부터 `initialVenues` 로 렌더, 위치 허용 시 같은 컴포넌트에서 `/api/home/venues?lat=&lng=` 로 재요청 후 **후처리로 정렬·갱신**.
- **파일**: `components/venues/VenuesListWithLocation.tsx`.

### 3.3 Hydration 비용 분리: 팝업 지연 로딩

- **변경**: **ContentLayer** 에서 **Popup** 만 `next/dynamic(..., { ssr: false })` 로 분리. 첫 페인트·hydration 시 팝업 번들을 로드하지 않음.
- **파일**: `components/content/ContentLayer.tsx`.

### 3.4 성능 측정: 서버 + 클라이언트

- **서버**: 기존 `getServerTiming()` / `logServerTiming(label)` 유지. 메인 페이지는 `fetch_sections` 후 **db** 는 `HomeDeferredSections` 내부에서만 로그.
- **클라이언트**: `lib/perf.ts` 에 **logClientTiming(label, startMs)**, **logNavigationTiming()** 추가. 루트 레이아웃에 **ClientPerfLogger** 마운트 시 `ttfb`, `dcl`, `first_paint_estimate` 로그 (NEXT_PUBLIC_PERF_LOG !== "0" 일 때).
- **파일**: `lib/perf.ts`, `components/ClientPerfLogger.tsx` (신규), `app/layout.tsx`.

---

## 4. 수정 전후 예상 체감 개선 효과

| 구간 | 수정 전 | 수정 후 (예상) |
|------|---------|-----------------|
| **메인 첫 페인트** | DB 포함 전체 응답 대기(2~4초) 후 한 번에 표시 | copy/sections 만으로 **1초 내외**에 히어로·CMS 섹션까지 표시, 대회/당구장은 스켈레톤 후 스트리밍 |
| **메인 대회/당구장 영역** | 동일 응답에 포함되어 함께 도달 | 스트리밍으로 **0.5~1초 뒤** 순차 도달, 체감 대기 감소 |
| **당구장 목록 첫 화면** | 위치 대기 중 빈 화면 또는 "불러오는 중"만 표시 | **즉시** 기본 목록 표시, 위치 허용 시 "정렬 중" 후 가까운 순 갱신 |
| **팝업** | 초기 JS에 포함되어 hydration 부담 | 첫 페인트 이후 로드되어 **LCP·FID 개선** 기대 |

---

## 5. 가장 무거웠던 페이지·컴포넌트 5개와 조치

| 순위 | 페이지/컴포넌트 | 왜 느렸는지 | 서버/클라이언트 | 적용한 수정 | 예상 효과 |
|------|------------------|-------------|------------------|-------------|-----------|
| 1 | **메인(홈)** | DB(대회/당구장)가 첫 바이트 블로킹 | 서버 | Suspense로 DB를 후속 스트리밍, take 4로 축소 | 첫 페인트 1~2초 단축 |
| 2 | **당구장 목록(VenuesListWithLocation)** | 위치 대기 중 목록 미표시 | 클라이언트 | 기본 목록 즉시 표시, 위치는 후처리 정렬 | 첫 화면 공백 제거 |
| 3 | **ContentLayer(Popup)** | 팝업이 메인 번들에 포함되어 hydration 부담 | 클라이언트 | Popup만 dynamic import, ssr:false | 초기 JS·hydration 감소 |
| 4 | **메인 HomeSectionsWithLocation** | 대회/당구장 카드 + 위치 재요청으로 데이터·연산 많음 | 혼합 | 서버에서 4개만 스트리밍, 클라이언트는 기존대로 위치 보강 | 서버 블로킹 제거로 체감 개선 |
| 5 | **대회 상세(tournaments/[id])** | findUnique + 많은 include, copy/session 순차 대기 | 서버 | (기존 1차에서 copy·session 병렬화, 인덱스 추가 완료) | 추가로 상세 include 축소 시 개선 여지 있음 |

---

## 6. 추가로 남아 있는 병목 후보

- **공통 fetch 중복**: copy, popup, noticeBar, siteSettings 등이 페이지마다 호출됨. 레이아웃 또는 상위에서 한 번만 조회해 props/cache로 넘기면 서버 부담·지연 감소 가능.
- **세션 조회**: 로그인이 꼭 필요 없는 공개 페이지에서도 getSession() 호출이 있으면 제거 또는 지연 검토.
- **대회 상세 DB**: tournament + entries + matchVenues + rule 등 include 과다. 탭별로 필요한 필드만 선택 조회하거나 구간 로딩 검토.
- **이미지**: 목록 카드에 썸네일 전용 URL/파이프라인 없음. 원본 사용 중. next/image 적용은 1차에서 진행, **썸네일 생성·목록 전용 필드** 도입 시 추가 개선.
- **관리자/클라이언트**: Tiptap, 대진표 편집 등 무거운 컴포넌트는 **dynamic import + ssr: false** 로 라우트 진입 후 로딩하면 hydration 병목 완화 가능.
- **웹폰트**: 여러 CDN/Google Fonts 링크로 인해 초기 블로킹 가능성. preload·폰트 디스플레이 전략 검토.

---

## 7. 성능 측정 사용 방법

- **서버**: `NEXT_PUBLIC_PERF_LOG` 를 비우거나 `1` 로 두면 콘솔에 `[perf] fetch_sections: 230ms`, `[perf] db: 150ms`, `[perf] page: 380ms` 형태로 출력. `0` 이면 비활성.
- **클라이언트**: 같은 env 설정 시 `[perf:client] ttfb: 120ms, dcl: 400ms`, `[perf:client] first_paint_estimate: 50ms` 로그. 서버 vs 클라이언트 병목 구분에 활용.

---

## 8. ESLint / 빌드

- **lint**: `npm run lint` 통과 (기존 경고만 유지).
- **build**: `npm run build` 통과. 메인 페이지 스트리밍·타입 수정 반영됨.

이 문서는 2차 최적화 적용 내용을 정리한 것이며, 이후 추가 측정·튜닝 시 이 보고서를 기준으로 병목을 추적할 수 있습니다.
