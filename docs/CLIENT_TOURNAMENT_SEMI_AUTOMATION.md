# 클라이언트 대회 운영 반자동화 설계

> 목표: **초안 자동 생성 + 관리자 승인** 구조로 운영 부담을 줄이되, 예외는 수동 개입 가능하게 한다.

---

## 1. 자동화된 단계 (시스템이 처리)

| 구간 | 현재 구현 | 비고 |
|------|-----------|------|
| 참가 승인 후 목록 반영 | API로 `TournamentEntry` 갱신, 클라이언트 패널에서 목록 재조회 | 부/권역·시드·중복 검사는 **부분** (명단 스냅샷·확정자 검증은 `lib/tournament-participant-roster.ts` 등) |
| 명단 확정 시 스냅샷 저장 | `participantRosterLockedAt` + `participantRosterSnapshot` | 대진 생성 시 확정자 일치 검증 |
| 대진(본선) 생성 | `TournamentFinalMatch` 생성, `BRACKET_GENERATED` 등 | 관리자/클라이언트 API 경로 존재 |
| 결과 입력 후 브래킷 연동 | 본선 매치 PATCH·동기화 로직 (`sync-progress` 등) | 다음 라운드 슬롯 연결은 모델·API에 일부 반영 |

---

## 2. 관리자 확인이 필요한 단계 (정책)

| 단계 | 의도 | 현재 상태 | 향후 |
|------|------|-----------|------|
| 참가 승인 | 입금·정원·대기 규칙 판단 | 수동 승인 + 일괄 처리 UI | 규칙 엔진·자동 승인 옵션 |
| 명단 확정 | 스냅샷 고정 전 최종 검토 | 확정 시 확인 모달 + 잠금 | 검사 리포트(중복·누락) 강화 |
| 대진 **초안** | 자동 배치 후 검토 | **미구현** — 생성 시 곧바로 본선 매치 반영 | `draft` 상태 테이블 또는 JSON 초안 + `publish` API |
| 대진 **확정** | 초안 승인 후 운영 반영 | 사실상 생성과 동시 확정 | `approveBracketDraft` → `BRACKET_GENERATED` / 매치 활성 |
| 경기 진행 | 테이블·지연·미입력 알림 | 브래킷 편집·필터 수준 | 운영 대시보드(현재 경기·대기 테이블) |
| 결과·정산 | 정산 데이터 누적 | `TournamentSettlement` 등 별도 흐름 | 결과 입력 시 자동 누적 규칙 명문화 |

---

## 3. 초안 저장 구조 (권장 방향)

현재는 **본선 매치가 생성 즉시 “운영 정본”**이 되는 패턴에 가깝다. 반자동화를 완성하려면 다음 중 하나를 도입한다.

### 옵션 A — DB 플래그 (최소)

- `TournamentBracketDraft` 또는 `Tournament.bracketDraftStatus`: `NONE | DRAFT | PUBLISHED`
- 초안 생성: `TournamentFinalMatch`를 `isDraft=true` 또는 별도 테이블에 저장
- 확정: 트랜잭션으로 `PUBLISHED`, `status=BRACKET_GENERATED`, 운영 알림

### 옵션 B — JSON 스냅샷

- 초안만 `bracketDraftJson`에 저장, 확정 시 관계형 `TournamentFinalMatch`로 materialize

### 옵션 C — 버전

- `bracketVersion` + 이전 버전 보관으로 롤백 가능

**권장**: 옵션 A + 기존 `TournamentFinalMatch`와의 역할 분리를 명확히 문서화.

---

## 4. 예외 처리 방식

- **명단/대진 불일치**: 기존 `validateConfirmedEntriesMatchRosterSnapshot` 패턴 유지
- **수동 수정**: 브래킷 편집 UI(매치·배정·시간) — 확정 후에는 **제한 모드** 또는 플랫폼 관리자만 `forceRegenerate`
- **경기 지연·미입력**: 매치 `status`, `scheduledStartAt` 기준 알림(푸시·콘솔 배지) — 단계적 구현

---

## 5. UI: 운영 단계 표시

- 코드: `OperationsTournamentPhaseStepper`, `lib/client-tournament-operation-phase.ts`
- 단계: **참가자 관리 → 명단 확정 → 대진 생성 → 경기 진행 → 결과 확정**
- 각 운영 화면 상단에 동일 표시(현재 화면 강조, 이정표 완료 시 `done` 스타일)
- 스냅샷: `status`, `participantRosterLockedAt`, `finalMatchCount` 기준(현재 스키마)
- **안내 문구**: 대진 초안·검토·확정 구조는 **향후 확장**이며, 현재는 생성 시 본선에 반영됨을 명시

---

## 6. 완료 보고 (요약)

| 항목 | 내용 |
|------|------|
| 자동화된 단계 | 참가 데이터 반영, 명단 스냅샷, 대진 생성 API, 결과·진행 동기화 일부 |
| 관리자 확인 단계 | 명단 확정, 대진 생성(향후 초안→확정), 경기 운영 판단, 정산 확정 |
| 초안 저장 구조 | **설계만** — DB 스키마/API 추가 필요 |
| 예외 처리 | 스냅샷 검증, 편집 UI, 플랫폼 강제 재생성 |
| 후속 개선 | ① 대진 draft/publish ② 명단 확정 검사 리포트 ③ 운영용 “현재 경기” 보드 ④ 결과→정산 자동 누적 ⑤ 중복·대기·환불 후보 분리 표시 강화 |

---

## 7. 관련 파일

- `lib/client-tournament-operation-phase.ts` — 단계 스냅샷·스텝 UI 데이터
- `components/client/console/OperationsTournamentPhaseStepper.tsx`
- `lib/tournament-participant-roster.ts` — 명단 스냅샷·잠금
- `app/api/admin/tournaments/[id]/bracket/generate/route.ts` 등 대진 생성 API
