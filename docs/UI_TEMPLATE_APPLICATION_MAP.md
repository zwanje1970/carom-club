# UI 템플릿 컴포넌트 단위 적용 가이드

다운받은 UI 템플릿을 **전체 교체가 아닌 컴포넌트 단위**로 적용하기 위한 파일·역할 정리입니다.  
먼저 **공통 컴포넌트**를 만든 뒤, 아래 목록에 따라 각 페이지/컴포넌트에서 해당 공통 컴포넌트를 사용하도록 바꾸면 됩니다.

---

## 1. 권장 구조: 공통 UI 컴포넌트 먼저 만들기

템플릿 스타일을 한 곳에서 관리하려면 아래 공통 컴포넌트를 만드는 것을 권장합니다.

| 컴포넌트 | 경로 (권장) | 역할 |
|----------|-------------|------|
| **Card** | `components/ui/Card.tsx` | 카드 레이아웃 (제목/내용/패딩/그림자) |
| **Button** | `components/ui/Button.tsx` | primary / secondary / outline / ghost 등 |
| **Header** | `components/ui/Header.tsx` 또는 `components/layout/Header.tsx` | 사이트/관리자 공통 헤더 (로고, 네비, CTA) |
| **List / Table** | `components/ui/List.tsx`, `components/ui/Table.tsx` | 리스트·테이블 래퍼 (목록/설정 메뉴/참가자 목록 등) |
| **Form** | `components/ui/FormField.tsx`, `Input.tsx`, `Label.tsx` 등 | input/select/label/에러 메시지 공통 스타일 |

템플릿에서 추출한 스타일을 위 컴포넌트에 반영한 뒤, 아래 파일들에서 **기존 인라인 스타일 → 공통 컴포넌트 사용**으로만 바꾸면 됩니다.

---

## 2. 카드 UI (Card) — 적용 대상 파일

카드 형태(흰 배경, 테두리, 둥근 모서리, 그림자)를 쓰는 곳입니다.  
→ **공통 `Card` 컴포넌트**를 만든 뒤, 아래에서 해당 래퍼를 `<Card>` 등으로 교체합니다.

### app (페이지)

| 파일 | 위치·용도 | 적용 시 교체할 부분 |
|------|-----------|---------------------|
| `app/page.tsx` | 홈 링크 카드 3개 (대회/커뮤니티/마이페이지) | `className="group rounded-xl border border-site-border bg-site-card p-6 shadow-sm ..."` 래퍼 → `<Card>` |
| `app/page.tsx` | 푸터 영역 | `footer` 내부 스타일 유지 또는 `<Card>` 계열 사용 |
| `app/tournaments/page.tsx` | 대회 목록 카드 (각 대회 한 개씩) | `className="block rounded-xl border border-site-border bg-site-card p-6 shadow-sm ..."` → `<Card>` |
| `app/tournaments/page.tsx` | 빈 목록 안내 카드 | `className="mt-12 rounded-xl border border-site-border bg-site-card p-12 ..."` → `<Card>` |
| `app/login/page.tsx` | 로그인 폼 컨테이너 | `div` (max-w-md, bg-site-card, rounded-lg, shadow, border) → `<Card>` |
| `app/signup/page.tsx` | 회원가입 폼 컨테이너 | 위와 동일 → `<Card>` |
| `app/mypage/page.tsx` | 마이페이지 메인 컨테이너 | `div.bg-site-card.rounded-lg.shadow.border...` → `<Card>` |
| `app/community/page.tsx` | (헤더만 있음) | 카드 사용 구역 추가 시 `<Card>` 사용 |
| `app/admin/login/page.tsx` | 로그인 박스 | `div.rounded-xl.border.bg-site-card.p-8` → `<Card>` |
| `app/admin/settings/page.tsx` | 설정 메뉴 **각 항목** | `Link`의 `className="... rounded-lg border border-site-border bg-site-card px-4 py-3 ..."` → `<Card>` 또는 리스트 아이템용 카드 |
| `app/admin/settings/site/page.tsx` | (폼 전체는 카드 형태 아님) | 섹션별 카드로 감쌀 경우 `<Card>` |
| `app/admin/settings/notifications/page.tsx` | 알림 옵션 카드 | `div.space-y-4.rounded-lg.border.bg-site-card.p-4` → `<Card>` |
| `app/admin/settings/integration/page.tsx` | 연동 설정 섹션 | `section.rounded-lg.border.bg-site-card.p-5` → `<Card>` |

### components

| 파일 | 위치·용도 | 적용 시 교체할 부분 |
|------|-----------|---------------------|
| `components/admin/AdminSidebar.tsx` | 사이드바 전체 | 필요 시 카드형 스타일을 `<Card>`로 통일 (선택) |
| `components/admin/ParticipantsTable.tsx` | 테이블 래퍼 | `div.bg-white.rounded-lg.shadow.overflow-hidden` → `<Card>` 또는 테이블 전용 래퍼 |
| `components/admin/TournamentNewForm.tsx` | 폼 래퍼 | `div.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/tournament/TournamentEditForm.tsx` | 섹션 카드 | `section.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/tournament/PrizeSettingsSection.tsx` | 상금 설정 섹션 | `section.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/tournament/FinanceSummaryBox.tsx` | 재무 요약 박스 | `section.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/tournament/BracketSettingsSection.tsx` | 대진 설정 섹션 | `section.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/tournament/EntrySettingsSection.tsx` | 참가 설정 섹션 | `section.bg-white.rounded-lg.shadow.p-6` → `<Card>` |
| `components/admin/PromoEditor.tsx` | 미리보기 모달 내용 | `div.bg-white.rounded-lg.shadow-xl...` → `<Card>` 계열 |
| `components/admin/OutlineEditor.tsx` | 미리보기 모달 내용 | 위와 동일 |
| `components/tournament/TournamentDetailTabs.tsx` | 탭별 콘텐츠 영역 (여러 개) | `div.bg-white.rounded-lg.shadow.p-6` → `<Card>` |

---

## 3. 버튼 스타일 (Button) — 적용 대상 파일

주요 액션(제출, 이동, 발행 등)은 모두 **공통 `Button`** 으로 통일할 수 있습니다.

### app

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `app/page.tsx` | 회원가입 링크(CTA) | `Link` with `className="... bg-site-primary ..."` → `<Button as={Link}>` 또는 `<Link><Button>회원가입</Button></Link>` |
| `app/tournaments/page.tsx` | 회원가입 버튼 | 동일 |
| `app/community/page.tsx` | 회원가입 버튼 | 동일 |
| `app/login/page.tsx` | 로그인 제출 버튼 | `button` → `<Button type="submit">` |
| `app/login/page.tsx` | 회원가입 링크 | 스타일만 버튼 컴포넌트로 통일 가능 |
| `app/signup/page.tsx` | 가입하기 버튼 | `button` → `<Button type="submit">` |
| `app/signup/page.tsx` | 로그인 링크 | 링크 스타일 통일 |
| `app/admin/login/page.tsx` | 로그인 버튼 | `button` → `<Button type="submit">` |
| `app/admin/layout.tsx` | 관리자 로그인 링크 (2곳) | `Link` → `<Button as={Link}>` |
| `app/admin/venues/page.tsx` | 당구장 등록 버튼 | `Link` with primary 스타일 → `<Button>` |
| `app/admin/venues/page.tsx` | 당구장 이름 링크 | 텍스트 링크 유지 또는 버튼 variant |
| `app/admin/venues/new/page.tsx` | 저장 / 취소 버튼 | `button` / `Link` → `<Button>` |
| `app/admin/settings/site/page.tsx` | 저장 / 취소 | 동일 |
| `app/admin/settings/notifications/page.tsx` | 저장 / 취소 | 동일 |
| `app/admin/settings/integration/page.tsx` | 저장 버튼 | 동일 |
| `app/admin/tournaments/page.tsx` | 대회 생성 버튼, 대회명 링크 | primary 버튼 → `<Button>` |

### components

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `components/SiteHeroContent.tsx` | 대회 보기 / 회원가입 | `Link` 2개 → `<Button>` 또는 `<Button as={Link}>` |
| `components/admin/AdminTopBar.tsx` | 로그아웃 버튼 | `button` → `<Button variant="ghost">` 등 |
| `components/admin/PromoEditor.tsx` | 발행 버튼 | primary 버튼 → `<Button>` |
| `components/admin/OutlineEditor.tsx` | 발행 버튼 | 동일 |
| `components/admin/TournamentNewForm.tsx` | 생성 버튼 | 동일 |
| `components/admin/tournament/TournamentEditForm.tsx` | 저장 버튼 | 동일 |
| `components/admin/AdminMeForm.tsx` | 저장 버튼 | 동일 |
| `components/admin/ParticipantsTable.tsx` | 상세/취소 등 링크 | 링크 스타일을 버튼 variant로 통일 가능 |
| `components/admin/BracketGenerateButton.tsx` | 대진표 생성 버튼 | 기존 버튼 → `<Button>` |
| `components/tournament/TournamentDetailTabs.tsx` | 탭 버튼들 | `button` → `<Button variant="tab">` 등 (템플릿에 탭 스타일이 있으면) |
| `components/tournament/TournamentDetailTabs.tsx` | 참가신청 / 로그인 등 링크 | CTA → `<Button>` |
| `components/tournament/TournamentApplyForm.tsx` | 신청하기 / 로그인 링크 | 동일 |
| `components/tournament/CancelEntryButton.tsx` | 참가 취소 | 기존 버튼 → `<Button>` |
| `components/RichEditor.tsx` | 툴바 버튼, 표 삽입, 이미지 삽입 등 | 공통 버튼 스타일 적용 시 `Button` 사용 (선택) |
| `components/AdminFloatButton.tsx` | 관리자 플로팅 버튼 | 한 개뿐이면 유지 또는 `<Button>` |

---

## 4. 헤더 (Header) — 적용 대상 파일

헤더는 **공통 `Header` 컴포넌트** 하나로 두고, 사이트/대회/관리자별로 props만 다르게 주면 됩니다.

| 파일 | 역할 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `app/page.tsx` | 홈 헤더 (로고, 대회/커뮤니티/로그인/회원가입) | `<header className="sticky top-0 z-20 border-b ...">` 전체 → `<Header variant="main" />` 등 |
| `app/tournaments/page.tsx` | 대회 목록 헤더 (동일 네비) | `<header className="border-b ...">` → `<Header variant="main" />` |
| `app/community/page.tsx` | 커뮤니티 헤더 | 동일 |
| `app/tournaments/[id]/page.tsx` | (헤더가 레이아웃/다른 컴포넌트에 있을 수 있음) | 있다면 동일하게 `<Header>` |
| `components/admin/AdminTopBar.tsx` | 관리자 상단바 (관리자, 로그아웃) | `<header className="h-14 bg-white ...">` → `<Header variant="admin" />` 또는 레이아웃에서 사용 |
| `components/admin/AdminSidebar.tsx` | 관리자 **사이드** 메뉴 (헤더 아님) | 리스트/네비 컴포넌트로 분리 시 여기서 사용 |

헤더 안에 들어가는 **로고·네비·CTA**는 템플릿 헤더 구조에 맞춰 `Header` 내부에서 `LogoLink`, `nav`, `Button` 등을 조합하면 됩니다.

---

## 5. 리스트 (List / Table) — 적용 대상 파일

목록·테이블 UI를 **List / Table** 컴포넌트로 통일할 수 있습니다.

### 테이블 (테이블 형태)

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `app/admin/tournaments/page.tsx` | 대회 목록 테이블 | `<table className="min-w-full divide-y divide-gray-200">` 및 thead/tbody → `<Table>` + `<TableHead>`/`<TableBody>`/`<TableRow>` |
| `app/admin/venues/page.tsx` | 당구장 목록 테이블 | 동일 |
| `components/admin/ParticipantsTable.tsx` | 참가자 목록 테이블 | 테이블 전체 → `<Table>` 계열 |
| `components/tournament/TournamentDetailTabs.tsx` | 참가확정/대기 목록 테이블 | `table.min-w-full.divide-y` → `<Table>` |

### 리스트 (카드/링크 목록)

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `app/admin/settings/page.tsx` | 설정 메뉴 목록 (사이트/알림/연동) | `<ul className="space-y-2">` + 각 `Link` → `<List>` + `<ListItem>` 또는 카드 리스트 컴포넌트 |

템플릿에 **카드 리스트**(썸네일+제목+설명)가 있으면 홈 링크 카드·설정 메뉴에 그 스타일을 적용할 수 있습니다.

---

## 6. 폼 (Form / Input / Label) — 적용 대상 파일

폼은 **FormField + Input + Label + Select** 등으로 공통화한 뒤, 아래 페이지/컴포넌트에서 인라인 스타일을 교체합니다.

### app (페이지 폼)

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `app/login/page.tsx` | 닉네임, 비밀번호 input + label | `label` + `input` 조합 → `<FormField><Label /><Input /></FormField>` |
| `app/signup/page.tsx` | 이름, 닉네임, 연락처, 비밀번호, 핸디, AVG 등 | 동일 |
| `app/admin/login/page.tsx` | 아이디, 비밀번호 | 동일 |
| `app/admin/settings/site/page.tsx` | 사이트 이름, 설명, 로고, primary/secondary 색상 | input/color 전부 → `<FormField>` + `<Input>` 등 |
| `app/admin/settings/notifications/page.tsx` | 체크박스들 + 저장/취소 | checkbox 그룹 → 폼 컴포넌트, 버튼 → `<Button>` |
| `app/admin/settings/integration/page.tsx` | API 키 등 input | 동일 |
| `app/admin/venues/new/page.tsx` | 당구장 이름, 타입, 주소 등 | 동일 |

### components (폼 컴포넌트)

| 파일 | 용도 | 적용 시 교체할 부분 |
|------|------|---------------------|
| `components/admin/TournamentNewForm.tsx` | 대회 생성 폼 (이름, slug, 일시 등) | 각 필드 → `<FormField>` + `<Input>` / `<Select>` |
| `components/admin/tournament/TournamentEditForm.tsx` | 대회 수정 폼 전체 | 동일 |
| `components/admin/AdminMeForm.tsx` | 비밀번호 변경 등 | 동일 |
| `components/admin/tournament/BracketSettingsSection.tsx` | input/select | 폼 필드 공통화 |
| `components/admin/tournament/EntrySettingsSection.tsx` | 참가 조건 등 | 동일 |
| `components/admin/tournament/PrizeSettingsSection.tsx` | 상금 관련 input | 동일 |
| `components/admin/tournament/PrizeScoreForm.tsx` | 상금 점수 폼 | 동일 |
| `components/admin/tournament/PrizeRatioForm.tsx` | 비율 입력 | 동일 |
| `components/admin/tournament/PrizeFixedForm.tsx` | 고정 상금 입력 | 동일 |
| `components/admin/tournament/TournamentDetailFormatSection.tsx` | 포맷 선택 등 | 동일 |
| `components/tournament/TournamentApplyForm.tsx` | 참가신청 폼 (입력/동의 등) | 동일 |
| `components/AvgProofUpload.tsx` | 파일 업로드 input | `<Input type="file">` 또는 업로드 전용 컴포넌트 |

에디터(RichEditor) 내부의 input/select(글꼴, 색 등)는 **선택 사항**으로, 템플릿에 에디터 스타일이 있으면 그때 적용하면 됩니다.

---

## 7. 적용 순서 제안

1. **공통 컴포넌트 생성**  
   `components/ui/` 에 Card, Button, Header, Table/List, FormField/Input/Label 등을 만들고, 다운받은 템플릿의 스타일을 여기에 반영합니다.
2. **Card**  
   위 “2. 카드 UI” 표 순서대로 페이지·컴포넌트에서 카드 래퍼를 `<Card>`로 교체합니다.
3. **Button**  
   “3. 버튼 스타일” 표 순서대로 CTA·제출·취소 등을 `<Button>`으로 교체합니다.
4. **Header**  
   “4. 헤더” 대로 홈/대회/커뮤니티/관리자 헤더를 `<Header>`로 교체합니다.
5. **List / Table**  
   “5. 리스트” 대로 테이블·설정 메뉴를 `<Table>` / `<List>` 로 교체합니다.
6. **Form**  
   “6. 폼” 대로 각 페이지·컴포넌트의 input/label/select를 `<FormField>` + `<Input>` 등으로 교체합니다.

이렇게 하면 **전체를 한 번에 갈아끼우지 않고**, 컴포넌트 단위로만 템플릿을 적용할 수 있습니다.  
다운받은 템플릿의 HTML/CSS 구조를 알려주시면, 위 공통 컴포넌트의 구체적인 props/스타일 예시까지 맞춰 드릴 수 있습니다.
