# 3단계: 데이터 구조 정리

작성일: 2025-03-11  
기준: STEP2_PERMISSION_POLICY.md

---

## 1. User.role 구조

- **Prisma enum `UserRole`**: `USER` | `CLIENT_ADMIN` | `PLATFORM_ADMIN` | **`ZONE_MANAGER`** 추가.
- **TypeScript `types/auth.ts`**: `UserRole` 타입에 `ZONE_MANAGER` 추가.
- **로그인/표시**: `app/api/auth/login/route.ts` 세션 role 캐스팅, `app/admin/me/page.tsx`, `AdminMembersList.tsx` ROLE_LABELS에 권역 관리자 반영.

---

## 2. Organization 추가 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| **clientType** | String? @default("GENERAL") | GENERAL(일반업체) \| REGISTERED(등록업체) |
| **approvalStatus** | String? | PENDING \| APPROVED \| REJECTED (승인된 클라이언트만 운영) |
| **membershipType** | String? | NONE \| ANNUAL (연회원 적용 시 ANNUAL) |

- 기존 행은 clientType 기본값 GENERAL, approvalStatus/membershipType null. 9단계에서 승인 플로우 시 APPROVED/ANNUAL 설정.

---

## 3. Tournament 구조

- **organizationId**: 유지 (소유권은 조직 기준).
- **createdByUserId**: `String?` 추가, `User` FK (SetNull). 대회 생성자 감사/보조용. 생성 API에서 세션 userId 저장 권장.

---

## 4. 권역 관리자 배정 구조

- **Zone** (신규)
  - id, name, code?, sortOrder, createdAt, updatedAt
  - 권역 마스터 데이터.

- **ZoneManagerAssignment** (신규)
  - id, userId, zoneId, createdAt
  - @@unique([userId, zoneId]), index userId/zoneId
  - ZONE_MANAGER 역할 사용자가 담당하는 권역.

- **User**: relation `zoneManagerAssignments ZoneManagerAssignment[]` 추가.

---

## 5. 마이그레이션 안내

1. **Prisma 클라이언트 재생성**  
   `npx prisma generate`  
   (dev 서버 등 사용 중인 프로세스 종료 후 실행 권장.)

2. **DB 마이그레이션**  
   `npx prisma migrate dev --name step3_roles_org_tournament_zone`  
   - UserRole enum에 ZONE_MANAGER 추가.
   - Organization에 clientType, approvalStatus, membershipType 컬럼 추가.
   - Tournament에 createdByUserId 컬럼 추가.
   - Zone, ZoneManagerAssignment 테이블 생성.

3. **기존 데이터**  
   - 기존 Organization: clientType 기본값 적용, approvalStatus/membershipType null.
   - 기존 Tournament: createdByUserId null (추후 생성 API에서만 채움).

---

## 6. 다음 단계

- **4단계**: isZoneManager, canManageTournament, canManageQualifierVenue 등 권한 유틸에서 Zone/ZoneManagerAssignment 조회.
- **5단계**: API에서 createdByUserId는 선택 저장, 소유권 검사는 organizationId·ownerUserId 기준 유지.
