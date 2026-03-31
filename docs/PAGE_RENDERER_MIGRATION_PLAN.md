# PageRenderer 전환 단계 계획

목표: `PageRenderer` + `pageBlocks`(CMS·슬롯 단일 스택)를 공개·미리보기의 단일 진실 소스로 쓰되, **한 번에 레거시 UI를 제거하지 않는다.**

## 현재 상태

- **홈** (`app/page.tsx`): `pageBlocks` + `PageRenderer`, 히어로 슬롯 시 중복 방지로 단독 `HomeHero` 생략. `HomeDeferredSections`는 2차 슬롯(`homeCarousels` 등) 연동 시 정리.
- **커뮤니티 허브** (`CommunityHomeInner.tsx`): `pageBlocks` + `PageRenderer`; `postList` 슬롯 없을 때만 `CommunityMainClient` 레거시.
- **대회** (`app/tournaments/page.tsx`): `pageBlocks` + `PageRenderer`; `tournamentList` 슬롯 없을 때만 제목·`TournamentsListBlock` 레거시.
- **관리자 미리보기**: `PageBuilderMobilePreview`가 공개와 동일 필터 + `page-preview-context` API로 슬롯 데이터 공급.

## 단계별 전환

### 1단계 (완료·유지)

- `getOrderedPageBlocksForPage` / `common-pageData.pageBlocks` 공개 경로에 연결.
- `hero`, `postList`, `nanguList`, `tournamentList`, `noticeOverlay` 슬롯 실 UI 매핑.
- DB 없을 때 `mock-page-sections-store`로 빌더 변형 유지.

### 2단계 (짧은 주기)

- **venues** 등 빌더 대상이 아닌 페이지: 변경 없음.
- **홈**: `quickMenu`, `homeCarousels`를 `PageSlotBlock`에서 실 컴포넌트로 연결한 뒤, `HomeDeferredSections`와 겹침 제거(슬롯 우선·중복 억제 패턴은 홈 히어로와 동일).
- **커뮤니티**: `postList`·`nanguList` 조합에 따른 `CommunityNanguPromoCard` 보조 배치 규칙을 문서화하고, 필요 시 슬롯 한 줄로 흡수.

### 3단계 (선택·합의 후)

- 레거시 폴백 제거: 각 라우트에서 “슬롯 없음” 분기와 이중 데이터 페칭(`TournamentsListBlock` 등) 축소.
- `pageSections` 소비처를 `pageBlocks`의 CMS 필터 뷰로 통일 후 타입·API 정리.

## 원칙

- 난구 솔버·대진표 등 **도메인 물리 로직**은 이 계획 범위 밖.
- 공개 UI **대량 삭제** 없이 슬롯·`PageRenderer`가 먼저 맞고, 레거시는 트래픽·에디터 검증 후 단계적으로 제거.
