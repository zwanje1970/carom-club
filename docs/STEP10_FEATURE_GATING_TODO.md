# 10단계: 기능 게이팅 연결 현황 및 TODO

작성일: 2025-03-11  

---

## 1. 현재 접근 분기를 연결한 기능

| 기능 코드 | 연결 위치 | 비고 |
|-----------|-----------|------|
| TOURNAMENT_PROMO_PAGE | /client/tournaments/[id]/promo | 권한 없으면 "이 기능은 사용 권한이 필요합니다" + 이용 현황 링크 |
| PARTICIPANT_MANAGEMENT | /client/tournaments/[id]/participants | 동일 |
| BRACKET_SYSTEM | /client/tournaments/[id]/bracket | 동일 |

- 판별: `canUseFeature(org, FEATURE_CODES.xxx)` (lib/feature-access.ts).  
- 연회원 플랜에 해당 기능이 포함되어 있고 유효하면 허용, 일반업체는 OrganizationFeatureAccess 또는 구독 플랜으로만 허용.

---

## 2. 아직 연결하지 않은 기능

- SETTLEMENT_SYSTEM (정산 시스템) — 결과/정산 관련 화면  
- MULTI_ZONE_OPERATION, ADVANCED_RESULTS, PRIORITY_EXPOSURE 등 (기능 코드 추가 후 화면 연결)  
- 대회 생성(/client/tournaments/new) — 필요 시 TOURNAMENT_POSTING 또는 단일 기능으로 게이팅  
- 조직 설정(/client/setup), 홍보/페이지 관리(/client/promo) — 당구장 홍보는 ListingProductBanner만 적용, 기능 게이팅은 선택 사항  
- 결과 관리(/client/tournaments/[id]/results) — SETTLEMENT_SYSTEM 또는 RESULTS 관련 코드로 연결 가능  

---

## 3. 다음 단계에서 연결할 화면/API

- **결과·정산:** /client/tournaments/[id]/results, 결과 입력 API에 `canUseFeature(org, SETTLEMENT_SYSTEM)` 또는 동일 코드 적용.  
- **대회 생성:** 대회 등록 상품(ListingProduct)과 연동하거나, 기능 코드(예: TOURNAMENT_CREATE)로 게이팅.  
- **기타 기능:** 새 Feature 코드 추가 후 해당 메뉴/페이지/API에서 `canUseFeature` 호출 및 권한 없을 때 안내/리다이렉트.
