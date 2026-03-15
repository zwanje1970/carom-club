# 10단계: 등록/게시 상품 정책

작성일: 2025-03-11  
목적: 당구장 홍보, 대회 등록, 레슨 등록, 동호회 등록의 게시기간·금액 정책 구조와 일반업체/등록업체 적용 방식 정리.

---

## 1. 등록상품 4종 구조

**ListingProduct**  
- code: VENUE_PROMOTION, TOURNAMENT_POSTING, LESSON_POSTING, CLUB_POSTING  
- name, description, postingMonths(게시기간, 개월), price(원), currency, isActive, appliesToGeneralOnly(true면 일반업체만 적용).

**ListingPurchaseRecord**  
- organizationId, listingProductId, targetType, targetId, postingMonths, amount, status, startedAt, expiresAt.  
- 게시 시작/종료일 관리, 만료 처리, 재등록 대응.

---

## 2. 게시기간 단위

- 단위: **개월** 고정.  
- DB: postingMonths (number).  
- 화면: "1개월", "3개월" 등으로 표시 (formatPostingMonths).

---

## 3. 금액 표시 규칙

- DB: price (number), 0이면 무료.  
- 화면: price === 0 → **"무료"**, price > 0 → **"10,000원"** 형식 (formatPrice).  
- 하드코딩 없이 DB/설정 기반.

---

## 4. 일반업체 적용 방식

- appliesToGeneralOnly === true 인 등록상품은 **일반업체(clientType=GENERAL)** 에만 적용.  
- 등록 화면 진입 시 해당 code의 ListingProduct를 조회해 게시기간·등록금액 안내 표시.  
- 실제 등록 시 ListingPurchaseRecord 생성, startedAt/expiresAt 관리.

---

## 5. 등록업체 예외 방식

- **등록업체** (organization.clientType === REGISTERED && membershipType === ANNUAL) 는 해당 등록상품 정책 **적용 대상 아님**.  
- 화면: "등록업체(연회원). 해당 등록상품 정책 적용 대상이 아닙니다. 별도 혜택으로 이용 가능합니다."  
- 즉, 게시기간/금액 정책을 보지 않고 바로 등록 가능하거나 0원 처리. (구현에서는 정책 배너만 숨기고 "적용 제외" 문구 표시.)

---

## 6. 관리자 입력값 반영

- /admin/listing-products 에서 상품별 게시기간(개월), 금액, 활성 여부 수정.  
- PATCH /api/admin/listing-products/[id] 로 저장.  
- 등록 화면에서는 활성 상품만 조회해 표시.

---

## 7. 등록 기록 구조

- ListingPurchaseRecord로 게시 시작일(startedAt), 만료일(expiresAt), 금액(amount), 상태(status) 관리.  
- 만료 시 status=EXPIRED 등으로 갱신, 재등록 시 새 레코드 생성 가능.

---

## 8. 기능 구조와 분리

- **기능 사용권** (Feature / PricingPlan / OrganizationFeatureAccess): 참가자 관리, 대진표, 정산 등.  
- **등록/게시 상품** (ListingProduct / ListingPurchaseRecord): 당구장 홍보, 대회 등록, 레슨 등록, 동호회 등록.  
- 두 체계는 별도로 관리하며, 등록상품은 “게시 기간·등록 비용”에만 사용.
