# 이미지 표시 최종 검증 보고서

배포 후 홈/대회/당구장/커뮤니티/관리자 화면 이미지 표시 여부 및 `/_next/image` 400 점검용 체크리스트입니다.  
**실제 검증은 배포된 사이트에서 DevTools Network로 확인해야 합니다.**

---

## 1. 정상 표시 예상 페이지 (코드 기준)

아래 페이지는 `sanitizeImageSrc` + `isOptimizableImageSrc` 분기 및 `unoptimized` 적용이 되어 있어, Vercel 배포 시 `images.unoptimized` 또는 원본 URL 직접 로드로 이미지가 표시되는 구조입니다.

| 구분 | 경로 | 이미지 출처 | 컴포넌트 |
|------|------|-------------|----------|
| **홈** | `/` | 히어로 배너/배경, 대회 포스터, 당구장 커버, 당구장 캐러셀 | HomeHero, HomeTournamentCards, HomeVenueCards, VenueCarousel |
| **대회** | `/tournaments`, `/tournaments/[id]` | posterImageUrl, imageUrl | TournamentsListWithFilters, TournamentPromoBlock, TournamentDetailView |
| **당구장** | `/v/[slug]` | logoImageUrl, coverImageUrl | app/v/[slug]/page.tsx |
| **당구장 목록** | (홈 내 섹션 등) | coverImageUrl | VenuesListWithLocation |
| **커뮤니티** | `/community`, 게시글 상세 | imageUrls, 섹션 이미지 | CommunityPostDetailView, ImageSection |
| **난구노트** | `/community/notes`, `/mypage/notes` | imageUrl | BilliardNotesListClient, BilliardNoteDetailClient (둘 다 `<img>` 사용) |
| **관리자** | `/admin/venues/[id]` | logoImageUrl, coverImageUrl | app/admin/venues/[id]/page.tsx |
| **관리자** | `/admin/settings/hero` 미리보기 | heroBackgroundImageUrl, 배너 | HeroPreviewBlock |
| **공통** | 전역 | 팝업 이미지, 푸터 파트너 로고, 헤더 로고 | Popup, SiteFooter, LogoLink |

---

## 2. 아직 안 보일 수 있는 이미지 (점검 대상)

- **DB/API에 잘못된 URL이 저장된 경우**  
  - 빈 문자열, 삭제된 Blob URL, 다른 도메인(미등록 호스트) 등 → 해당 레코드만 깨짐.
- **관리자 > 페이지 섹션**  
  - `ImageSection`: imageUrl / imageUrlMobile이 외부 URL일 때 `remotePatterns` 또는 `unoptimized`로 처리됨. Vercel이면 unoptimized로 로드.
- **OAuth/프로필 아바타**  
  - 관리자 UI의 Avatar가 외부 URL을 쓰는 경우, 이번에 `unoptimized` 추가해 두었음.

---

## 3. `/_next/image` 400 여부 (코드 기준)

- **Vercel 배포**  
  - `next.config.ts`에서 `VERCEL === "1"`일 때 `images.unoptimized: true` → **`/_next/image` 요청 자체가 없어야 함.**  
  - Network에서 `/_next/image`가 보이면 빌드 시 `VERCEL` 미설정 등 환경 이슈 가능.
- **자체 호스팅**  
  - `unoptimized` 미사용 시 `remotePatterns`에 등록된 호스트만 최적화 통과.  
  - 사용자 업로드 이미지용으로는 `NEXT_IMAGE_UNOPTIMIZED=1` 권장.

**이번 수정으로 `unoptimized` 추가한 컴포넌트 (400 가능성 제거):**

- `components/admin/ui/avatar/Avatar.tsx`
- `components/admin/tournament/ui/avatar/Avatar.tsx`
- `components/admin/tournament/header/UserDropdown.tsx`
- `components/admin/tournament/header/NotificationDropdown.tsx` (모든 Image)

---

## 4. 잘못된 원본 URL 사례 (DB/API 점검 시 참고)

| 유형 | 예시 | 대응 |
|------|------|------|
| 빈 문자열 / null | `""`, `null` | 프론트: placeholder 또는 미표시. DB 정리 권장. |
| 상대 경로만 | `uploads/xxx.jpg` | 절대 URL 또는 `/uploads/xxx.jpg`로 저장해야 함. |
| 삭제된 Blob | 404 응답 URL | 재업로드 또는 placeholder 처리. |
| HTML/JSON 반환 URL | 로그인 리다이렉트, API 엔드포인트 | URL 생성/저장 로직 수정. |
| 다른 도메인 (미등록) | `https://other-cdn.com/...` | `NEXT_PUBLIC_IMAGE_REMOTE_HOSTS`에 호스트 추가 또는 unoptimized로 처리. |

---

## 5. 추가 필요한 hostname (`NEXT_PUBLIC_IMAGE_REMOTE_HOSTS`)

현재 `next.config.ts`에 이미 포함된 호스트:

- `**.public.blob.vercel-storage.com`, `*.public.blob.vercel-storage.com`
- `NEXT_PUBLIC_SITE_URL`에서 추출한 호스트 (www / apex)
- `VERCEL_URL` 호스트
- `*.vercel.app`
- `NEXT_PUBLIC_IMAGE_REMOTE_HOSTS` (쉼표 구분)

**추가가 필요한 경우:**  
이미지가 실제로 `https://other-domain.com/...` 형태로 저장·노출된다면, 해당 도메인을 `.env`에 추가:

```env
NEXT_PUBLIC_IMAGE_REMOTE_HOSTS=other-domain.com,cdn.example.com
```

(자체 호스팅에서 unoptimized를 쓰지 않을 때만 필요. Vercel + unoptimized면 호스트 추가 없이도 표시됨.)

---

## 6. 배포 후 수동 검증 체크리스트

1. **Network (Img / Fetch)**  
   - 이미지 요청이 **원본 URL(Blob 또는 사이트 도메인)로 직접 200** 인지 확인.  
   - `/_next/image` 요청이 **없거나**, 있으면 모두 **200**인지 확인.

2. **콘솔**  
   - `INVALID_IMAGE_OPTIMIZE_REQUEST` 로그가 **없는지** 확인.

3. **페이지별 확인**  
   - `/` (히어로, 대회 카드, 당구장 카드/캐러셀)  
   - `/tournaments`, `/tournaments/[id]`  
   - `/v/[slug]` (로고, 커버)  
   - `/community`, 게시글 상세 (첨부 이미지)  
   - `/admin/venues/[id]`, `/admin/settings/hero`  
   - 팝업, 푸터 파트너 로고, 헤더 로고  

4. **깨진 이미지**  
   - 특정 페이지만 깨지면 해당 페이지에서 사용하는 **이미지 URL(Network에서 실패한 요청의 Request URL)** 을 확인하고, 위 4·5절 기준으로 원인 분류.

---

*최종 수정: 관리자 Avatar/UserDropdown/NotificationDropdown에 `unoptimized` 추가 반영.*
