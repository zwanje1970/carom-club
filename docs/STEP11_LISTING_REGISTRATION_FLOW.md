# Step 11: 등록상품 실제 등록 흐름

## 1. 개요

등록상품(ListingProduct) 기준으로 “등록”이 발생하는 시점에 **ListingPurchaseRecord**가 생성되도록 연결했습니다.  
이번 단계에서는 **실제 PG 결제 연동은 하지 않으며**, 등록 확정 시 기록만 남깁니다.

## 2. 등록상품 실제 등록 흐름

### 2.1 당구장 홍보 등록 (VENUE_PROMOTION)

- **진입**: 클라이언트 관리자 → 당구장 홍보 페이지에서 “게시” 동작.
- **API**: `PATCH /api/client/organization/promo` (body: `publish`)
- **동작**: `promoPublished` 업데이트 후 `createListingPurchaseRecord(orgId, "VENUE_PROMOTION", "VENUE_PROMO", orgId)` 호출.
- **결과**: ListingPurchaseRecord 1건 생성 (targetType: VENUE_PROMO, targetId: organizationId).

### 2.2 대회 등록 (TOURNAMENT_POSTING)

- **진입**: 대회 생성 완료 시점.
- **API**: `POST /api/admin/tournaments` (대회 생성 성공 후).
- **동작**: Tournament 생성 후 `createListingPurchaseRecord(organizationId, "TOURNAMENT_POSTING", "TOURNAMENT", tournament.id)` 호출.
- **결과**: ListingPurchaseRecord 1건 생성 (targetType: TOURNAMENT, targetId: tournament.id).

### 2.3 레슨/동호회 등록 (LESSON_POSTING, CLUB_POSTING)

- **현재**: 실제 등록 진입점(레슨/동호회 생성·등록 API)이 구현된 경우, 동일하게 해당 시점에 `createListingPurchaseRecord(..., "LESSON_POSTING" | "CLUB_POSTING", "LESSON" | "CLUB", targetId)` 호출하면 됨.
- **TODO**: 레슨·동호회 등록 화면/API가 있으면 같은 패턴으로 연결.

## 3. ListingPurchaseRecord 생성 시점 및 필드

- **생성 위치**: `lib/listing-registration.ts` → `createListingPurchaseRecord(options)`.
- **옵션**: `organizationId`, `listingCode`, `targetType`, `targetId?`.
- **로직 요약**:
  1. 조직 조회 → clientType 확인.
  2. ListingProduct를 `code`로 조회 (활성만).
  3. **startedAt** = 현재 시점.
  4. **expiresAt** = startedAt + product.postingMonths 개월.
  5. **일반업체**: amount = product.price.
  6. **등록업체**: amount = 0 (기록은 남김, 정책 적용 제외).
  7. status = "ACTIVE", postingMonths = product.postingMonths 저장.

## 4. startedAt / expiresAt 계산

- `startedAt = new Date()` (등록 확정 시점).
- `expiresAt = new Date(startedAt); expiresAt.setMonth(expiresAt.getMonth() + product.postingMonths)`.
- 만료일이 지난 경우 조회 화면에서는 “만료”로 구분해 표시 (추후 배치로 status를 EXPIRED로 갱신할 수 있음).

## 5. 일반업체 / 등록업체 처리 차이

| 구분 | 일반업체 | 등록업체 |
|------|----------|----------|
| 정책 적용 | ListingProduct의 postingMonths, price 적용 | 적용 안 함 |
| amount | product.price | 0 |
| 기록 | ListingPurchaseRecord 생성 | 동일하게 생성 (0원) |
| 화면 안내 | 게시기간·금액 표시 | “등록상품 요금 정책 적용되지 않습니다” 등 |

## 6. 남은 TODO

- 레슨/동호회 등록 플로우가 정의되면 해당 시점에 `createListingPurchaseRecord` 호출 추가.
- 실제 결제(PG) 연동 시: 결제 완료 후 같은 함수 호출 또는 결제 ID를 sourceRef 등으로 기록.
- 만료 배치: expiresAt 경과 시 ListingPurchaseRecord.status를 EXPIRED로 업데이트 (선택).
