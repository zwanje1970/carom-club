# Prisma 조회 작성 규칙

Organization / Tournament 조회를 공용 select 상수로 통일해 runtime 컬럼 불일치와 과조회를 줄이기 위한 규칙.

---

## 1. 공용 select 상수 우선

- **Organization** 조회는 `lib/db-selects.ts`의 상수를 사용한다.
- **Tournament** 조회도 `lib/db-selects.ts`의 상수를 사용한다.
- **ad-hoc select**를 새로 만들기 전에 **기존 상수로 해결 가능한지** 먼저 확인한다.

---

## 2. Organization 조회 규칙

| 용도 | 상수 |
|------|------|
| 공개 페이지 | `ORGANIZATION_SELECT_PUBLIC` |
| 관리자 목록/상세/권한 체크 | `ORGANIZATION_SELECT_ADMIN_BASIC` |
| 관리자 수정 폼 | `ORGANIZATION_SELECT_ADMIN_EDIT` |

- **기존 `ORGANIZATION_SELECT_ADMIN`**은 deprecated alias로만 유지한다. **새 코드에서는 직접 사용하지 않는다.**

---

## 3. Tournament 조회 규칙

| 용도 | 상수 |
|------|------|
| 목록/카드 | `TOURNAMENT_SELECT_LIST` |
| 공개 상세 기본 | `TOURNAMENT_SELECT_BASIC` |
| 공개 상세 alias 필요 시 | `TOURNAMENT_SELECT_DETAIL_PUBLIC` |
| 관리자 상세 | `TOURNAMENT_SELECT_ADMIN_BASIC` |
| 관리자 수정 폼 | `TOURNAMENT_SELECT_ADMIN_EDIT` |

- **기존 `TOURNAMENT_SELECT_CARD`**는 deprecated alias로만 유지한다. **새 코드에서는 직접 사용하지 않는다.**

---

## 4. 금지 규칙

- **`organization: true`** 사용 금지
- **`include: true`** 남용 금지
- **무거운 relation**(entries, brackets, payments, rounds 등)을 **공용 select 상수에 넣지 않는다**

---

## 5. relation 조회 규칙

- relation은 **필요한 필드만 명시적 select**로 조회한다.
- **무거운 relation**은 **별도 함수**로 분리한다.
  - 예: `getTournamentEntries()`, `getTournamentBrackets()`, `getTournamentSettlement()`

---

## 6. getTournamentBasic 규칙

- **스칼라**: `TOURNAMENT_SELECT_BASIC` 기반으로 가져온다.
- **포함 relation**: `ORGANIZATION_SELECT_PUBLIC`, `rule`, `_count`, `matchVenues`, `tournamentVenues`만 포함한다.
- **첫 렌더에 포함하지 않음**: entries / rounds / brackets
- **fallback**: outlinePdfUrl 등 컬럼 불일치 가능성을 대비해 fallback 경로를 유지한다.

---

## 7. 새 Prisma 조회 추가 시 체크리스트

- [ ] 이 조회는 **public / admin basic / admin edit** 중 무엇인가?
- [ ] **기존 db-selects 상수**로 해결 가능한가?
- [ ] **relation 전체 조회**를 하고 있지 않은가?
- [ ] **무거운 relation**을 첫 렌더에 포함하고 있지 않은가?
- [ ] **schema 변경** 시 런타임 컬럼 불일치에 안전한가?

---

## 참고

- 상수 정의: `lib/db-selects.ts`
- 타입 안정성: 각 상수는 `satisfies Prisma.OrganizationSelect` 또는 `satisfies Prisma.TournamentSelect` 사용.
