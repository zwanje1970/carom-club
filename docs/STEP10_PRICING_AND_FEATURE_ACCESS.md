# 10단계: 요금제 및 기능 접근 구조

작성일: 2025-03-11  
목적: 실제 결제 연동 전 단계까지 요금 정책·기능 접근 권한·연회원/일반업체 분기 기반을 DB와 코드에 반영.

---

## 1. Feature / PricingPlan / PlanFeature 구조

**Feature (기능 정의)**  
- id, code(unique), name, description, isActive, createdAt, updatedAt  
- 기능 코드는 권한/노출 분기에서 직접 사용 (예: TOURNAMENT_PROMO_PAGE, PARTICIPANT_MANAGEMENT, BRACKET_SYSTEM, SETTLEMENT_SYSTEM).

**PricingPlan (요금제/상품)**  
- id, code(unique), name, description, planType(ANNUAL|PACKAGE|FEATURE), billingType(ONE_TIME|YEARLY), price, currency, isActive, validDays, createdAt, updatedAt  
- 가격은 DB 저장, UI에서 0원이면 "무료"로 표시.

**PlanFeature (요금제-기능 연결)**  
- planId, featureId (unique).  
- 연회원/패키지 상품은 여러 기능 포함 가능.

---

## 2. Subscription / FeatureAccess / PaymentRecord 구조

**OrganizationPlanSubscription**  
- organizationId, planId, status(ACTIVE|EXPIRED|CANCELLED), startedAt, expiresAt, grantedByUserId, sourceType(MANUAL|PURCHASE|APPROVAL), notes.

**OrganizationFeatureAccess**  
- organizationId, featureId, status(ACTIVE|EXPIRED|REVOKED), startedAt, expiresAt, sourceType(PLAN|PURCHASE|MANUAL|MEMBERSHIP), sourceRefId, notes.  
- 구독 플랜 반영 시 자동 생성하거나, 수동 부여 시 생성.

**PaymentRecord**  
- organizationId, planId?, amount, currency, status(PENDING|PAID|FAILED|CANCELLED|MANUAL_GRANTED), paidAt, sourceType(MANUAL|MOCK|PG_FUTURE), externalPaymentId, createdByUserId, memo.  
- 실제 PG 연동 전에는 MANUAL_GRANTED, MOCK으로 기록.

---

## 3. 연회원 vs 일반업체 기능 접근 규칙

1. **연회원** (organization.membershipType === ANNUAL + 유효 구독 또는 ClientMembership 유효기간)  
   - 연회원 플랜(annual_membership)에 포함된 기능은 자동 사용 가능.  
   - `isAnnualMembershipActive(orgId)`, `canUseFeature(org, featureCode)` 에서 반영.

2. **일반업체**  
   - 구매한 패키지/단일 기능에 포함된 기능, 또는 직접 부여된 OrganizationFeatureAccess 만 사용 가능.  
   - 등록/게시 상품 정책(게시기간·금액) 적용 대상.

3. **판별 유틸** (`lib/feature-access.ts`)  
   - `canUseFeature(org, featureCode)`  
   - `hasActivePlan(orgId, planCode)`  
   - `hasFeatureAccess(orgId, featureCode)`  
   - `isAnnualMembershipActive(orgId)`  
   - isActive, status, expiresAt 모두 반영.

---

## 4. 올해 무료 / 향후 유료 전환 대응

- price는 DB에 실제 금액 저장.  
- 무료 운영 시: price=0 저장, 또는 수동 부여(MANUAL_GRANTED)로 구독/기능 접근 부여.  
- 운영 플래그(예: PlatformSettings.billingEnabled)로 “무료 기간”이면 실제 결제 없이 MANUAL 부여 가능.  
- 2027년 이후: 가격만 변경하거나 무료 정책만 해제하면 유료 전환 가능.

---

## 5. 주요 API

- GET/POST /api/admin/features, PATCH /api/admin/features/[id]  
- GET/POST /api/admin/pricing-plans, PATCH /api/admin/pricing-plans/[id]  
- GET/POST /api/admin/pricing-plans/[id]/features, DELETE .../features/[featureId]  
- GET/POST /api/admin/organizations/[id]/subscriptions  
- GET /api/admin/organizations/[id]/feature-access  
- GET/POST/PATCH /api/admin/listing-products, PATCH /api/admin/listing-products/[id]  
- GET /api/client/my-billing, GET /api/client/my-feature-access  
- GET /api/listing-products (등록 화면용, code 쿼리 가능)

---

## 6. 주요 화면

- **관리자:** /admin/features, /admin/pricing-plans, /admin/pricing-plans/[id], /admin/listing-products  
- **클라이언트:** /client/billing (이용 현황), /client/promo (당구장 홍보 + 등록상품 안내)  
- 대표 기능 게이팅: 대회 홍보페이지, 참가자 관리, 대진표 관리에 `canUseFeature` 분기 적용.
