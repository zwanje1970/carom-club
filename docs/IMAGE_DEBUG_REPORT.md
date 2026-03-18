# 이미지 미표시 원인 분리 · 점검 보고

배포 후 이미지가 안 보일 때 **렌더링/원본 URL** 기준으로 원인을 나누고 점검하기 위한 문서입니다.

---

## 1. 적용한 수정 요약

### 1) 상대 경로 정규화 (`lib/image-src.ts`)

- DB/API에서 `uploads/foo.jpg`처럼 **앞에 `/` 없는 경로**가 오면 `sanitizeImageSrc`에서 **`/uploads/foo.jpg`** 로 바꿉니다.
- 배포 도메인에서 `https://도메인/uploads/foo.jpg` 로 요청되도록 해 404를 줄입니다.

### 2) 모든 이미지 출력을 `<img>` 로 통일

- `next/image`(Image) 대신 **단순 `<img src={safeSrc} ... />`** 만 사용하도록 변경했습니다.
- **원인 분리**:  
  - 이 상태에서 **이미지가 보이면** → 예전에는 CSS/레이아웃 또는 next/image 이슈.  
  - 이 상태에서도 **안 보이면** → **원본 URL/응답 문제** (아래 3·4 절 참고).

### 3) 디버깅용 `data-debug-src`

- 이미지가 있는 요소에 `data-debug-src={safeSrc}` 를 넣어두었습니다.
- **확인 방법**:  
  - DevTools → Elements → 해당 `<img>` 선택 → Attributes 에서 `data-debug-src` 값 복사  
  - 그 값을 **새 탭 주소창에 붙여 넣어** 열어보기.

### 4) 레이아웃 보정

- `min-h-[80px]`, `min-h-[120px]` 등으로 **높이가 0으로 줄어들어 이미지가 안 찍히는 경우**를 줄였습니다.

---

## 2. 컴포넌트별 점검 (보고 형식)

배포 환경에서 아래처럼 채워서 정리하면 원인 판단에 도움이 됩니다.

| 항목 | 설명 |
|------|------|
| **안 보이는 컴포넌트명** | 예: HomeHero, HomeTournamentCards, ImageSection |
| **해당 컴포넌트의 최종 safeSrc** | Elements에서 `data-debug-src` 또는 `<img src="...">` 값 |
| **새 탭에서 src 직접 열기** | 이미지 뜸 / 안 뜸 (HTML·로그인 페이지·404 등) |
| **Network 상태코드** | 해당 이미지 요청의 HTTP 상태 (200 / 404 / 401 / 403 등) |
| **최종 판정** | CSS/레이아웃 문제 vs URL/DB·API 문제 |
| **수정 파일** | 원인에 따라 수정한 파일 |
| **수정 내용** | 한 줄 요약 |

---

## 3. 원인 분류 기준

- **새 탭에서 src 주소 열었을 때 이미지가 뜸**  
  → 페이지 안에서는 **CSS/레이아웃** (hidden, overflow, 부모 크기 0 등) 쪽 점검.

- **새 탭에서 안 뜸** (404, HTML, 로그인 화면 등)  
  → **원본 URL/저장값/권한** 문제.  
  - 404: URL 잘못됨 또는 리소스 삭제.  
  - 401/403: 비공개 URL 또는 인증 필요.  
  - HTML/리다이렉트: API URL·페이지 URL을 이미지 주소로 쓰고 있는지 확인.

- **Network에서 해당 이미지 요청이 200**  
  → 서버는 정상 응답. **CSS/레이아웃**(보이지 않게 가리는 요소) 점검.

- **Network에서 404 / 401 / 403**  
  → **URL 또는 권한** 문제. DB/API에서 내려주는 `imageUrl` 등 저장값 확인.

---

## 4. CSS/레이아웃 점검 포인트

- `display: none`, `visibility: hidden`, `opacity: 0`
- `width: 0`, `height: 0`, `overflow: hidden` 으로 잘린 경우
- `position: absolute` 인데 부모에 `position`/높이 없어 영역이 0인 경우
- 부모 `flex`/`grid` 에서 자식이 찌그러져 높이 0이 된 경우

→ DevTools에서 해당 `<img>` 와 부모들을 선택해 Computed 스타일과 박스 크기를 확인하세요.

---

## 5. DB/응답 데이터 점검

- **실제 배포 환경**에서 내려오는 값 확인:
  - 예: `/api/home/tournaments`, `/api/home/venues`, 사이트 설정 API 등에서  
    `imageUrl`, `posterImageUrl`, `coverImageUrl`, `logoImageUrl`, `heroBackgroundImageUrl` 등
- **형태별로** 어떤 값이 오는지 정리:
  - `uploads/...` → 정규화 후 `/uploads/...` 로 요청됨 (같은 오리진)
  - `https://xxx.public.blob.vercel-storage.com/...` → Blob URL
  - `https://다른도메인/...` → 해당 도메인 서버/권한 확인
  - `""`, `null` → placeholder 또는 미표시 처리 여부 확인

---

## 6. 수정한 파일 목록 (이번 작업)

| 파일 | 수정 내용 |
|------|------------|
| `lib/image-src.ts` | 상대 경로 → 앞에 `/` 붙여 절대 경로로 정규화 |
| `components/home/HomeHero.tsx` | Image 제거, img + data-debug-src, min-h |
| `components/home/HomeTournamentCards.tsx` | Image 제거, img + data-debug-src |
| `components/home/HomeVenueCards.tsx` | Image 제거, img + data-debug-src |
| `components/home/VenueCarousel.tsx` | Image 제거, img + data-debug-src |
| `components/sections/ImageSection.tsx` | Image 제거, img + data-debug-src, min-h |
| `components/common/Popup.tsx` | Image 제거, img + data-debug-src |
| `components/tournament/TournamentPromoBlock.tsx` | Image 제거, img + data-debug-src |
| `components/venues/VenuesListWithLocation.tsx` | Image 제거, img + data-debug-src |
| `components/community/CommunityPostDetailView.tsx` | Image 제거, img + data-debug-src |
| `components/intro/LogoLink.tsx` | Image 제거, img + data-debug-src |
| `components/tournaments/TournamentsListWithFilters.tsx` | Image 제거, img + data-debug-src |
| `app/v/[slug]/page.tsx` | 로고/커버/프로모 Image → img, data-debug-src |
| `app/admin/venues/[id]/page.tsx` | 로고/커버 Image → img, data-debug-src |
| `app/admin/settings/hero/HeroPreviewBlock.tsx` | Image 제거, img + data-debug-src |

---

## 7. URL/저장 문제: Vercel 배포

### 7.1 `/uploads` 경로가 404가 나는 이유

- Vercel(및 대부분 서버리스)에서는 **요청마다 파일시스템이 일시적**입니다.
- API에서 `public/uploads`에 파일을 써도, 그 파일은 **다음 요청이나 정적 배포에 포함되지 않습니다.**
- 따라서 DB에 **`/uploads/xxx.jpg`** 로 저장된 URL은 배포 환경에서 **항상 404**입니다.

### 7.2 저장되는 URL 형태

| 환경 | BLOB_READ_WRITE_TOKEN | 업로드 결과 URL |
|------|------------------------|-----------------|
| 로컬 | 없음 | `/uploads/content/20250101-abc.jpg` (로컬에서만 유효) |
| 로컬 | 있음 | `https://xxx.public.blob.vercel-storage.com/...` |
| Vercel 배포 | 없음 | **에러 반환** (업로드 불가, 새로 추가된 방어 로직) |
| Vercel 배포 | 있음 | `https://xxx.public.blob.vercel-storage.com/...` |

### 7.3 배포 후 이미지가 안 보일 때 점검 순서

1. **실제 src 수집**  
   - 배포 사이트에서 안 보이는 이미지 1~3개 선정.  
   - DevTools → Elements → 해당 `<img>` → `data-debug-src` 또는 `src` 값 복사.

2. **새 탭에서 해당 URL 직접 열기**  
   - **이미지 표시** → CSS/레이아웃 문제.  
   - **404** → URL/저장 문제.  
     - `https://도메인/uploads/...` 이면: 과거에 로컬처럼 저장된 값. **재업로드** 하거나, Blob 사용 후 해당 필드를 Blob URL로 갱신해야 함.  
     - Blob URL인데 404면: Blob 삭제/만료 또는 저장 실패 이력 확인.  
   - **401/403** → 비공개 Blob/권한 설정 확인.  
   - **HTML/JSON** → 잘못된 URL이 DB/API에 들어간 경우. 저장/제공 로직 수정.

3. **Network 탭에서 해당 요청 상태코드 확인**  
   - 200 → 응답은 정상, CSS/가림 문제.  
   - 4xx → 위 URL/저장 대응.

4. **DB 원본값 확인 (URL 문제일 때)**  
   - Prisma Studio 또는 해당 API 응답에서 `imageUrl`, `coverImageUrl`, `logoUrl` 등 **원본 저장값** 확인.  
   - `/uploads/...` 또는 `uploads/...` 가 들어 있으면 배포 환경에서는 404.  
   - **조치**: BLOB_READ_WRITE_TOKEN 설정 후, 해당 이미지 **재업로드**하여 Blob URL로 갱신.

### 7.4 수정 사항 (업로드/저장 로직)

- **`lib/image-upload.ts`**  
  - **Vercel(`VERCEL=1`)인데 `BLOB_READ_WRITE_TOKEN`이 없으면** `uploadToLocal` 대신 **에러를 던지도록** 변경했습니다.  
  - 이렇게 해서 배포 환경에서 `/uploads/...` URL이 **새로 저장되는 것**을 막습니다.  
- 이미 **DB에 `/uploads/...` 로 들어가 있는 값**은 코드로 자동 수정되지 않습니다.  
  - 해당 레코드에서 이미지를 **다시 업로드**해 Blob URL로 바꾸거나, DB를 직접 Blob URL로 갱신해야 합니다.

---

배포 후에는 위 표를 채워 **어느 컴포넌트가 어떤 safeSrc 로 요청하고, 새 탭/Network 결과가 어떤지** 정리하면 다음 수정 방향을 정하기 쉽습니다.
