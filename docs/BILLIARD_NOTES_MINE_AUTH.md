# 난구노트 `mine=1` API 401 점검 요약

## 1. 호출 위치

| 파일 | 용도 |
|------|------|
| `components/community/BilliardNotesListClient.tsx` | `/mypage/notes` 목록 — `GET /api/community/billiard-notes?mine=1` |

기타: `edit/page.tsx`, `BilliardNoteDetailClient.tsx`, `nangu/write` 등은 `mine` 없이 `[id]` 조회.

## 2. fetch 옵션 (수정 후)

- `credentials: "include"` — 유지
- `mode: "same-origin"` — 추가
- `cache: "no-store"` — 추가 (중간 캐시로 인한 오판 방지)
- 401 전용 분기 → 로그인 유도 UI (무한 재시도 없음)

## 3. 도메인 혼용 (www / apex / http)

- 코드에 `https://www.carom.club/...` 로 API를 직접 부르는 패턴은 없음 — 상대경로 `/api/...` 사용.
- 메타/OG 기본값은 `lib/site-settings.ts`의 `DEFAULT_SITE_URL` 등 — API와 무관.
- **문제 패턴**: `www`에서 로그인해 쿠키가 `www` 전용으로만 붙고, `apex`에서 `/api` 호출 시 쿠키 미전달.
- **정규화(www·HTTPS)**: `next.config.ts`에는 host 기반 redirects 없음 — **Vercel Domains**에서만 설정(Next redirects와 중복 시 무한 리다이렉트 방지).
- **대응**: Vercel Domains에서 apex/`www` 정리 + `SESSION_COOKIE_DOMAIN=carom.club`(코드가 `.carom.club`로 발급).

## 4. 세션 쿠키 (수정 후)

- `lib/auth.ts`의 `getSessionCookieOptions()` — 로그인 API·`setSessionCookie`·`clearSessionCookie` 공통.
- `app/api/auth/login/route.ts` — 기존 인라인 `res.cookies.set`을 위 옵션으로 통일 (`SESSION_COOKIE_DOMAIN` 반영).
- `secure`: production에서 true, `sameSite`: `lax`, `path`: `/`.

## 5. API 인증

- `app/api/community/billiard-notes/route.ts` — `getSession()`; 세션 없으면 401.
- **`AUTH_DEBUG_COOKIE=1` (Vercel 환경변수, 일시)** 일 때만 서버 `console.warn`:
  - `host`, `xForwardedProto`, `cookieHeaderPresent`, `cookieLength`, `hasCaromSessionName`, `getSessionOk`, `mineParam`, `visibilityParam`

## 5b. 클라이언트 UX (`BilliardNotesListClient`)

- 401 → 로그인 안내 + `?next=` (재시도 루프 없음).
- 네트워크 실패(TypeError 등) → 「네트워크 오류」 카드(401과 문구 구분).
- 그 외 HTTP/서버 메시지 → 빨간 텍스트 오류.

## 6. 배포 검증 (수동)

1. Production에서 **한 호스트**만 사용하는지 확인 (또는 `SESSION_COOKIE_DOMAIN` 설정).
2. 로그인 후 DevTools → Application → Cookies에서 `carom_session`의 **Domain** 확인.
3. `/mypage/notes`에서 목록이 뜨는지, 401 시 안내 카드가 뜨는지 확인.
4. `/mypage/notes/new`에서 공 배치는 `MobileBallPlacementFullscreen`, 노트/난구 등 **경로 편집**은 `SolutionPathEditorFullscreen` — 서로 다른 플로우.
