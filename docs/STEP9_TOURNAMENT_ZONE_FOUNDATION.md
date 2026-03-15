# 9단계: 대회-권역 연결 기반 (TournamentZone)

작성일: 2025-03-11  
목적: 대진 시스템 고도화 전에 필요한 “대회-권역 연결” 데이터 구조와 기본 관리 흐름을 추가.

---

## 1. 왜 이 구조가 필요한지

- **Zone**은 기존에 전역 마스터(예: 서울권, 부산권)로만 존재했음.
- 실제 운영에서는 “**어느 대회의 어느 권역인지**”가 필요함(권역별 예선, 본선 진출, 권역 관리자 배정 등).
- 따라서 **TournamentZone**으로 Tournament와 Zone을 연결하고, 대진·참가자·결과를 나중에 이 단위로 스코핑할 수 있게 함.

---

## 2. 추가한 모델/타입

**TournamentZone (prisma/schema.prisma):**

- id, tournamentId, zoneId  
- name (선택) — 대회 안에서의 표시명  
- code (선택) — 대회 안에서의 코드  
- sortOrder — 표시/정렬 순서  
- status (선택) — ACTIVE / DRAFT / CLOSED 등  
- createdAt, updatedAt  

**제약:**

- (tournamentId, zoneId) 유니크 — 한 대회에 같은 Zone은 한 번만 연결.

**관계:**

- Tournament.tournamentZones → TournamentZone[]  
- Zone.tournamentZones → TournamentZone[]  

---

## 3. ZoneManagerAssignment와의 연결

- **현재:** ZoneManagerAssignment는 **Zone** 기준(userId + zoneId).  
  ZONE_MANAGER는 “배정된 Zone” 목록만 보고, /zone 콘솔은 Zone 단위로 동작.
- **다음 단계 옵션:**  
  - **A.** 그대로 Zone 기준 유지하고, “이 Zone이 연결된 대회”는 TournamentZone 조회로 보강.  
  - **B.** TournamentZoneManagerAssignment를 추가해 “대회별 권역” 단위로 배정.  
- 이번 단계에서는 **기존 ZoneManagerAssignment를 유지**하고, 문서에만 “향후 TournamentZone 기준 확장 가능”을 명시.  
  대진/권역 운영이 붙을 때 TournamentZone 기준 조회·배정으로 확장할 수 있음.

---

## 4. ZONE_MANAGER 구조와의 연결 방향

- **현재 /zone:** Zone 기준 — “내가 맡은 권역” 목록은 ZoneManagerAssignment 기준.  
- **향후:**  
  - “내가 맡은 권역”을 **대회별**로 보려면:  
    - TournamentZone + (TournamentZoneManagerAssignment 또는 기존 ZoneManagerAssignment)로  
      “이 대회의 이 권역을 내가 관리한다”는 정보를 조합.  
  - 참가자/대진표/결과를 권역별로 스코핑할 때는 **TournamentZone** id 또는 (tournamentId, zoneId)를 기준으로 필터링.

---

## 5. API / 화면

**API:**

- `GET /api/admin/tournaments/[id]/tournament-zones` — 대회에 연결된 권역 목록. canViewTournament.
- `POST /api/admin/tournaments/[id]/tournament-zones` — 권역 연결. body: zoneId, name?, code?, sortOrder?. canManageTournament.
- `DELETE /api/admin/tournaments/[id]/tournament-zones/[tzId]` — 연결 제거. canManageTournament.
- `GET /api/admin/zones` — 권역 목록(드롭다운용). 로그인 사용자.

**화면:**

- **/client/tournaments/[id]/zones** — 부/권역 탭.  
  - 연결된 TournamentZone 목록, 권역 추가(Zone 선택 후 연결), 연결 해제.  
  - TournamentZonesManager 클라이언트 컴포넌트 사용.
- **/client/zones** — “대회별 권역 연결은 각 대회 상세 → 부/권역 탭에서” 안내 및 내 대회 링크.

---

## 6. 다음 대진 시스템 단계에서 붙일 것

- **참가자 권역 배정:** TournamentEntry에 tournamentZoneId 또는 (tournamentId + zoneId) 연결해 권역별 참가자 목록 조회.
- **라운드/대진표와 권역 연결:** TournamentRound 또는 그룹에 tournamentZoneId 연결해 권역별 대진표/결과 스코핑.
- **ZONE_MANAGER 화면:** “내가 맡은 권역”을 대회별로 보여주려면 TournamentZone + 배정 정보 조합.
- **공동관리자/권역 관리자 배정:** 대회별 권역(TournamentZone) 단위로 ZONE_MANAGER 배정 시 TournamentZoneManagerAssignment 또는 기존 ZoneManagerAssignment와 TournamentZone 조합.

---

## 7. 마이그레이션

- `prisma/migrations/20260328000000_step9_client_approval_tournament_zone/migration.sql`  
  - TournamentZone 테이블 생성, Tournament/Zone FK, 인덱스.  
- 적용: `npx prisma migrate dev` (또는 배포 환경에 맞게).  
- 적용 후 `npx prisma generate`로 클라이언트 재생성.
