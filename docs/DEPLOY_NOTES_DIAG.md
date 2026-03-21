# 당구노트 Production 배포 확인용 진단 흔적

배포 후 **이 코드가 실제로 실행되는지** 확인하기 위한 최소 증거입니다. 확인이 끝나면 `middleware` 로그/헤더·`carom:*` UI·이 문서를 정리해 제거해도 됩니다.

## 1. 브라우저에서 반드시 볼 수 있는 것

| 위치 | 표시 예 | 의미 |
|------|---------|------|
| `/mypage/notes` 상단 (서버 RSC) | `carom:notes-page:abc1234` | 해당 배포의 **Git 커밋 앞 7자**(Vercel 빌드 시). 로컬은 `local`. |
| 목록 영역 (클라이언트) | `carom:notes-list:abc1234` | **동일한 7자**면 서버 HTML과 클라이언트 번들이 같은 빌드. |
| Elements | `data-carom-notes-layout="1"` | `app/mypage/notes/layout.tsx` 가 렌더됨. |
| Network → 문서 요청 → Response Headers | `x-carom-notes-mw: pass` \| `no-cookie` \| `jwt-invalid` | Edge `middleware.ts` 가 해당 요청에 실행됨. |

## 2. Vercel Logs에서 검색할 문자열

| 검색어 | 나오면 |
|--------|--------|
| `[CAROM][MW][NOTES]` | `/mypage/notes*` 요청이 **middleware**를 탐. JSON에 `host`, `pathname`, `result`(pass / no_cookie / jwt_invalid). |
| `x-carom-notes-mw` | (헤더는 브라우저 Network에서 확인) |

**경로:** Vercel 프로젝트 → **Logs** → Runtime / Edge Functions 필터.

## 3. 흔적이 안 보일 때 원인 후보

| 증상 | 가능한 원인 |
|------|-------------|
| `[CAROM][MW][NOTES]` 로그 없음 | 다른 프로젝트/환경에 배포됨, **middleware 미포함 빌드**, 또는 `matcher`에 해당 URL이 안 걸림(현재 `/admin`, `/mypage/notes`, `/mypage/notes/:path*`). |
| `carom:notes-page` / `carom:notes-list` 없음 | **다른 브랜치/구버전** 정적 캐시, 또는 `/mypage/notes`가 아닌 URL. |
| 페이지는 있는데 `notes-page`/`notes-list`만 `local` | Vercel 외 환경이거나 `VERCEL_GIT_COMMIT_SHA` 없음. |
| `x-carom-notes-mw` 없음 | 문서가 CDN/프록시에서 캐시되어 헤더가 다르게 보이거나, middleware 미실행. |

## 4. matcher 점검 메모

- `/mypage/notes` — 명시 포함.
- `/mypage/notes/new` — `/mypage/notes/:path*` 로 매칭 (`new` 세그먼트).
- 정적 파일은 matcher에 없어 **미들웨어 비실행**(의도).
