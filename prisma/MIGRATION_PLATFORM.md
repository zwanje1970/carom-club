# 플랫폼 구조 전환 마이그레이션

스키마를 "당구 대회, 모임, 레슨을 연결하는 플랫폼" 구조로 반영한 뒤 아래 순서로 진행하세요.

## 1. Prisma 클라이언트 생성

```bash
npx prisma generate
```

(Windows에서 파일 잠금 오류가 나면 IDE/터미널을 잠시 닫고 다시 시도하세요.)

## 2. DB 마이그레이션

```bash
npx prisma migrate dev --name platform_roles_and_client_application
```

생성된 마이그레이션에 **기존 데이터 보정**이 필요할 수 있습니다.

- **User.role**: 이전 값 `ADMIN` → `PLATFORM_ADMIN`.  
  마이그레이션 후에도 기존 관리자 계정이 있다면 한 번 실행:

  ```sql
  UPDATE "User" SET role = 'PLATFORM_ADMIN' WHERE role = 'ADMIN';
  ```

  (Prisma가 enum을 새로 만들고 컬럼을 바꾸는 방식이면, 마이그레이션 SQL 안에 위 내용을 넣거나, 마이그레이션 적용 후 수동으로 실행.)

- **Tournament.status**: 이전에 `String`이었다면 값 `draft` 등 → enum `DRAFT`/`OPEN` 등으로 맞춰주세요.  
  (현재 스키마는 `TournamentStatus` enum, 기본값 `OPEN`.)

- **TournamentEntry.status**: enum을 `APPLIED`, `CONFIRMED`, `REJECTED`, `CANCELED`로 변경했습니다.  
  기존 데이터가 있다면 `applied`→`APPLIED`, `confirmed`→`CONFIRMED`, `cancelled`→`CANCELED`,  
  `waiting_payment`/`waiting_list`→`APPLIED`, `absent`→`CANCELED` 등으로 매핑하는 데이터 마이그레이션이 필요합니다.

## 3. 시드

```bash
npx prisma db seed
```

시드는 이미 `PLATFORM_ADMIN` 역할로 관리자 계정을 생성하도록 수정되어 있습니다.
