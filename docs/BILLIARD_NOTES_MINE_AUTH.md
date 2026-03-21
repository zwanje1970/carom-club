# 당구노트 `mine=1` API 401 점검 요약

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

## 3. 도메인 혼용 (www / apex)

- 코드에 `https://www.carom.club/...` 로 API를 직접 부르는 패턴은 없음 — 상대경로 `/api/...` 사용.
- 메타/OG 기본값은 `lib/site-settings.ts`의 `DEFAULT_SITE_URL` 등 — API와 무관.
- **문제 패턴**: `www`에서 로그인해 쿠키가 `www` 전용으로만 붙고, `apex`에서 `/api` 호출 시 쿠키 미전달.
- **대응**: 호스트를 DNS/리다이렉트로 하나로 통일하거나, Vercel에 `SESSION_COOKIE_DOMAIN=carom.club` 설정(코드가 `.carom.club`로 발급).

## 4. 세션 쿠키 (수정 후)

- `lib/auth.ts`의 `getSessionCookieOptions()` — 로그인 API·`setSessionCookie`·`clearSessionCookie` 공통.
- `app/api/auth/login/route.ts` — 기존 인라인 `res.cookies.set`을 위 옵션으로 통일 (`SESSION_COOKIE_DOMAIN` 반영).
- `secure`: production에서 true, `sameSite`: `lax`, `path`: `/`.

## 5. API 인증

- `app/api/community/billiard-notes/route.ts` — `getSession()`; 세션 없으면 401.
- `AUTH_DEBUG_COOKIE=1` 시: `cookie` 헤더 길이·`carom_session` 문자열 포함 여부를 `console.warn`.

## 6. 배포 검증 (수동)

1. Production에서 **한 호스트**만 사용하는지 확인 (또는 `SESSION_COOKIE_DOMAIN` 설정).
2. 로그인 후 DevTools → Application → Cookies에서 `carom_session`의 **Domain** 확인.
3. `/mypage/notes`에서 목록이 뜨는지, 401 시 안내 카드가 뜨는지 확인.
