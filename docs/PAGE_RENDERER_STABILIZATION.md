# PageRenderer / 페이지 빌더 — 1차 안정화 정리

운영·재설계 시 참고용. 코드 기준(2026-03).

## 1. 히어로 `slotContext` · 폴백

- **공개 홈** (`app/page.tsx`): `getHeroSettings()` 결과를 항상 `slotContext.heroSettings`로 전달.
- **미리보기 API** (`app/api/admin/content/page-preview-context/route.ts`): 홈 분기에서 동일 `getHeroSettings()` 사용.
- **누락 폴백** (`components/content/PageSlotBlock.tsx`): `resolveHeroSettingsForSlot(ctx?.heroSettings)` — `undefined`/`null`이면 `getDefaultHeroSettings()`와 동일한 기본 객체로 `HomeHero` 렌더. 점선 `SlotFallback`은 사용하지 않음.
- **클라이언트 안전 기본값** (`lib/hero-settings-defaults.ts`): Prisma 없음. `lib/hero-settings.ts`는 DB 전용 + defaults re-export.

## 2. 미완성 슬롯(SlotFallback) · `slotSurface`

| slotType | 운영(`slotSurface="public"`) | 관리자 미리보기(`adminPreview`) |
|----------|-------------------------------|----------------------------------|
| `quickMenu` / `homeCarousels` / `default` | **출력 없음** (`null`) | 점선 `SlotFallback` 안내 |
| `postList` / `tournamentList` (데이터 없음) | `null` | `SlotFallback` |

`PageRenderer` 기본값은 `slotSurface="public"`. `PageBuilderMobilePreview`만 `adminPreview` 전달.

**연결 우선순위 제안**

1. `homeCarousels` → 기존 `HomeDeferredSections` 내 대회·당구장 흐름과 합치거나, 슬롯 위치에 동일 컴포넌트 마운트.
2. `quickMenu` → 레이아웃/헤더 인근 전역 컴포넌트와 계약 후 슬롯만 순서 마커로 유지할지 결정.

## 3. `cmsPageSections` — 최종 방향 (**유지**)

| 구분 | 영향 범위(코드 기준) |
|------|---------------------|
| **렌더** | `components/content/PageSlotBlock.tsx` — `null` |
| **빌더** | `page-section-page-rules`, `PageBuilderClient` 슬롯 목록, `buildPageLayoutSectionPayload` / 시드 데이터 |
| **제거 시** | DB·mock에 남은 `cmsPageSections` 행 정리 마이그레이션, 운영자 교육 문서 수정 |
| **통합(비권장)** | 슬롯 내부에서 `PageSectionsRenderer` 재호출 시 CMS 이중 렌더·순서 불일치 위험 |

**결론**: 순서 마커로 **유지**. 제거는 이득 대비 비용 큼; 통합은 구조적으로 비권장.

## 4. 커뮤니티 / 대회 레거시 제거 단계

### 커뮤니티 (`CommunityHomeInner.tsx`)

- **현재**: `postList` 슬롯 없으면 `CommunityMainClient` 폴백; `postList` 있으나 `nanguList` 없으면 상단에 `CommunityNanguPromoCard`.
- **전환 조건**: 빌더에서 홈 허브에 `postList` + (필요 시) `nanguList`를 넣고, 실서비스에서 레거시 폴백 없이 동일 UX가 검증된 뒤.
- **단계**: (1) 스테이징에서 슬롯만으로 목록+난구 카드 확인 (2) `!hasPostListSlot` 분기 제거 (3) 난구 카드 보조 분기를 슬롯 순서로 흡수할지 제품 결정 후 제거.

### 대회 (`app/tournaments/page.tsx`)

- **현재**: `tournamentList` 슬롯 없으면 `TournamentsPageChromeTitles` + `TournamentsListBlock` 폴백.
- **전환 조건**: 빌더에 `tournamentList` 고정 + 공개 URL 쿼리(tab/sort)와 슬롯 내 목록 동작 검증 완료 후.
- **단계**: (1) 폴백 경로 트래픽 0에 가깝게 모니터링 (2) `!hasTournamentListSlot` 분기 제거 (3) 중복 `getCommonPageData` 호출 정리.

## 5. 미리보기 ↔ 실제 일치

| slotType | 일치 여부 | 비고 |
|----------|-----------|------|
| `hero` | 일치 | 기본값 폴백으로 컨텍스트 누락 시에도 동일 컴포넌트·동일 기본 데이터 |
| `postList` | 부분 | `canManageReports` / `showSolverEntry` / `latest`는 **미리보기 API = 공개와 동일 빌더** (`buildCommunityHomeSlotCommunityPayload`). `initialCategory`는 미리보기가 항상 `"all"` — **카테고리별 라우트(`/community/qna` 등)와 목록 필터는 다를 수 있음** |
| `nanguList` | 일치 | 컨텍스트 불필요 |
| `tournamentList` | 부분 | 미리보기는 빈 쿼리 기준 목록; 실제는 URL 쿼리 반영 |
| `noticeOverlay` | 일치 | 동일 안내 문구 |
| `cmsPageSections` | 일치 | 둘 다 null |
| `quickMenu` / `homeCarousels` | 일치(둘 다 자리 없음) | 운영 `null` / 미리보기만 안내 |
| default | 동일 | 운영 `null` / 미리보기만 안내 |

---

## 6. 레거시 폴백 제거 준비(검증 헬퍼)

- `lib/content/page-layout-legacy-readiness.ts`: `hasCommunityPostListSlot`, `hasTournamentsTournamentListSlot`
- `PageBuilderClient`: 위 조건 충족/미충족 시 안내 문구(실제 분기 제거는 미실행).

---

## 변경 요약 (이번 안정화 커밋)

- `lib/hero-settings-defaults.ts` 추가, `resolveHeroSettingsForSlot`로 히어로 슬롯 안정화.
- `lib/community-home-slot-context.server.ts`로 커뮤니티 슬롯 payload 단일화; 미리보기 API와 `CommunityHomeInner` 공유.
- `slotSurface` / `page-layout-legacy-readiness` / 미리보기·빌더 안내 문구는 후속 UX 정리 커밋에서 반영.
