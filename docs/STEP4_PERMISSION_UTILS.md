# 4단계: 권한 유틸 분리

작성일: 2025-03-11  
목적: 권한 판단 기준을 `lib/permissions.ts`로 통합. 5단계 API 권한 차단에서 재사용.

---

## 1. 공통 모듈

- **파일**: `lib/permissions.ts`
- **의존성**: `types/auth` (SessionUser, UserRole)만 참조. Prisma/DB 미참조.
- **사용처**: `app/`, `app/api/`, `app/admin/`, `app/client/` 등에서 `import { ... } from "@/lib/permissions"` 로 사용.

---

## 2. 추가한 유틸 목록 및 판단 기준

### 2.1 기본 role 체크 (null/undefined 안전)

| 함수 | 판단 기준 |
|------|-----------|
| `isPlatformAdmin(user)` | `user?.role === "PLATFORM_ADMIN"` |
| `isClientAdmin(user)` | `user?.role === "CLIENT_ADMIN"` |
| `isZoneManager(user)` | `user?.role === "ZONE_MANAGER"` |
| `isUser(user)` | `user?.role === "USER"` |

### 2.2 Organization 기준 체크

| 함수 | 판단 기준 |
|------|-----------|
| `isApprovedClient(org)` | `org?.approvalStatus === "APPROVED"` |
| `isRegisteredClient(org)` | `org?.clientType === "REGISTERED"` |
| `isAnnualClient(org)` | `org?.membershipType === "ANNUAL"` |

- 인자: `OrgLike` (id, ownerUserId, approvalStatus, clientType, membershipType 중 필요한 것만 있으면 됨).

### 2.3 조직 권한 (조회 vs 실무 분리)

| 함수 | 조회/실무 | PLATFORM_ADMIN | CLIENT_ADMIN | ZONE_MANAGER |
|------|-----------|----------------|--------------|--------------|
| `canViewOrganization(user, org)` | 조회 | true (전체) | 본인 소유(ownerUserId)만 true | false |
| `canManageOrganization(user, org)` | 실무 | **false** | 본인 소유만 true | false |

- **PLATFORM_ADMIN**: 조직 실무는 하지 않음(플랫폼 운영 전용). 조회/모니터링만.

### 2.4 대회 권한 (조회 vs 실무 분리)

| 함수 | 조회/실무 | PLATFORM_ADMIN | CLIENT_ADMIN | ZONE_MANAGER |
|------|-----------|----------------|--------------|--------------|
| `canViewTournament(user, tournament, org?)` | 조회 | true (모니터링) | 본인 조직 대회만 true | false* |
| `canManageTournament(user, tournament, org?)` | 실무 | **false** | 본인 조직 대회만 true | false |

- \* 권역별 대회 조회는 5/8단계에서 권역–대회 매핑 후 처리.
- **PLATFORM_ADMIN**: 대회 생성/수정/참가 확정/대진 생성 등 실무 권한 없음.

### 2.5 권역 권한 (조회 vs 실무 분리)

| 함수 | 조회/실무 | PLATFORM_ADMIN | ZONE_MANAGER |
|------|-----------|----------------|--------------|
| `canViewZone(user, zoneId, assignedZoneIds?)` | 조회 | true (전체) | `zoneId in assignedZoneIds` 만 true |
| `canManageZone(user, zoneId, assignedZoneIds?)` | 실무 | **false** | `zoneId in assignedZoneIds` 만 true |

- `assignedZoneIds`: API/페이지에서 DB(ZoneManagerAssignment) 조회 후 넘김. `permissions.ts`는 DB 접근 안 함.

### 2.6 기존 호환

| 함수 | 비고 |
|------|------|
| `isAdmin(user)` | `isPlatformAdmin(user) \|\| isClientAdmin(user)`. @deprecated, 신규는 canView* / canManage* 사용 권장. |

---

## 3. 타입 (lib/permissions.ts)

- **UserLike**: `{ id, role }` (SessionUser와 호환).
- **OrgLike**: `{ id?, ownerUserId?, approvalStatus?, clientType?, membershipType? }` (Organization 일부 필드).
- **TournamentLike**: `{ id?, organizationId?, organization? }` (Tournament + include organization 시).

- 세션/Prisma 결과를 그대로 넘겨도 됨. 필요한 필드만 있으면 동작.

---

## 4. 5단계에서 적용할 API와 매핑

| API (대상) | 조회 권한 | 실무 권한 |
|------------|-----------|-----------|
| GET /api/admin/tournaments | `canViewTournament` | - |
| POST /api/admin/tournaments | - | `canManageTournament` (대회 생성 시 org 소유만) |
| GET /api/admin/tournaments/[id] | `canViewTournament` | - |
| PATCH /api/admin/tournaments/[id] | - | `canManageTournament` |
| DELETE 등 | - | `canManageTournament` |
| GET/PATCH /api/admin/tournaments/[id]/venues | `canViewTournament` | `canManageTournament` |
| PATCH /api/admin/tournaments/[id]/outline | - | `canManageTournament` |
| GET/POST /api/admin/tournaments/[id]/rule | `canViewTournament` | `canManageTournament` |
| POST /api/admin/tournaments/[id]/bracket/generate | - | `canManageTournament` |
| 참가 확정/결석/출석 등 participants 하위 | `canViewTournament` | `canManageTournament` (또는 권역 전용 API는 canManageZone) |
| 권역 관련 API (신규) | `canViewZone` | `canManageZone` |
| 조직(업체) 조회/수정 API | `canViewOrganization` | `canManageOrganization` |

- **PLATFORM_ADMIN**: 위 표에서 “실무”는 모두 false로 차단. 모니터링용 GET은 canView* 로 허용.
- **CLIENT_ADMIN**: 본인 조직/본인 대회만 canManage* true.
- **ZONE_MANAGER**: 권역 API만 canViewZone/canManageZone + assignedZoneIds 로 허용.

---

## 5. 사용 예시 (5단계 이후)

```ts
import { getSession } from "@/lib/auth";
import { canManageTournament, canViewTournament } from "@/lib/permissions";

// API 라우트 예시
const session = await getSession();
if (!session) return NextResponse.json({ error: "로그인 필요" }, { status: 401 });

const tournament = await prisma.tournament.findUnique({
  where: { id },
  include: { organization: { select: { ownerUserId: true, approvalStatus: true } } },
});
if (!tournament) return NextResponse.json({ error: "없음" }, { status: 404 });

if (request.method === "GET") {
  if (!canViewTournament(session, tournament, tournament.organization))
    return NextResponse.json({ error: "조회 권한 없음" }, { status: 403 });
  // ... 조회 처리
} else {
  if (!canManageTournament(session, tournament, tournament.organization))
    return NextResponse.json({ error: "수정 권한 없음" }, { status: 403 });
  // ... 수정 처리
}
```

---

## 6. 이번 단계 범위

- 권한 유틸 **추가/정리**만 수행.
- 기존 `types/auth.ts`의 isPlatformAdmin, isClientAdmin, isAdmin은 유지(호환). 점진적으로 `lib/permissions` 로 이전 가능.
- API 실제 차단·라우트 수정은 **5단계**에서 적용.
- `canManageQualifierVenue`(예선 당구장 등)는 데이터 구조 확정 후 필요 시 동일 패턴으로 추가.

