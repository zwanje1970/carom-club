# Prisma 마이그레이션 정책

## `PageSection.deletedAt` 중복 정리 (2026-04)

### 경위

- `20260329170000_page_section_deleted_at` 에서 이미 `PageSection.deletedAt` 컬럼을 추가함.
- 이후 스키마에 동일 필드가 반영된 상태에서, 기존 마이그레이션 목록을 확인하지 않고 **`20260410120000_page_section_deleted_at`** 를 추가로 만들면서 **동일한 `ADD COLUMN "deletedAt"`** 가 중복됨.
- `schema.prisma` 는 단일 진실 소스이므로 필드가 이미 있어도, **이미 적용된 SQL과 같은 변경을 담은 새 마이그레이션** 을 또 넣으면 배포 시 충돌한다.

### 정본(단일 마이그레이션)

| 필드 | 마이그레이션 디렉터리 |
|------|------------------------|
| `PageSection.deletedAt` | `20260329170000_page_section_deleted_at` |

### 저장소에서 제거한 항목

- `20260410120000_page_section_deleted_at` — 위와 동일 SQL만 포함한 **중복** 이므로 디렉터리 전체 삭제.

### DB에 이미 `20260410120000...` 가 `_prisma_migrations` 에만 남아 있는 경우

`migrate resolve` 등으로 해당 이름이 기록됐는데, 저장소에서는 폴더를 지운 뒤라면 Prisma가 히스토리와 불일치할 수 있다. **실제 DB에는 `deletedAt` 이 이미 있다**는 전제에서:

1. 팀 정책에 맞게 `_prisma_migrations` 에서 해당 행만 제거하는 방법을 검토한다.
   - 예 (PostgreSQL):  
     `DELETE FROM "_prisma_migrations" WHERE migration_name = '20260410120000_page_section_deleted_at';`
2. 또는 플랫폼 담당자와 맞춰 **baseline / shadow DB** 로 히스토리를 재정렬한다.

※ 프로덕션에서는 백업·다운타임 정책에 맞게 수행할 것.

## 앞으로 중복을 막기 위해

1. **새 컬럼 추가 전** `prisma/migrations` 아래에서 컬럼명·테이블명을 검색한다.  
   예: `grep -r "deletedAt" prisma/migrations`
2. 스키마만 고치고 바로 `migrate dev` 하기 전에, **이미 같은 변경이 과거 마이그레이션에 있는지** 확인한다.
3. 의심스러우면 `prisma migrate diff` 로 현재 DB(또는 shadow)와 스키마 차이를 본 뒤, **빈 변경이면 마이그레이션을 만들지 않는다.**
