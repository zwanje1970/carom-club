# Vercel 배포 이미지 (`/_next/image` 400 대응)

## 자주 나는 원인

| 증상 | 원인 |
|------|------|
| `INVALID_IMAGE_OPTIMIZE_REQUEST` / 400 | `remotePatterns`에 호스트 없음, 또는 `search: ""`인데 URL에 `?` 쿼리 있음 |
| 404 | 원본 URL이 잘못됨·삭제됨 |
| 401/302 HTML | 비공개 Blob·로그인 리다이렉트 URL을 이미지로 씀 |

## 이 프로젝트 설정 (`next.config.ts`)

1. **Vercel 배포(`VERCEL=1`)**: `images.unoptimized: true` → 브라우저가 **원본 URL로 직접** 요청. `/_next/image` 거치지 않음 → 위 오류 제거.
2. **`remotePatterns`**: Vercel Blob(쿼리 허용), `NEXT_PUBLIC_SITE_URL` 호스트, `VERCEL_URL`, `*.vercel.app`, `NEXT_PUBLIC_IMAGE_REMOTE_HOSTS`(쉼표 구분) 추가.
3. **컴포넌트**: `data:` / `blob:` / 빈 문자열 → `<img>` (`lib/image-src.ts`).

## 추가 CDN 호스트가 있을 때

`.env` 예:

```env
NEXT_PUBLIC_IMAGE_REMOTE_HOSTS=cdn.example.com,images.example.org
```

## 자체 서버에서도 최적화 끄기

```env
NEXT_IMAGE_UNOPTIMIZED=1
```
