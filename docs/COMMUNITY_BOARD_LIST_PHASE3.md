# 커뮤니티 게시판 목록 3차 최적화 (요약)

## 1. Cursor pagination

- **`lib/community-board-cursor.ts`**: `v1` 페이로드에 `fk`(필터 지문), `sort`(createdAt | viewCount | likeCount | commentCount), `createdAt`, `id`, 및 정렬별 보조 필드(`vc`/`lc`/`cc`).
- **`encodeBoardListCursor` / `decodeBoardListCursor`**: 실제 API·쿼리에서 사용.
- **`queryBoardPostLists(..., { cursor })`**: 유효 커서면 `skip` 없이 `AND`로 이전 페이지 이후만 조회; 무효/불일치 시 **기존 `page`+skip**으로 폴백.
- **첫 페이지**: `cursor` 없음 → 기존과 동일. **더 보기**: 클라이언트가 `cursor`만 전달 (deep `page` 북마크는 여전히 offset).

## 2. Pill / 필터 서버화

- **`CommunityBoardPopularNav`**, **`CommunityBoardTroubleStatusNav`**: 전부 `<Link>` + 쿼리스트링 (`scroll={false}`).
- **`CommunityBoardTabBar`**: `use client` 제거, `activeSlug` props로 활성 탭.
- **검색**: `<details>` + **GET `<form method="get">`** (hidden `popular` / `status`).
- **페이지 조립**: **`CommunityBoardPageShell`** (RSC) + 목록/더보기만 **`CommunityBoardListAndMoreClient`** (~120줄).

## 3. 클라이언트 fetch

- 필터·검색·탭 변경 시 **전체 페이지 네비게이션** → 목록에 대한 **hydration 직후 중복 fetch 없음**.
- **더 보기**만 `fetch` + **커서** (`load_more_cursor_*` perf 로그).

## 4. 이미지

- 목록은 기존과 동일: 로컬 경로는 **`next/image`** 56px·`sizes="56px"`·`quality={75}`; 외부는 `img` lazy. 별도 CDN 쿼리 파라미터는 스토리지 규격 미정으로 미적용.

## 5. returnUrl / next

- 난구 미로그인: **`/login?next=...`** (쿼리 보존).
- 로그인 폼: **`next` 또는 `returnUrl`** 인식; 제출 시에도 동일.
- **클라이언트 로그인** + `next`가 `/community/`로 시작하면 **콘솔 기본 이동보다 해당 경로 우선**.

## 제거·축소된 클라이언트

- 삭제: **`CommunityBoardSlugClient.tsx`** (~290줄).
- 게시판 목록 경로에서 **`CommunityPopularPills`**, **`useRouter` 동기화 effect`**, **`useEffect` 목록 fetch** 제거.

## 남은 병목 (1)

- **공지(notice) 고정글 + 일반글**을 한 번에 가져오는 구조·**검색 `title contains` 인덱스**는 그대로 — 트래픽이 크면 공지 캐시·검색 전용 인덱스 검토.
