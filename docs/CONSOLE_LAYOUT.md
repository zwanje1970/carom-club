# 콘솔 레이아웃 정책 (관리자 / 클라이언트)

구현·토큰: `lib/console-layout.ts`

## 본문 폭 (max-width)

- 양쪽 콘솔 모두 **`max-w-6xl` (1152px)** + `mx-auto w-full min-w-0` 로 동일한 중앙 컬럼을 사용한다.
- 관리자 상단 액션바(`AdminPageActions`), 스크롤 `main`, 클라이언트 헤더 내부·스크롤 `main`, 관리자 `FooterBar`·`NavBar` 내부가 같은 컬럼 기준을 따른다.
- **예외**: `/admin/page-builder` 등 에디터 풀폭 모드는 `AdminLayout`에서 `main`에 `p-0` 유지 (기존 동작).

## 수평 패딩

- 공통: **`px-4 sm:px-5 md:px-6`** (`CONSOLE_PAD_X_CLASS`)

## 브레이크포인트 의미

| 토큰 | 너비   | 역할 |
|------|--------|------|
| **md** | 768px | 페이지 **내부** 밀도·카드↔테이블 분기 (`hidden md:block` 등). 셸과 독립. |
| **lg** | 1024px | **좌측 사이드바** 표시 (`lg:flex` / `lg:pl-[280px]`). 클라이언트 **하단 네비 숨김** (`lg:hidden`). |
| **xl** | 1280px | 셸 본문 폭은 6xl로 고정; 개별 UI에서만 보조로 사용 가능. |

## 768px ~ 1023px 구간

- 사이드바 **없음** (햄버거·상단 액션만).
- 클라이언트: **하단 탭 네비 표시**, 본문 `pb`는 하단 네비·safe-area까지 확보되도록 **`lg` 이후**에만 일반 패딩으로 전환.
- 목록/대시보드: **md** 기준 카드형 UI 유지 — **lg** 사이드바와 역할이 겹치지 않음.

## 관련 파일

- `components/admin/AdminLayout.tsx` — `CONSOLE_ADMIN_MAIN_CLASS`
- `components/admin/AdminPageActions.tsx` — 액션바 내부 컬럼
- `components/client/console/ClientConsoleShell.tsx` — 헤더·`main`
- `components/admin/_components/Section/Main.tsx` — 셸이 폭·좌우 패딩을 담당하므로 섹션은 세로 간격 위주
