# 난구노트 접근 정책·경로·배포 점검

## 1. 비회원이 URL로 들어왔을 때 예전에 안 막혀 보일 수 있었던 이유

| 원인 | 설명 |
|------|------|
| **클라이언트/모달만** | `NotesLoginGate`(모달)만 쓰면 주소창은 `/mypage/notes`로 남고, “막힘”과 “페이지 진입”이 혼동될 수 있음. |
| **배포 코드 불일치** | `middleware.ts`·`layout` 서버 `redirect`가 **main/Production에 없으면** 로컬과 동작이 다름. |
| **feature 브랜치만 수정** | Vercel Production이 `main`만 배포하면 `feature/*` 변경은 사이트에 반영되지 않음. |
| **홈 ISR** | `app/page.tsx`는 `revalidate = 60`으로 **껍데기 HTML이 잠시 캐시**될 수 있으나, 하단 네비·클라이언트 컴포넌트는 마운트 시 최신 JS로 동작. UI “안 바뀜”은 대개 **배포 브랜치/캐시 무효화** 이슈. |

## 2. 현재 서버 측 보호 (경로 자체 차단)

우선순위: **Edge `middleware` → `app/mypage/notes/layout.tsx`의 `redirect()` → 각 page/API `getSession`**

| 단계 | 파일 | 동작 |
|------|------|------|
| 1 | `middleware.ts` | `/mypage/notes`, `/mypage/notes/*` 에 대해 `carom_session` 없음/검증 실패 시 **`/login?next=현재경로`** 로 **즉시 리다이렉트** (캐시 방지 헤더 포함). |
| 2 | `app/mypage/notes/layout.tsx` | `getSession()` 없으면 **`redirect(/login?next=…)`** (`x-pathname` 헤더·없으면 `/mypage/notes`). |
| 3 | `app/mypage/notes/[id]/page.tsx` 등 | 작성자 검증·`notFound` (세션은 레이아웃 이후에도 `getSession`으로 사용). |
| 4 | `app/api/community/billiard-notes/**` | 비로그인 **401** 등. |

`middleware`는 모든 요청에 `x-pathname`을 넣어 `login?next=` 복귀 경로를 맞춤.

## 3. 경로별 비회원 정책 (전수)

| 경로 | 비회원 | 비고 |
|------|--------|------|
| `/mypage/notes` | **불가** | middleware + layout |
| `/mypage/notes/new` | **불가** | 동일 (클라이언트 페이지도 상위 레이아웃 적용) |
| `/mypage/notes/[id]` | **불가** | 동일 + 작성자만 상세 |
| `/mypage/notes/[id]/edit` | **불가** | 동일 |
| `/community/notes` | 리다이렉트 → `/mypage/notes` → 위와 동일 | 레거시 URL 호환 |
| `/community/notes/new` | → `/mypage/notes/new` | 동일 |
| `/community/notes/[id]` | → `/mypage/notes/[id]` | 동일 |
| `/community/notes/[id]/edit` | → `/mypage/notes/[id]/edit` | 동일 |
| `/api/community/billiard-notes` (mine 등) | **401** (정책에 따라) | 세션 필요 구간 |
| `/api/community/billiard-notes/upload-image` | **401** | |
| `/api/community/billiard-notes/[id]` | **401** (비로그인) | 커뮤니티 공개 노트는 API 내부 규칙 따름 |

**페이지 라우트 `/community/billiard-notes`는 없음** — API만 존재 (`/api/community/billiard-notes`).

## 4. 실제 사용 중인 UI 파일 (중복 여부)

| 역할 | 파일 |
|------|------|
| 모바일 하단 네비 “난구노트” | `components/layout/BottomNav.tsx` → `href="/mypage/notes"` |
| 노트 목록 UI | `components/community/BilliardNotesListClient.tsx` (`app/mypage/notes/page.tsx`) |
| 새 글 폼·공 배치 진입 | `app/mypage/notes/new/page.tsx` → `BilliardNoteFormScreen` + `MobileBallPlacementFullscreen` |
| 공 배치 풀스크린 | `components/community/MobileBallPlacementFullscreen.tsx` |
| 경로/해법 편집 풀스크린 (난구·노트 편집 등 다른 플로우) | `components/nangu/SolutionPathEditorFullscreen.tsx` |
| 홈에 “커뮤니티 노트 피드” 섹션 컴포넌트 | `app/community/CommunityBilliardNotesSection.tsx` — **현재 다른 파일에서 import 되지 않음(미사용)**. 링크·피드가 필요하면 `page.tsx` 등에 연결 필요. |

## 5. 배포·브랜치 체크

- Production은 보통 **`main` 머지 후** Vercel이 빌드. **feature 브랜치만** 수정하면 사이트에 안 나올 수 있음.
- 머지 후에도 CDN/브라우저 캐시 의심 시 **하드 리로드** 또는 Vercel **Redeploy**.

## 6. 개발 모드 식별 로그

- `components/layout/BottomNav.tsx`: 마운트 시 `console.debug` (development만).
- `components/community/MobileBallPlacementFullscreen.tsx` / `components/nangu/SolutionPathEditorFullscreen.tsx`: development만 마운트 로그 (기존 보강).

## 7. 홈 `revalidate = 60` 과 회원 UI

- 홈 **서버 HTML**은 최대 60초 단위로 재검증 가능.
- **로그인 여부에 따라 달라지는 버튼**이 전부 서버에서만 결정되면 캐시에 섞일 수 있음. 현재 하단 네비는 **클라이언트**이며, 난구노트는 **서버 middleware/layout**으로 보호.
