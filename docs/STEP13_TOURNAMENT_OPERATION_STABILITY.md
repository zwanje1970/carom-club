# Step 13: 대회 운영 안정화 (Tournament Operation Stability)

## 1. 개요

이번 단계는 **새 기능 추가가 아니라**, 이미 구현된 권역 예선 → 본선 구조가 실제 대회 운영에서 **데이터가 꼬이지 않도록** 상태 관리, 잠금 정책, 검증, 예외 처리, 재생성 규칙을 정리한 것입니다.

---

## 2. 대회 진행 상태 구조

### 2.1 Tournament.tournamentStage

| 값 | 설명 |
|----|------|
| SETUP | 대회 생성 후 권역 설정·참가자 배정 단계 |
| QUALIFIER_RUNNING | 권역 예선 진행 중 |
| QUALIFIER_COMPLETED | 권역 예선 완료 |
| FINAL_READY | 본선 진출자 취합 완료 |
| FINAL_RUNNING | 본선 경기 진행 중 |
| COMPLETED | 대회 종료 |

- 기본값: `SETUP`
- **자동 전환**
  - 첫 권역 대진표 생성 시 → `QUALIFIER_RUNNING`
  - 진출자 취합(POST qualified-participants) 성공 시 → `FINAL_READY`
  - 본선 대진표 생성(POST final-bracket/generate) 성공 시 → `FINAL_RUNNING`
- **강제 변경**: 플랫폼 관리자 유지보수 페이지에서만 가능.

### 2.2 상태별 허용 작업

- **SETUP**: 권역 설정, 참가자 배정, 권역 대진 생성 가능.
- **QUALIFIER_RUNNING / QUALIFIER_COMPLETED**: 권역 결과 입력·수정, 진출자 취합 가능. (FINAL_READY 이상이면 아래 잠금)
- **FINAL_READY 이상**: 권역 결과 수정·진출 규칙 수정·참가자 배정 변경 **금지**. 본선 생성·본선 결과 입력만 허용.

---

## 3. 권역 예선 잠금 정책

**FINAL_READY, FINAL_RUNNING, COMPLETED** 상태에서는 다음 API가 **409 Conflict** 로 차단됩니다.

| API | 차단 메시지 |
|-----|-------------|
| PATCH /api/admin/tournaments/[id]/tournament-zones/[tzId] | 본선 준비가 완료된 후에는 권역 진출 규칙을 수정할 수 없습니다. |
| DELETE /api/admin/tournaments/[id]/tournament-zones/[tzId] | 본선 준비가 완료된 후에는 권역 설정을 변경할 수 없습니다. |
| PATCH /api/admin/tournaments/[id]/tournament-zones/[tzId]/matches/[matchId] | 본선 준비가 완료된 후에는 권역 경기 결과를 수정할 수 없습니다. |
| POST /api/admin/tournaments/[id]/tournament-zones/[tzId]/bracket | 본선 준비가 완료된 후에는 권역 대진표를 생성할 수 없습니다. |
| POST /api/admin/tournaments/[id]/zone-assignments | 본선 준비가 완료된 후에는 권역 참가자 배정을 변경할 수 없습니다. |
| PATCH /api/admin/tournaments/[id]/zone-assignments/[assignmentId] | 동일 |
| DELETE /api/admin/tournaments/[id]/zone-assignments/[assignmentId] | 동일 |
| POST /api/admin/tournaments/[id]/zone-assignments/auto | 동일 |

구현: `lib/tournament-stage.ts`의 `isQualifierLocked(tournamentStage)` 사용.

---

## 4. 본선 생성 중복 방지

- **POST** `/api/admin/tournaments/[id]/final-bracket/generate`
  - 이미 `TournamentFinalMatch`가 존재하면 **400** + "이미 본선 대진이 생성되어 있습니다."
  - **PLATFORM_ADMIN**만 `body.forceRegenerate: true`로 재생성 가능. 이 경우 기존 본선 대진 삭제 후 새로 생성.

---

## 5. 진출자 검증 강화

### 5.1 진출자 취합(POST qualified-participants) 시

- `computeAllZoneQualifiers` 결과 **총 2명 미만** → 400 "권역 예선이 아직 완료되지 않았습니다. 진출 가능 인원이 2명 이상 필요합니다."
- **동일 entryId 중복** (같은 참가자가 여러 권역에서 중복 진출) → 400 "진출자 데이터가 유효하지 않습니다. (중복 참가자)"

### 5.2 본선 생성(POST final-bracket/generate) 시

- 저장된 진출자 **2명 미만** → 400 "본선 참가자 수가 부족합니다. …"
- 진출자 목록 내 **entryId 중복** → 400 "진출자 데이터가 유효하지 않습니다. (중복 참가자)"

---

## 6. 진출자 재취합 정책

- **진출자 취합(POST qualified-participants)** 은 **FINAL_READY 미만**에서만 허용.
  - 즉, `SETUP`, `QUALIFIER_RUNNING`, `QUALIFIER_COMPLETED`에서만 가능.
- **FINAL_READY, FINAL_RUNNING, COMPLETED**에서는 409 "본선 준비가 완료된 후에는 진출자 재취합을 할 수 없습니다."
- 본선 준비가 끝나면 예선 결과 → 본선 구조는 **고정**됩니다.

---

## 7. 결과 입력 검증 강화

### 7.1 권역 경기 PATCH (tournament-zones/…/matches/[matchId])

- **이미 COMPLETED**인 경기의 `scoreA`, `scoreB`, `winnerEntryId` 수정 → 409 "이미 완료된 경기는 수정할 수 없습니다."
- **winnerEntryId**가 해당 경기의 **entryIdA 또는 entryIdB**가 아니면 → 400 "승자는 해당 경기의 A 또는 B 참가자 중 한 명이어야 합니다."
- **scoreA, scoreB**가 음수이면 → 400 "점수는 0 이상이어야 합니다."
- **entryIdA 또는 entryIdB가 없는** 경기(BYE 등)에 결과 입력 → 400 "참가자가 없는 슬롯의 경기 결과를 입력할 수 없습니다."
- 그 외, 잠금 정책에 따라 FINAL_READY 이상이면 409 (권역 결과 수정 금지).

### 7.2 본선 경기 PATCH (final-matches/[matchId])

- 위와 동일: 완료 경기 수정 금지, winner는 A/B 중 하나, 점수 0 이상, 참가자 없는 슬롯 결과 입력 금지.

### 7.3 상태 전환

- 경기 상태는 **PENDING → IN_PROGRESS → COMPLETED** 흐름을 따르며, 승자 확정 시 다음 경기 슬롯에 반영됩니다.

---

## 8. 관리자 운영 도구 (플랫폼 관리자 전용)

- **경로**: `/admin/tournaments/[id]/maintenance`
- **API**: **POST** `/api/admin/tournaments/[id]/maintenance`
  - **권한**: `session.role === "PLATFORM_ADMIN"` 만 허용. CLIENT_ADMIN은 403.

### 8.1 제공 기능

| body.action | 설명 |
|-------------|------|
| reset_zone_results | 모든 권역의 TournamentZoneMatch 삭제, tournamentStage → SETUP |
| reset_qualifiers | TournamentFinalQualifier 삭제, 필요 시 stage를 QUALIFIER_COMPLETED 등으로 조정 |
| reset_final_bracket | TournamentFinalMatch 삭제, tournamentStage → FINAL_READY |
| set_stage | body.tournamentStage 로 진행 상태 강제 변경 (SETUP | QUALIFIER_RUNNING | … | COMPLETED) |

- 데이터 복구 불가하므로 신중히 사용해야 합니다.

---

## 9. 사용자 안내 메시지 및 UI 상태 표시

### 9.1 CLIENT_ADMIN 화면 메시지

- **권역 예선 진행 중** (QUALIFIER_RUNNING) → "권역 예선이 진행 중입니다."
- **권역 예선 완료** (QUALIFIER_COMPLETED) → "권역 결과가 완료되었습니다. 본선 진출자를 취합하세요."
- **본선 준비** (FINAL_READY) → "본선 준비가 완료되었습니다. 본선 대진표를 생성하세요."
- **본선 진행 중** (FINAL_RUNNING) → "본선 경기가 진행 중입니다."
- **대회 종료** (COMPLETED) → "대회가 종료되었습니다."

### 9.2 대회 상태 배지

- **경로**: `/client/tournaments/[id]` 상단
- **표시**: 진행 상태(tournamentStage)에 따른 **색상 배지** + 위 메시지 중 해당 문구.
- 배지 라벨: SETUP → "설정", QUALIFIER_RUNNING → "권역 예선 진행 중", QUALIFIER_COMPLETED → "권역 예선 완료", FINAL_READY → "본선 준비", FINAL_RUNNING → "본선 진행 중", COMPLETED → "종료".

---

## 10. 구현 체크리스트

- [x] Tournament.tournamentStage 필드 추가 및 마이그레이션
- [x] 권역 예선 잠금 정책 적용 (FINAL_READY 이상 시 API 409)
- [x] 본선 중복 생성 방지 (기본 생성 불가, PLATFORM_ADMIN만 forceRegenerate)
- [x] 진출자 검증 강화 (취합/본선 생성 시 인원·중복 검증)
- [x] 진출자 재취합 정책 (FINAL_READY 이상에서 재취합 금지)
- [x] 결과 입력 검증 (완료 경기 수정 금지, winner/점수/빈 슬롯 검증)
- [x] 관리자 유지보수 페이지 및 API (PLATFORM_ADMIN 전용)
- [x] 대회 상태 UI 표시 (배지 + 메시지)
- [x] 문서 작성 (본 파일)

---

## 11. 관련 파일

- `prisma/schema.prisma` — Tournament.tournamentStage
- `lib/tournament-stage.ts` — isQualifierLocked, isCollectAllowed, STAGE_LABELS 등
- `app/api/admin/tournaments/[id]/maintenance/route.ts` — 유지보수 API
- `app/admin/tournaments/[id]/maintenance/page.tsx` — 유지보수 페이지
- 각 잠금/검증이 적용된 API 라우트 (tournament-zones, zone-assignments, qualified-participants, final-bracket, final-matches, zone matches)
