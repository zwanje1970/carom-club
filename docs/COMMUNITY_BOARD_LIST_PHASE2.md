# 커뮤니티 게시판 목록 2차 속도 최적화 (요약)

## 왜 첫 진입이 1차 이후에도 느리게 느껴졌는지

1. **`app/community/[boardSlug]/page.tsx` 전체가 Client Component**  
   첫 페인트 전에 JS 번들 로드·hydration 이후에야 목록 fetch가 시작되어, **HTML 첫 응답에 글 목록이 비어 있는 시간**이 길어짐.
2. **중복 네트워크**  
   동일 조건(`popular`, `page`, 검색 등)으로 **hydration 직후 API를 한 번 더 호출**하는 패턴.
3. **허브 탭용 `/api/community/boards` 추가 요청**  
   서버에서 한 번에 줄 수 있는 데이터를 클라이언트가 다시 요청.

## Client → Server 로 옮긴 것

| 영역 | 변경 |
|------|------|
| 페이지 엔트리 | `page.tsx` → **Server Component**: 세션(trouble), DB, 허브 게시판 + 첫 목록 조회 |
| 목록 데이터 | `loadCommunityBoardPageData` (`lib/community-board-page-data.ts`)에서 Prisma로 직접 조회 (API와 동일 규칙) |
| 초기 HTML | `CommunityBoardSlugClient`에 `initial` props로 내려줌 → **RSC+클라 SSR로 목록 행이 첫 HTML에 포함** |
| 인터랙션만 Client | `CommunityBoardSlugClient.tsx`: 인기 탭, trouble 필터, 검색, 더보기, URL 동기화, 글쓰기 FAB |

## 중복 fetch 제거

- **허브 게시판 탭**: 서버에서 `hubBoards`를 조회해 props로 전달 → **mount 시 `/api/community/boards` 호출 제거**.
- **첫 목록**: `buildCommunityBoardQueryKey`로 SSR 시점의 필터 키와 동일하면, **`userTouchedFiltersRef`가 false인 동안** 클라이언트 `fetch` 생략 (hydration 직후 재요청 제거).
- 필터·검색·더보기 등 사용자 조작 후에는 `userTouchedFiltersRef = true`로 두어 **정상적으로 API 재요청**.

## 초기 렌더 체감

- **TTFP 이전**: 서버 응답 HTML에 목록·breadcrumb·제목이 포함 → 스피너만 보이던 구간 감소.
- **JS 로드 후**: 동일 조건이면 목록 API를 다시 부르지 않음 → **네트워크 1~2회 감소**(boards + list).

## deep pagination

- `lib/community-board-list-pagination.ts`: **`boardListOffset`** 로 skip/take 사용처 분리.
- **`encodeBoardListCursor` / `decodeBoardListCursor`**: `latest` 정렬 기준 커서 후보(ISO `createdAt` + `id`) — 인기/기간 필터 조합은 별도 설계 필요.
- 당장 라우트 동작은 기존 **page + skip** 유지.

## 목록 이미지

- `CommunityBoardPostThumb`: **`/` 로 시작하는 최적화 가능 URL**은 `next/image` (56px, quality 75, `sizes`) — 업로드 경로 등 **동일 출처 작은 페이로드**에 유리.
- 그 외(외부 URL 등)는 **`img` + lazy** 유지 (remotePatterns 미설정 시 안전).

## 성능 로그

| 구분 | 환경 변수 | 내용 |
|------|-----------|------|
| 서버 SSR 구간 | `COMMUNITY_LIST_PERF_LOG=1` | `communityBoardSsrPerf` → `[community-list] SSR community/[boardSlug] … done in …ms` |
| 클라이언트 | `NEXT_PUBLIC_COMMUNITY_BOARD_PERF=1` | `skip_initial_list_fetch`, `list_fetch_start` / `list_fetch_done` (ms), `list_fetch_error` |

## 남은 병목 (1~2)

1. **깊은 `page` (skip/take)**  
   인기·검색·기간 필터가 겹칠수록 큰 offset 비용 가능 → 커서 페이지네이션 단계적 도입.
2. **Client 번들**  
   탭·검색·FAB 등은 여전히 클라이언트 — 인기 pill 일부를 서버 링크(쿼리만 바꿔 전체 네비게이션)로 바꾸면 JS 더 줄일 수 있음.
