# 캐롬클럽 DB·상태값 재설계안 (대회 운영 중심)

**목표**: 커뮤니티/랭킹이 아닌 **대회 홍보 / 참가자 모집 / 참가자 관리 / 대진표 생성 / 대회 운영** 완성을 위한 DB·상태값 설계.  
**범위**: 설계안 정리만 (코드 반영 전).

---

## 1. 필요한 테이블 요약

| 구분 | 테이블 | 비고 |
|------|--------|------|
| 기존 확장 | User, MemberProfile, Organization, Tournament, TournamentRule, TournamentEntry, TournamentMatchVenue, TournamentRound, TournamentGroup, TournamentResult … | 필드/enum 추가·변경 |
| 신규 | EntryPayment (또는 Payment) | 입금확인·결제 이력 (향후 유료화 확장) |
| 유지·참조 | TournamentZone, TournamentFinalMatch, NotificationLog, PushSubscription … | 연맹/알림 등 기존 유지 |

- **EntryPayment**: “입금확인” 시점·순서 확정용. 참가 확정 순서 = 입금확인 순서이므로, 입금확인 시각을 한 곳에서 관리하는 것이 안전함. 기존 `TournamentEntry.paidAt`과 역할이 겹치므로, 설계상 **입금확인 순서 = paidAt 순서**로 두고, 필요 시 나중에 EntryPayment로 이전 가능하도록 확장 포인트만 둠.

---

## 2. 각 테이블 핵심 필드

### 2.1 User (기존 + 변경 없음)

- id, name, username, email, phone, role, status, address, addressDetail, latitude, longitude, withdrawnAt, createdAt, updatedAt  
- **역할**: 참가자·관리자 계정. 대회 신청 시 본인 정보는 MemberProfile에서 가져옴.

### 2.2 MemberProfile (기존 + 확장)

| 필드 | 타입 | 비고 |
|------|------|------|
| id | cuid | PK |
| userId | string | UK |
| handicap | string? | 기존. 핸디 |
| avg | string? | 기존. AVG |
| **burnInScore** | string? | **신규. 번인 점수** (마이페이지 저장, 신청 시 자동 반영·수정 가능) |
| **ever** | string? | **신규. 에버** (동일) |
| avgProofUrl, avgProofExpiresAt | 기존 | |
| createdAt, updatedAt | | |

- **역할**: 마이페이지에서 번인 점수·에버 저장, 대회 신청 시 기본값으로 넣고 신청 폼에서 수정 가능.

### 2.3 Organization (Client) (기존 + 확장)

| 필드 | 타입 | 비고 |
|------|------|------|
| (기존 전부) | | |
| membershipType | string? | 기존. NONE \| ANNUAL 등 |
| **membershipExpireDate** | date? | **확장. 연회원 만료일** (표시/정책용. 상세는 ClientMembership/Plan 구독 참고) |

- **역할**: 주최 측(당구장 등). 유료화 시 연회원 만료일 등 정책 판단용.

### 2.4 Tournament (기존 + 확장)

| 필드 | 타입 | 비고 |
|------|------|------|
| (기존) id, organizationId, name, title, slug, summary, description, startAt, endAt, venue, venueName, region, entryFee, prizeInfo, gameFormat, entryCondition, maxParticipants, status, tournamentStage, approvalType, rules, promoContent, outlineDraft, outlinePublished, matchVenues, … | | |
| **scope** | string? | **신규. 지역대회 \| 전국대회** (REGIONAL \| NATIONAL) |
| **gameFormatType** | string? | **신규. 경기방식** TOURNAMENT \| SCOTCH \| SURVIVAL \| FOUR_BALL (기존 gameFormat은 자유 텍스트로 유지 가능) |
| **allowMultipleSlots** | boolean | **신규. 중복 참가 허용** (1인 여러 슬롯) default false |
| **isPromoted** | boolean? | **확장. 유료 홍보 여부** |
| **promotionLevel** | string? | **확장. 홍보 등급** |
| **promotionEndDate** | date? | **확장. 홍보 노출 종료일** |

- **대회 기간**: 기존 `startAt`, `endAt`으로 1일/2일/3일 이상 모두 표현. 별도 “기간 유형” 필드는 선택(표시용).
- **역할**: 대회 분류(지역/전국, 경기방식, 중복 참가), 향후 홍보 유료화.

### 2.5 TournamentRule (기존 유지·참조)

- entryFee, maxEntries, useWaiting, bracketType, bracketConfig, prizeType, prizeInfo 등.  
- `maxEntries` = 모집 정원. 대기자 산정 시 사용.

### 2.6 TournamentEntry (기존 + 확장·enum 변경)

| 필드 | 타입 | 비고 |
|------|------|------|
| id | cuid | PK |
| tournamentId | string | FK |
| userId | string | FK |
| **slotIndex** | int | **신규. 슬롯 번호** (1, 2, …). allowMultipleSlots 시 1인 다슬롯. default 1 |
| **status** | enum | **변경. 아래 참가 상태 enum** |
| depositorName | string? | 입금자명 |
| clubOrAffiliation | string? | 소속 |
| **paidAt** | datetime? | **입금확인 시각** (확정 순서 = paidAt ASC) |
| **waitlistOrder** | int? | 대기자 순번 (WAITLIST일 때만) |
| rejectionReason | string? | 반려 사유 (REJECTED 시) |
| reviewedAt | datetime? | |
| **finalResult** | string? | **신규. 성적** ONE_WIN \| ROUND_16 \| ROUND_8 \| ROUND_4 \| RUNNER_UP \| CHAMPION |
| round, prize | 기존 | |
| createdAt, updatedAt | | |

- **Unique**: `(tournamentId, userId, slotIndex)`. allowMultipleSlots=false면 slotIndex는 항상 1.
- **역할**: 신청 1건 = 1슬롯. 입금확인 순으로 확정/대기 부여, 취소 시 대기자 1순위 승격, 성적 저장.

### 2.7 EntryPayment (신규, 향후 확장용)

| 필드 | 타입 | 비고 |
|------|------|------|
| id | cuid | PK |
| tournamentEntryId | string | FK (TournamentEntry) |
| **paymentType** | string? | **확장. 결제 유형** (참가비/추가옵션 등) |
| **amount** | int? | **확장. 금액(원)** |
| **status** | string? | **확장. PENDING \| PAID \| FAILED \| REFUNDED 등** |
| confirmedAt | datetime? | 입금확인 시각 (paidAt과 동기화 가능) |
| memo | string? | 관리자 메모 |
| createdAt, updatedAt | | |

- **역할**: 입금확인·결제 이력. 당장은 “입금확인”만 써도 되고, 유료화 시 PG·정산 연동 확장.
- **선택**: 1차에는 TournamentEntry.paidAt만 사용하고, EntryPayment는 “확장 포인트”로만 정의해 두고, 나중에 도입해도 됨.

### 2.8 TournamentMatchVenue, TournamentRound, TournamentGroup, TournamentResult (기존)

- 대진표·경기장·라운드·조·결과는 기존 구조 유지.  
- **성적**은 위처럼 `TournamentEntry.finalResult`에 우승/준우승/8강 등 저장하는 방식을 권장.  
- TournamentResult(조별 rank 등)는 기존 용도로 두고, “대회 최종 성적”은 entry.finalResult로 두면 됨.

### 2.9 기타 (Zone, Notification, Push, …)

- 연맹(Zone), 알림(Notification, NotificationLog, PushSubscription) 등은 기존 유지.  
- PaymentRecord(Organization 단위 결제)는 기존 유지. EntryPayment는 “참가비 1건” 단위 확장용.

---

## 3. 상태값 Enum 정의

### 3.1 참가 상태 (TournamentEntry.status)

요구 6가지(신청완료·입금대기·입금완료표시·참가확정·대기자·취소) + 관리자 반려를 아래 enum으로 표현.

| DB 값 | 한글(요구) | 설명 |
|-------|------------|------|
| **APPLIED** | 신청완료 | 신청 제출 직후. 아직 입금 확인 전. |
| **PAYMENT_PENDING** | 입금대기 | 입금 안내 후 대기. (구분 없이 APPLIED로 통일해도 됨) |
| **CONFIRMED** | 참가확정 | 입금확인 완료 + 정원 내. 확정 순서 = paidAt 순서. |
| **WAITLIST** | 대기자 | 입금확인 완료 + 정원 초과. waitlistOrder로 순번. |
| **CANCELED** | 취소 | 참가자/관리자 취소. 확정 취소 시 대기 1순위 자동 승격. |
| **REJECTED** | (반려) | 관리자 반려. 신청 거절. |

- **입금완료표시**: DB에 별도 상태 없음. **CONFIRMED** 또는 **WAITLIST** 이면서 **paidAt이 있는 경우**를 화면에서 “입금완료”로 표시하면 됨.
- **권장 enum (구현용)**: `APPLIED | PAYMENT_PENDING | CONFIRMED | WAITLIST | CANCELED | REJECTED`. PAYMENT_PENDING을 쓰지 않으면 APPLIED만으로 “신청완료/입금대기” 통합 가능.

### 3.2 대회 상태 (Tournament.status) — 기존 보강

| 값 | 한글 | 비고 |
|----|------|------|
| DRAFT | 초안 | |
| OPEN | 모집중 | |
| CLOSED | 참가 마감 | |
| BRACKET_GENERATED | 대진 생성됨 | |
| FINISHED | 종료 | |
| HIDDEN | 숨김 | |

- 기존과 동일. 주석/라벨만 “참가 마감” 등으로 통일.

### 3.3 대회 분류

**scope (지역/전국)**

- REGIONAL — 지역대회  
- NATIONAL — 전국대회  

**gameFormatType (경기방식)**

- TOURNAMENT — 토너먼트  
- SCOTCH — 스카치  
- SURVIVAL — 서바이벌  
- FOUR_BALL — 4구대회  

### 3.4 성적 (TournamentEntry.finalResult)

| 값 | 한글 |
|----|------|
| ONE_WIN | 1승 |
| ROUND_16 | 16강 |
| ROUND_8 | 8강 |
| ROUND_4 | 4강 |
| RUNNER_UP | 준우승 |
| CHAMPION | 우승 |

- 대진/결과 입력 후 관리자가 부여하거나, 결과 집계 로직에서 자동 부여.

### 3.5 확장용 (Payment)

- paymentType: FREE \| ENTRY_FEE \| OPTION \| …  
- status: PENDING \| PAID \| FAILED \| REFUNDED \| CANCELLED  

---

## 4. 관계 구조 (요약)

```
User 1 ──┬── * MemberProfile (1:1 실질)
         ├── * TournamentEntry (참가 신청)
         └── ...

Organization (Client) 1 ── * Tournament
                              │
Tournament 1 ── * TournamentEntry (tournamentId, userId, slotIndex UK)
                │   ├── status: APPLIED | CONFIRMED | WAITLIST | CANCELED | REJECTED
                │   ├── paidAt (입금확인 시각 → 확정 순서)
                │   ├── waitlistOrder (WAITLIST 시)
                │   └── finalResult (성적)
                │
                ├── * TournamentMatchVenue (경기장)
                ├── * TournamentRound (라운드/브래킷)
                └── 1 TournamentRule

TournamentEntry 1 ── 0..1 EntryPayment (확장 시. 입금/결제 이력)
```

- **중복 참가**: `(tournamentId, userId, slotIndex)` unique. slotIndex 기본 1. allowMultipleSlots=true일 때만 2, 3, … 허용.
- **입금 순서**: CONFIRMED/WAITLIST 부여 시 `paidAt ASC`로 정렬해 정원까지 CONFIRMED, 나머지 WAITLIST + waitlistOrder 부여.
- **취소 시 승격**: CONFIRMED → CANCELED 시, WAITLIST 중 waitlistOrder=1 인 엔트리를 CONFIRMED로 변경하고 waitlistOrder 재정렬.

---

## 5. 향후 확장 포인트

| 구분 | 내용 |
|------|------|
| **Client(Organization)** | membershipType(기존), membershipExpireDate(만료일 캐시). 연회원/기능 제한 정책. |
| **Tournament** | isPromoted, promotionLevel, promotionEndDate — 메인/목록 노출·순위 유료 홍보. |
| **Payment** | EntryPayment 테이블 또는 Payment: paymentType, amount, status — 참가비 결제·PG·영수증·정산. |
| **참가자** | slotIndex로 1인 다슬롯 이미 반영. 부별(남/녀/시니어) 등은 entryCondition 또는 별도 division 필드로 확장 가능. |
| **성적** | finalResult enum 확장(3·4위전 등). 조별 결과는 기존 TournamentResult 유지. |
| **대회 기간** | startAt/endAt 유지. “1일/2일/3일” 라벨용 durationType 같은 필드는 선택. |

---

## 6. 입금/확정 규칙 정리 (로직 요약)

- **확정 기준**: 신청순이 아니라 **입금확인(paidAt) 순**.
- **관리자 “입금확인” 클릭**  
  - 해당 엔트리에 paidAt = now() 설정.  
  - 해당 대회의 CONFIRMED 수가 maxEntries 미만이면 → status = CONFIRMED.  
  - 이미 정원이면 → status = WAITLIST, waitlistOrder = (기존 WAITLIST max + 1).
- **정원 초과 후 입금확인**: 모두 WAITLIST, waitlistOrder 순서대로 부여.
- **확정 참가자 취소**:  
  - 해당 엔트리 status = CANCELED.  
  - WAITLIST 중 waitlistOrder가 가장 작은 1건을 CONFIRMED로 변경, waitlistOrder 전건 -1 또는 재계산.

(위 로직은 애플리케이션 레이어에서 구현; DB는 status, paidAt, waitlistOrder만으로 표현 가능.)

---

## 7. 설계 반영 시 유의사항

- **기존 데이터**: TournamentEntry에 slotIndex default 1, status 값 매핑(APPLIED/CONFIRMED/REJECTED/CANCELED 유지, WAITLIST 추가). paidAt·waitlistOrder 이미 있음.
- **Unique 변경**: (tournamentId, userId) → (tournamentId, userId, slotIndex). 마이그레이션 시 기존 행에 slotIndex=1 부여.
- **MemberProfile**: burnInScore, ever 컬럼 추가. 마이페이지·신청 폼에서만 사용.
- **Tournament**: scope, gameFormatType, allowMultipleSlots, isPromoted, promotionLevel, promotionEndDate nullable 추가.
- **EntryPayment**: 1차에는 테이블만 생성해 두거나, 아예 나중에 추가해도 됨. 유료화 시 TournamentEntry.paidAt과 연동 정책만 정하면 됨.

이 설계안을 기준으로 마이그레이션·API·화면 순으로 반영하면 됩니다.
