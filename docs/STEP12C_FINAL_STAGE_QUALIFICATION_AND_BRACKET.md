# Step 12C: 본선 진출·본선 대진 (Final Stage Qualification and Bracket)

## 1. 개요

권역별 예선(TournamentZone) 결과를 바탕으로 **진출자 추출 → 본선 진출자 취합 → 본선 32강/64강 생성 → 본선 결과 입력**까지 한 대회 안에서 연결하는 구조입니다.

- **CLIENT_ADMIN**: 본선 생성·수정·결과 입력 가능.
- **ZONE_MANAGER**: 본선 관련 API/화면 접근 불가 (권역 예선만).
- **PLATFORM_ADMIN**: 본선 조회만 가능.

---

## 2. TournamentZone 진출 규칙

각 권역(TournamentZone)마다 “몇 명이 본선에 진출하는지” 규칙을 둡니다.

### 2.1 필드 (TournamentZone)

| 필드 | 타입 | 설명 |
|------|------|------|
| advanceCount | Int (default 1) | 진출 인원 수 (TOP_N일 때 상위 N명) |
| advanceRuleType | String (default "WINNER_ONLY") | WINNER_ONLY \| TOP_N |

- **WINNER_ONLY**: 해당 권역 우승자 1명만 본선 진출.
- **TOP_N**: 해당 권역 결과 기준 상위 `advanceCount`명 진출 (1위→2위→…→N위 순).

### 2.2 시드/배정 순서 (선택)

- `TournamentFinalQualifier.seedOrder`: 취합 시 0부터 부여. 자동배정 시 이 순서와 권역·순위 조합으로 정렬해 사용.

### 2.3 API

- **PATCH** `/api/admin/tournaments/[id]/tournament-zones/[tzId]`  
  - body: `advanceCount?`, `advanceRuleType?`  
  - canManageTournament 필요.

---

## 3. 진출자 추출

### 3.1 추출 방식

- **lib/final-qualification.ts**
  - `extractZoneQualifiers(tournamentZoneId, rule)`: 해당 권역의 `TournamentZoneMatch` 결과만 사용.
  - **WINNER_ONLY**: 결승 경기 승자 1명.
  - **TOP_N**: 결승 승자 → 결승 패자 → 준결승 패자 → 8강 패자 … 순으로 `advanceCount`명까지 채움.
- `computeAllZoneQualifiers(tournamentId)`: 모든 권역에 대해 위 로직 실행 후 `byZone` + `total` 반환. **DB에는 쓰지 않고** 계산 결과만 반환.

### 3.2 진출자 데이터 (출처 유지)

저장 시 `TournamentFinalQualifier`에 다음이 남습니다.

| 필드 | 설명 |
|------|------|
| participantId | (엔트리 기준이므로) entryId로 저장 |
| tournamentZoneId | 출처 권역 |
| qualifiedRank | 1=우승, 2=준우승, 3=3위 … |
| sourceMatchId | (선택) 출처 경기 ID |
| seedOrder | 본선 배정 순서용 |

---

## 4. 본선 참가자 취합

### 4.1 전체 본선 진출자 목록

- **GET** `/api/admin/tournaments/[id]/qualified-participants`
  - 저장된 진출자(`TournamentFinalQualifier`) + 권역별 “현재 결과 기준 추출 가능 인원”(computed).
  - 응답: `savedCount`, `computedTotal`, `byZone[]` (권역별 저장/추출 인원, qualifiers 목록), `canCollect`.

### 4.2 취합(저장) 동작

- **POST** `/api/admin/tournaments/[id]/qualified-participants` (“진출자 취합”)
  - `computeAllZoneQualifiers` 실행 후 기존 `TournamentFinalQualifier` 삭제 후, 계산 결과로 다시 생성.
  - canManageTournament 필요.

### 4.3 본선 생성 전 검증

- 본선 생성 API는 “저장된 진출자 2명 이상”일 때만 허용.
- 미확정 권역이 있으면 computed와 저장 수가 다를 수 있으므로, 화면에서 권역별 “추출 가능 / 저장됨”을 보여 주어 운영자가 “진출자 취합” 시점을 판단할 수 있게 했습니다.

---

## 5. 본선 배정 구조

### 5.1 본선 대진 모델: TournamentFinalMatch

- 대회 단위(`tournamentId`만 소유). 권역 ID 없음.
- 필드: roundIndex, matchIndex, entryIdA, entryIdB, scoreA, scoreB, winnerEntryId, status, nextMatchId, nextSlot (권역 대진과 동일 구조).

### 5.2 32강 / 64강 생성

- **POST** `/api/admin/tournaments/[id]/final-bracket/generate`  
  - body: `{ size: 32 | 64, assignMode: "auto" | "manual" }`
  - 이미 본선 대진이 있으면 400.
  - **자동배정**: `orderQualifiersForAutoAssign`로 “같은 권역 1회전 충돌 최소화” 순서로 정렬한 뒤, 앞에서부터 `size`개 슬롯에 배치하고 `buildFinalBracketPlan(slots, size)`로 대진 생성.
  - **수동배정**: 진출자 순서대로 슬롯에 넣은 뒤 동일하게 대진 생성. 이후 **PATCH** `/api/admin/tournaments/[id]/final-bracket/slots`로 슬롯별 교체 가능.

### 5.3 자동배정 규칙 (확장 가능 구조)

- 현재: rank 순으로 권역별 나열 → zoneA_r1, zoneB_r1, zoneC_r1, zoneA_r2, …  
  → 1라운드에서 같은 권역끼리 만날 확률 감소.
- 향후 같은 클럽/같은 지역 회피 등은 `orderQualifiersForAutoAssign` 또는 별도 정렬 함수로 확장 가능.

### 5.4 수동배정

- **PATCH** `/api/admin/tournaments/[id]/final-bracket/slots`  
  - body: `{ slots: [ { slotIndex, entryId } ] }`  
  - slotIndex 0,1 = 1라운드 1경기 A/B, 2,3 = 2경기 A/B, …  
  - entryId는 null 가능(슬롯 비우기).

---

## 6. 본선 대진표 / 결과

### 6.1 조회

- **GET** `/api/admin/tournaments/[id]/final-bracket`  
  - 본선 경기 전체 + 엔트리 이름, stats( total / completed / pending ).

### 6.2 결과 입력

- **PATCH** `/api/admin/tournaments/[id]/final-matches/[matchId]`  
  - body: `scoreA`, `scoreB`, `winnerEntryId`, `status`  
  - 승자 확정 시 다음 경기 `entryIdA`/`entryIdB` 및 status 자동 반영 (권역 대진과 동일).

### 6.3 권한 정리

- **CLIENT_ADMIN**: 본선 생성·수정·결과 입력 가능.
- **ZONE_MANAGER**: 본선 API/화면 접근 불가.
- **PLATFORM_ADMIN**: 조회만 가능.

---

## 7. 화면

- **경로**: `/client/tournaments/[id]/results`
  - “권역 예선 → 본선” 섹션에서 다음 흐름이 보이도록 구성.
- **표시 내용**
  - 권역별 결과 입력 링크 (각 권역 → `/zones/[tzId]/results`)
  - 권역별 진출 현황 테이블 (권역명, 진출 규칙, 추출 가능, 저장됨)
  - “진출자 취합” 버튼 (POST qualified-participants)
  - 본선 진출자 목록 (권역·순위·이름)
  - 본선 생성: 32강/64강, 자동배정/수동배정 선택 후 “본선 대진표 생성”
  - 본선 대진표 보기 (라운드별 경기, A승/B승으로 결과 입력)

권역별 예선과 본선이 같은 대회 안에서 연결된 흐름으로 이해되도록 구성했습니다.

---

## 8. API 요약

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/admin/tournaments/[id]/qualified-participants | canViewTournament | 진출 현황·저장된 진출자 목록 |
| POST | /api/admin/tournaments/[id]/qualified-participants | canManageTournament | 진출자 취합(저장) |
| GET | /api/admin/tournaments/[id]/final-bracket | canViewTournament | 본선 대진표 조회 |
| POST | /api/admin/tournaments/[id]/final-bracket/generate | canManageTournament | 본선 32/64강 생성 (body: size, assignMode) |
| PATCH | /api/admin/tournaments/[id]/final-bracket/slots | canManageTournament | 1라운드 슬롯 수동 배정 |
| PATCH | /api/admin/tournaments/[id]/final-matches/[matchId] | canManageTournament | 본선 경기 결과 입력 |

---

## 9. 남은 TODO

- 본선 슬롯 수동 배정 전용 UI (슬롯 목록 + 드롭다운으로 진출자 선택) 고도화.
- 32강/64강 대진표 시각화(트리 형태) 개선.
- 본선 “시드” 규칙 세분화(클럽/지역 회피 등) 시 `orderQualifiersForAutoAssign` 또는 별도 정렬 확장.
- 멀티플레이어(2인 1조 등) 진출 규칙 확장 시 `extractZoneQualifiers` 및 진출자 스키마 확장 검토.
