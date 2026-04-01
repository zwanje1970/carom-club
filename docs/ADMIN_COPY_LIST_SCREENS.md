# 관리자·클라이언트 목록형 화면 — 메뉴/문구(copy) 적용 범위

`getCopyValue` + `DEFAULT_ADMIN_COPY` + 빈 문자열 폴백 + `fillAdminCopyTemplate` 패턴 기준으로, **목록·테이블형 UI**에서 무엇을 치환했는지와 **치환하지 않는 것**을 구분한다.

**전체 키 네이밍·공용/전용 기준·통합 이력:** `docs/ADMIN_COPY_KEY_REGISTRY.md`

## 공용 네임스페이스

| 네임스페이스 | 용도 |
|-------------|------|
| `admin.list.*` | 플랫폼 관리자·클라이언트 콘솔에서 **반복되는** 목록 UI (로딩, 페이지네이션, `—`/`-`, `전체`, 페이지당·건, 정렬 라벨, **공통 표 헤더**(장소·상태·작업·대회명·일시 등), 필터 후 빈 목록 문구, 검색/필터 접근성 등) |
| `admin.tournaments.*` | `/admin/tournaments` **목록 화면 전용**(플랫폼/클라이언트 제목 분기, 주최 클라이언트·경기방식 열, 이전 대회 불러오기/대회 생성 버튼 등) |
| `admin.community.posts.*` | `/admin/community/posts` 스텁 페이지(커뮤니티 이동 안내) |
| `admin.feeLedger.*` | `/admin/fee-ledger` 정산·회비 장부(요약 카드, 탭, 정렬 옵션, 당구장·회비유형 등 **정산 도메인** 표 헤더) |
| `admin.venues.*` | `/admin/venues` 클라이언트 목록 |
| `admin.clientApplications.*` | `/admin/client-applications` 신청 목록 |
| `admin.inquiries.*` | `/admin/inquiries` 안내 문구 |
| `admin.members.*` | `/admin/members` 회원·권한 (화면별 세부) |
| `client.operations.*` | 클라이언트 대회 운영 허브·참가 관리 등 (**대회명·일정·참가비·신청** 등 운영 화면 특유 열) |
| `client.dashboard.tournamentStatus.*` | `Tournament.status` **공통** 라벨(대시보드·관리자 대회 목록 등에서 동일 의미로 재사용) |
| `site.tournaments.empty` | 등록된 대회 없음(사이트 대회 목록과 **동일 문구**를 쓰는 관리자 대회 목록 빈 상태) |

**정리:** `client.operations.format.emptyDash`는 제거하고 **`admin.list.emptyDash`**로 통합했다. 참가비·신청 수 등 **형식 템플릿**은 `client.operations.format.entryFee`, `client.operations.format.applicationsCell` 등에 유지한다.

`admin.members`에서 의미가 `admin.list`와 겹치던 항목은 코드상 **`admin.list.filter.all`**, **`admin.list.sortLabel`**, **`admin.list.perPageLabel`**, **`admin.list.perPageSuffix`**를 쓰도록 옮겼다.  
`DEFAULT_ADMIN_COPY`에서 삭제한 키(`admin.members.filter.roleType.all`, `admin.members.filter.status.all`, `admin.members.sortLabel`, `admin.members.perPageLabel`, `admin.members.perPageSuffix`)는 **DB에만 남아 있는 커스텀 값**은 더 이상 적용되지 않는다(필요 시 `admin.list.*`에 동일 문구로 다시 설정).

**승격·통합 (이번 배치):** 클라이언트 운영 허브 표에서 **`장소` / `상태` / `작업`** 열은 **`admin.list.thVenue`**, **`admin.list.thStatus`**, **`admin.list.thActions`**로 통합했다. `DEFAULT_ADMIN_COPY`에서 **`client.operations.thVenue`**, **`thStatus`**, **`thActions`** 키는 제거되었으며, 설정 DB에만 남아 있던 해당 키 커스텀은 **로드되지 않는다**(새 키로 다시 설정).

### `admin.list.*`로 승격하는 기준 vs 화면 전용으로 두는 기준

| `admin.list.*`로 승격 | 화면 전용 네임스페이스에 둠 |
|----------------------|---------------------------|
| 여러 관리자/클라이언트 **목록·표**에서 **같은 한글 의미**로 반복되는 표 헤더(예: 장소, 상태, 작업, 대회명, 일시) | 한 화면의 **역할·도메인**에만 맞는 열·버튼(예: 주최 클라이언트, 경기방식, 정산 탭·회비유형) |
| 빈 필터 결과·날짜/값 없음 표시 등 **패턴이 동일**한 문구(`admin.list.emptyFiltered`, `admin.list.datePlaceholder`) | 대회 운영만의 **이벤트 카피**(클라이언트 `client.operations.*`의 설명·퀵 액션 등) |
| 페이지네이션·로딩·검색 `aria-label` 등 **목록 UX 공통** | 서버가 내려주는 **행 데이터**(`thisMonthStatus` 등)·API 에러 메시지 |

`Tournament.status` **표시 라벨**은 플랫폼 관리자 대회 목록에서 **`client.dashboard.tournamentStatus.*`** + **`getDashboardTournamentStatusLabel`**을 쓴다. 클라이언트 운영 허브 표는 **`client.operations.tournamentStatus.*`** + **`getClientOperationsTournamentStatus`**를 유지한다(DRAFT 문구 등 제품상 다를 수 있음).

## 치환 대상 (이번·기존 배치)

- 정적 UI: 페이지 제목·인트로, 표 헤더, 필터 라벨, `<option>` 라벨(코드에 매핑된 enum), 빈 목록/로딩, 페이지네이션 라벨, 빠른 실행/행 액션 링크 텍스트  
- **형식 템플릿**: 금액 `{amount}원`, 신청 수 `{confirmed}{maxSuffix}` 등 `fillAdminCopyTemplate`로 조합하는 부분  
- **클라이언트 기본 알림/프롬프트**: `confirm` / `prompt` / `alert`에 넣는 **고정 한글 문장** (API 본문이 아닌 경우)  
- **접근성**: `aria-label`(검색 입력, 표 요약, 페이지네이션 `nav`, 필터 `select` 등), `role="status"` / `role="alert"` (로딩·오류·빈 상태)

## 비대상 (치환하지 않음)

다음은 **원문 그대로** 두거나, **서버/DB가 준 문자열을 우선**한다.

| 구분 | 예시 |
|------|------|
| API/DB 필드 | 회원명, 업체명, 대회명, `row.slug`, 신청자 연락처, 거절 **사유 본문**, RBAC `roleOption.label`, 권한 `permission.label` |
| HTTP 응답 에러 | `data.error`, `res.json().error`, fetch 실패 시 서버가 준 메시지를 그대로 `setError` 등에 표시하는 경우 |
| 동적/기술 표시 | 사용자명 `(username)` 괄호 안, `communityScore` 수치, 타입 코드가 알려지지 않은 경우의 **raw `row.type` 폴백** |

**구분:** 클라이언트에서만 정의한 **폴백 문구**(예: `throw new Error(getCopyValue(...))`)는 copy 키로 관리한다. 반면 **`setError(data.error || …)`**에서 `data.error`가 있으면 그것이 우선이며, 이는 서버 메시지로 분류한다.

정산 장부의 **`이번달 상태`** 셀 값(`납부완료` / `미납` 등)은 **서버/집계 로직과 연동된 데이터**로 두고, 스타일 분기만 유지한다.

## 화면별 적용 파일 (목록형 중심)

- `app/(site)/admin/members/*`, `AdminMembersList.tsx`  
- `app/(site)/admin/venues/page.tsx`, `VenueListTable.tsx`  
- `app/(site)/admin/client-applications/page.tsx`, `ClientApplicationsList.tsx`  
- `app/(site)/admin/inquiries/page.tsx`  
- `app/(site)/admin/tournaments/page.tsx`  
- `app/(site)/admin/community/posts/page.tsx`  
- `app/(site)/admin/fee-ledger/page.tsx`, `FeeLedgerPageClient.tsx`  
- `app/(site)/client/operations/page.tsx`, `participants/page.tsx`, `OperationsQuickActions`, `OperationsTournamentListRowActions`, `OperationsTournamentMobileCard`

## 미적용·후속 후보

- 플랫폼 관리자: `admin/participants`, `admin/brackets`, 설정·팝업 등  
- 클라이언트: `client/tournaments`, `client/billing`, `client/zones`, 대회 하위 `operations/tournaments/[id]/*` 패널 컴포넌트 등  
- `FeeLedgerModal` 및 기타 모달 전용 문구

---

설정 UI(`admin/site/copy` 등)에서 키를 검색할 때는 `ADMIN_COPY_GROUPS`( `lib/admin-copy.ts` )의 그룹명을 참고하면 된다.
