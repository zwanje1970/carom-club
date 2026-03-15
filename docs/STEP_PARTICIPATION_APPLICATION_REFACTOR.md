# 참가 신청 리팩터 정리 (Participation Application Refactor)

## 1. 목표

참가 신청을 “단순 폼 제출”이 아니라 **대회 운영 엔진의 시작점**으로 연결하고, 현재 플랫폼 구조(권한, 대회 진행 상태, 권역, 공개 관람, 요금/등록 정책)와 맞게 정리했습니다.

**목표 흐름:**
공개 대회 페이지 → 참가 신청 → 신청 정보 입력 → 신청 완료 → CLIENT_ADMIN이 신청 확인/승인/관리 → 참가 확정 → 권역 배정·대진 운영으로 연결

---

## 2. 기존 기능 점검 결과

### 2.1 재사용한 부분

- **TournamentEntry 한 모델**: “신청”과 “참가 엔트리”를 하나의 엔트리로 관리. `status`로 구분.
  - **APPLIED**: 신청 대기 (관리자 승인 전)
  - **CONFIRMED**: 참가 확정 (승인 후, 권역 배정·대진 대상)
  - **REJECTED**: 반려
  - **CANCELED**: 취소(신청자) 또는 불참(관리자)
- **공개 참가 신청 API**: `POST /api/tournaments/apply` — 로그인 필수, `getPublicTournamentOrNull`로 비공개 대회 차단, OPEN만 허용.
- **CLIENT_ADMIN 참가자 관리**: `/client/tournaments/[id]/participants` — 자기 조직 대회만 조회 (`organizationId: orgId`). ParticipantsTable에서 승인/반려, 상태 필터, 이름 검색.
- **승인 API**: `POST .../participants/[entryId]/confirm` — `canManageTournament`로 본인 조직 대회만. 승인 시 CONFIRMED, 알림 발송.
- **반려 API**: `POST .../participants/[entryId]/reject` — 반려 사유 저장, 알림.
- **권역 배정·대진**: `TournamentEntryZoneAssignment`, 권역 대진 생성 시 `entry.status === "CONFIRMED"` 인 엔트리만 사용. **승인 후 참가자 연결은 이미 동작.**

### 2.2 수정·보강한 부분

- **비공개/종료/마감/준비 중 안내**
  - Apply API: `status === "DRAFT"` 시 "아직 참가 신청을 받지 않습니다." 반환.
  - 공개 페이지(탭): `applyClosedReason`으로 DRAFT/CLOSED/FINISHED/정원 마감 시 **한 문구로** 안내 (참가 신청 불가 이유 명확화).
- **공개 페이지에서 참가 신청 찾기**
  - 대회 안내(정보) 탭에서 **참가 신청 가능 시** “참가 신청을 받고 있습니다” + “참가 신청하기” 버튼 노출 → 클릭 시 참가신청 탭으로 이동.
- **신청 데이터**
  - `TournamentEntry`에 **clubOrAffiliation** (소속/클럽, 선택) 추가. 참가비·결제는 기존처럼 확장 가능하도록 유지.
  - Apply API: `clubOrAffiliation` 수신·저장.
  - 참가 신청 폼: 소속/클럽 입력 필드(선택) 추가.
- **CLIENT_ADMIN 신청 관리**
  - ParticipantsTable에 **연락처**(user.phone), **소속**(clubOrAffiliation) 컬럼 추가.
  - 기존: 이름, 핸디, AVG, 입금자명, 신청일, 상태, 반려 사유, 출석, 작업(승인/반려 등). → 연락처·소속으로 관리 편의 향상.

### 2.3 유지한 정책 (구조와 맞는 부분)

- **엔트리 중심**: 별도 Application 테이블 없이, TournamentEntry 한 건이 “신청 + 참가 엔트리” 역할. 신청 시 APPLIED, 승인 시 CONFIRMED.
- **참가 확정 = CONFIRMED**: 권역 배정·zone bracket 생성은 CONFIRMED 엔트리만 사용. “승인 후 참가자 연결”은 기존대로 동작.
- **CLIENT_ADMIN만 승인/반려**: `canManageTournament`로 자기 조직 대회만. PLATFORM_ADMIN은 조회만(실무 승인/반려는 CLIENT_ADMIN 담당).
- **요금/결제**: 참가비·결제 연동은 이번 작업 범위 외. depositorName·paidAt 등 필드는 유지해 두어 향후 결제·수동 부여 연동 시 사용 가능.

---

## 3. 신청 데이터와 참가 엔트리 연결 방식

- **신청**: 사용자가 “참가 신청” 제출 → `TournamentEntry` 생성, `status = "APPLIED"`.
- **저장 데이터**: userId, tournamentId, depositorName, clubOrAffiliation(선택), waitingListOrder(대기 시). 이름·연락처·핸디는 User/MemberProfile에서 조회.
- **승인**: CLIENT_ADMIN이 “참가확정” → 동일 엔트리의 `status = "CONFIRMED"`, reviewedAt·paidAt 설정, 알림.
- **참가자로 사용**: CONFIRMED 엔트리만 참가자 목록·권역 배정·권역 대진 생성에 사용. 이후 권역 예선·본선 구조로 이어짐.

즉, **신청 상태(APPLIED)와 참가 확정 상태(CONFIRMED)는 같은 엔트리의 status로 구분**하며, 별도 “Application → Entry” 전환 단계는 두지 않음.

---

## 4. 공개 참가 신청 흐름

1. **진입**: 공개 대회 상세 `/tournaments/[id]` → “참가신청” 탭 또는 안내 탭의 “참가 신청하기” 버튼.
2. **조건**: 로그인 필수. 대회는 비공개(HIDDEN)가 아니어야 하며, `status === "OPEN"`, 정원/대기 정책에 따라 신청 가능.
3. **불가 시 안내**: DRAFT / CLOSED / FINISHED / 정원 마감(대기 미사용 시) → `applyClosedReason`으로 “아직 참가 신청을 받지 않습니다.”, “참가 신청이 마감되었습니다.” 등 한 문구 표시.
4. **폼**: 입금자명(필수), 소속/클럽(선택), 참가요건 동의. 제출 시 `POST /api/tournaments/apply`.
5. **완료**: “참가 신청이 접수되었습니다. 운영자 승인 후 참가가 확정됩니다.” (대기 등록 시 별도 문구).

---

## 5. CLIENT_ADMIN 신청 관리 흐름

1. **화면**: `/client/tournaments/[id]/participants` (자기 조직 대회만 노출).
2. **목록**: 해당 대회의 모든 TournamentEntry. 이름, 연락처, 핸디, AVG, 입금자명, 소속, 신청일, 상태, 반려 사유, 출석, 작업(참가확정/반려 등).
3. **필터**: 상태별(신청됨/참가확정/거절/취소), **이름 검색**.
4. **승인**: “참가확정” → CONFIRMED, 알림. 이후 참가자 관리·권역 배정에서 사용.
5. **반려**: “반려” + 사유(선택) → REJECTED, rejectionReason 저장, 알림.

---

## 6. 상태/권한 검증

- **공개 신청**
  - 비공개: `getPublicTournamentOrNull`로 HIDDEN 대회 404.
  - 종료: FINISHED → “종료된 대회에는 참가 신청할 수 없습니다.”
  - 마감: CLOSED → “참가 신청이 마감되었습니다.”
  - 준비 중: DRAFT → “아직 참가 신청을 받지 않습니다.”
  - 정원: maxEntries 초과 시 대기 미사용이면 “정원이 마감되었습니다.”
- **CLIENT_ADMIN**
  - 참가자 페이지·승인/반려 API 모두 `canManageTournament` 또는 tournament 조회 시 `organizationId: orgId`로 **자기 조직 대회만** 접근.

---

## 7. 구현 체크리스트

- [x] 공개 대회 페이지에서 참가 신청 진입 가능 (탭 + 안내 탭 CTA)
- [x] 신청 불가 상태에서 안내 문구 표시 (DRAFT/CLOSED/FINISHED/정원 마감)
- [x] 신청 데이터 정상 저장 (APPLIED, depositorName, clubOrAffiliation)
- [x] CLIENT_ADMIN이 자기 대회 신청만 조회·관리
- [x] 승인/반려 가능 (confirm/reject API + 테이블 버튼)
- [x] 승인 후 CONFIRMED → 참가자·권역 배정·대진과 연결
- [x] 권역 배정 단계에서 CONFIRMED 엔트리만 사용 가능
- [x] 문서 작성 (본 파일)

---

## 8. 남은 TODO

- **참가비 결제 연동**: depositorName·paidAt 활용한 유료 신청·수동 부여 확장.
- **이메일/문자 알림**: 승인·반려 시 선택적 발송 (현재는 알림만).
- **재신청**: REJECTED 후 재신청 허용 여부 및 정책 정리 후 적용 가능.
