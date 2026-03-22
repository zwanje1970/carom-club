# 커뮤니티 게시판 목록 4차 최적화 (Phase 4)

> **최적화 종료 판단·모니터링 방침·선택 과제:** [`COMMUNITY_BOARD_LIST_PERFORMANCE_CLOSURE.md`](./COMMUNITY_BOARD_LIST_PERFORMANCE_CLOSURE.md)

## 목표

- 공지 고정글 + 일반 목록 **동시 조회**에서 공지 쪽 부하·반복 조회 완화
- **제목 contains** 검색 비용 점검 및 DB 보강
- **검색어 없을 때** 제목 조건 미적용
- 구간별 **성능 로그**로 비교 가능하게 함

---

## 1. 공지 고정글

| 항목 | 내용 |
|------|------|
| **캐시 적용** | **예** — `unstable_cache`, `revalidate: 45s`, 태그 `community-board-notice-{boardId}` |
| **일반 목록과 분리** | **예** — `getNoticePinnedCached`는 `isPinned: true`만 조회, 일반 목록은 `isPinned: false` (`slug === "notice"`일 때) |
| **캐시 키** | boardId, 모더 숨김 노출, 검색어, 인기 필터, trouble status, slug, **로컬 달력 일자**(today/weekly 경계와 맞춤) |
| **무효화** | 공지 작성 `POST` (`boards/[slug]/posts`), 공지 글 `PATCH`/`DELETE` (`posts/[id]`), 신고 처리로 공지 **숨김·해제** (`reports/[id]` PATCH) 시 `revalidateTag` |

> 트랜잭션 `tx`로 목록을 조회할 때도 고정글 캐시는 **전역 `prisma`** 기준으로 동작한다. 공지 목록 API는 보통 단일 요청·무트랜잭션이라 실무 영향은 작다.

---

## 2. 검색 (제목 contains)

| 항목 | 내용 |
|------|------|
| **쿼리** | Prisma `title: { contains, mode: 'insensitive' }` 유지 (UX: 부분 일치) |
| **빈 검색어** | `qTitle` trim 후 빈 문자열이면 **제목 where 생략** (`buildBoardListWhere`) |
| **인덱스** | `@@index([boardId, isHidden, title])` + 마이그레이션 btree 인덱스 |
| **PostgreSQL** | `pg_trgm` + GIN `CommunityPost_title_gin_trgm_idx` — `ILIKE '%…%'` 계열에 유리 |

**성능 개선 여부:** 마이그레이션 적용 후 DB에서 제목 패턴 검색 시 **seq scan 대비 완화**를 기대. 정확한 ms는 데이터량·선택도에 따라 다르므로 아래 로그로 측정.

---

## 3. 성능 로그

환경 변수: `COMMUNITY_LIST_PERF_LOG=1`

| 로그 라벨 | 의미 |
|-----------|------|
| `GET boards/[slug]/posts` | 핸들러 전체(기존 `communityListPerfStart`) |
| `notice_pinned_search` / `notice_pinned_nosearch` | 공지 고정글 구간 (캐시 히트 시 매우 짧게 보일 수 있음) |
| `list_main_search` / `list_main_nosearch` | 일반 목록 `findMany` |

같은 요청에서 `*_search` vs `*_nosearch` 및 고정글 vs 목록 ms를 비교하면 된다.

---

## 4. 보고 요약

| 질문 | 답 |
|------|-----|
| 공지 캐시 적용 여부? | **적용함** (45s + 태그 무효화 + 주요 변경 경로 연동) |
| 검색 성능 개선 여부? | **조건부** — 빈 `q` 제거로 불필요한 필터 제거 + **인덱스·GIN(trgm)** 으로 contains 부하 완화. 실측은 `COMMUNITY_LIST_PERF_LOG=1` + `EXPLAIN ANALYZE` 권장 |
| **남은 병목 1개 (후보)** | **일반 목록 `findMany` 자체** — 페이지네이션·정렬·인기(like/view/comment)·커서 조합에 따른 큰 결과 스캔/정렬. 공지는 캐시로 분리했으므로 상대적으로 **목록 쿼리 + 총합 집계(있다면)** 가 다음 튜닝 대상 |

---

## 관련 파일

- `lib/community-board-list-query.ts` — where 분리, 고정글 캐시, `Promise.all`, perf 측정
- `lib/community-list-perf.ts` — `communityListPerfMeasure`, `communityListPerfStart`
- `lib/community-notice-pinned-revalidate.ts` — 태그 / `revalidateCommunityNoticePinned`
- `app/api/community/boards/[slug]/posts/route.ts` — 공지 POST 후 무효화
- `app/api/community/posts/[id]/route.ts` — 공지 PATCH/DELETE 후 무효화
- `app/api/community/reports/[id]/route.ts` — 공지 숨김·해제 후 무효화
- `prisma/schema.prisma` — `CommunityPost` 인덱스
- `prisma/migrations/20260422000000_community_post_title_search_indexes/migration.sql`
