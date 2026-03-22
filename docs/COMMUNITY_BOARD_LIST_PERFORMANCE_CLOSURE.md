# 커뮤니티 게시판 성능 최적화 — 종료 단계

**판단일:** 운영 기준 종료 선언 (추가 리팩토링 중단, 실측 모니터링 후 필요 시만 대응)

## 현재 완료 상태

| 영역 | 상태 |
|------|------|
| 공지 고정글 | 캐시 + 무효화 완료 |
| 검색 | 인덱스(`boardId,isHidden,title` + `pg_trgm` GIN) + 빈 검색어 시 조건 제거 완료 |
| 페이지네이션 | Cursor 기반 적용 완료 |
| 렌더링 | Server 중심 구조 완료 |
| 클라이언트 | 목록 fetch 최소화 완료 |

## 종료 판단

- **구조적 병목은 해소된 것으로 본다.**
- 남은 **`list_main` `findMany`** 는 게시판 목록의 정상적인 최종 비용 구간으로 본다. (정렬·필터·페이지 크기에 따른 DB 조회)
- **이 단계에서 추가 리팩토링은 필수 아님** — 실사용 트래픽·지표를 본 뒤 필요할 때만 개입한다.

## 선택 과제 (트래픽·지표 기준)

필요 시 순서 없이 검토만 하면 됨.

1. **인기/최신 1페이지 캐시** — 첫 화면 히트가 크고 DB 부하가 눈에 띄울 때 `unstable_cache` 등 짧은 TTL 캐시 검토
2. **Read replica** — 읽기 QPS·DB CPU/지연이 지속적으로 한계에 닿을 때 인프라 측면 검토
3. **별도 검색 엔진** — 제목 검색 트래픽·복잡도가 커질 때 (전문 검색, 오타, 가중치 등) Elasticsearch/Meilisearch 등 검토

## 관련 문서

- `docs/COMMUNITY_BOARD_LIST_PHASE4.md` — 4차(공지 분리·검색·로그) 상세
- 이전 단계: `COMMUNITY_BOARD_LIST_PHASE2.md`, `COMMUNITY_BOARD_LIST_PHASE3.md`

## 모니터링 힌트

- 서버: `COMMUNITY_LIST_PERF_LOG=1` 로 구간 ms (필요 시 일시 활성화)
- DB: 느린 쿼리 로그, `EXPLAIN ANALYZE` (검색·인기 정렬 구간)
- 앱: 목록 API p95/p99, 에러율
