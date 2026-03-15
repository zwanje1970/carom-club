# 페이지 전환/로딩 성능 개선 보고

## 목표
- 내부 페이지 이동 체감 속도 **약 1초 내외**로 개선
- 전체 새로고침처럼 보이는 이동 제거
- 목록/상세 데이터·이미지 로딩 최적화

---

## 1. 적용한 변경 사항

### 1) 캐시·revalidate
- **메인** (`app/page.tsx`): `force-dynamic` 제거 → `revalidate = 60` (60초 캐시)
- **대회 목록** (`app/tournaments/page.tsx`): 동일하게 `revalidate = 60`
- **당구장 목록** (`app/venues/page.tsx`): 동일하게 `revalidate = 60`  
→ 자주 보는 페이지는 60초 동안 캐시되어 재방문 시 DB/API 부담 감소.

### 2) DB 인덱스
- **Tournament** 모델: `@@index([status, startAt])` 추가  
→ 목록 조회 시 `status NOT IN ('DRAFT','HIDDEN')` + `orderBy startAt` 조건이 인덱스로 처리되어 스캔 비용 감소.  
- **마이그레이션**: `npx prisma migrate dev` 로 인덱스 생성 필요 (배포 시 적용).

### 3) 로딩·스켈레톤 UI
- **전역**: `app/loading.tsx` (이미 존재)
- **대회 목록**: `app/tournaments/loading.tsx` (카드 스켈레톤)
- **대회 상세**: `app/tournaments/[id]/loading.tsx` (상세 스켈레톤) **신규**
- **당구장 목록**: `app/venues/loading.tsx` **신규**
- **클라이언트/관리자**: `app/client/loading.tsx`, `app/admin/loading.tsx` (이미 존재)  
→ 4초 대기 시 빈 화면 대신 스켈레톤으로 체감 속도 개선.

### 4) 성능 로그 (어디가 느린지 확인)
- **`lib/perf.ts`**: `getServerTiming()`, `logServerTiming(label, startMs?)`, `measureAsync(label, fn)`  
  - 라벨: `page`, `db`, `fetch_copy`, `fetch_sections` 등
- **적용 페이지**
  - 메인: `fetch_sections`(콘텐츠/설정), `db`(대회·당구장 목록), `page`
  - 대회 목록: `fetch_copy`, `db`, `page`
  - 대회 상세: `db`, `fetch_copy`(copy+session 병렬), `page`
  - 당구장 목록: `fetch_copy`, `db`, `page`  
→ 서버 콘솔에 `[perf] db: 120ms` 형태로 출력. `NEXT_PUBLIC_PERF_LOG=0` 이면 비활성화.

### 5) next/image·lazy
- **대회 목록 카드**: `<img>` → `<Image>` (fill, sizes, loading="lazy"), 상대 경로만 최적화
- **페이지 섹션 이미지** (`components/sections/ImageSection.tsx`): `<img>` → `<Image>` (fill, lazy, data URL은 unoptimized)
- **팝업 이미지** (`components/common/Popup.tsx`): `<img>` → `<Image>` (fill, aspect-video, lazy)  
→ 레이아웃 시프트 감소, 뷰포트 밖 이미지는 lazy로 지연 로드.

### 6) 서버 요청 병렬화
- **대회 상세** (`app/tournaments/[id]/page.tsx`): `getAdminCopy()`와 `getSession()`을 `Promise.all([getAdminCopy(), getSession()])` 로 한 번에 요청  
→ copy·session 순차 대기 시간 감소.

### 7) 링크 점검
- 이전 점검에서 내부 이동은 Next.js `Link` 또는 admin `Button`(Link 기반) 사용 확인.  
  로그인/리다이렉트만 `window.location` 사용(의도적). 추가 수정 없음.

### 8) 목록 쿼리
- `getTournamentsListRaw`는 이미 최소 필드만 조회(본문·큰 이미지 제외). 변경 없음.

---

## 2. 어떤 페이지가 왜 느릴 수 있었는지 (로그로 확인 가능)

| 페이지 | 가능한 원인 | 로그로 확인 |
|--------|-------------|-------------|
| 메인 | DB 대회/당구장 목록, 여러 콘텐츠/설정 fetch | `[perf] fetch_sections`, `db`, `page` |
| 대회 목록 | copy + DB 목록 조회, 이미지 다수 | `fetch_copy`, `db`, `page` |
| 대회 상세 | 단일 대회 findUnique(include 많음), copy·session | `db`, `fetch_copy`, `page` |
| 당구장 목록 | clientApplication + organization 조회 | `fetch_copy`, `db`, `page` |

- **db** 구간이 크면: 쿼리/인덱스·N+1 점검 (위 인덱스로 일부 완화).
- **fetch_copy** / **fetch_sections** 가 크면: 캐시(revalidate)로 재방문 시 개선.
- **이미지**: next/image·lazy로 초기 렌더·LCP 개선.

---

## 3. 예상 개선 효과

| 항목 | 예상 효과 |
|------|-----------|
| revalidate 60초 | 재방문 시 메인/대회/당구장 목록 응답 시간 감소 (캐시 히트 시 DB 생략) |
| Tournament (status, startAt) 인덱스 | 목록 쿼리 시간 감소 (테이블 스캔 → 인덱스 스캔) |
| 로딩/스켈레톤 UI | 체감 대기 시간 감소 (빈 화면 4초 → 즉시 스켈레톤) |
| next/image + lazy | LCP·CLS 개선, 뷰포트 밖 이미지 로딩 지연으로 초기 로딩 경량화 |
| copy·session 병렬화 (상세) | 대회 상세 페이지 서버 처리 시간 소폭 감소 |

**체감 목표(약 1초)** 달성을 위해:
1. 서버 로그에서 `[perf]`로 병목 구간 확인 후, DB 쿼리·인덱스 추가 검토.
2. 필요 시 revalidate 값을 조정(예: 30~120초).
3. 대회 상세의 `include`(entries 등)가 무거우면 목록/상세 분리 또는 페이징 검토.

---

## 4. 추가로 해두면 좋은 것

- **이미지**: 업로드 시 WebP·썸네일 생성 파이프라인 도입 시 목록에서 썸네일만 사용 (구조만 정리해 두었고, 실제 변환 로직은 미구현).
- **마이그레이션**: `npx prisma migrate dev --name add_tournament_status_start_at_index` 로 인덱스 반영 후 배포.
