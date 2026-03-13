# /admin 상단 헤더 및 레이아웃 정리

## 1. /admin에서 실제로 보이는 상단 헤더 (2024 수정 반영)

**결론: 공용 사이트 헤더 + 관리자 NavBar 둘 다 보입니다.**

### DOM/코드 기준 확인

- **app/layout.tsx**: `MainSiteHeaderWrapper`와 `{children}`을 렌더합니다.
- **MainSiteHeaderWrapper** (`components/layout/MainSiteHeaderWrapper.tsx`):
  - `/client`일 때만 `return null`. **`/admin`에서는 공용 헤더를 렌더함.**
- **app/admin/layout.tsx**: 로그인 후 `AdminLayout`을 렌더하고, 그 안에서 **NavBar**를 렌더합니다.

따라서 /admin 페이지에서 DOM 순서는 **공용 사이트 헤더(64px) → 관리자 NavBar(64px) → 본문(padding-top: 128px)** 입니다.

| 구분 | 공용 사이트 헤더 | 관리자 NavBar |
|------|------------------|----------------|
| 컴포넌트 | MainSiteHeader (MainSiteHeaderWrapper) | NavBar (AdminLayout 내부) |
| /admin에서 렌더 여부 | **렌더됨** | **렌더됨** |
| 높이 | 64px | 64px |
| 위치 | 최상단 sticky | fixed top: 64px |

---

## 2. 원하시는 동작 (현재 화면 기준)

현재 화면에서 보이는 헤더는 **관리자 NavBar**뿐이므로, 원하시는 것은:

- **관리자 NavBar가 항상 화면 최상단에 고정**
- **본문은 NavBar 바로 아래(64px 이하)에서 시작**

공용 사이트 헤더를 관리자 페이지에서도 보이게 하라는 요청은 없었고, 코드상으로도 /admin에서는 공용 헤더를 숨기고 있으므로, 수정 방향은 **B. 관리자 NavBar만 대상**으로 합니다.

---

## 3. 공용 헤더 표시 (수정 후)

- **파일:** `components/layout/MainSiteHeaderWrapper.tsx`
- **동작:** `pathname.startsWith("/client")`일 때만 `return null`. `/admin`에서는 **공용 헤더(MainSiteHeader)를 렌더**합니다.

---

## 4. 수정한 헤더 및 본문 (공용 헤더 + 관리자 NavBar)

- **공용 헤더:** `components/layout/MainSiteHeader.tsx` — `h-16`, `style={{ height: "64px" }}` (64px 고정).
- **관리자 NavBar:** `components/admin/dashboard/_components/NavBar/index.tsx` — `fixed`, `style={{ top: "64px", height: "64px" }}` (공용 헤더 바로 아래).
- **본문 래퍼:** `components/admin/AdminLayout.tsx` — `pt-[128px]` + `style={{ paddingTop: "128px" }}`.
- **사이드바:** `components/admin/dashboard/_components/AsideMenu/Layer.tsx` — `style={{ top: "128px", height: "calc(100vh - 128px)" }}`.

---

## 5. 겹치던 요소 (추가로 발견한 것)

- 대시보드 첫 화면(`app/admin/page.tsx` → SectionMain → SectionTitleLineWithButton, DashboardMenuBox)에는 **negative margin(-mt-*), absolute, fixed**가 없습니다.
- `components/admin/_components/Section/Title.tsx`에는 `-mt-6` 등이 있으나, **admin 페이지들은 SectionTitleLineWithButton만 사용**하고 Section/Title은 사용하지 않아, /admin 대시보드와는 무관합니다.
- 따라서 **겹침의 직접 원인**은 “본문 래퍼의 상단 여백 부족” 또는 “NavBar가 sticky여서 환경에 따라 동작이 달라지던 것”으로 보는 것이 맞고, **실제로 겹치던 DOM 요소 하나를 특정할 수는 없습니다.**  
  위와 같이 **NavBar를 fixed로 바꾸고 본문 래퍼에 pt-16 + paddingTop: 64px**를 적용한 것이 겹침 방지 조치입니다.

---

## 6. 최종 요약 (공용 헤더 + 관리자 NavBar 구조)

| 항목 | 내용 |
|------|------|
| /admin에서 렌더되는 상단 구조 | **공용 사이트 헤더(64px)** → **관리자 NavBar(64px)** → **본문(padding-top: 128px)** |
| 공용 헤더 | `MainSiteHeader` — /admin에서도 렌더됨. 높이 64px. |
| 관리자 NavBar | `NavBar` — fixed, top: 64px, height: 64px. |
| 본문 래퍼 | padding-top: 128px (공용 64px + NavBar 64px). |
| 사이드바 | top: 128px, height: calc(100vh - 128px). |
