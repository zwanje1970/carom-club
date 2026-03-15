# Step 12B: 권역별 대진표 및 결과 입력

## 1. 개요

12A에서 배정된 TournamentZone 참가자를 기준으로 **권역별 대진표 생성**과 **권역별 결과 입력** 구조를 추가했습니다.  
ZONE_MANAGER는 자기 배정 권역만 조회·결과 입력할 수 있습니다.  
본선 진출자 취합은 12C에서 처리합니다.

## 2. TournamentZone 단위 대진 구조

### 2.1 모델: TournamentZoneMatch

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (cuid) | PK |
| tournamentId | String | 대회 ID (조회 편의) |
| tournamentZoneId | String | 권역 ID (FK → TournamentZone) |
| roundIndex | Int | 라운드 (0 = 1라운드) |
| matchIndex | Int | 라운드 내 경기 번호 |
| entryIdA, entryIdB | String? | 참가 엔트리 ID (BYE 시 null) |
| scoreA, scoreB | Int? | 점수 (선택) |
| winnerEntryId | String? | 승자 엔트리 ID |
| status | String | PENDING \| BYE \| IN_PROGRESS \| COMPLETED |
| nextMatchId | String? | 승자 진출 경기 ID |
| nextSlot | String? | A \| B (다음 경기 슬롯) |

- 한 경기의 승자가 확정되면 `nextMatchId`·`nextSlot`에 따라 다음 라운드 경기의 `entryIdA` 또는 `entryIdB`가 채워지고, 해당 경기 `status`가 IN_PROGRESS로 갱신됩니다.

### 2.2 생성 로직

- `lib/zone-bracket.ts`: `buildZoneBracket(entryIds)` — 1v1 싱글 엘리미네이션, 2의 거듭제곱 슬롯, BYE 허용.
- 1라운드만 참가자를 배치하고, 상위 라운드는 빈 슬롯으로 생성한 뒤 `nextMatchId`/`nextSlot`로 연결.

## 3. 결과 입력 구조

- **PATCH** 경기 한 건: `scoreA`, `scoreB`, `winnerEntryId`, `status` 등 갱신.
- `winnerEntryId`를 넣으면 해당 경기는 COMPLETED로 두고, `nextMatchId` 경기의 `entryIdA` 또는 `entryIdB`에 승자 엔트리 ID를 넣고, 그 경기를 IN_PROGRESS로 둡니다.

### 권한

- **CLIENT_ADMIN**: 본인 대회의 모든 TournamentZone에 대해 대진 생성·결과 입력 가능 (canManageTournament).
- **ZONE_MANAGER**: 본인이 배정된 Zone에 해당하는 TournamentZone만 조회·결과 입력 가능 (canManageTournamentZone).
- **PLATFORM_ADMIN**: 조회만 가능, 실무 수정 불가.

## 4. ZONE_MANAGER 연결 방식

- **배정 기준**: `ZoneManagerAssignment`(userId ↔ zoneId).  
  TournamentZone은 (tournamentId, zoneId)로 Zone을 참조하므로,  
  ZONE_MANAGER가 관리할 수 있는 것은 **tz.zoneId가 자신의 배정 zoneId 목록에 포함된 TournamentZone**입니다.
- **헬퍼**: `lib/auth-zone.ts`  
  - `canViewTournamentZone(session, tournamentZoneId)`  
  - `canManageTournamentZone(session, tournamentZoneId)`  
  - `getAssignedTournamentZones(session)` — 관리 가능한 TournamentZone 목록 (대회명·권역명 포함).

### /zone 화면

- **/zone**: `getAssignedTournamentZones`로 “내가 맡은 대회 권역” 목록 표시.  
  각 항목에서 `/zone/tournament-zones/[tzId]`로 이동.
- **/zone/tournament-zones/[tzId]**: 개요(참가자 수, 경기 수, 완료/남은 경기).
- **/zone/tournament-zones/[tzId]/participants**: 해당 권역 참가자 목록 (GET /api/zone/tournament-zones/[tzId]/participants).
- **/zone/tournament-zones/[tzId]/bracket**: 대진표 조회 (GET .../bracket).
- **/zone/tournament-zones/[tzId]/results**: 결과 입력 (동일 대진표 + PATCH .../matches/[matchId]).

## 5. API 요약

### Admin (CLIENT_ADMIN / PLATFORM_ADMIN 조회)

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/admin/tournaments/[id]/tournament-zones/[tzId]/bracket | canViewTournament | 권역 대진표 조회 |
| POST | /api/admin/tournaments/[id]/tournament-zones/[tzId]/bracket | canManageTournament | 권역 대진표 생성 (해당 권역 배정·참가확정 참가자만 사용) |
| PATCH | /api/admin/tournaments/[id]/tournament-zones/[tzId]/matches/[matchId] | canManageTournament | 경기 결과(점수·승자) 입력, 다음 라운드 반영 |

### Zone (ZONE_MANAGER)

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/zone/my-tournament-zones | ZONE_MANAGER | 내가 관리할 수 있는 TournamentZone 목록 |
| GET | /api/zone/tournament-zones/[tzId]/participants | canViewTournamentZone | 해당 권역 참가자 |
| GET | /api/zone/tournament-zones/[tzId]/bracket | canViewTournamentZone | 해당 권역 대진표 |
| PATCH | /api/zone/tournament-zones/[tzId]/matches/[matchId] | canManageTournamentZone | 경기 결과 입력 |

## 6. 현재 지원 포맷

- **토너먼트**: 1대1 싱글 엘리미네이션 (build1v1Bracket).
- 참가자 수에 따라 2의 거듭제곱 슬롯으로 BYE 부여.
- 1라운드 생성 후 상위 라운드 빈 슬롯 생성 및 nextMatchId/nextSlot 연결.
- 조별/멀티플레이어 등은 추후 동일 Match 구조 또는 별도 구조로 확장 가능.

## 7. 권역별 현황

- **개요/대진표 응답**: `stats`: total, completed, pending, inProgress.
- **CLIENT_ADMIN**: `/client/tournaments/[id]/zones`에서 권역별 “참가 N명”, “경기 M/N” 표시, 권역별 대진 생성·대진표/결과 링크.
- **ZONE_MANAGER**: `/zone/tournament-zones/[tzId]` 개요에서 참가자 수, 전체/완료/남은 경기 수 표시.

## 8. 다음 단계(본선 진출자 취합)와 연결

- 권역별 대진이 완료되면, 각 권역의 **우승자/상위 N명**을 조회할 수 있도록:
  - TournamentZoneMatch에서 해당 권역의 최종 라운드(결승) 경기 winnerEntryId 및 준우승 등 수집.
- 12C에서는 이 데이터를 사용해 “본선 32강/64강” 참가자 풀을 만들고, 본선 대진 생성·재배정을 수행하면 됩니다.
