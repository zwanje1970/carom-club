# 1단계: 현황 파악 및 백업

작성일: 2025-03-11  
목적: 권한/대시보드 재정리 전 현재 상태 고정. 단계별 작업 시 참조용.

---

## 1. 현재 관리자 메뉴 구조

**사이드바** (`components/admin/AdminSidebar.tsx`): 단일 메뉴 리스트, 역할별 분기 없음.

| 순서 | href | label |
|------|------|--------|
| 1 | /admin | 대시보드 |
| 2 | /admin/tournaments | 대회관리 |
| 3 | /admin/participants | 참가자관리 |
| 4 | /admin/brackets | 대진표관리 |
| 5 | /admin/members | 회원관리 |
| 6 | /admin/inquiries | 문의관리 |
| 7 | /admin/venues | 클라이언트 목록 |
| 8 | /admin/fee-ledger | 회비 장부 |
| 9 | /admin/client-applications | 클라이언트 신청 |
| 10 | /admin/settings | 설정 |

- **설정** 진입 후: 사이트 관리(/admin/site), 관리자 정보 수정, 사이트 기본 정보, 알림, 연동, 요금 정책, 메뉴/문구 등.
- **사이트 관리** (/admin/site): 메인페이지 구성, 히어로, 컴포넌트(→page-sections), 헤더, 푸터, 공통 디자인.

---

## 2. 현재 관리자 라우트 정리

### 2.1 /admin 진입 및 레이아웃

- **미들웨어** (`middleware.ts`): `/admin/*` (로그인 제외) 접근 시 `carom_session` 쿠키 없으면 `/admin/login?from=...` 리다이렉트. **역할 검사 없음.**
- **레이아웃** (`app/admin/layout.tsx`):
  - 세션 없으면 `/admin/login` 리다이렉트.
  - **세션 있으나 `session.role !== "PLATFORM_ADMIN"`** → 403 UI 표시("캐롬클럽 관리자 권한이 없습니다") + 로그아웃/메인 링크. **CLIENT_ADMIN도 /admin/* 접근 불가.**

### 2.2 페이지 라우트 목록 (app/admin)

| 경로 | 비고 |
|------|------|
| /admin | 대시보드 (page.tsx 또는 dashboard 리다이렉트) |
| /admin/login | 로그인 (레이아웃 없이) |
| /admin/me | 관리자 정보 수정 |
| /admin/dashboard | → /admin 리다이렉트 |
| /admin/tournaments | 대회 목록 |
| /admin/tournaments/new | 대회 생성 |
| /admin/tournaments/[id] | 대회 상세 |
| /admin/tournaments/[id]/edit | 대회 수정 |
| /admin/tournaments/[id]/outline | 대회 개요 |
| /admin/tournaments/[id]/participants | 참가자 관리 |
| /admin/participants | 참가자관리 (전체?) |
| /admin/brackets | 대진표관리 |
| /admin/members | 회원관리 (PLATFORM_ADMIN만, 페이지에서 추가 체크) |
| /admin/inquiries | 문의관리 |
| /admin/venues | 클라이언트(업체) 목록 |
| /admin/venues/[id] | 클라이언트 상세 |
| /admin/venues/[id]/promo | 홍보 페이지 |
| /admin/fee-ledger | 회비 장부 |
| /admin/client-applications | 클라이언트 신청 (PLATFORM_ADMIN만, 페이지에서 체크) |
| /admin/settings | 설정 목록 |
| /admin/settings/site | → `/admin/site/settings` 리다이렉트 |
| /admin/settings/hero | → `/admin/site/hero` 리다이렉트 |
| /admin/settings/footer | → `/admin/site/footer` 리다이렉트 |
| /admin/settings/notifications | 알림 설정 |
| /admin/settings/integration | 연동 설정 |
| /admin/settings/platform-billing | 요금 정책 |
| /admin/settings/labels | → `/admin/site/copy` 리다이렉트 |
| /admin/settings/system-text | → `/admin/site/copy` 리다이렉트 |
| /admin/site | 사이트 관리 랜딩 |
| /admin/site/main | 메인페이지 구성 |
| /admin/site/hero | 메인 히어로 설정 + 구 CMS 메인 비주얼 링크 |
| /admin/site/components | → /admin/page-sections |
| /admin/site/header | 헤더 설정 |
| /admin/site/footer | 푸터 설정 + 문구 페이지 링크 |
| /admin/site/copy | 고정문구 · 페이지별 문구(통합) |
| /admin/site/design | → `/admin/site/settings` 리다이렉트 |
| /admin/site/settings | 사이트 설정 · 디자인/색상 (로고·테마·헤더 색상 등) |
| /admin/page-sections | 페이지 섹션(컴포넌트) 목록 |
| /admin/page-sections/new | 섹션 추가 |
| /admin/page-sections/[id]/edit | 섹션 수정 |
| /admin/popups | 팝업 관리 |
| /admin/notice-bars | 공지 바 |

- **CLIENT_ADMIN 전용**: `/client/*` 별도 존재 (client/dashboard, client/tournaments/[id] 등). `/admin/*` 와 분리.

---

## 3. 현재 대회 관련 API 정리

| 메서드 | 경로 | 권한 | 비고 |
|--------|------|------|------|
| GET | /api/admin/tournaments | PLATFORM_ADMIN \| CLIENT_ADMIN | CLIENT_ADMIN 시 본인 조직만 (getClientAdminOrganizationId) |
| POST | /api/admin/tournaments | PLATFORM_ADMIN \| CLIENT_ADMIN | 동일 스코핑 |
| GET | /api/admin/tournaments/[id] | PLATFORM_ADMIN \| CLIENT_ADMIN | CLIENT_ADMIN 시 organization.ownerUserId === session.id |
| PATCH | /api/admin/tournaments/[id] | PLATFORM_ADMIN \| CLIENT_ADMIN | 동일 |
| GET/POST/PATCH/DELETE | /api/admin/tournaments/[id]/venues | PLATFORM_ADMIN \| CLIENT_ADMIN | 대회 수정 권한과 동일 검사 |
| PATCH | /api/admin/tournaments/[id]/outline | 세션만 검사, **역할/소유권 검사 없음** | 5단계에서 PLATFORM/CLIENT 차단·소유권 검사 추가 필요 |
| GET/POST | /api/admin/tournaments/[id]/rule | 세션만 검사, **역할/소유권 검사 없음** | 동일 |
| POST | /api/admin/tournaments/[id]/bracket/generate | 세션만 검사, **역할/소유권 검사 없음** | 동일 |
| POST | /api/admin/tournaments/[id]/participants/[entryId]/confirm | 세션만 검사, **역할/소유권 검사 없음** | 동일 |
| GET/POST | /api/admin/tournaments/[id]/participants/[entryId]/absent | 세션만 검사, **역할/소유권 검사 없음** | 동일 |
| GET/POST | /api/admin/tournaments/[id]/participants/[entryId]/attendance | 세션만 검사, **역할/소유권 검사 없음** | 동일 |
| GET | /api/client/tournaments/[id] | CLIENT_ADMIN | 본인 소유 업체 대회 1건 |

- **공통**: 대회 생성/수정 시 CLIENT_ADMIN은 `getClientAdminOrganizationId` / `organization.ownerUserId` 로 본인 조직만 허용. PLATFORM_ADMIN은 전체.

---

## 4. 현재 권한 체크 코드 전수

### 4.1 타입/유틸 (`types/auth.ts`)

- `UserRole`: `"USER" | "CLIENT_ADMIN" | "PLATFORM_ADMIN"` (ZONE_MANAGER 없음)
- `isPlatformAdmin(session)`: `session?.role === "PLATFORM_ADMIN"`
- `isClientAdmin(session)`: `session?.role === "CLIENT_ADMIN"`
- `isAdmin(session)`: `isPlatformAdmin(session) || isClientAdmin(session)`

### 4.2 라이브러리

- `lib/auth-org.ts`: `getClientAdminOrganizationId(session)`, `getAllowedOrganizationIds(session)` — CLIENT_ADMIN은 `Organization.ownerUserId` 또는 `OrganizationMember(ACTIVE)`로 연결된 조직들; 활성 조직은 쿠키 `client_console_org_id` + `lib/client-console-org.ts`의 `pickActiveOrganizationId`.

### 4.3 레이아웃/페이지

- `app/admin/layout.tsx`: `session.role !== "PLATFORM_ADMIN"` → 403 UI (CLIENT_ADMIN도 /admin 차단).
- `app/admin/members/page.tsx`: `session.role !== "PLATFORM_ADMIN"` → redirect("/admin/login").
- `app/admin/client-applications/page.tsx`: `session.role !== "PLATFORM_ADMIN"` → redirect("/admin/login").

### 4.4 API (역할 검사만 요약)

- **PLATFORM_ADMIN 전용**:  
  client-applications, client-applications/[id], content/page-sections, content/page-sections/reorder, content/popups, content/notice-bars, site-settings/*, copy, integration-status, integration-settings, notification-settings, venues, venues/[id], organizations/[id]/fee, organizations/[id]/fee/payments, platform-settings, site-settings(route), upload-image(PLATFORM_ADMIN|CLIENT_ADMIN 허용).
- **PLATFORM_ADMIN 또는 CLIENT_ADMIN**:  
  admin/tournaments, admin/tournaments/[id], admin/tournaments/[id]/venues.  
  (CLIENT_ADMIN은 본인 조직/대회만 — organization.ownerUserId 또는 getClientAdminOrganizationId 사용.)
- **outline/rule/bracket/participants 하위**: getSession 후 역할 검사 없거나 동일 패턴일 수 있음 — 5단계에서 전수 적용 시 확인.

### 4.5 기타

- `app/login/page.tsx`: role === "PLATFORM_ADMIN" → /admin, 아니면 /.
- `app/mypage/page.tsx`: CLIENT_ADMIN / PLATFORM_ADMIN 표시.
- `app/mypage/client-apply/page.tsx`: session.role !== "USER" 시 분기.
- `app/apply/client/route.ts`: session?.role !== "USER" 시 차단.
- `app/api/account/delete/route.ts`: role !== "USER" 시 관리자 탈퇴 차단.
- `components/AdminFloatButton.tsx`: user?.role === "PLATFORM_ADMIN" 일 때만 관리자 버튼 노출.
- `components/layout/MainSiteHeader.tsx`: user?.role === "CLIENT_ADMIN" 일 때 클라이언트 대시보드 링크.
- `app/client/layout.tsx`, `app/client/dashboard/page.tsx`: session.role !== "CLIENT_ADMIN" 시 null 또는 권한 없음 UI.
- `app/api/auth/login/route.ts`: platformAdminOnly, isClientLoginRequest 에 따라 role 검사 후 리다이렉트/토큰.

---

## 5. User / Organization / Tournament 관련 DB 구조

### 5.1 User (Prisma)

- `id`, `name`, `username`, `password`, `email`, `phone`, **`role` (UserRole)**, `status`, `withdrawnAt`, 주소/좌표, `createdAt`, `updatedAt`.
- **UserRole enum**: USER, CLIENT_ADMIN, PLATFORM_ADMIN (ZONE_MANAGER 없음).
- 관계: MemberProfile, OrganizationMember, TournamentEntry, Inquiry, Notification, ClientApplication 등.

### 5.2 Organization

- `id`, **`ownerUserId`** (대표 관리자), `slug`, `name`, **`type`** (VENUE | CLUB | FEDERATION | HOST | INSTRUCTOR | OTHER), 설명/이미지/연락처/주소, `region`, `isPublished`, `setupCompleted`, `status` (ACTIVE | SUSPENDED | EXPELLED), `adminRemarks`, `typeSpecificJson` 등.
- **없는 필드**: clientType, approvalStatus, membershipType (3단계에서 추가 예정).
- 관계: OrganizationMember, Tournament, TournamentVenue, OrganizationFeeSetting, OrganizationFeePayment, ClientMembership.

### 5.3 Tournament

- `id`, **`organizationId`**, `name`, `title`, `slug`, 요약/설명/이미지, `venue`, `venueName`, `region`, `startAt`, `endAt`, `entryFee`, `status`, `approvalType`, `rules`, `promoContent`, outline, `createdAt`, `updatedAt`.
- **없는 필드**: createdByUserId (현재 소유권은 Organization.ownerUserId로 간접 판단).
- 관계: organization, rule, entries, rounds, tournamentVenues.

### 5.4 권역 관련

- **DB/코드에 권역(ZONE) 개념 없음.** TournamentRound / TournamentGroup / TournamentResult 등은 있으나 "권역" 필드/테이블 없음. ZONE_MANAGER·권역 배정은 3단계 이후 추가 예정.

### 5.5 기타

- ClientApplication: type, status(PENDING|APPROVED|REJECTED), applicantUserId 등. 승인 시 User.role = CLIENT_ADMIN, OrganizationMember.role = OWNER 생성 (client-applications [id] route).
- ClientMembership: organizationId, validFrom, validUntil — 연회원 유효기간.
- OrganizationFeeSetting / OrganizationFeePayment: 회비 설정·입금.

---

## 6. 플랫폼관리자에 들어간 대회 실무 기능 목록

아래는 **현재 /admin 에서** 플랫폼관리자(PLATFORM_ADMIN)만 접근 가능한데, 실무적으로는 **대회 주체(CLIENT_ADMIN)** 이 할 일에 가까운 기능들. 6단계에서 플랫폼 대시보드에서 제거·차단, 7단계에서 CLIENT_ADMIN 전용으로 이관할 대상.

| 메뉴/라벨 | 경로 | 기능 요약 |
|-----------|------|-----------|
| 대회관리 | /admin/tournaments | 대회 목록·생성·수정·상세·개요·참가자·대진 생성 등 |
| 참가자관리 | /admin/participants | 참가 신청/참가자 목록·확정·결석·출석 등 |
| 대진표관리 | /admin/brackets | 대진표 조회·생성·수정 등 |

**유지 (플랫폼 전용)**  
- 회원관리, 문의관리, 클라이언트 목록, 회비 장부, 클라이언트 신청, 설정(사이트 관리·사이트 기본 정보·알림·연동·요금·메뉴문구), 페이지 섹션/팝업/공지 바: 플랫폼 운영 전용으로 유지.

**참고**  
- "부/권역 설정", "공동관리자 관리", "결과 관리", "권역별 예선" 등은 현재 메뉴/라우트에 없음. 7·8단계에서 CLIENT_ADMIN·ZONE_MANAGER 화면 분리 시 추가 예정.

---

## 7. 백업/참조

- 이 문서는 **코드 변경 없이** 현황만 정리한 백업 문서.
- 2단계 이후 권한 정책 확정·데이터 구조 정리·API 차단·대시보드 분리 시 이 문서를 기준으로 변경 범위를 적용하면 됨.
- 필요 시 `git tag step1-before-permission-refactor` 등으로 태그 보관 권장.
