# Admin One 본문 페이지 적용 결과

## 적용 순서 및 변경 요약

### 1. 관리자 대시보드
- **페이지:** `app/admin/page.tsx`
- **적용:** `SectionMain`, `SectionTitleLineWithButton`(아이콘: mdiViewDashboard), `CardBox`
- **내용:** 제목 + 안내 문구를 카드 한 장으로 정리. DB/API 없음.
- **기능:** 기존과 동일(문구만 표시).

---

### 2. 목록 페이지

| 페이지 | 경로 | 적용 컴포넌트 | 비고 |
|--------|------|----------------|------|
| 대회 목록 | `app/admin/tournaments/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiTrophy), CardBox(hasTable), Button(대회 생성), PillTag(상태) | 테이블·상태 배지 Admin One 스타일, 링크 색상 통일 |
| 당구장 목록 | `app/admin/venues/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiOfficeBuilding), CardBox(hasTable), Button(새 당구장 추가) | 테이블 스타일·다크모드 클래스 추가 |
| 참가자관리 | `app/admin/participants/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiAccountGroup), CardBox | 안내 문구만 있던 페이지를 카드로 정리 |
| 회원관리 | `app/admin/members/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiAccountMultiple), CardBox | 동일 |
| 문의관리 | `app/admin/inquiries/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiMessageQuestion), CardBox | 동일 |
| 설정 목록 | `app/admin/settings/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiCog), CardBox, 목록을 divide-y로 구분 | SETTINGS_MENU 링크 유지, 스타일만 통일 |

- **데이터/라우팅:** 대회·당구장은 기존처럼 `prisma` / `MOCK_*` 사용, 링크 경로 변경 없음.

---

### 3. 입력/수정 페이지

| 페이지 | 경로 | 적용 컴포넌트 | 비고 |
|--------|------|----------------|------|
| 대회 생성 | `app/admin/tournaments/new/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiTrophy), CardBox | 페이지 래퍼만 적용 |
| 대회 생성 폼 | `components/admin/TournamentNewForm.tsx` | NotificationBar(에러), Button(저장/취소), 외부 div 제거(max-w-xl만 유지) | API·폼 필드·검증 로직 그대로 |
| 새 당구장 추가 | `app/admin/venues/new/page.tsx` | SectionMain, SectionTitleLineWithButton, CardBox, FormField(당구장명/slug/설명), Buttons, Button(제출/취소), NotificationBar(에러) | 폼 전부 Admin One FormField·Button으로 교체 |
| 사이트 설정 | `app/admin/settings/site/page.tsx` | SectionMain, SectionTitleLineWithButton(mdiCog), CardBox, Button(← 설정/저장/취소), NotificationBar(에러) | 로딩 시에도 Section+CardBox, 저장/취소만 Button으로 |
| 알림 설정 | `app/admin/settings/notifications/page.tsx` | SectionMain, SectionTitleLineWithButton, CardBox, Button(← 설정/저장/취소), NotificationBar(에러) | 동일 |
| 연동 설정 | `app/admin/settings/integration/page.tsx` | SectionMain, SectionTitleLineWithButton, CardBox, PillTag(설정됨/미설정), Button(← 설정/저장), NotificationBar(에러) | 폼 필드/API 호출 그대로 |

- **기능:** 제출·취소·API 호출·유효성 검사 동일. 라우팅·DB 미변경.

---

### 4. 알림/안내 UI (NotificationBar)

- **적용 위치:**  
  - 대회 생성 폼(TournamentNewForm) 에러  
  - 당구장 추가 폼 에러  
  - 설정 > 사이트/알림/연동 폼 에러  
- **스타일:** `NotificationBar` `color="danger"` 사용, 기존 빨간 박스 문구를 배지형 알림으로 통일.

---

## 적용한 Admin One 컴포넌트 목록

- **Section:** `SectionMain`, `SectionTitleLineWithButton`
- **CardBox:** 기본·hasTable
- **Button:** href/타입/라벨/color(info, contrast), outline, small
- **Buttons:** 버튼 그룹
- **FormField:** label, labelFor, help, hasTextareaHeight, render prop으로 input/textarea/select 스타일
- **PillTag:** 상태 표시(success, contrast, info, light), small
- **NotificationBar:** color="danger" 에러 메시지

---

## 기존 기능 유지 여부

- **DB/API/라우팅:** 변경 없음.  
  - 대회·당구장 목록: 기존 `prisma`·mock 동일.  
  - 대회 생성/당구장 생성/설정 저장: 기존 API 그대로 호출.  
- **페이지 기능:**  
  - 목록 조회·필터·링크, 폼 제출·유효성 검사·리다이렉트, 설정 불러오기/저장 모두 동일하게 동작.

---

## 아직 손대지 않은 admin 페이지

- **`/admin/login`** – 로그인 전용, 레이아웃 분리되어 있음. (원하면 나중에 Admin One 폼/카드만 적용 가능)
- **`/admin/me`** – AdminMeForm 사용. (래퍼만 넣거나 폼을 FormField/Button으로 교체 가능)
- **`/admin/brackets`** – 대진표 관리. (목록/테이블 있으면 동일 패턴으로 적용 가능)
- **`/admin/tournaments/[id]`** – 대회 상세. (제목·카드·버튼만 넣을 수 있음)
- **`/admin/tournaments/[id]/edit`** – 대회 수정. (TournamentEditForm – FormField/Button 적용 가능)
- **`/admin/tournaments/[id]/outline`** – 대회 요강 편집. (OutlineEditor)
- **`/admin/tournaments/[id]/participants`** – 참가자 목록. (ParticipantsTable)
- **`/admin/venues/[id]/promo`** – 당구장 홍보 편집. (PromoEditor)

위 페이지들은 **라우팅·데이터·역할은 그대로** 두고, 필요 시 본문만 SectionMain/CardBox/FormField/Button/PillTag/NotificationBar로 단계 적용하면 됨.

---

## 빌드

- `SESSION_SECRET` 설정 후 `npx next build` **통과** (컴파일·린트·타입·페이지 생성 완료).
