# Admin One - 남은 admin 페이지 적용 결과

## 1. 어떤 페이지를 바꿨는지

| 우선순위 | 경로 | 변경 요약 |
|----------|------|------------|
| 1 | `/admin/login` | CardBox, FormField(아이디/비밀번호), Button(로그인), NotificationBar(에러), 링크 스타일 통일 |
| 2 | `/admin/me` | SectionMain, SectionTitleLineWithButton(mdiAccountCircle), CardBox×4(기본정보/소속조직/비밀번호변경/알림설정) |
| 3 | `/admin/tournaments/[id]` | SectionMain, SectionTitleLineWithButton(대회명), Buttons(목록/설정수정/대회요강/참가자관리), CardBox(dl), PillTag(상태), BracketGenerateButton 유지 |
| 4 | `/admin/tournaments/[id]/edit` | SectionMain, SectionTitleLineWithButton, Button(←대회상세), CardBox(TournamentEditForm), DB 없을 때 안내 CardBox |
| 5 | `/admin/tournaments/[id]/participants` | SectionMain, SectionTitleLineWithButton(mdiAccountGroup), Button(←대회상세), CardBox hasTable, ParticipantsTable |
| 6 | `/admin/venues/[id]/promo` | SectionMain, SectionTitleLineWithButton(mdiOfficeBuilding), Button(←당구장목록), CardBox(PromoEditor) |
| 7 | `/admin/tournaments/[id]/outline` | SectionMain, SectionTitleLineWithButton(mdiTrophy), Button(←대회상세), CardBox(OutlineEditor) |
| 8 | `/admin/brackets` | SectionMain, SectionTitleLineWithButton(mdiTable), CardBox(안내 문구) |

**공통 컴포넌트 적용**
- **AdminMeForm**  
  FormField(현재/새/확인 비밀번호), Button(비밀번호 변경), NotificationBar(성공/에러)
- **TournamentEditForm**  
  NotificationBar(에러), Buttons+Button(저장/취소), 기본정보 섹션 border 스타일
- **ParticipantsTable**  
  외부 카드 제거 → 페이지에서 CardBox hasTable로 감쌈. PillTag(상태), Button(입금확인/불참/출석/결석), 테이블 dark: 클래스

---

## 2. 어떤 컴포넌트를 적용했는지

- **Section:** SectionMain, SectionTitleLineWithButton (아이콘: mdiAccountCircle, mdiTrophy, mdiAccountGroup, mdiOfficeBuilding, mdiTable)
- **CardBox:** 기본, hasTable(참가자 테이블)
- **Button:** href(목록/대회상세/당구장목록), type="submit", label, color(info, contrast, success, danger), outline, small, onClick
- **Buttons:** 버튼 그룹(목록+설정수정+대회요강+참가자관리, 저장+취소)
- **FormField:** 로그인(아이디/비밀번호), 본인정보(비밀번호 변경 3개 필드)
- **PillTag:** 대회 상세 상태, 참가자 테이블 상태(신청/입금대기/참가확정/대기/취소/불참)
- **NotificationBar:** 로그인 에러, 본인정보 비밀번호 성공/에러, 대회 수정 에러

---

## 3. 아직 임시 처리나 추가 개선이 필요한 부분

### 3.1 로그인 (`/admin/login`)
- AdminLayout 밖의 독립 페이지라 SectionMain 미사용. CardBox+Form만 적용.
- 다크 모드 대응은 CardBox/FormField/배경 클래스로 처리됨.

### 3.2 본인 정보 (`/admin/me`)
- AdminMeForm 내부는 FormField/Button/NotificationBar로 통일됨.
- “알림 설정” 카드는 추후 제공 예정 문구만 있음.

### 3.3 대회 상세 (`/admin/tournaments/[id]`)
- BracketGenerateButton은 기존 컴포넌트 유지(동작만 사용). 필요 시 Admin One Button으로 교체 가능.

### 3.4 대회 설정 수정 (`/admin/tournaments/[id]/edit`)
- TournamentEditForm 내부의 **EntrySettingsSection, BracketSettingsSection, PrizeSettingsSection, FinanceSummaryBox**는 기존 마크업 유지.
- 기본정보 섹션만 border 스타일 조정. 나머지 섹션은 추후 FormField/CardBox로 단계 적용 가능.

### 3.5 참가자 관리 (`/admin/tournaments/[id]/participants`)
- ParticipantsTable: API 실패 시 `alert()` 사용. 추후 NotificationBar 또는 토스트로 교체 권장.

### 3.6 당구장 홍보/대회요강 (`/admin/venues/[id]/promo`, `/admin/tournaments/[id]/outline`)
- PromoEditor, OutlineEditor 내부(리치 에디터 등)는 미변경. 페이지 래퍼만 Section+CardBox 적용.

### 3.7 대진표 (`/admin/brackets`)
- 안내 문구만 있는 카드 페이지. 실제 대진표 목록/기능은 없음.

---

## 4. 기존 기능 유지

- **DB/API/라우팅:** 변경 없음.
- **로그인:** POST /api/auth/login, 리다이렉트 동일.
- **본인 정보:** prisma 조회, 비밀번호 PATCH /api/admin/me/password 동일.
- **대회 상세/수정/참가자:** prisma·mock, PATCH/POST API 동일.
- **당구장 홍보/대회요강:** prisma·mock, 편집기 API 동일.

---

## 5. 빌드

- `npx next build` 통과 (SESSION_SECRET 설정 후).
