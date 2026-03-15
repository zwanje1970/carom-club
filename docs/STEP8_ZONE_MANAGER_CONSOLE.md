# 8단계: ZONE_MANAGER 전용 콘솔

작성일: 2025-03-11  
목적: ZONE_MANAGER가 배정된 권역(zone)만 조회·관리할 수 있는 전용 화면 흐름 분리.

---

## 1. 권역 관리자 전용 진입 경로

| 역할 | 진입 경로 |
|------|-----------|
| PLATFORM_ADMIN | /admin |
| CLIENT_ADMIN | /client |
| ZONE_MANAGER | **/zone** |

- ZONE_MANAGER 로그인 후 자동 리다이렉트: `/zone`
- `/admin`, `/client` 접근 시 ZONE_MANAGER는 `/zone`으로 리다이렉트됨(전체 대회/조직 운영 불가).

---

## 2. 내가 맡은 권역 목록 구조

**경로:** `/zone` (권역 운영 대시보드)

- **데이터:** `ZoneManagerAssignment` 기준으로 `userId = session.id`인 배정만 조회 → `Zone` 이름·코드·sortOrder.
- **표시:** 권역명, 코드(있을 때), "권역별 대회 연결은 추후 제공" 안내, 바로가기 버튼.
- **바로가기:** 권역 상세, 참가자 보기, 대진표 보기, 결과 입력 → `/zone/[zoneId]`, `/zone/[zoneId]/participants`, `/zone/[zoneId]/bracket`, `/zone/[zoneId]/results`.
- **배정 없음:** "배정된 권역이 없습니다. 대회 총관리자가 공동관리자/권역 관리자 메뉴에서 권역을 배정하면 여기에 표시됩니다."

---

## 3. 권역 상세에서 가능한 기능 / 불가능한 기능

**경로:** `/zone/[zoneId]` + 탭

| 탭 | 가능 | 불가 |
|----|------|------|
| 권역 정보 | 배정된 권역 정보 조회 | 대회 기본정보 수정, 전체 대회 설정 |
| 참가자 | (연동 후) 권역 참가자 목록 조회, 출석/상태 확인 | 전체 대회 참가자, 다른 권역 참가자, 참가자 소속 대회 수정 |
| 대진표 | (연동 후) 권역 대진표 조회, 결과 입력 진입 | 다른 권역 대진표, 본선 전체 브래킷 수정, 대회 전체 브래킷 생성 |
| 결과 관리 | (연동 후) `canManageZone`인 경우 권역 경기 결과 입력·진출 확정 | 다른 권역 결과, 대회 전체 결과 설정 |

- 현재 DB에는 **대회–권역 연결**(Tournament ↔ Zone)이 없어, 참가자/대진표/결과 탭은 안내 문구 + 추후 연동 구조만 구현됨.
- 접근 제어: `getAssignedZoneIds(session)` + `canViewZone(session, zoneId, assignedIds)` / `canManageZone(...)` 사용.

---

## 4. 재사용한 기존 화면/컴포넌트

- **참가자/대진표/결과:** 이번 단계에서는 **재사용하지 않음**. DB에 권역별 참가·라운드 연결이 없어, 각 탭은 "권역별 데이터는 대회-권역 연결 후 제공" 안내만 표시. 추후 `TournamentEntry.zoneId` 또는 라운드–권역 매핑이 생기면 `ParticipantsTable` 등에 zone 필터를 걸어 재사용 예정.
- **권한:** `lib/permissions.ts`의 `canViewZone`, `canManageZone` 및 `lib/auth-zone.ts`의 `getAssignedZoneIds`, `getAssignedZones` 재사용.

---

## 5. 추가/변경 파일 요약

| 파일 | 설명 |
|------|------|
| `lib/auth-zone.ts` | `getAssignedZoneIds`, `getAssignedZones` (ZONE_MANAGER 배정 권역 조회) |
| `components/zone/ZoneSidebar.tsx` | /zone 공통 사이드바 ("권역 운영", "내가 맡은 권역", "메인으로") |
| `components/zone/ZoneDetailTabs.tsx` | 권역 상세 탭 네비 (권역 정보, 참가자, 대진표, 결과 관리) |
| `app/zone/layout.tsx` | ZONE_MANAGER 전용 레이아웃, 비로그인/비권역관리자 시 로그인·권한 안내 |
| `app/zone/page.tsx` | 내가 맡은 권역 목록 |
| `app/zone/[zoneId]/layout.tsx` | 배정된 zone만 접근 허용, 아니면 notFound |
| `app/zone/[zoneId]/page.tsx` | 권역 정보 탭 |
| `app/zone/[zoneId]/participants/page.tsx` | 참가자 탭 (안내) |
| `app/zone/[zoneId]/bracket/page.tsx` | 대진표 탭 (안내) |
| `app/zone/[zoneId]/results/page.tsx` | 결과 관리 탭 (안내) |
| `app/admin/layout.tsx` | ZONE_MANAGER일 때 `/zone`으로 리다이렉트 |
| `app/client/layout.tsx` | ZONE_MANAGER일 때 `/zone`으로 리다이렉트 |
| `app/login/page.tsx` | 로그인 성공 시 ZONE_MANAGER → `/zone`, CLIENT_ADMIN → `/client` |

---

## 6. 아직 남은 TODO

- **대회–권역 연결:** Tournament ↔ Zone (또는 Round/Entry ↔ Zone) 스키마·API 확장 후, 권역별 참가자/대진표/결과 데이터 표시 및 기존 참가자·대진표·결과 컴포넌트에 zone 스코핑 연결.
- **CLIENT_ADMIN 공동관리자 UI:** 대회 상세에서 권역별 ZONE_MANAGER 배정 UI 완성 시, 배정 결과가 `ZoneManagerAssignment`에 저장되고 `/zone` 목록에 즉시 반영됨.
- **권역별 결과 입력 API:** `canManageZone` 기준 권역별 경기 결과 입력·진출 확정 API 및 화면 연동.
- **권역 상태(진행중/대기/종료):** 현재 Zone 모델에는 상태 없음. 대회–권역 연결 후 대회/라운드 기준 상태 표시 가능.

---

## 7. CLIENT_ADMIN과의 연결

- CLIENT_ADMIN이 (추후) 대회 상세 → 공동관리자/권역 관리자 메뉴에서 특정 Zone에 사용자를 배정하면, `ZoneManagerAssignment`에 `userId` + `zoneId`가 생성됨.
- ZONE_MANAGER는 `getAssignedZones(session)`으로 해당 목록만 조회하므로, 배정 즉시 `/zone`에서 "내가 맡은 권역"으로 표시됨.
- 이번 단계에서는 배정 UI 미완성이어도, 수동 또는 시드로 `ZoneManagerAssignment`를 넣으면 ZONE_MANAGER 화면에서 바로 확인 가능.
