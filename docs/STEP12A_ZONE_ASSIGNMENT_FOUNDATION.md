# Step 12A: 권역 배정 기반 (Zone Assignment Foundation)

## 1. 개요

참가자(TournamentEntry)를 대회별 권역(TournamentZone)에 배정하는 구조를 추가했습니다.  
이 단계에서는 **권역 배정 데이터·API·UI**만 마련하며, 권역별 대진표 생성은 다음 단계에서 진행합니다.

## 2. 참가자 → TournamentZone 배정 구조

### 2.1 모델: TournamentEntryZoneAssignment

| 필드 | 타입 | 설명 |
|------|------|------|
| id | String (cuid) | PK |
| tournamentEntryId | String | 참가 신청(엔트리) ID, **unique** (대회당 1:1) |
| tournamentZoneId | String | 대회별 권역 ID (TournamentZone) |
| assignmentType | String | AUTO \| MANUAL |
| assignedAt | DateTime | 배정 시점 |
| assignedByUserId | String? | 배정 수행자 (선택) |
| notes | String? | 메모 (선택) |
| createdAt, updatedAt | DateTime | |

- **제약**: 한 참가자(Entry)는 같은 대회 안에서 **하나의 TournamentZone에만** 배정됩니다.  
  `tournamentEntryId`에 unique 제약으로 중복 배정을 막습니다.

### 2.2 관계

- `TournamentEntry.zoneAssignment` → TournamentEntryZoneAssignment? (1:1)
- `TournamentZone.zoneAssignments` → TournamentEntryZoneAssignment[]
- `User.entryZoneAssignmentsGranted` → TournamentEntryZoneAssignment[] (assignedBy)

## 3. API

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| GET | /api/admin/tournaments/[id]/zone-assignments | canViewTournament | 대회 기준 전체 참가자·미배정·권역별 현황. 쿼리 `?tournamentZoneId=` 시 해당 권역 참가자만 |
| POST | /api/admin/tournaments/[id]/zone-assignments | canManageTournament | 수동 배정. body: entryId, tournamentZoneId, assignmentType?, notes? |
| PATCH | /api/admin/tournaments/[id]/zone-assignments/[assignmentId] | canManageTournament | 배정 변경. body: tournamentZoneId?, notes? |
| DELETE | /api/admin/tournaments/[id]/zone-assignments/[assignmentId] | canManageTournament | 배정 해제 |
| POST | /api/admin/tournaments/[id]/zone-assignments/auto | canManageTournament | 자동 배정(미배정 참가자를 권역에 균등 분배) |

- **CLIENT_ADMIN**: 본인 조직 대회에 대해 canManageTournament → 수정·배정 가능.
- **PLATFORM_ADMIN**: canViewTournament만 true, canManageTournament는 false → 조회만 가능, 실무 수정 불가.

## 4. 수동 배정 / 자동 배정

### 4.1 수동 배정

- 참가자 목록에서 권역을 선택하거나, 배정된 권역을 다른 권역으로 변경.
- 배정 해제: 권역을 "미배정"으로 바꾸거나 "배정 해제" 버튼.

### 4.2 자동 배정 (기본형)

- **미배정 참가자만** 대상.
- 대회에 연결된 TournamentZone 목록 순서대로 **균등 분배** (round-robin).
- assignmentType = "AUTO", assignedByUserId = 요청한 사용자.
- 향후 핸디/부/지역 기준 확장 시 이 API 내부 로직만 확장하면 됨.

## 5. 권역별 참가자 조회

- **대회 전체**: `GET .../zone-assignments`  
  - 응답: entries(각 entry에 zoneAssignment 포함), tournamentZones, unassignedCount, zoneCounts.
- **특정 권역**: `GET .../zone-assignments?tournamentZoneId=[tzId]`  
  - 해당 TournamentZone에 배정된 참가자만 entries에 포함.

이 구조가 다음 단계에서 **권역별 대진 생성**의 입력(권역별 참가자 목록)으로 사용됩니다.

## 6. CLIENT_ADMIN 화면

- **경로**: `/client/tournaments/[id]/participants`
- **권역 배정** 섹션(참가자 테이블 아래):
  - 미배정 인원 수, 권역별 배정 인원 수.
  - "미배정 자동 배정" 버튼.
  - 표: 참가자명, 소속(핸디/AVG), 현재 권역, 배정(드롭다운), 액션(배정 해제).
  - 드롭다운에서 권역 선택 시 수동 배정, "미배정" 선택 시 배정 해제.

## 7. ZONE_MANAGER 연결 준비

- **현재**: Zone 기반 권한(canViewZone, canManageZone)과 ZoneManagerAssignment( userId ↔ zoneId )가 있음.
- **TournamentZone과의 연결**: TournamentZone은 (tournamentId, zoneId)로 Zone을 참조합니다.  
  ZONE_MANAGER는 특정 Zone에 배정되므로, 다음 단계에서 **자기 Zone에 해당하는 TournamentZone**의 참가자 목록만 조회하면 됩니다.
- **TODO (다음 단계)**:
  - ZONE_MANAGER용 화면/API에서 `GET .../zone-assignments?tournamentZoneId=...` 호출 시,  
    요청자가 배정된 Zone에 속하는 TournamentZone만 허용하도록 권한 체크 추가.
  - 권역별 대진표 생성 시, 해당 권역에 배정된 참가자(entries from zone-assignments?tournamentZoneId=)를 입력으로 사용.

## 8. 다음 단계(권역별 대진표 생성)에서 이 구조 사용

1. **권역별 참가자 목록**: `GET /api/admin/tournaments/[id]/zone-assignments?tournamentZoneId=[tzId]` 로 해당 권역 참가자 확보.
2. **대진 생성 입력**: 권역별로 별도 Round/Group을 만들 경우, 위 참가자 id(entryId) 목록을 사용.
3. **ZONE_MANAGER**: 자기 zoneId에 연결된 TournamentZone만 필터링해, 해당 권역 참가자·대진·결과만 노출 및 관리.

## 9. 마이그레이션

스키마 변경 후 다음을 실행하세요.

```bash
npx prisma migrate dev --name step12a_zone_assignment
npx prisma generate
```
