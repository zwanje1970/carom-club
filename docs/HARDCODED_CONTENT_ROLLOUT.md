# 하드코딩 콘텐츠 → 데이터 연동 (점진 롤아웃)

## 이미 있는 뼈대 (재사용)

- **DB `PageSection`**: `title`, `subtitle`, `description`, `imageUrl`, `buttons`, `sortOrder`, `isVisible`, `slotType`, `slotConfigJson`, `sectionStyleJson`, 링크 필드(`linkType`, `internalPath`, `internalPage`, `externalUrl`, `buttons[]`) 등.
- **공개 렌더**: `components/content/PageRenderer.tsx` — `blocks` 배열을 순서대로 map, `slotType` 있으면 `PageSlotBlock` switch, 없으면 `PageSectionBlockRow`(CMS 행).
- **관리**: `/admin/page-sections`, `/admin/page-builder`, `PATCH /api/admin/content/page-layout`, 문구는 `/admin/site/copy` → `lib/admin-copy.ts` `DEFAULT_ADMIN_COPY` + DB 오버레이.
- **슬롯 행 링크 해석**: `lib/page-section-slot-href.ts` `resolvePageSectionLinkHref` — 섹션 링크·첫 버튼 `href` → URL (없으면 copy 기본값으로 보완).

## 전수 점검 요약 (블록별)

| 영역 | 상태 | 비고 |
|------|------|------|
| 홈 `app/(site)/page.tsx` | 데이터 기반 | `getOrderedPageBlocksForPage` + `PageRenderer` + `buildHomeSlotRenderPayload` |
| 커뮤니티 `CommunityHomeInner` | 데이터 기반 | 동일 패턴 + `postList`/`nanguList` 폴백 규칙 |
| 대회 목록 `tournaments/page.tsx` | 데이터 기반 | `tournamentList` 슬롯 + 폴백 |
| `tournamentIntro` | copy + `PageSection` 제목 | 근처 찾기·에러·전체보기 → copy 키; `block.title`/`subtitle` |
| `venueIntro` | copy + `PageSection` 제목 | `VenueCarousel` 헤더·필터·빈 목록·캐러셀 aria → copy; `block.title` |
| `venueLink` | copy | 자동 모드 링크 문구·수동 카드 제목 없음 → copy |
| `nanguList` + `CommunityNanguPromoCard` | copy + `PageSection` 링크 | `resolvePageSectionLinkHref(block)` 우선, 없으면 `site.community.nanguPromo.href` |
| `noticeOverlay` / 미리보기 플레이스홀더 | copy | `site.pageBuilder.*` 키 |
| `getCopyValue` | 빈 문자열 → 기본값 | 키는 있으나 공백만 있으면 `DEFAULT_ADMIN_COPY` 사용 |

## 최근 변경 파일 (요지)

- `lib/admin-copy.ts` — 홈 당구장·페이지 빌더·난구 href 등 키 추가, `getCopyValue` 보강.
- `lib/page-section-slot-href.ts` — 슬롯 행 링크 해석.
- `VenueCarousel`, `HomeVenueIntroSlot`, `HomeVenueLinkSlot`, `PageSlotBlock`, `CommunityNanguPromoCard`.

## 다음 단계 후보 (플랫폼 관리자 / 클라이언트 대시보드)

동일 패턴(`getCopyValue` + `DEFAULT_ADMIN_COPY` + `/admin/site/copy`)으로 옮기기 좋은 **하드코딩 한글·라벨** 후보(우선순위는 운영 노출 빈도 순).

**클라이언트 콘솔 (`components/client/`)**

- `ClientOperationsParticipantsPanel.tsx` — 참가 상태 라벨·필터 옵션(입금확인대기, 참가확정 등).
- `ClientOperationsParticipantRosterPanel.tsx` — 예/아니오·안내 문구.
- `ClientBracketEditor.tsx` / `ClientBracketBuildConsole.tsx` / `BracketManualEdit.tsx` / `FinalStageSection.tsx` — 라운드명·미배정·단계 라벨(일부는 도메인 고정어일 수 있음).
- `ClientPushBroadcastPanel.tsx`, `ClientOperationsParticipantsPanel.tsx` — 테이블·뱃지 문자열.
- `FeatureGateNotice.tsx`, `ListingProductBanner.tsx` — 등록업체/연회원 안내.
- `TournamentFormSimple.tsx` — 대회 유형·지역 라벨, 버튼·placeholder(대형 폼은 단계적).

**플랫폼 관리자 (`app/(site)/admin/`, `components/admin/`)**

- 로그인·설정 등 **폼 라벨**은 UX 고정이 많음 — copy 키화는 선택.
- `admin/tournaments/*`, `admin/venues/*` — 목록·상세에 남은 한글 상수(상태 뱃지 등은 `site.tournament.*`와 통합 검토).

**공통 원칙**

- 상태 코드 → 표시 문자열 매핑은 `lib/` 상수 + copy 키 한 벌로 묶으면 중복이 줄어듦.
- empty/에러/힌트 문구는 copy 우선.

## 회귀 주의

- `site.home.tournaments.btnViewAll` 기본값은 `"전체보기 →"`(이전 DEFAULT `"전체 보기 →"`와 다를 수 있음). DB 오버레이는 유지.
- `getCopyValue`는 **의도적으로 빈 문자열을 기본값으로 되돌림** — “문구 비우기”로 숨기려는 경우가 있으면 별도 플래그 설계 필요.
