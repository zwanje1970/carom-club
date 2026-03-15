# P3006 / P1014 마이그레이션 오류 수정 요약

## 1. 오류 내용

- **P3006**: Migration `20260328000000_step9_client_approval_tournament_zone` failed to apply cleanly to the shadow database.
- **P1014**: The underlying table for model `ClientApplication` does not exist. (이후 동일 원인으로 `Zone` 테이블 없음 오류 발생)

---

## 2. 원인 파악 결과

### 2.1 schema.prisma

- `ClientApplication` 모델: 84~107라인에 정의됨 (id, type, status, requestedClientType, reviewedByUserId 등).
- `Zone` 모델: 432~442라인에 정의됨. `TournamentZone`이 `zoneId` FK로 참조.

### 2.2 migrations 폴더 검토

- **20260310000000_init**: User, Organization, Tournament 등만 생성. **ClientApplication, Zone 없음.**
- **20260310000001 ~ 20260327000000**: 그 어느 마이그레이션에도 `ClientApplication` / `Zone` **CREATE TABLE 없음.**
- **20260328000000_step9_client_approval_tournament_zone**:
  - **기존 내용**: `ClientApplication`에 대해 **ALTER TABLE ADD COLUMN** 만 있음 (requestedClientType, reviewedByUserId).
  - **TournamentZone**: `CREATE TABLE` + FK로 `Zone("id")` 참조.
- 결론: **ClientApplication**과 **Zone**을 최초로 만드는 마이그레이션이 **전체 체인에 없음**. step9가 “이미 테이블이 있다”고 가정하고 ALTER/참조만 하고 있어서, **빈 DB(shadow DB)에 순서대로 적용하면 실패**함.

### 2.3 migration chain이 깨진 지점

- **깨진 지점**: step9 **이전**에 `ClientApplication`과 `Zone`을 생성하는 마이그레이션이 **원래 있어야 하는데 없음**.
- 가능한 과거 상황 예:
  - 다른 브랜치/로컬에서만 테이블을 만들고, 그 마이그레이션이 main에 안 합쳐짐.
  - 수동으로 테이블을 만들고 마이그레이션 파일은 “ALTER만” 추가함.
  - 초기 설계에서 step9를 “추가 컬럼 + TournamentZone”만 넣는 걸로 만들다가, “테이블 최초 생성” 마이그레이션을 빼먹음.

---

## 3. 왜 실제 DB에서는 되고, shadow DB에서만 실패했는지

- **실제 DB(개발/스테이징)**  
  - 예전에 `migrate dev`를 실행했을 때는 **이미** ClientApplication/Zone이 존재했거나(수동 생성/다른 경로로 생성),  
  - 또는 그때는 “테이블 생성” 마이그레이션이 있었는데 나중에 삭제/수정되었을 수 있음.  
  - 그래서 **현재 실제 DB에는 테이블이 있어서** step9의 ALTER만 해도 문제가 없음.
- **Shadow database**  
  - `prisma migrate dev`는 **빈 shadow DB**를 만들고, **현재 migrations 폴더에 있는 SQL만** 순서대로 적용함.  
  - 그 안에는 ClientApplication/Zone을 **만드는 SQL이 없고**, step9에서 **바로 ALTER / FK로 참조**하므로  
  - “ClientApplication does not exist” → 수정 후 “Zone does not exist” 순으로 실패함.

즉, **마이그레이션 히스토리(파일)와 실제 DB 상태가 어긋나 있는 상태**라서, “새로 만든 빈 DB”에만 적용하는 shadow DB에서만 오류가 드러난 것입니다.

---

## 4. 적용한 수정 (개발 단계 기준 안전한 수정)

파일: **`prisma/migrations/20260328000000_step9_client_approval_tournament_zone/migration.sql`**

### 4.1 ClientApplication

- **문제**: 테이블 생성 없이 `ALTER TABLE "ClientApplication" ADD COLUMN ...` 만 있음.
- **수정**:
  - step9 **앞부분**에 **CREATE TABLE IF NOT EXISTS "ClientApplication"** 추가 (requestedClientType, reviewedByUserId **제외**한 나머지 컬럼).
  - 인덱스 2개: `ClientApplication_status_idx`, `ClientApplication_applicantUserId_idx` → **CREATE INDEX IF NOT EXISTS**.
  - FK `applicantUserId` → User(id): **DO $$ ... IF NOT EXISTS (pg_constraint) ... ADD CONSTRAINT**.
  - 기존 ALTER는 유지하되 **ADD COLUMN IF NOT EXISTS** 로 변경해, 이미 테이블/컬럼이 있는 DB에서도 안전하게 적용되도록 함.

### 4.2 Zone

- **문제**: `TournamentZone`이 `Zone("id")`를 FK로 참조하는데, **Zone**을 만드는 마이그레이션이 없음.
- **수정**:
  - TournamentZone **바로 위**에 **CREATE TABLE IF NOT EXISTS "Zone"** 추가 (id, name, code, sortOrder, createdAt, updatedAt).
  - 순서: ClientApplication 처리 → Zone 생성 → TournamentZone 생성 → 기존 인덱스/FK 유지.

이렇게 하면:

- **Shadow DB(빈 DB)**: ClientApplication → Zone → TournamentZone 순으로 생성된 뒤 ALTER/FK가 적용되어 **P1014 해소**.
- **이미 테이블이 있는 DB**: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS / DO $$ 로 기존 객체는 건드리지 않고, 없을 때만 생성/추가되므로 **기존 환경도 유지**.

---

## 5. 수정 후 확인 방법

- **로컬에서 대화형 터미널**에서 실행 (CI/비대화형에서는 `migrate dev`가 제한될 수 있음):

```bash
npx prisma migrate dev
```

- 정상이면 shadow DB에 모든 마이그레이션이 순서대로 적용되고, “Everything is in sync” 또는 새 마이그레이션 생성 안내만 나와야 합니다.
- 만약 **이미 적용된 마이그레이션을 수정한 것**이라면, “Migration history was modified” 관련 메시지가 나올 수 있습니다. 이때는 Prisma 안내에 따라 **로컬 개발 DB**만 맞춰서 사용하고, **이미 적용된 step9를 되돌리지 말고** 위와 같이 “앞에 CREATE 보강”하는 방식만 유지하는 것이 안전합니다.

---

## 6. 요약

| 항목 | 내용 |
|------|------|
| **원인** | ClientApplication / Zone 테이블을 생성하는 마이그레이션이 전체 체인에 없는데, step9에서 ALTER 및 Zone 참조만 함. |
| **깨진 지점** | step9 이전에 “ClientApplication·Zone 최초 생성” 마이그레이션이 없음. |
| **수정** | step9의 migration.sql 상단에 ClientApplication CREATE TABLE IF NOT EXISTS + 인덱스/FK, 그 다음 Zone CREATE TABLE IF NOT EXISTS 추가. ALTER는 ADD COLUMN IF NOT EXISTS로 변경. |
| **Shadow DB 실패 이유** | 빈 DB에 SQL만 순서대로 적용하므로, “생성”이 없는 테이블에 대한 ALTER/참조에서 P1014 발생. |
| **실제 DB에서 안 보였던 이유** | 이미 해당 테이블이 다른 경로로 존재하거나, 예전 마이그레이션 상태가 달랐기 때문. |

이 수정으로 **`npx prisma migrate dev`** 가 shadow DB에서 정상 통과하는지 로컬 터미널에서 한 번 실행해 보면 됩니다.
