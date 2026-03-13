# Admin One UI 적용 점검 결과

## 1. Build 최종 통과 여부

**통과**

- `SESSION_SECRET` 설정 후 `npx next build` 성공
- 컴파일·린트·타입 체크·페이지 데이터 수집·정적 생성 모두 완료

```bash
# 빌드 시 환경 변수 설정 (PowerShell)
$env:SESSION_SECRET="your-secret-at-least-32-chars"
npx next build
```

---

## 2. 실제 화면 확인 결과

### 2.1 레이아웃 (/admin 주요 페이지)

| 항목 | 상태 | 비고 |
|------|------|------|
| 레이아웃 깨짐 | 정상 | `AdminLayout`이 모든 로그인 후 admin 페이지를 감쌈 |
| 사이드 메뉴(AsideMenu) | 적용됨 | 대시보드, 대회관리, 참가자관리 등 메뉴 + 아이콘 |
| 상단 바(NavBar) | 적용됨 | 사용자명, 내 정보/설정/로그아웃 드롭다운 |
| 푸터(FooterBar) | 적용됨 | "CAROM 관리자" 표시 |
| 반응형(모바일 메뉴) | 적용됨 | 햄버거 메뉴로 아사이드 토글 |
| 비로그인/비관리자 | 정상 | 로그인 유도·권한 없음 메시지 별도 UI (AdminLayout 미적용) |
| /admin/login | 정상 | AdminLayout 없이 로그인 페이지만 렌더 |

**확인 방법:** 로그인 후 `/admin`, `/admin/tournaments`, `/admin/settings` 등 이동 시 좌측 메뉴·상단 바·본문 영역이 한 번에 보이면 레이아웃 정상.

### 2.2 Button / CardBox / FormField / PillTag / NotificationBar

| 컴포넌트 | 적용 위치 | 비고 |
|----------|-----------|------|
| Button | NavBar(메뉴·로그아웃), AsideMenu(메뉴·로그아웃), FooterBar | 레이아웃 내에서 사용 |
| CardBox | **페이지 본문에서는 미사용** | 템플릿 대시보드/데모에서만 사용, app/admin 페이지는 기존 마크업 |
| FormField | **페이지 본문에서는 미사용** | 동일 |
| PillTag | **페이지 본문에서는 미사용** | 동일 |
| NotificationBar | **현재 라우트에서 미사용** | 템플릿 데모용 |

- **정리:** Admin One 스타일의 **레이아웃(NavBar, AsideMenu, FooterBar)** 은 적용됨.  
  **각 admin 페이지 본문**(대시보드, 대회 목록, 설정 등)은 아직 Admin One의 CardBox/FormField/PillTag/NotificationBar로 교체되지 않았고, 기존 디자인/마크업 유지.

### 2.3 다크모드 스텁

- **런타임 오류 없음**
- `_stores/hooks.ts`: `useAppSelector`는 항상 `defaultState` 반환 → `darkMode.isEnabled === false`
- `_stores/darkModeSlice.ts`: `setDarkMode()`는 no-op
- 이 스토어를 쓰는 컴포넌트: `Section/FullScreen`, `StyleSelect/OnVisit`, `CardBox/User`, `UserAvatar/CurrentUser`, `ProfileForm`, `DarkModeExample`  
  → 모두 템플릿/데모용이며, 현재 app/admin 라우트에서는 **직접 렌더되지 않음**.  
  → 따라서 스텁 상태로도 화면 오류 없음.

### 2.4 Chart 플레이스홀더

- **ChartLineSample** 은 `components/admin/dashboard/_components/ChartLineSample/` 에서 **플레이스홀더 UI** 로만 렌더 (chart.js 제거됨).
- 이 컴포넌트를 사용하는 곳은 **템플릿 대시보드** (`components/admin/dashboard/page.tsx`) 뿐.
- **app/admin/page.tsx**(실제 `/admin` 대시보드) 는 단순 제목+문단만 있어 ChartLineSample을 쓰지 않음.
- **결론:** 현재 앱에서 차트가 나오는 라우트가 없어, 플레이스홀더는 “템플릿 데모용 코드 경로” 에만 존재하며, 해당 경로에서도 단순 div+문구로 정상 렌더됨.

---

## 3. 아직 임시 처리인 부분

### 3.1 스토어/다크모드 스텁

| 파일 | 내용 |
|------|------|
| `components/admin/_stores/hooks.ts` | `useAppSelector` / `useAppDispatch` 항상 기본값 반환 (실제 상태 없음) |
| `components/admin/_stores/darkModeSlice.ts` | `setDarkMode()` no-op, 주석에 "호환용 스텁" |
| `components/admin/_stores/StoreProvider.tsx` | 자식만 렌더하는 래퍼 (상태 제공 없음) |

### 3.2 Chart

| 파일 | 내용 |
|------|------|
| `components/admin/dashboard/_components/ChartLineSample/index.tsx` | chart.js 제거 후 "Chart (N points)" 문구만 보여주는 플레이스홀더 div |

### 3.3 Re-export (ui → _components)

| 파일 | 내용 |
|------|------|
| `components/admin/ui/Buttons.tsx` | `export { default } from "../_components/Buttons"` |
| `components/admin/ui/OverlayLayer.tsx` | `export { default } from "../_components/OverlayLayer"` |
| `components/admin/ui/NumberDynamic.tsx` | `export { default } from "../_components/NumberDynamic"` |

### 3.4 루트/공통 모듈 (템플릿 호환용)

| 파일 | 내용 |
|------|------|
| `context/ThemeContext.tsx` | 다크 토글용 `useTheme` / `ThemeProvider` (실제 테마 상태는 단순 class 토글) |
| `components/admin/context/ThemeContext.tsx` | 동일 API, admin 내부 참조용 |
| `components/common/ComponentCard.tsx` | BasicTableOne / VideosExample 등에서 사용하는 카드 래퍼 |
| `components/ui/table.tsx` | Table / TableHeader / TableBody / TableRow / TableCell (HTML 테이블 래퍼) |
| `components/ui/badge/Badge.tsx` | Badge (Admin One 스타일) |

---

## 4. 다음 정리 우선순위

1. **(선택) admin 페이지 본문을 Admin One 스타일로 단계 적용**  
   - `/admin` 대시보드에 CardBox/위젯 스타일 적용  
   - 대회·설정·회원 등 목록/폼에 CardBox, FormField, PillTag 등 적용  
   - DB/API 유지하고 마크업만 교체 (기존 `docs/UI_TEMPLATE_APPLICATION_MAP.md` 참고 가능)

2. **(선택) 다크모드 실제 연동**  
   - `_stores` 를 실제 상태(예: React Context 또는 소규모 store)로 교체하고, `setDarkMode` 시 `document.documentElement.classList.toggle("dark")` 등과 연동  
   - 또는 다크모드 미사용 시: 스텁 유지하고, 다크모드 사용 컴포넌트는 점진적으로 제거/대체

3. **(낮음) 템플릿 전용 코드 정리**  
   - `components/admin/dashboard/page.tsx`, `components/admin/layout.tsx` 등 앱에서 직접 라우트되지 않는 템플릿용 페이지/레이아웃은 유지할지, 삭제할지 결정  
   - ChartLineSample 플레이스홀더는 “데모용” 으로 유지해도 빌드/런타임에는 영향 없음

4. **(낮음) ui / _components 중복 구조 정리**  
   - `components/admin/ui/*` 중 re-export만 하는 파일은 점진적으로 import 경로를 `_components` 로 통일한 뒤 제거 가능

---

**요약**

- **Build:** SESSION_SECRET 설정 후 최종 통과.
- **화면:** Admin One 레이아웃(사이드/상단/푸터)은 적용되어 있고, 본문은 기존 UI 유지. 다크모드 스텁·Chart 플레이스홀더는 현재 라우트에서 문제 없음.
- **임시 처리:** 스토어/다크모드 스텁, Chart 플레이스홀더, ui re-export, 루트 ThemeContext/ComponentCard/table/badge.
- **다음 우선순위:** 본문에 CardBox/FormField 등 적용 → (선택) 다크모드 연동 → 템플릿 전용·ui 구조 정리.
