# Step 11: 기능 게이팅 및 빌링 UX

## 1. 기능 게이팅 연결 화면

다음 CLIENT_ADMIN 화면에 `canUseFeature` 기반 접근 제한이 적용되어 있습니다.

| 기능 | 경로 | 기능 코드 | 비고 |
|------|------|-----------|------|
| 대회 홍보 페이지 | `/client/tournaments/[id]/promo` | TOURNAMENT_PROMO_PAGE | |
| 참가자 관리 | `/client/tournaments/[id]/participants` | PARTICIPANT_MANAGEMENT | |
| 대진표 생성/관리 | `/client/tournaments/[id]/bracket` | BRACKET_SYSTEM | |
| 대회요강 | `/client/tournaments/[id]/outline` | TOURNAMENT_PROMO_PAGE | |
| 결과 관리 | `/client/tournaments/[id]/results` | SETTLEMENT_SYSTEM | |
| 부/권역 설정 | `/client/tournaments/[id]/zones` | MULTI_ZONE_OPERATION | |
| 공동관리자 관리 | `/client/tournaments/[id]/co-admins` | MULTI_ZONE_OPERATION | |

- **등록업체(연회원)**: 연회원 플랜에 포함된 기능이면 사용 가능.
- **일반업체**: 해당 기능에 대한 구매/부여된 접근권이 있어야 사용 가능.
- 권한 없을 때는 403/빈 화면 대신 **공통 안내 UI**를 노출합니다.

## 2. 공통 게이팅 컴포넌트

- **컴포넌트**: `components/client/FeatureGateNotice.tsx`
- **Props**: `featureName`, `clientType`, `membershipType`, `annualActive?`, `hint?`
- **표시 내용**:
  - "이 기능은 사용 권한이 필요합니다."
  - 현재 업체 구분(일반업체/등록업체)
  - 연회원 상태(사용 중/없음/만료)
  - 이용 현황 보기 링크 (`/client/billing`)
  - 이용 정책 확인 링크
  - 선택적 `hint` 문구

각 게이팅 페이지에서는 서버에서 `canUseFeature(org, FEATURE_CODES.xxx)` 및 `isAnnualMembershipActive(orgId)`를 호출한 뒤, 권한이 없으면 `FeatureGateNotice`만 렌더링합니다.

## 3. 일반업체 / 등록업체 UX 차이

- **일반업체**
  - 기능별로 구매/부여된 접근권이 있어야 해당 기능 사용 가능.
  - 등록상품(당구장 홍보, 대회 등록, 레슨, 동호회) 정책(게시기간·금액) 적용.
- **등록업체**
  - 연회원 플랜에 포함된 기능 사용 가능.
  - 등록상품 요금 정책 적용 대상 아님. (배너 등에서 "적용되지 않습니다" 문구 표시)

## 4. /client/billing 개선 내용

- **현재 업체 상태**: 업체 구분, 승인 상태, 연회원 여부, 연회원 상태(사용 중/없음/만료).
- **사용 가능한 기능**: 기능명, 제공 출처(연회원/요금제/수동 부여/구매), 상태(사용 중/만료), 만료일.
- **구독/부여 상태**: 요금제별 시작일·만료일·상태·출처.
- **등록상품 정책 안내**: 일반업체일 때 상품별 게시기간·금액; 등록업체일 때 "적용되지 않습니다" 문구.
- **결제/부여/등록 이력**: 결제, 수동 구독 부여, 등록상품 구매 이력을 시간순으로 통합 표시.

데이터는 `lib/billing-client.ts`의 `getMyBillingData(orgId)`에서 생성하며, `GET /api/client/my-billing`과 `/client/billing` 페이지에서 공통 사용합니다.
