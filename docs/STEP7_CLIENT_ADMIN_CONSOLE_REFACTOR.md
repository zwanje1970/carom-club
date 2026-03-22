# 7단계: CLIENT_ADMIN 대시보드 및 대회 운영 기능 이관/정리

작성일: 2025-03-11  
목적: 플랫폼관리자(/admin)에서 제거한 대회 실무 기능을 CLIENT_ADMIN 전용 콘솔(/client)에서 사용할 수 있도록 메뉴·라우트·화면 구조 정리.

---

## 1. /client에 정리한 메뉴

| 메뉴 | 경로 | 비고 |
|------|------|------|
| 대시보드 | /client/dashboard | 내 조직 대회 운영 현황, 빠른 작업, 최근 대회 |
| 내 대회 | /client/tournaments | 대회 목록(참가자 수, 수정일, 상세/수정/참가자/대진표/결과 링크) |
| 참가자 관리 | /client/participants | 대회별 참가자 관리 진입 목록 |
| 부/권역 설정 | /client/zones | 골격(추후 권역 설정) |
| 대진표 관리 | /client/brackets | 대회별 대진표 진입 목록 |
| 결과 관리 | /client/results | 대회별 결과 진입 목록 |
| 공동관리자 관리 | /client/co-admins | 골격(추후 공동관리자 배정) |
| 홍보/페이지 관리 | /client/promo | 기존 홍보 페이지 편집 |
| 조직 설정 | /client/setup | 기존 업체 설정 |

---

## 2. /admin에서 /client로 이관한 기능 목록

| 기능 | /admin 경로 | /client 경로 | 재사용 |
|------|-------------|--------------|--------|
| 대회 목록 | /admin/tournaments | /client/tournaments | 신규 목록(org 스코핑) |
| 대회 생성 | /admin/tournaments/new | /client/tournaments/new | 기존 클라이언트 폼 유지 |
| 대회 상세 | /admin/tournaments/[id] | /client/tournaments/[id] | 탭 구조로 재구성 |
| 대회 수정 | /admin/tournaments/[id]/edit | /client/tournaments/[id]/edit | 기존 클라이언트 편집 폼 |
| 대회요강 편집 | /admin/tournaments/[id]/outline | /client/tournaments/[id]/outline | OutlineEditor 재사용 |
| 참가자 관리 | /admin/tournaments/[id]/participants | /client/tournaments/[id]/participants | ParticipantsTable 재사용 |
| 대진표 생성 | /admin/tournaments/[id] (버튼) | /client/tournaments/[id]/bracket | BracketGenerateButton 재사용 |

- API는 기존 /api/admin/tournaments/* 사용(STEP5에서 CLIENT_ADMIN 권한 적용됨).
- 결과·공동관리자·부권역은 골격만 두고 추후 구현.

---

## 3. 재사용한 기존 페이지/컴포넌트

| 컴포넌트 | 용도 |
|----------|------|
| OutlineEditor | /client/tournaments/[id]/outline |
| ParticipantsTable | /client/tournaments/[id]/participants |
| BracketGenerateButton | /client/tournaments/[id]/bracket |
| CardBox (admin) | 클라이언트 outline/participants/bracket 레이아웃 |

- TournamentNewForm은 사용하지 않고, 기존 /client/tournaments/new의 자체 폼 유지(이미 /api/admin/tournaments POST 호출).

---

## 4. 아직 골격만 만든 메뉴 / 다음 단계 TODO

| 메뉴/경로 | 상태 | TODO |
|-----------|------|------|
| 부/권역 설정 | /client/zones, /client/tournaments/[id]/zones | 권역 마스터·대회별 권역 연결 후 UI 구현 |
| 결과 관리 | /client/results, /client/tournaments/[id]/results | 경기 결과 입력·진출자 확정 API/UI |
| 공동관리자 관리 | /client/co-admins, /client/tournaments/[id]/co-admins | ZONE_MANAGER 배정·공동관리자 CRUD |
| 홍보/페이지 | /client/tournaments/[id]/promo | 현재는 기본정보 수정 링크 + 미리보기. 전용 편집기 연결 가능 |

---

## 5. CLIENT_ADMIN 기준 주요 사용자 흐름

1. **로그인** → /client (또는 메인에서 클라이언트 대시보드 링크).
2. **대시보드** → 접수중/마감/종료 대회 수, 참가 승인 대기, 최근 대회, 빠른 작업(새 대회 만들기, 내 대회, 참가자, 부권역, 대진표).
3. **내 대회** → 목록에서 상세/수정/참가자/대진표/결과 이동.
4. **대회 상세** → 탭: 기본정보, 대회요강, 참가자, 부/권역, 대진표, 결과, 공동관리자, 홍보페이지.
5. **대회 생성** → /client/tournaments/new → 저장 후 해당 대회 상세로 이동.
6. **참가자 관리** → 대회별 참가자 탭 또는 /client/participants에서 대회 선택 후 참가자 관리.
7. **대진표** → 대회 상세 → 대진표 탭에서 생성 버튼. /client/brackets에서 대회별 진입 가능.
8. **조직 설정** → /client/setup. **홍보/페이지** → /client/promo(업체 홍보).

---

## 6. 조직 기준 접근 보장

- 모든 /client 대회 관련 페이지에서 `getClientAdminOrganizationId(session)`으로 orgId 조회.
- 대회 조회 시 `where: { id, organizationId: orgId }` 또는 `where: { organizationId: orgId }` 사용.
- 다른 조직 대회는 목록에 없고, 직접 URL 접근 시 notFound().
- API 권한은 STEP5에서 canManageTournament/canViewTournament로 이미 차단됨.

---

## 7. 변경/추가 파일 요약

- **components/client/console/ClientConsoleShell.tsx** — 사업자용 업무 콘솔 골격(좌측 사이드바·상단 헤더·메인).
- **app/client/layout.tsx** — ClientConsoleShell 사용, 메인 사이트 헤더/하단 네비와 분리(`/client`는 루트 래퍼에서 제외).
- **app/client/dashboard/page.tsx** — 내 조직 대회 현황(접수중/마감/종료/승인대기), 빠른 작업, 최근 대회.
- **app/client/tournaments/page.tsx** — 제목 "내 대회", 참가자 수·수정일·바로가기(상세/수정/참가자/대진표/결과).
- **app/client/tournaments/[id]/page.tsx** — 탭 네비(기본정보/대회요강/참가자/부권역/대진표/결과/공동관리자/홍보).
- **app/client/tournaments/[id]/outline/page.tsx** — OutlineEditor 재사용.
- **app/client/tournaments/[id]/participants/page.tsx** — ParticipantsTable 재사용.
- **app/client/tournaments/[id]/bracket/page.tsx** — BracketGenerateButton 재사용.
- **app/client/tournaments/[id]/results/page.tsx** — 골격.
- **app/client/tournaments/[id]/co-admins/page.tsx** — 골격.
- **app/client/tournaments/[id]/zones/page.tsx** — 골격.
- **app/client/tournaments/[id]/promo/page.tsx** — 홍보 미리보기 + 기본정보 수정 링크.
- **app/client/participants/page.tsx** — 대회별 참가자 관리 진입.
- **app/client/zones/page.tsx** — 부/권역 설정 골격.
- **app/client/brackets/page.tsx** — 대회별 대진표 진입.
- **app/client/results/page.tsx** — 대회별 결과 진입.
- **app/client/co-admins/page.tsx** — 공동관리자 골격.
