# 콘텐츠 관리 시스템 (CMS) 정리

## 1. 수정된/추가된 파일 목록

### 타입
- `types/page-section.ts` - 페이지 섹션 타입
- `types/popup.ts` - 팝업 타입
- `types/notice-bar.ts` - 공지 배너 타입

### 라이브러리
- `lib/content/mock-data.ts` - mock 데이터 (페이지 섹션, 팝업, 공지 배너)
- `lib/content/service.ts` - 조회/저장 서비스 (현재 mock 사용)
- `lib/content/constants.ts` - 페이지/위치/라벨 상수

### 관리자
- `components/admin/adminMenu.ts` - 사이드바 메뉴 구조 변경 (콘텐츠 관리, 대회, 당구장, 회원 그룹)
- `components/admin/page-sections/PageSectionList.tsx`
- `components/admin/page-sections/PageSectionForm.tsx`
- `components/admin/popups/PopupForm.tsx`
- `components/admin/notice-bars/NoticeBarForm.tsx`
- `app/admin/page-sections/page.tsx` - 목록
- `app/admin/page-sections/new/page.tsx` - 섹션 추가
- `app/admin/page-sections/[id]/edit/page.tsx` - 섹션 수정
- `app/admin/popups/page.tsx` - 팝업 목록/추가/수정
- `app/admin/notice-bars/page.tsx` - 공지 배너 목록/추가/수정
- `app/api/admin/content/page-sections/route.ts` - GET 목록
- `app/api/admin/content/popups/route.ts` - GET 목록
- `app/api/admin/content/notice-bars/route.ts` - GET 목록

### 공통/섹션 컴포넌트
- `components/common/SmartLink.tsx` - 내부(Link)/외부(a) 링크
- `components/common/NoticeBar.tsx` - 공지 배너 렌더링
- `components/common/Popup.tsx` - 팝업 렌더링 (오늘 하루 보지 않기 localStorage)
- `components/sections/ImageSection.tsx`
- `components/sections/TextSection.tsx`
- `components/sections/CtaSection.tsx`
- `components/content/ContentLayer.tsx` - 공지 배너 + 팝업
- `components/content/PageSectionsRenderer.tsx` - 섹션 목록 렌더링

### 페이지 연동
- `app/page.tsx` - 메인: ContentLayer, PageSectionsRenderer, getNoticeBarsForPage('home') 등
- `app/venues/page.tsx` - 당구장: 동일
- `app/tournaments/page.tsx` - 대회: 동일

---

## 2. Mock 데이터 기반 동작 부분

- **목록/조회**: `lib/content/mock-data.ts` 배열을 `lib/content/service.ts`에서 반환.
- **저장/삭제**: 서비스에 `savePageSection`, `savePopup`, `saveNoticeBar`, `delete*` 함수는 있으나 **mock에서는 메모리 갱신 없음**. 관리자에서 "저장" 시 성공 처리만 하고, 목록 새로고침 시 기존 mock 데이터만 보임.
- **프론트 노출**: `getPageSectionsForPage(page)`, `getPopupsForPage(page)`, `getNoticeBarsForPage(page)`가 mock 배열을 필터·정렬해 반환. `isVisible` 및 `startAt`/`endAt` 기간 내인 것만 노출.

---

## 3. 페이지 콘텐츠 불러오는 방식

1. **서버 컴포넌트** (예: `app/page.tsx`)에서:
   - `getNoticeBarsForPage(pageSlug)` - 해당 페이지 노출 공지 배너
   - `getPopupsForPage(pageSlug)` - 해당 페이지 노출 팝업
   - `getPageSectionsForPage(pageSlug)` - 해당 페이지 노출 섹션 (isVisible + 기간 내, sortOrder 오름차순)
2. **표시 조건**: `isVisible === true` 이고, 현재 시간이 `startAt` ~ `endAt` 사이 (null이면 기간 제한 없음).
3. **정렬**: `sortOrder` 오름차순 (숫자 낮을수록 먼저).
4. **클라이언트**: `ContentLayer`에 noticeBars, popups 전달; `PageSectionsRenderer`에 sections 전달.

---

## 4. Neon DB 연결 시 필요한 테이블 구조

### PageSection (페이지 섹션)
- id (cuid), type (image|text|cta), title, subtitle, description, textAlign, page, placement
- imageUrl, imageUrlMobile, imageHeightPc, imageHeightMobile
- linkType, internalPage, internalPath, externalUrl, openInNewTab
- buttons (JSON: SectionButton[])
- isVisible, sortOrder, startAt, endAt, createdAt, updatedAt

### Popup (팝업)
- id, title, description, imageUrl, buttonName, buttonLink, page
- startAt, endAt, hideForTodayEnabled, showCloseButton, isVisible, sortOrder, createdAt, updatedAt

### NoticeBar (공지 배너)
- id, message, linkType, internalPath, externalUrl, openInNewTab
- backgroundColor, textColor, page, position (below_header|fixed_top)
- startAt, endAt, isVisible, sortOrder, createdAt, updatedAt

연동 시 `lib/content/service.ts`에서 `prisma.pageSection.findMany(...)` 등으로 교체하고, 관리자 저장 시 API route에서 `prisma.pageSection.create/update` 호출하면 됨.

---

## 5. 이미지 업로드 저장소 연결 방법

- **페이지 섹션 이미지**: 현재 폼에서는 "대표 이미지 URL" 직접 입력. 기존처럼 업로드 시에는 `POST /api/admin/upload-image` 사용 후 반환된 `url`을 section.imageUrl에 저장하면 됨.
- **팝업 이미지**: 동일. `processUploadedImage` + `uploadToBlob` (또는 `uploadToLocal`) 사용. 정책은 `IMAGE_POLICIES.content` 또는 `banner`.
- **Blob/로컬**: `lib/image-upload.ts` 참고. `BLOB_READ_WRITE_TOKEN` 있으면 Vercel Blob, 없으면 `public/uploads` 로컬 저장.
