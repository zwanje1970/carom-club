# 5단계: API 권한 차단 적용

작성일: 2025-03-11  
목적: lib/permissions.ts의 canView* / canManage*를 대회/조직 관련 API에 적용해 세션만 검사하던 구간을 역할·소유권 기준으로 보호.

---

## 1. 적용 원칙

- **GET** → `canView*` (조회 권한)
- **POST / PATCH / PUT / DELETE** → `canManage*` (실무 권한)
- 대상 리소스(tournament / organization)를 먼저 조회한 뒤 권한 판단
- 권한 없음 → **403**, 대상 없음 → **404**, 미로그인 → **401**

---

## 2. 수정한 API 목록 및 적용 함수

| API | 메서드 | 적용 권한 함수 | 비고 |
|-----|--------|----------------|------|
| `/api/admin/tournaments` | GET | 역할만 검사 (isPlatformAdmin \|\| isClientAdmin) | 목록은 대상 단일 리소스 없음. CLIENT_ADMIN은 본인 org만 필터. |
| `/api/admin/tournaments` | POST | **canManageOrganization(session, org)** | 대회 생성. PLATFORM_ADMIN은 403(대회 생성 불가). |
| `/api/admin/tournaments/[id]` | GET | **canViewTournament(session, tournament, org)** | 404 대회 없음, 403 권한 없음 |
| `/api/admin/tournaments/[id]` | PATCH | **canManageTournament(session, tournament, org)** | PLATFORM_ADMIN 403 |
| `/api/admin/tournaments/[id]/venues` | GET | **canViewTournament** | |
| `/api/admin/tournaments/[id]/venues` | POST | **canManageTournament** | |
| `/api/admin/tournaments/[id]/venues` | DELETE | **canManageTournament** | |
| `/api/admin/tournaments/[id]/outline` | PATCH | **canManageTournament** | |
| `/api/admin/tournaments/[id]/rule` | PUT | **canManageTournament** | |
| `/api/admin/tournaments/[id]/bracket/generate` | POST | **canManageTournament** | |
| `/api/admin/tournaments/[id]/participants/[entryId]/confirm` | POST | **canManageTournament** | 대회 조회 후 entry 조회, 404/403 |
| `/api/admin/tournaments/[id]/participants/[entryId]/absent` | POST | **canManageTournament** | 동일 |
| `/api/admin/tournaments/[id]/participants/[entryId]/attendance` | POST | **canManageTournament** | 동일, entry.tournamentId 일치 검사 추가 |

---

## 3. 조회 vs 실무 권한 기준

- **canViewTournament**: PLATFORM_ADMIN 전체 조회(모니터링), CLIENT_ADMIN 본인 조직 대회만. ZONE_MANAGER는 현재 대회 API에서는 false(권역 API는 별도).
- **canManageTournament**: CLIENT_ADMIN만 본인 조직 대회에 true. **PLATFORM_ADMIN은 항상 false** (대회 실무 불가).
- **canManageOrganization**: 대회 생성 시 “이 조직의 대회를 만들 수 있는지” 판단. CLIENT_ADMIN 본인 소유 조직만 true.

---

## 4. 공통 적용 패턴 (각 라우트)

1. **세션 확인** → 없으면 401
2. **대상 데이터 조회** → tournamentId 있으면 tournament + organization(ownerUserId) 조회
3. **권한 판단** → GET은 canViewTournament, 변경·생성·삭제는 canManageTournament(또는 canManageOrganization)
4. **에러** → !tournament 404, !권한 403

---

## 5. 아직 미적용 API (TODO)

- **권역(Zone) 관련 API**: 아직 라우트 없음. 추가 시 `canViewZone` / `canManageZone` + assignedZoneIds(ZoneManagerAssignment 조회) 적용.
- **참가자 목록 GET** 등: `/api/admin/tournaments/[id]/participants` 목록 조회가 있으면 canViewTournament 적용.
- **기타 admin API**: 회원관리, 클라이언트 신청, 사이트 설정 등은 기존대로 PLATFORM_ADMIN 전용 유지(이번 단계 범위 외).

---

## 6. 검증 체크리스트

작업 후 아래를 확인하면 됨.

| 확인 항목 | 기대 결과 |
|-----------|-----------|
| PLATFORM_ADMIN이 대회 생성(POST /api/admin/tournaments) 호출 | 403 |
| PLATFORM_ADMIN이 대회 수정(PATCH /api/admin/tournaments/[id]) 호출 | 403 |
| PLATFORM_ADMIN이 outline/rule/bracket/participants 실무 API 호출 | 403 |
| PLATFORM_ADMIN이 대회/대회 당구장 목록 GET 호출 | 200 (조회만 허용) |
| CLIENT_ADMIN이 자기 조직 대회만 수정 | 200 |
| CLIENT_ADMIN이 다른 조직 대회 수정 시도 | 403 |
| 존재하지 않는 tournament id로 조회/수정 | 404 |
| 미로그인 시 API 호출 | 401 |
| ZONE_MANAGER가 대회 실무 API 호출 | 403 (현재 대회 API는 CLIENT만 실무 허용) |

---

## 7. 변경 요약

- **tournaments POST**: PLATFORM_ADMIN 차단(403), CLIENT_ADMIN만 생성 가능. canManageOrganization(session, org)로 검사.
- **tournaments/[id] GET/PATCH, venues GET/POST/DELETE, outline PATCH, rule PUT, bracket/generate POST, participants confirm/absent/attendance POST**: 모두 tournament + organization 조회 후 canViewTournament 또는 canManageTournament 사용. 404/403 통일.
- **participants/attendance**: params에서 tournamentId(id) 사용해 먼저 대회 권한 검사 후 entry 조회, entry.tournamentId 일치 검사 추가.
