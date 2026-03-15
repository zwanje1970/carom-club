# 유료화 확장 준비 (구조만 반영)

현재는 **무료 운영 중심**이며, 연회원/대회홍보/기능상품을 붙일 수 있도록 **DB·코드 확장 자리**만 마련해 두었습니다.  
**UI 결제 플로우는 최소화·보류**하며, 기존 기능 흐름은 복잡하게 만들지 않습니다.

---

## 1. DB 필드 (선반영)

| 대상 | 필드 | 용도 |
|------|------|------|
| **Organization** | `membershipType` | 기존. NONE \| ANNUAL |
| **Organization** | `membershipExpireDate` | 연회원 만료일. 확장 시 단일 필드로 만료 판단 |
| **Tournament** | `isPromoted` | 대회 홍보 상품 적용 여부 |
| **Tournament** | `promotionLevel` | 홍보 레벨(1=기본, 2=프리미엄 등) |
| **Tournament** | `promotionEndDate` | 홍보 노출 종료일 |
| **PaymentRecord** | `paymentType` | MEMBERSHIP \| TOURNAMENT_PROMO \| FEATURE \| PLAN 등 결제 유형 구분 |
| **PaymentRecord** | `amount` | 기존. 원 단위 |
| **PaymentRecord** | `status` | 기존. PENDING \| PAID \| FAILED 등 |

마이그레이션: `prisma/migrations/20260401000000_monetization_fields/`

---

## 2. 확장 포인트 (코드)

- **연회원 만료**
  - `lib/feature-access.ts` — `isAnnualMembershipActive()`  
    - 이미 `membershipExpireDate` 조회 및 만료 시 false 반영.  
    - 연회원 플랜 구독 / ClientMembership 유효기간 로직은 그대로 두고, 필요 시 여기서 `membershipExpireDate` 우선 사용하도록 확장 가능.

- **대회 홍보 노출**
  - 대회 목록/홈 노출 시: `Tournament.isPromoted`, `promotionLevel`, `promotionEndDate` 사용 가능.  
  - 현재는 정렬/필터에 **미반영**.  
  - 확장 시: `getTournamentsListRaw` / `getTournamentsListWithOrgCoords` 등에서  
    `isPromoted === true` 및 `promotionEndDate >= now()` 조건·정렬 추가.

- **결제 유형**
  - `PaymentRecord.paymentType`으로 연회원/대회홍보/기능상품 구분 가능.  
  - 결제 생성·조회 시 `paymentType` 설정/필터링만 추가하면 됨.

---

## 3. 결제 UI 플로우

- **현재**: 수동 부여(MANUAL), 테스트(MOCK), PG_FUTURE 등 기존 플로우 유지.  
- **보류**: 실제 PG 연동·결제 페이지·장바구니 등 UI 결제 플로우는 **구현하지 않음**.  
- **추가 시**:  
  - 연회원: 결제 완료 후 `Organization.membershipType`/`membershipExpireDate` 또는 구독 테이블 갱신.  
  - 대회 홍보: 결제 완료 후 `Tournament.isPromoted`/`promotionLevel`/`promotionEndDate` 갱신.  
  - 기능상품: 기존 `OrganizationFeatureAccess` / `ListingPurchaseRecord` 흐름에 `PaymentRecord.paymentType` 연결.

---

## 4. 요약

- DB: Client(Organization) 만료일, Tournament 홍보 필드, Payment 유형 필드 **선반영** 완료.  
- 코드: 연회원 만료 판단에 `membershipExpireDate` 반영, 나머지는 **주석/문서로 확장 포인트만 정리**.  
- UI: 결제 플로우 **최소화·보류**, 현재 기능 흐름은 유지.
