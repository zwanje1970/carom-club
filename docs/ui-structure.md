# UI 구조 (UI Structure)

## 폴더 구조

```
app/                    # App Router 페이지·레이아웃
  layout.tsx
  page.tsx
  login/, signup/, mypage/
  tournaments/, tournaments/[id]/
  community/
  admin/, admin/tournaments/, admin/participants/, admin/brackets/,
  admin/members/, admin/inquiries/, admin/settings/
components/             # 공통 UI 컴포넌트
modules/                # 기능 단위 모듈 (대회, 회원, 관리자 등)
lib/                    # 유틸, DB 클라이언트
hooks/                  # React 훅
types/                  # 공통 타입
prisma/                 # Prisma schema, migrations
docs/                   # 프로젝트 문서
```

## 페이지 역할

| 경로 | 역할 |
|------|------|
| `/` | 홈 |
| `/login`, `/signup` | 인증 |
| `/mypage` | 회원 프로필·증빙 |
| `/tournaments`, `/tournaments/[id]` | 대회 목록·상세·참가 |
| `/community` | 커뮤니티 |
| `/admin/*` | 관리자 전용 |

## 공통

- 레이아웃: `app/layout.tsx` (공통 헤더/푸터는 추후 컴포넌트로 분리)
- 스타일: Tailwind CSS, `app/globals.css`
