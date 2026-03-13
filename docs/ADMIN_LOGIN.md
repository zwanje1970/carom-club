# 관리자 로그인 확인

## 1. DB 마이그레이션 (최초 1회)

스키마에 `UserRole`이 `USER` / `PLATFORM_ADMIN` / `CLIENT_ADMIN`으로 변경되어 있으므로, DB에 반영이 필요합니다.

### 방법 A – 리셋 없이 적용 (데이터 유지, 권장)

이미 `prisma migrate dev` 시 "We need to reset... All data will be lost"라고 나와 **no**를 선택한 경우:

```bash
cd c:\project\jukbang-platform-v2
npx prisma migrate deploy
```

- `prisma/migrations/20260311000000_platform_roles_no_reset/` 마이그레이션이 **기존 데이터를 유지한 채** `UserRole`만 `ADMIN` → `PLATFORM_ADMIN` 구조로 바꿉니다.
- 적용 후 아래 2번처럼 시드를 실행하면 됩니다.

### 방법 B – 개발 환경에서 리셋 허용

DB를 비워도 되는 개발 환경이면:

```bash
npx prisma migrate dev --name platform_roles
```

- "Do you want to continue? All data will be lost."에 **yes** 하면 리셋 후 최신 스키마로 적용됩니다.

## 2. 관리자 계정 생성/비밀번호 초기화

```bash
npx prisma db seed
```

- **아이디:** `admin`
- **비밀번호:** `admin1234`
- **역할:** `PLATFORM_ADMIN` (캐롬클럽 관리자 전용 로그인 가능)

## 3. 관리자 로그인 경로

- **URL:** `http://localhost:3000/admin/login`
- **동작:**
  - `platformAdminOnly: true`로 로그인 API 호출 → **PLATFORM_ADMIN**만 성공
  - 성공 시 `/admin/dashboard`로 이동
  - 실패 시: "플랫폼 관리자 전용 로그인입니다. 이 계정으로는 접근할 수 없습니다." (403)

## 4. 확인 체크리스트

1. [ ] `npx prisma migrate dev` 로 DB 스키마 최신 반영
2. [ ] `npx prisma db seed` 로 관리자 계정 생성/비밀번호 초기화
3. [ ] 브라우저에서 `http://localhost:3000/admin/login` 접속
4. [ ] 아이디 `admin`, 비밀번호 `admin1234` 입력 후 로그인
5. [ ] `/admin/dashboard`(또는 `/admin`)로 이동되는지 확인

이후 비밀번호 변경은 관리자 > 설정 또는 DB에서 수정하면 됩니다.
