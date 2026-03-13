# 이미지 자동 최적화 시스템 보고서

## 1. 현재 이미지 처리 구조 (분석 결과)

### 업로드 위치
| 용도 | API 경로 | 저장 경로(Blob) | 비고 |
|------|----------|-----------------|------|
| 로고 | `POST /api/admin/site-settings/logo` | `logo/YYYYMMDD-xxx.ext` | 관리자 사이트 설정 |
| 에디터 본문 | `POST /api/admin/upload-image` | `content/YYYYMMDD-{sessionId}-xxx.webp` | RichEditor(홍보/요강/참가설정) |
| 참가신청 증빙 | `POST /api/mypage/avg-proof` | `proof/YYYYMMDD-{userId}-xxx.jpg` | 마이페이지 AVG 증빙 |

### 표시 위치
| 이미지 종류 | 표시 위치 | 방식 |
|-------------|-----------|------|
| 로고 | `components/intro/LogoLink.tsx`, 관리자 사이트 설정 미리보기 | next/image (비 SVG), img (SVG) |
| 당구장 소개 | Organization.promoPublished HTML 내부 이미지 | dangerouslySetInnerHTML (에디터 본문) |
| 대회 홍보/요강 | Tournament.description, outlinePublished, entryConditions | dangerouslySetInnerHTML |
| 에디터 본문 이미지 | 위 HTML 내 삽입된 img URL | 업로드 시 content 정책으로 이미 최적화 |
| 증빙 이미지 | `app/mypage/page.tsx` | next/image |

### 공통 컴포넌트
- **RichEditor** (`components/RichEditor.tsx`): 이미지 업로드 시 `/api/admin/upload-image` 호출 → 동일 API가 content 정책 적용
- **로고 업로드**: 관리자 사이트 설정 페이지에서 직접 FormData로 `/api/admin/site-settings/logo` 호출
- **증빙 업로드**: `AvgProofUpload` 등에서 `/api/mypage/avg-proof` 호출

### 저장 방식
- **Vercel Blob** (환경 변수 `BLOB_READ_WRITE_TOKEN`)
- 모든 업로드가 Blob에만 저장, DB에는 URL만 저장 (SiteSetting.logoUrl, MemberProfile.avgProofUrl, 본문 HTML 내 img src)

---

## 2. 제안한 최적화 구조

### 공통 유틸/서비스
- **`lib/image-policies.ts`**: 이미지 종류별 정책(logo, banner, venue, tournament, content, proof, thumbnail). maxWidth, quality, format, maxFileSize, blobPathPrefix 등.
- **`lib/image-optimizer.ts`**: sharp 기반 리사이즈·포맷 변환. SVG는 원본 유지. 실패 시 원본 반환.
- **`lib/image-upload.ts`**: `processUploadedImage(file, policy)` → 검증 + 최적화 + Blob 경로 생성, `uploadToBlob(processed)` → Blob put.

### 이미지 종류별 정책
| 종류 | maxWidth | format | quality | maxFileSize | 경로 |
|------|----------|--------|---------|-------------|------|
| logo | 800 | original | - | 2MB | logo/ |
| banner | 1600 | webp | 78 | 5MB | banner/ |
| venue | 1200 | webp | 78 | 5MB | venue/ |
| tournament | 1600 | webp | 78 | 5MB | tournament/ |
| **content** | 1200 | webp | 75 | 5MB | content/ |
| **proof** | 2000 | jpeg | 85 | 8MB | proof/ |
| thumbnail | 400 | webp | 72 | 2MB | thumb/ |

### 업로드 처리 방식
- 허용 확장자: 정책별 allowedMimeTypes (로고는 SVG 포함)
- 파일 크기: 정책별 maxFileSize 초과 시 400 + 메시지
- 리사이즈: sharp로 maxWidth 초과 시 비율 유지 리사이즈
- 포맷: content/proof 등은 webp/jpeg 변환, 로고는 original
- Blob 경로: `{prefix}/YYYYMMDD-{suffix?}-{random}.{ext}`

### 표시 최적화 방식
- **next/image** 적용: LogoLink(비 SVG), 마이페이지 증빙 이미지. `next.config.ts`에 `images.remotePatterns`로 `*.public.blob.vercel-storage.com` 허용.
- **본문(prose) 이미지**: `globals.css`에서 전역 `img { max-width: 100%; height: auto; }` 적용으로 최대 폭 제한.
- 에디터 업로드 이미지는 이미 content 정책(1200px, webp 75)으로 저장되므로 본문에서 그대로 사용.

---

## 3. 실제 수정한 파일

| 파일명 | 수정 이유 | 핵심 변경 |
|--------|-----------|-----------|
| `lib/image-policies.ts` | 신규 | 종류별 정책 상수 (IMAGE_POLICIES, getOutputExtension) |
| `lib/image-optimizer.ts` | 신규 | sharp 기반 optimizeImage(), SVG 원본 유지, isAllowedMime() |
| `lib/image-upload.ts` | 신규 | processUploadedImage(), uploadToBlob(), buildBlobPath(), BLOB_TOKEN_MISSING_MESSAGE |
| `app/api/admin/site-settings/logo/route.ts` | 로고 업로드 최적화 | processUploadedImage(logo) + uploadToBlob, 경로 logo/ |
| `app/api/admin/upload-image/route.ts` | 에디터 이미지 최적화 | processUploadedImage(content) + uploadToBlob, 경로 content/ |
| `app/api/mypage/avg-proof/route.ts` | 증빙 최적화 | processUploadedImage(proof) + uploadToBlob, 경로 proof/ |
| `next.config.ts` | next/image 원격 허용 | images.remotePatterns: *.public.blob.vercel-storage.com |
| `components/intro/LogoLink.tsx` | 표시 최적화 | next/image 사용 (비 SVG), SVG는 img 유지 |
| `app/mypage/page.tsx` | 표시 최적화 | 증빙 이미지 next/image (fill, sizes) |
| `app/admin/settings/site/page.tsx` | 안내 문구 | 로고 업로드 설명에 최적화/용량 안내 추가 |

---

## 4. 적용 완료 기능

- **자동 리사이즈**: 정책 maxWidth 초과 시 sharp로 비율 유지 리사이즈
- **포맷 변환**: content → webp 75, proof → jpeg 85, 로고 → original(SVG 포함)
- **용량 제한**: 정책별 maxFileSize (로고 2MB, 일반 5MB, 증빙 8MB), 초과 시 400 + 메시지
- **next/image 적용**: 로고(비 SVG), 마이페이지 증빙
- **lazy loading**: next/image 기본 적용
- **에러 메시지**: 허용 형식/용량 초과/파일 선택 등 사용자용 메시지, Blob 토큰 없음 503 + 관리자 문의 안내
- **저장 경로 구조화**: logo/, content/, proof/ 접두사로 구분
- **썸네일 생성**: 정책(thumb)만 정의, 별도 API/자동 생성 미구현

---

## 5. 아직 남은 작업

- **썸네일 생성**: 카드/목록용 400px WebP 생성 API 또는 대회/당구장 이미지 저장 시 썸네일 병렬 생성 미구현.
- **대회 대표 이미지(Tournament.imageUrl)**: DB 필드는 있으나 업로드 API/UI 없음. 필요 시 tournament 정책으로 API 추가.
- **배너/당구장 전용 업로드**: banner, venue 정책은 정의만 되어 있고 전용 API는 없음. 필요 시 동일 패턴으로 API 추가.
- **Blob 연동 상태 노출**: 연동 설정 페이지에서 BLOB_READ_WRITE_TOKEN 유무에 따라 “이미지 저장 사용 가능/불가” 안내 가능.

---

## 6. 주의사항

- **로고**: format original, 압축 최소. SVG는 sharp 통과 안 하고 원본 유지.
- **증빙 이미지**: jpeg 85, maxWidth 2000으로 글씨/기록 식별 가능하도록 화질 우선. 과도한 압축 금지.
- **sharp**: 서버(API Route) 전용. Vercel Serverless에서 사용 가능. sharp 실패 시 원본 버퍼 그대로 저장하도록 fallback 처리됨.
- **BLOB_READ_WRITE_TOKEN 미설정 시**: 로고/에디터/증빙 업로드 모두 503, 사용자/관리자용 메시지로 “이미지 저장 설정이 되어 있지 않습니다” 안내.
