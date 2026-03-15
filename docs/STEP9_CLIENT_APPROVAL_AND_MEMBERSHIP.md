# 9단계: 클라이언트 신청 / 승인 / 등급 구조

작성일: 2025-03-11  
목적: 일반업체와 등록업체를 구분해 신청받고, 플랫폼 관리자 승인 시 organization의 clientType / approvalStatus / membershipType이 반영되도록 구현.

---

## 1. 클라이언트 신청 유형

| 구분 | requestedClientType | 설명 |
|------|---------------------|------|
| 일반업체 | GENERAL | 승인 시 clientType=GENERAL, membershipType=NONE |
| 등록업체 | REGISTERED | 승인 시 clientType=REGISTERED, membershipType=ANNUAL (연회원) |

- 신청 데이터와 organization 실제 상태는 분리됨. 신청은 ClientApplication에 남고, 승인 시에만 Organization이 생성/갱신되며 등급이 반영됨.

---

## 2. 신청 데이터 저장 (ClientApplication)

**추가/사용 필드:**

- `requestedClientType` — GENERAL | REGISTERED (기본 GENERAL)
- `reviewedByUserId` — 승인/반려 처리한 플랫폼 관리자 userId (선택)
- 기존: type, status, applicantUserId, organizationName, applicantName, phone, email, region, shortDescription, referenceLink, rejectedReason, reviewedAt, createdAt, updatedAt

**규칙:**

- 신청 상태(PENDING/APPROVED/REJECTED)는 ClientApplication.status에만 저장.
- 반려 시 Organization은 변경하지 않음. rejectionReason 저장.

---

## 3. 승인 시 Organization 반영 규칙

**일반업체 승인 (requestedClientType = GENERAL):**

- organization.clientType = GENERAL  
- organization.approvalStatus = APPROVED  
- organization.membershipType = NONE  

**등록업체 승인 (requestedClientType = REGISTERED):**

- organization.clientType = REGISTERED  
- organization.approvalStatus = APPROVED  
- organization.membershipType = ANNUAL  

**반려 시:**

- ClientApplication.status = REJECTED  
- rejectedReason 저장  
- Organization은 생성/수정하지 않음  

---

## 4. 연회원 상태 반영

- 등록업체 승인 시 membershipType = ANNUAL 으로 설정.
- 결제/요금제 연동은 이번 단계 범위 외. 데이터 구조만 확보.

---

## 5. 관련 API

| API | 메서드 | 설명 |
|-----|--------|------|
| /api/apply/client | POST | 클라이언트 신청 생성. body에 requestedClientType (GENERAL \| REGISTERED) 포함 가능. |
| /api/mypage/client-application | GET | 내 신청 1건. requestedClientType 포함. |
| /api/mypage/client-application | PATCH | PENDING 신청 수정. requestedClientType 수정 가능. |
| /api/admin/client-applications | GET | 플랫폼 관리자 — 신청 목록. requestedClientType 포함. |
| /api/admin/client-applications/[id] | PATCH | 승인/반려/보류. 승인 시 org clientType/approvalStatus/membershipType 반영, reviewedByUserId 저장. |

---

## 6. 관련 화면

- **마이페이지 / 신청 폼:** 등록 구분 선택(일반업체 / 등록업체). POST·PATCH 시 requestedClientType 전송.
- **관리자 > 클라이언트 신청:** 목록에 "신청 유형"(일반업체/등록업체) 컬럼, 승인/반려 시 위 규칙대로 반영.
- **CLIENT 대시보드:** 자기 organization의 approvalStatus, clientType, membershipType 표시(승인 대기 / 일반업체 / 등록업체(연회원)).

---

## 7. 권한/유틸 연결

- `lib/permissions.ts`:  
  - `isApprovedClient(org)` — approvalStatus === "APPROVED"  
  - `isRegisteredClient(org)` — clientType === "REGISTERED"  
  - `isAnnualClient(org)` — membershipType === "ANNUAL"  
- 기존 구조와 동일하게 사용. 이번 단계에서 Organization에 값이 채워지므로 정책 적용 가능.

---

## 8. 마이그레이션

- `prisma/migrations/20260328000000_step9_client_approval_tournament_zone/migration.sql`  
  - ClientApplication에 requestedClientType, reviewedByUserId 컬럼 추가.  
- 적용: `npx prisma migrate dev` (또는 배포 환경에 맞게 적용).
