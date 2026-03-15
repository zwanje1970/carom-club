# 2단계: 권한 정책 확정

작성일: 2025-03-11  
목적: 역할·클라이언트 구분·연회원 정책을 문서로 확정. 3단계 이후 데이터 구조·API·UI 적용의 단일 기준.

---

## 1. 사용자 역할 (User Role)

| 역할 | 코드 | 설명 | 접근 범위 |
|------|------|------|-----------|
| 플랫폼 관리자 | **PLATFORM_ADMIN** | 플랫폼 운영 전용. 대회 실무 불가. | 사이트 설정, 회원/문의/클라이언트 목록, 클라이언트 신청·승인, 회비 장부, 요금 정책, 연동·알림 등 **플랫폼 운영 메뉴만**. |
| 클라이언트 관리자 | **CLIENT_ADMIN** | 대회 생성·운영 주체(당구장/동호회/연맹 등 대표). | **자기 조직(Organization)** 및 그 조직의 **대회·참가자·대진표·결과**만 관리. 공동관리자 배정 가능. |
| 권역 관리자 | **ZONE_MANAGER** | 권역 실무 담당. 대회 생성/소유 아님. | **본인에게 배정된 권역**에 한해: 권역 목록, 권역 대진표, **경기 결과 입력**, **진출자 확정**. |
| 일반 사용자 | **USER** | 조회·신청만. | 대회/당구장 조회, 참가 신청, 마이페이지, 문의 등. 관리자 화면 없음. |

- **역할은 1인 1역할** (User.role 한 개). 권역 담당은 별도 테이블/배정으로 ZONE_MANAGER + 권역 매핑.
- PLATFORM_ADMIN은 대회 생성/수정/참가 확정/대진 생성 등 **대회 실무 API 호출 불가** (5단계에서 차단).
- CLIENT_ADMIN은 **자기 조직(organizationId)**·**자기 조직이 소유한 대회**만 접근.
- ZONE_MANAGER는 **배정된 권역** 내 대회의 결과·진출만 접근 (대회 생성/삭제/일반 설정 불가).

---

## 2. 클라이언트(업체) 구분 — GENERAL / REGISTERED

**대상**: 당구장·동호회·연맹 등 **Organization** (클라이언트).

| 구분 | 코드 | 설명 |
|------|------|------|
| 일반업체 | **GENERAL** | 신청·승인 후 일반 클라이언트. 연회원 아님. (기존 당구장/동호회 등과 동일) |
| 등록업체 | **REGISTERED** | “등록업체 신청” 경로로 신청 후 승인 시 **연회원(membershipType=ANNUAL)** 적용. |

- **저장 위치**: Organization 쪽 필드로 구분 (3단계에서 `clientType`, `approvalStatus`, `membershipType` 등 추가).
- **신청 경로**: 9단계에서 “일반업체 신청” / “등록업체 신청” 분리. 승인 시:
  - 일반업체: clientType=GENERAL (또는 동일 개념), 연회원 미적용.
  - 등록업체: clientType=REGISTERED, 승인 시 membershipType=ANNUAL 반영(또는 ClientMembership 등 연회원 유효기간 설정).

---

## 3. REGISTERED 승인 시 연회원 적용

- **등록업체(REGISTERED) 승인** 시:
  - 해당 Organization에 **연회원 기능 적용** (예: membershipType=ANNUAL 또는 ClientMembership 유효기간 설정).
- **연회원 유효 기간 내**:
  - 해당 조직은 **대회 무제한 생성** 등 연회원 전용 기능 사용 (기존 `hasActiveClientMembership` 개념 확장).
- 10단계에서 `canUseAnnualFeatures` 등 유틸로 분기, 연회원 전용 기능 연결.

---

## 4. 정책 요약표

| 구분 | 내용 |
|------|------|
| **PLATFORM_ADMIN** | 플랫폼 운영 전용. 대회 실무 메뉴/API 차단. |
| **CLIENT_ADMIN** | 자기 조직·자기 대회만. 대회관리·참가자·대진표·결과·공동관리자. |
| **ZONE_MANAGER** | 배정 권역만. 권역 목록·대진표·경기 결과 입력·진출자 확정. |
| **USER** | 조회·신청만. |
| **클라이언트** | GENERAL(일반) / REGISTERED(등록). |
| **REGISTERED 승인** | membershipType=ANNUAL(또는 동일 효과) 적용, 연회원 기능 사용 가능. |

---

## 5. 이후 단계와의 연결

- **3단계**: User.role에 ZONE_MANAGER 추가, Organization에 clientType·approvalStatus·membershipType, Tournament·권역 배정 구조.
- **4단계**: isPlatformAdmin, isClientAdmin, isZoneManager, isApprovedClient, isRegisteredClient, isAnnualClient, canManageTournament, canManageQualifierVenue 등 공통 유틸.
- **5단계**: API에서 PLATFORM_ADMIN 대회 실무 차단, CLIENT_ADMIN/ZONE_MANAGER 스코핑.
- **6단계**: 플랫폼관리자 대시보드에서 대회 실무 메뉴 제거·접근 차단.
- **7단계**: CLIENT_ADMIN 전용 사이드바·대회 실무 이관.
- **8단계**: ZONE_MANAGER 전용 화면(권역 목록·대진표·결과 입력·진출 확정).
- **9단계**: 일반업체/등록업체 신청 분리, 승인 시 clientType·membershipType 반영.
- **10단계**: 연회원(membershipType) 기반 분기·canUseAnnualFeatures·연회원 전용 기능.

이 문서는 **정책 확정**만 담당. 구현은 각 단계에서 진행.
