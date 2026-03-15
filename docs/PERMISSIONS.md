# 권한 정리 (클라이언트 vs 플랫폼 관리자)

## 1. 역할별 우선순위

| 역할 | 용도 |
|------|------|
| **CLIENT_ADMIN** | 대회 생성·운영 주체(당구장/동호회 등). 자기 조직의 대회·참가자·대진표만 관리. |
| **PLATFORM_ADMIN** | 플랫폼 운영. 전체 대회 모니터링, 전체 클라이언트 관리. 필요 시 전체 대회 데이터 수정 가능. |

## 2. 클라이언트 권한 (CLIENT_ADMIN)

- **대회 생성**: 자기 소유 조직(Organization) 기준으로만 생성. (`canManageOrganization` → `/client/tournaments/new`, `POST /api/admin/tournaments`)
- **참가자 관리**: 자기 조직 대회만. 참가 신청 승인/반려, 출석, 취소. (`canManageTournament`)
- **입금확인**: 참가자 확정 시 입금 확인 처리. (참가자 관리 내 확인 API)
- **대진표 생성**: 자기 대회만. (`canManageTournament` → `POST .../bracket/generate`)
- **대진표 강제수정**: 자기 대회만. (`canManageTournament` → `PATCH .../final-matches/[matchId]`, 슬롯 배정 등)

**페이지 접근**: `/client/*` 전용. 레이아웃에서 `session.role === "CLIENT_ADMIN"` 검사.

## 3. 플랫폼 관리자 권한 (PLATFORM_ADMIN)

- **전체 대회 모니터링**: 모든 대회 조회·상세. (`canViewTournament` → true for any)
- **전체 클라이언트 관리**: 클라이언트 신청·승인, 조직·요금제·기능·사이트 설정 등. (`session.role === "PLATFORM_ADMIN"` 전용 API/페이지)
- **필요 시 전체 대회 데이터 수정 가능**: 모든 대회에 대해 수정/참가자/대진표 생성·강제수정 등 실무 동일. (`canManageTournament` → true for any)
- **대회 생성은 불가**: 대회 생성(POST)은 `canManageOrganization` 사용 → PLATFORM_ADMIN은 false. 생성은 클라이언트 전용.

**페이지 접근**: `/admin/*` 전용. 레이아웃에서 `session.role === "PLATFORM_ADMIN"` 검사. 대회 상세에서 설정 수정·대회요강·참가자 관리·대진표·유지보수 링크 노출.

## 4. 역할별 가능 액션 요약

| 액션 | CLIENT_ADMIN | PLATFORM_ADMIN |
|------|----------------|----------------|
| 대회 생성 | ✅ (자기 조직만) | ❌ |
| 대회 조회(전체/상세) | ✅ (자기 조직 대회만) | ✅ (전체) |
| 대회 수정(설정/요강) | ✅ (자기 대회만) | ✅ (전체) |
| 참가자 관리(승인/반려/입금확인) | ✅ (자기 대회만) | ✅ (전체) |
| 대진표 생성 | ✅ (자기 대회만) | ✅ (전체) |
| 대진표 강제수정 | ✅ (자기 대회만) | ✅ (전체) |
| 유지보수(본선 초기화 등) | ❌ | ✅ |
| 클라이언트 신청/승인, 요금제, 사이트 설정 | ❌ | ✅ |

## 5. 페이지 접근 권한

| 경로 | CLIENT_ADMIN | PLATFORM_ADMIN |
|------|----------------|----------------|
| `/admin/*` | ❌ (권한 없음 안내) | ✅ |
| `/admin/tournaments` | - | ✅ (대회 현황) |
| `/admin/tournaments/new` | - | ✅ (대회 생성 불가 안내) |
| `/admin/tournaments/[id]` | - | ✅ (상세·수정/참가자/대진표/유지보수 링크) |
| `/admin/tournaments/[id]/bracket` | - | ✅ (대진표 생성·강제수정) |
| `/admin/tournaments/[id]/maintenance` | - | ✅ (PLATFORM 전용) |
| `/client/*` | ✅ | ❌ (접근 안 함) |
| `/client/tournaments/new` | ✅ | - |
| `/client/tournaments/[id]/*` | ✅ (자기 조직 대회만) | - |

## 6. API 권한 (핵심)

- `canViewTournament`: PLATFORM_ADMIN → true, CLIENT_ADMIN → 본인 조직 대회만.
- `canManageTournament`: PLATFORM_ADMIN → **true**(전체), CLIENT_ADMIN → 본인 조직 대회만.
- `canManageOrganization`: PLATFORM_ADMIN → false, CLIENT_ADMIN → 본인 소유 조직만. (대회 생성 시 사용)
- 대회 생성 `POST /api/admin/tournaments`: `canManageOrganization(session, org)` → CLIENT_ADMIN만 성공.

 구현: `lib/permissions.ts` 주석 및 `canManageTournament` 반환값.
