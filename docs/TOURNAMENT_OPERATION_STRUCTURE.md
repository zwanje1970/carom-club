# 대회 운영 구조 정리 (분석·정리용)

구현 전에 이 문서를 기준으로 **페이지 구조 / DB 구조 / 상태값 / 권한**을 맞추고, 변경 시 여기를 먼저 갱신한다.

---

## 1. 페이지 구조

### 1.1 공개 (비로그인·일반회원)

| 경로 | 용도 |
|------|------|
| `/tournaments` | 대회 목록 (참가현황·마감임박 표시) |
| `/tournaments/[id]` | 대회 상세 (탭: 안내/요강/참가신청/참가자명단/시합문의/결과) |
| `/tournaments/[id]/bracket` | 본선 대진표 보기 |
| `/tournaments/[id]/results` | 결과 보기 |
| `/venues` | 당구장 목록 (위치 허용 시 가까운 순) |

### 1.2 클라이언트 관리자 (`/client` — CLIENT_ADMIN만)

| 경로 | 용도 |
|------|------|
| `/client` | 대시보드 |
| `/client/tournaments` | 내 대회 목록 |
| `/client/tournaments/new` | 대회 생성 |
| `/client/tournaments/[id]` | 대회 상세 (기본정보 탭) |
| `/client/tournaments/[id]/edit` | 대회 수정 |
| `/client/tournaments/[id]/outline` | 대회요강 편집 |
| `/client/tournaments/[id]/promo` | 홍보페이지 편집 |
| `/client/tournaments/[id]/participants` | 참가자 관리 (승인/반려/입금확인) |
| `/client/tournaments/[id]/bracket` | 대진표 생성·강제수정 |
| `/client/tournaments/[id]/results` | 결과 입력 |
| `/client/tournaments/[id]/zones` | 권역(경기장) |
| `/client/tournaments/[id]/co-admins` | 공동관리자 |

### 1.3 플랫폼 관리자 (`/admin` — PLATFORM_ADMIN만)

| 경로 | 용도 |
|------|------|
| `/admin/tournaments` | 대회 현황 (전체) |
| `/admin/tournaments/[id]` | 대회 상세 (설정 수정/요강/참가자/대진표/유지보수 링크) |
| `/admin/tournaments/[id]/edit` | 대회 설정 수정 |
| `/admin/tournaments/[id]/participants` | 참가자 관리 |
| `/admin/tournaments/[id]/bracket` | 대진표 생성·강제수정 |
| `/admin/tournaments/[id]/maintenance` | 유지보수 (본선 초기화 등) |

---

## 2. DB·상태값 정리

### 2.1 Tournament.status

| 값 | 의미 |
|----|------|
| DRAFT | 초안 (비공개) |
| OPEN | 모집중 |
| CLOSED | 참가 마감 |
| BRACKET_GENERATED | 대진표 생성됨 (참가자 수정 잠금) |
| FINISHED | 종료 |
| HIDDEN | 숨김 |

### 2.2 TournamentEntry.status

| 값 | 의미 |
|----|------|
| APPLIED | 신청대기 (입금 전 또는 입금완료 체크 전) |
| CONFIRMED | 참가확정 (입금확인 완료 또는 관리자 확정) |
| REJECTED | 반려 |
| CANCELED | 취소 (참가자/관리자 취소) |

- **대기자**: `status = APPLIED` 이면서 `waitingListOrder != null`. 입금확인 시 정원 초과면 대기자로 등록되고 순번 부여.

### 2.3 참가 확정·대기 흐름 (핵심 필드)

| 필드 | 용도 |
|------|------|
| paymentMarkedByApplicantAt | 신청자 "입금 완료" 체크 시각. 관리자 입금확인 가능 조건 |
| paidAt | 관리자 입금확인 시각. 한 번만 설정 (중복 방지) |
| waitingListOrder | 대기자 순번. 입금확인 시 정원 초과면 부여, 확정 취소 시 재정렬 |
| reviewedAt | 승인/반려 처리 시각 |

- **입금확인**: `paymentMarkedByApplicantAt != null` 인 건만 처리. 정원 내 → CONFIRMED + paidAt. 정원 초과 + 대기 허용 → APPLIED + waitingListOrder + paidAt.

### 2.4 대기자 자동승격

- **확정 취소 시**: CONFIRMED → CANCELED 처리 시, 대기 1순위(waitingListOrder 최소)를 CONFIRMED로 변경하고 waitingListOrder null, 나머지 대기자 순번 재정렬.
- 구현 위치: `api/admin/tournaments/[id]/participants/[entryId]/cancel`, `api/tournaments/entry/cancel`.

---

## 3. 권한 (요약)

| 액션 | CLIENT_ADMIN | PLATFORM_ADMIN |
|------|----------------|----------------|
| 대회 생성 | ✅ 자기 조직만 | ❌ |
| 대회 조회/수정/참가자/대진표 | ✅ 자기 조직 대회만 | ✅ 전체 |
| 입금확인·승인·반려·취소 | ✅ 자기 대회만 | ✅ 전체 |
| 유지보수(본선 초기화 등) | ❌ | ✅ |

- 조회: `canViewTournament`. 실무(수정/참가자/대진): `canManageTournament`.  
- 상세: `docs/PERMISSIONS.md`.

---

## 4. API (대회 운영 관련 핵심)

| 메서드 | 경로 | 용도 | 권한 |
|--------|------|------|------|
| POST | /api/tournaments/apply | 참가 신청 | 공개 |
| PATCH | /api/tournaments/entry/[entryId]/mark-paid | 신청자 입금완료 체크 | 본인 |
| POST | .../participants/[entryId]/confirm | 입금확인 → 확정/대기 | canManageTournament |
| POST | .../participants/[entryId]/reject | 반려 | canManageTournament |
| POST | .../participants/[entryId]/cancel | 관리자 취소 (대기자 승격 포함) | canManageTournament |
| POST | .../bracket/generate | 대진표 생성 | canManageTournament |
| PATCH | .../final-matches/[matchId] | 대진표 강제수정 | canManageTournament |

---

## 5. 모바일·운영자 UX 가이드

- **버튼 수 최소화**: 한 화면에서 자주 쓰는 액션(입금확인, 확정, 반려)은 최소 클릭으로 실행.
- **목록 우선**: 참가자 관리 화면에서 상태·대기순번 한눈에 보이게, 필터/정렬 유지.
- **입금확인**: "입금 완료 체크한 건만" 한 번에 다중 선택 확정/대기 처리 등으로 단축 검토 가능.
- **대진표**: 생성 후 곧바로 강제수정 진입 가능, 라운드별 편집 한 화면에서 처리.

---

구현 시 이 문서의 1~4절과 일치하는지 확인하고, 바꾼 부분은 이 문서를 먼저 수정한 뒤 코드를 건드린다.
