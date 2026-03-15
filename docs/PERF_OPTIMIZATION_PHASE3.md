# 캐롬클럽 3차 성능 최적화 보고서

실서비스 기준 3차 최적화 적용 내용과 효과를 정리한 문서입니다.

---

## 1. 공통 fetch 통합 (layout/캐시)

### 적용 내용
- **`lib/common-page-data.ts`** 추가
  - `getCommonPageData(page)`: copy, siteSettings, noticeBars, popups, pageSections를 **한 번에 조회**, `unstable_cache`로 **60초 재검증**
  - 페이지 slug: `home` | `tournaments` | `venues` | `community`
- **공개 페이지 전환**
  - **홈** (`app/page.tsx`): `getCommonPageData("home")` 1회 호출로 통합
  - **대회 목록** (`app/tournaments/page.tsx`): `getCommonPageData("tournaments")`
  - **당구장 목록** (`app/venues/page.tsx`): `getCommonPageData("venues")`
  - **커뮤니티** (`app/community/page.tsx`): `getCommonPageData("community")`
  - **대회 상세** (`app/tournaments/[id]/page.tsx`): `getCommonPageData("tournaments")`로 copy/공통 데이터 캐시 활용
- **`getSiteSettings()`** (`lib/site-settings.ts`): 내부 로직을 `unstable_cache`로 감싸 **60초 캐시** 적용 (레이아웃·API 등 반복 호출 시 캐시 hit)

### 효과
- 페이지마다 하던 **copy / noticeBars / popups / siteSettings / pageSections** 개별 요청이 **페이지당 1회 통합** + **동일 데이터 재요청 시 캐시에서 반환**
- 공개 페이지 간 이동 시 동일 slug 재방문 또는 60초 이내 재방문 시 **공통 데이터 재요청 감소** → 체감 속도 개선

---

## 2. 이미지 썸네일 시스템

### 현재 상태
- **`lib/image-policies.ts`**에 `thumbnail` 정책 이미 존재 (400px, webp, quality 72, blobPathPrefix: `"thumb"`)
- **`lib/image-upload.ts`**의 `processUploadedImage`는 정책당 1개 결과만 반환
- **`app/api/admin/upload-image/route.ts`**는 단일 정책으로 1회 업로드
- DB/API에는 `posterImageUrl`, `imageUrl` 등만 있고, **썸네일 전용 URL 필드**는 아직 없음

### 권장 후속 작업
1. 업로드 시 **원본 + 썸네일(thumbnail 정책)** 두 개 생성·저장하고, 응답에 `url`, `thumbnailUrl` 반환
2. Tournament 등 스키마에 **`posterThumbnailUrl`** 등 썸네일 URL 필드 추가 (마이그레이션)
3. 목록/카드/메인 섹션에서는 **썸네일 URL** 사용, 상세 페이지만 **원본 또는 큰 이미지** 사용하도록 컴포넌트 분리

---

## 3. 대회 상세 DB 조회 분리

### 적용 내용
- **`lib/db-tournaments.ts`**
  - **`getTournamentBasic(id)`**: organization, rule, matchVenues, _count만 포함, **entries 제외** → 첫 응답 경량화
  - **`getTournamentEntries(id)`**: 엔트리 목록만 별도 조회 (user, memberProfile 포함)
- **대회 상세 페이지** (`app/tournaments/[id]/page.tsx`)
  - **첫 로드**: `getTournamentBasic(id)` + `getCommonPageData("tournaments")`만 수행, **getSession() 제거**
  - **Suspense**: `<TournamentDetailWithEntries>`에서 **후속 로딩**으로 `getTournamentEntries(id)` + `getSession()` 병렬 호출 후 상세 뷰 렌더
  - 엔트리/참가자 명단·참가신청 탭 데이터는 **스트리밍**으로 도착해 체감 지연 완화
- **`components/tournament/TournamentDetailWithEntries.tsx`**: 엔트리·세션 조회 후 `TournamentDetailView`에 전달하는 async 서버 컴포넌트

### 효과
- 첫 응답에서 **entries(참가자 목록) 제거**로 DB 부하·페이로드 감소
- **세션**은 공개 페이지 첫 페이로드에서 제거되고, Suspense 경계 안에서만 조회 → **비로그인 사용자 TTFB 개선**
- 탭/섹션별 후속 로딩으로 **첫 화면(대회요강 등)이 먼저 보이고**, 참가자/참가신청 데이터는 이어서 표시

---

## 4. 공개 페이지 session 최소화

### 적용 내용
- **대회 상세** (`app/tournaments/[id]/page.tsx`): 서버에서 **getSession() 제거** → Suspense 내부 `TournamentDetailWithEntries`에서만 `getSession()` 호출
- 공개 **홈/목록/커뮤니티**는 원래부터 세션 의존 없음; 대회 상세만 세션 의존이 있었고 이를 **후속 로딩**으로 이동

### 효과
- 공개 대회 상세 첫 바이트가 **세션 DB/쿠키 조회 대기 없이** 전송되도록 되어 비로그인 사용자 체감 속도 개선

---

## 5. Dynamic import (관리자/클라이언트)

### 적용 내용
- **RichEditor(Tiptap)**  
  - **`components/RichEditorLazy.tsx`** 추가: `dynamic(import("@/components/RichEditor"), { ssr: false })` + 로딩 placeholder  
  - 아래에서 **RichEditor → RichEditorLazy** 교체:
    - `components/admin/OutlineEditor.tsx`
    - `components/admin/PromoEditor.tsx`
    - `components/admin/tournament/EntrySettingsSection.tsx`
    - `app/client/tournaments/new/page.tsx`
    - `app/client/tournaments/[id]/edit/page.tsx`
- **대진표 편집**: `BracketManualEdit`은 **서버 컴포넌트 페이지**에서 사용되므로 `ssr: false` dynamic 사용 불가 → **일반 import 유지** (Next 15 서버 컴포넌트 제약)

### 효과
- Tiptap 번들이 **초기 로드에서 분리**되어, 해당 에디터가 필요한 관리자/클라이언트 페이지의 **초기 JS·hydration 부담 감소**

---

## 6. 웹폰트·외부 리소스

### 적용 내용
- **layout.tsx**: 웹폰트 링크에 주석으로 **Google Fonts는 `display=swap` 사용** 명시 (이미 URL에 `display=swap` 포함)
- **getSiteSettings** 60초 캐시로 레이아웃·공통 데이터 요청 시 DB 반복 조회 감소

### 권장 후속
- 불필요한 폰트 제거·통합 검토
- 핵심 폰트만 **preload** 선별
- CDN 폰트가 초기 렌더를 막지 않도록 **비동기 로딩** 검토

---

## 7. 무거운 페이지 5개 측정 (구분 항목)

실제 측정은 **실서비스/스테이징**에서 다음 항목으로 진행하는 것을 권장합니다.

| 페이지 | 서버 응답 시간 | 클라이언트 hydration | 이미지 총 용량 | JS 번들 영향 | 공통 fetch 중복 |
|--------|----------------|----------------------|----------------|-------------|-----------------|
| **홈 (/) ** | getCommonPageData 1회 + hero, DB 4건 | ContentLayer(Popup dynamic), HomeDeferredSections | 메인 섹션 이미지 | 141 kB First Load | **감소** (공통 1회·캐시) |
| **대회 목록** | getCommonPageData 1회 + getTournamentsListRaw | 목록 즉시 | 포스터 썸네일(썸네일 도입 시 추가 절감) | 115 kB | **감소** |
| **대회 상세** | getTournamentBasic + getCommonPageData, no session | Suspense로 엔트리/세션 후속 | 상세 포스터 등 | 118 kB | **감소**, 첫 응답 경량화 |
| **당구장 목록** | getCommonPageData 1회 + venues | VenuesListWithLocation | 커버 이미지 | 137 kB | **감소** |
| **관리자 사이트 설정** | - | Tiptap 등 무거운 UI | - | 175 kB | - |

- **공통 fetch 중복**: 3차에서 **getCommonPageData + getSiteSettings 캐시**로 대부분 페이지에서 감소
- **썸네일**: 도입 시 목록/카드/메인 이미지 용량·로딩 시간 추가 절감 가능

---

## 8. 최종 요약

| 항목 | 내용 |
|------|------|
| **줄어든 공통 fetch** | copy, noticeBars, popups, siteSettings, pageSections를 **페이지당 1회** + **60초 캐시**로 통합; getSiteSettings도 60초 캐시 |
| **썸네일 시스템** | 정책·인프라는 존재; **업로드 이원화·DB 필드·목록/상세 분리**는 후속 작업으로 권장 |
| **대회 상세 DB** | **첫 응답**: Basic(org, rule, matchVenues, _count만); **엔트리·세션**은 Suspense 후속 로딩으로 분리 |
| **Dynamic import** | **RichEditor** → RichEditorLazy(ssr:false) 적용; BracketManualEdit은 서버 컴포넌트 제약으로 일반 import 유지 |
| **남은 병목** | ① 이미지 썸네일 전면 적용 ② 웹폰트 preload·비동기 로딩 ③ 관리자/클라이언트 무거운 차트·도구 추가 dynamic 분리 |
| **예상 체감** | 공개 페이지 이동 시 **공통 데이터 재요청 감소**, 대회 상세 **첫 화면·TTFB 개선**, 에디터 사용 페이지 **초기 hydration 부담 감소** |

---

## 9. 빌드·린트

- **`npm run lint`**: 통과 (기존 경고만 존재, 3차 변경으로 인한 신규 에러 없음)
- **`npm run build`**: 통과 (타입·ESLint 오류 없이 배포 가능 상태)
