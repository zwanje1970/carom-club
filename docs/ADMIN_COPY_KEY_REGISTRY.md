# Admin copy 키 레지스트리 (`DEFAULT_ADMIN_COPY`)

`lib/admin-copy.ts`의 **`DEFAULT_ADMIN_COPY`**는 메뉴/문구 설정 UI와 `getAdminCopy()` 병합의 **단일 소스**이다. `lib/admin-copy-server.ts`의 `COPY_KEYS`는 이 객체의 키 집합과 동일하다.

## 공용 키(`admin.list.*`) vs 화면 전용 네임스페이스 — 확정 기준

| 구분 | 조건 | 예시 |
|------|------|------|
| **`admin.list.*`로 둔다** | 여러 플랫폼 관리자·클라이언트 **목록/표**에서 **같은 열 의미**(상태, 작업, 장소, 업체명, 빈 필터 결과, 페이지네이션, 공통 `aria` 등)로 재사용된다. | `admin.list.thStatus`, `admin.list.thOrgName`, `admin.list.emptyFiltered` |
| **화면 전용 네임스페이스에 둔다** | 한 메뉴/도메인에만 쓰이거나, **같은 한글이라도 문맥이 다르면** 분리한다. | `admin.members.thUsernameEmail`, `admin.feeLedger.thBilliardHall`, `client.operations.format.*` |
| **`admin.common.*`** | 버튼·칼럼이 아닌 **액션/편집기** 공통(저장, 취소, 일괄 치환 placeholder 등). 목록 표 헤더는 우선 `admin.list.*`. | `admin.common.save`, `admin.common.cancel` |
| **`site.*`** | **공개 사이트** 카피(홈, 대회, 당구장, 커뮤니티 슬롯 등). 관리자 전용 문구와 섞지 않는다. | `site.tournaments.empty` |
| **`client.dashboard.*` / `client.console.*` / `client.operations.*`** | 클라이언트 콘솔·대시보드·대회 운영 허브. 플랫폼 관리자 메뉴와 동일 단어라도 **제품 맥락이 다르면** 키를 분리한다. | `client.operations.tournamentStatus.*` vs `client.dashboard.tournamentStatus.*` |

**원칙:** 기본값 문자열이 같아도, **설정 화면에서 묶어 편집할 단위**가 다르면 키를 합치지 않는다. 다만 **완전히 동일한 열 헤더**는 `admin.list.*` 한 곳으로 모아 중복 키를 제거한다.

## 네임스페이스 요약

| 접두사 | 용도 |
|--------|------|
| `menu.*` | 관리자 사이드 메뉴 라벨 |
| `nav.*` | 관리자 상단 유저 메뉴 |
| `settings.menu.*` | 설정 하위 메뉴 |
| `site.*` | 공개 사이트(홈·대회·당구장·커뮤니티·페이지 빌더 등) |
| `admin.common.*` | 관리자 공통 액션·편집기 |
| `admin.list.*` | 목록/테이블 **공통** (헤더 일부, 빈 결과, 로딩·페이지네이션·placeholder·aria 등) |
| `admin.members.*` | `/admin/members` 전용 |
| `admin.venues.*` | 클라이언트 목록·상태·유형 enum 라벨 |
| `admin.clientApplications.*` | 신청 목록·처리 버튼·확인문 |
| `admin.feeLedger.*` | 정산·회비 장부 |
| `admin.tournaments.*` | 플랫폼/클라이언트 관리자 대회 **목록** 화면 전용 |
| `admin.community.posts.*` | 커뮤니티 글 관리 스텁 |
| `admin.inquiries.*` | 문의 관리 안내 |
| `admin.dashboard.*` | 플랫폼 관리자 대시보드 |
| `admin.settings.*` | 설정 각 탭(라벨 UI에 노출) |
| `admin.participants.*` / `admin.tournament.*` / `admin.clientOnly.*` / `admin.forbidden.*` | 참가자·대회 편집·게이트 문구 |
| `client.dashboard.*` | 클라이언트 대시보드 홈·표 |
| `client.console.*` / `client.gate.*` / `client.sidebar.*` | 콘솔 레이아웃·내비·게이트 |
| `client.operations.*` | 대회 운영 허브(표·카드·퀵액션·형식 템플릿) |
| `client.zones.*` | 권역 안내 |

## 동적 키(문자열 상수로는 “미참조”로 보이는 경우)

다음 패턴은 런타임에 키 문자열을 조합한다. **단순 grep으로 “미사용 키”를 판단하면 안 된다.**

- `` `admin.venues.type.${type}` ``, `` `admin.venues.status.${status}` ``
- `` `admin.clientApplications.type.${type}` ``, `` `...status.${status}` ``, `` `...clientType.${t}` ``
- `` `client.operations.tournamentStatus.${status}` ``, `` `client.dashboard.tournamentStatus.${status}` ``
- `` `admin.members.permCategory.${category}` ``, `` `site.tournament.stage.${stage}` ``

헬퍼: `getClientOperationsTournamentStatus`, `getDashboardTournamentStatusLabel`, `getVenueOrgStatusLabel`, `getFeeLedgerFeeTypeLabel`.

## 메뉴/문구 설정 UI (요약)

`app/(site)/admin/site/copy`는 **`ADMIN_COPY_GROUPS`를 펼쳐** 행을 만들며, 그룹에 등록된 키 집합은 **`DEFAULT_ADMIN_COPY`와 1:1**이다. 상세 로드·저장 동작은 아래 **운영 점검** 절을 본다.

## 통합·제거 이력 (중복 의미 정리)

| 제거된 키 | 대체(canonical) | 비고 |
|-----------|-----------------|------|
| `admin.members.thStatus` | `admin.list.thStatus` | 동일 열 의미「상태」 |
| `client.dashboard.home.thStatus` | `admin.list.thStatus` | 동일 |
| `admin.clientApplications.thOrgName` | `admin.list.thOrgName` | 동일「업체명」 |

이전 키로 DB에 저장해 둔 커스텀 값은 **자동 이전되지 않는다**. 필요 시 관리 UI에서 `admin.list.*`에 동일 문구로 다시 저장한다.

## 유지보수 시 주의

- **키 삭제**는 제품·DB 영향이 있으므로, 통합 시 위 표처럼 문서에 **대체 키**를 남긴다.
- **`admin.common.*`** 중 일부는 앱 코드에서 직접 참조되지 않아도, **일괄 치환·설정 화면**용으로 둔 것이 있을 수 있다. “grep 미매칭 = 삭제”로 판단하지 않는다.
- 목록형 화면 치환 범위·비대상(API/DB 문자열)은 `docs/ADMIN_COPY_LIST_SCREENS.md`와 함께 본다.

---

## 운영 점검: `/admin/site/copy`와 반영 범위

### 로드·저장 경로 (구조 변경 없음, 동작 요약)

| 단계 | 동작 |
|------|------|
| **표시** | 클라이언트는 `ADMIN_COPY_GROUPS`를 펼쳐 **모든 `DEFAULT_ADMIN_COPY` 키**를 한 줄씩 노출한다(그룹별). `DEFAULT` 키 개수와 그룹에 등록된 키 개수는 일치한다(`scripts/compare-copy-groups.cjs`로 검증 가능). |
| **초기 병합** | `GET /api/admin/copy` → `getAdminCopy()` → 베이스는 `DEFAULT_ADMIN_COPY` 전체이고, DB `adminCopy` 행 중 **`key`가 `COPY_KEYS`(= `Object.keys(DEFAULT_ADMIN_COPY)`)에 포함된 것만** `base[key] = row.value`로 덮어쓴다. |
| **저장** | `PUT /api/admin/copy` body의 `copy` 객체에 대해 `updateAdminCopy`가 **`Object.keys(updates)`를 순회**하며, **`COPY_KEYS`에 있는 키만** upsert한다. 값이 빈 문자열이면 `DEFAULT_ADMIN_COPY[key]`로 저장된다. |
| **적용 시점** | 저장 후 `router.refresh()`로 서버 컴포넌트 재요청. `getAdminCopy()`를 쓰는 페이지·레이아웃에 반영된다. |

**화면 전용 키**를 수정하면: 해당 네임스페이스를 `getCopyValue`로 읽는 **그 화면·컴포넌트**에만 영향이 있다(예: `admin.feeLedger.*` → 정산 장부).

**공용 키(`admin.list.*` 등)** 를 수정하면: 아래 [공용 키 변경 영향](#공용-키adminlist-변경-시-영향-범위-요약)에 나열한 **모든 참조 지점**에 한 번에 반영된다.

### 동적 키 패턴

`admin.venues.type.${code}` 등 **런타임 조합 키**는 `DEFAULT_ADMIN_COPY`에 **수십 개의 고정 키**로 존재한다. 미사용 자동 삭제 대상이 **아니다**. 문자열 grep으로 “참조 없음”이 나와도 레지스트리·제품 정책상 유지한다.

### DB에만 남은 구 키 → 대체 키 안내

`COPY_KEYS`에서 빠진 키는 **로드 시 무시**되므로, 과거에 DB에 저장해 둔 값은 적용되지 않는다. 아래로 **수동 이전**한다(동일 문구를 새 키에 다시 저장).

| 구 키(더 이상 적용 안 됨) | 대체 키(canonical) |
|---------------------------|---------------------|
| `admin.members.thStatus` | `admin.list.thStatus` |
| `client.dashboard.home.thStatus` | `admin.list.thStatus` |
| `admin.clientApplications.thOrgName` | `admin.list.thOrgName` |
| `admin.members.filter.roleType.all` | `admin.list.filter.all` |
| `admin.members.filter.status.all` | `admin.list.filter.all` |
| `admin.members.sortLabel` | `admin.list.sortLabel` |
| `admin.members.perPageLabel` | `admin.list.perPageLabel` |
| `admin.members.perPageSuffix` | `admin.list.perPageSuffix` |
| `client.operations.thVenue` | `admin.list.thVenue` |
| `client.operations.thStatus` | `admin.list.thStatus` |
| `client.operations.thActions` | `admin.list.thActions` |

운영 DB 점검: Prisma Studio 또는 SQL에서 `adminCopy` 테이블의 `key` 열을 위 목록과 대조한다. 구 키 행은 삭제하거나, 값을 복사한 뒤 **대체 키**로 새 행을 저장한 다음 구 키를 정리한다.

### 공용 키(`admin.list.*`) 변경 시 영향 범위 (요약)

아래는 **현재 코드베이스 기준** `getCopyValue(..., "admin.list.*")` 사용처이다. 키 하나를 바꾸면 이 파일들이 함께 바뀐다.

| 키 | 참조 파일(요약) |
|----|-----------------|
| `admin.list.filter.all` | `AdminMembersList.tsx`, `VenueListTable.tsx` |
| `admin.list.sortLabel`, `perPageLabel`, `perPageSuffix` | `AdminMembersList.tsx` |
| `admin.list.loading` | `AdminMembersList.tsx`, `ClientApplicationsList.tsx` |
| `admin.list.paginationPrev` / `Next`, `paginationNavAria` | `AdminMembersList.tsx` |
| `admin.list.thType`, `thOrgName`, `thStatus`, `thActions` | `ClientApplicationsList.tsx`, `VenueListTable.tsx` |
| `admin.list.thStatus` | 위 + `AdminMembersList.tsx`, `client/dashboard/page.tsx`, `fee-ledger/FeeLedgerPageClient.tsx`, `client/operations/page.tsx`, `admin/tournaments/page.tsx` |
| `admin.list.thVenue`, `thTournamentName`, `thDateTime` | `client/operations/page.tsx`, `admin/tournaments/page.tsx` |
| `admin.list.thActions` | `client/operations/page.tsx`, `VenueListTable.tsx` |
| `admin.list.emptyDash`, `datePlaceholder` | `ClientApplicationsList.tsx`, `VenueListTable.tsx`, `client/operations/page.tsx`, `FeeLedgerPageClient.tsx` 등 |
| `admin.list.emptyFiltered` | `FeeLedgerPageClient.tsx` |

**참고:** `admin.list.searchAria`는 `DEFAULT_ADMIN_COPY`·그룹에 포함되어 설정 UI에서 편집 가능하나, **현재 TSX에서 `getCopyValue`로 읽는 곳은 없다**. DB에 값이 있어도 화면에 쓰이지 않는다(향후 검색/필터 `aria-label` 연결 시 사용 예정).
