# CAROM.CLUB 관리자 CMS 정리

관리자가 코드 수정 없이 사이트 콘텐츠를 관리할 수 있도록 하는 기능 범위와 구현 요약입니다.

---

## 1. 수정·추가된 파일 목록

### 신규
- `lib/uploads/image-upload.ts` — 이미지 업로드 모듈 재노출 (spec 파일 구조)
- `lib/uploads/image-optimize.ts` — 이미지 최적화 모듈 재노출
- `components/admin/_components/AdminImageField.tsx` — 드래그 앤 드롭 / 파일 선택 / URL 입력, 썸네일·교체·삭제
- `app/api/admin/content/page-sections/reorder/route.ts` — 페이지 섹션 드래그 정렬 API (PATCH)
- `docs/ADMIN_CMS.md` — 본 문서

### 수정
- `lib/image-policies.ts` — `section` 정책 추가 (페이지 섹션용, 1920px, webp, 품질 78)
- `lib/image-optimizer.ts` — EXIF 제거 및 방향 정규화 (`rotate()`)
- `lib/content/constants.ts` — `RECOMMENDED_IMAGE_SIZES` (위치별 권장 이미지 크기)
- `lib/content/service.ts` — `reorderPageSections(page, placement, sectionIds)` 추가
- `app/api/admin/upload-image/route.ts` — `policy` 파라미터 지원 (content | section | banner | logo | thumbnail)
- `components/admin/page-sections/PageSectionForm.tsx` — 이미지 설정을 `AdminImageField` + 권장 크기 안내로 변경
- `components/admin/page-sections/PageSectionList.tsx` — 드래그 핸들(≡), 같은 page+placement 내 드래그 정렬, PATCH reorder 후 refetch
- `app/admin/page-sections/page.tsx` — `refetch` 전달하여 정렬 후 목록 갱신

---

## 2. 이미지 업로드 처리 방식

- **기본**: 파일 업로드 (드래그 앤 드롭 또는 파일 선택)
- **선택**: 이미지 URL 직접 입력 (동일 필드에 URL 입력란 제공)
- **허용 확장자**: jpg, jpeg, png, webp (API에서 MIME 검증)
- **업로드 후**: 썸네일 미리보기, 이미지 교체, 이미지 삭제 (폼 내에서만; 저장 시 반영)
- **API**: `POST /api/admin/upload-image`  
  - `FormData`: `file` (필수), `policy` (선택, 기본 `content`)  
  - 페이지 섹션 이미지: `policy=section` → `IMAGE_POLICIES.section` 적용
- **저장 위치**: `BLOB_READ_WRITE_TOKEN` 있으면 Vercel Blob, 없으면 `public/uploads/` (로컬)

---

## 3. 이미지 최적화 규칙

- **최대 너비**
  - 데스크톱(섹션): 1920px (`section` 정책)
  - 본문/기타: 1200px 등 정책별 상이 (`lib/image-policies.ts` 참고)
- **압축 품질**: 70~82 구간 사용 (섹션 78, 배너 78 등)
- **포맷**: 가능하면 webp 변환 (`section`, `content` 등)
- **메타데이터**: `rotate()`로 EXIF 제거 및 방향 정규화 후 리사이즈·포맷 변환

---

## 4. 드래그 정렬 방식

- **범위**: 같은 **페이지** + 같은 **노출 위치** 그룹 안에서만 정렬 가능
- **UI**: 페이지·위치 필터를 둘 다 선택했을 때만 테이블에 **≡** 드래그 핸들 표시
- **동작**: 행 드래그로 순서 변경 → 드롭 시 `PATCH /api/admin/content/page-sections/reorder` 호출  
  - Body: `{ page, placement, sectionIds }` (원하는 순서의 id 배열)
- **저장**: DB 연동 시 `reorderPageSections()`에서 해당 그룹의 `sortOrder`를 `sectionIds` 순서대로 0, 1, 2, … 로 재계산

---

## 5. Neon DB 연결 시 필요한 테이블 구조

CMS 콘텐츠는 현재 mock 사용 중이며, DB 연동 시 아래 타입/서비스를 기준으로 테이블을 설계하면 됩니다.

### 페이지 섹션 (`PageSection`)

- `types/page-section.ts` 참고
- 필드: id, type, title, subtitle, description, textAlign, page, placement, imageUrl, imageUrlMobile, imageHeightPc, imageHeightMobile, linkType, internalPage, internalPath, externalUrl, openInNewTab, buttons(JSON), isVisible, sortOrder, startAt, endAt, createdAt, updatedAt
- 인덱스: (page, placement, sortOrder), (page, placement) — 정렬/재정렬 쿼리용

### 팝업 (`Popup`)

- `types/popup.ts` 참고
- 필드: id, title, description, imageUrl, buttonName, buttonLink, page, startAt, endAt, isVisible, sortOrder, createdAt, updatedAt 등

### 공지 배너 (`NoticeBar`)

- `types/notice-bar.ts` 참고
- 필드: id, message, linkUrl, backgroundColor, textColor, page, startAt, endAt, isVisible, sortOrder, createdAt, updatedAt 등

### 기간 노출·프론트 렌더링

- **표시 조건**: `isVisible = true` 이고, 현재 시각이 `startAt` ~ `endAt` 안에 있을 것
- **정렬**: `sortOrder` 오름차순
- **로딩**: `lib/content/service.ts`의 `getPageSectionsForPage(page)`, `getPopupsForPage(page)`, `getNoticeBarsForPage(page)`를 DB 조회로 교체

---

## 관리자 메뉴 구조

- **콘텐츠 관리**
  - 페이지 섹션 관리 (`/admin/page-sections`)
  - 팝업 관리 (`/admin/popups`)
  - 공지 배너 관리 (`/admin/notice-bars`)

페이지 구조 미리보기는 기존 컴포넌트(`SectionPositionPreview`, `SectionPositionPreviewPanel`)를 유지하며, PC는 sticky 플로팅 패널, 모바일은 버튼 클릭 시 모달로 동작합니다.
