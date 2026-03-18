# 이미지 업로드 API 점검 보고

## 1. 업로드 요청 경로

| 경로 | 용도 | Blob 호출 | 토큰 없을 때(배포) |
|------|------|-----------|---------------------|
| `POST /api/admin/upload-image` | 관리자 공통 이미지(로고/배너/섹션/대회 등) | ✅ `uploadToBlob(processed)` | **503** + 선행 검사 |
| `POST /api/admin/site-settings/logo` | 사이트 로고 | ✅ `uploadToBlob(processed)` | 503 (catch) |
| `POST /api/admin/site-settings/footer-partner-logo` | 푸터 협력업체 로고 | ✅ `uploadToBlob(processed)` | 503 (catch) |
| `POST /api/community/upload-image` | 커뮤니티 게시글 첨부 | ✅ `uploadToBlob(processed)` | 503 (catch) |
| `POST /api/community/billiard-notes/upload-image` | 당구노트 테이블 이미지 | ✅ `uploadToBlob(processed)` | 503 (catch) |
| `POST /api/mypage/avg-proof` | 마이페이지 AVG 증빙 | ✅ `uploadToBlob(processed)` | 503 (catch) |
| `POST /api/tournaments/apply/upload-avg-proof` | 대회 신청 AVG 증빙 | ✅ `uploadToBlob(processed)` | 503 (catch) |

- 모든 이미지 업로드는 `lib/image-upload.ts`의 `processUploadedImage` → `uploadToBlob` 경로를 사용하며, **BLOB_READ_WRITE_TOKEN**이 있으면 `@vercel/blob`의 `put()`으로 Blob 업로드를 수행합니다.

---

## 2. 상태코드

| 상황 | 상태코드 | 본문 예시 |
|------|----------|-----------|
| 토큰 없음(배포) 또는 Blob/토큰 관련 오류 | **503** | `{ "error": "이미지 저장 설정이 되어 있지 않아 업로드할 수 없습니다. 관리자에게 문의해 주세요." }` |
| 권한 없음 | 403 | `{ "error": "권한이 없습니다." }` |
| 로그인 필요 | 401 | `{ "error": "로그인이 필요합니다." }` |
| 파일 없음/형식/용량(정책 위반) | 400 | `{ "error": "허용 형식: ..." }` 등 |
| 기타 서버 오류 | 500 | `{ "error": "업로드 중 오류가 발생했습니다." }` 또는 메시지 |

- **503**은 “Blob 설정 미비 또는 Blob API 오류”로만 사용됩니다. DB 미연결 등 다른 이유로는 사용하지 않습니다.

---

## 3. 서버 에러 메시지

- **Blob 설정 오류 시**  
  - `lib/image-upload.ts`에서 배포 환경(`VERCEL === "1"` 또는 `NODE_ENV === "production"`)이고 토큰이 없으면  
    `uploadToBlob()` 내부에서 **throw**  
    `"배포 환경에서는 이미지가 저장되지 않습니다. Vercel Blob을 사용하려면 BLOB_READ_WRITE_TOKEN을 설정하세요. ..."`  
  - 이 메시지는 `isBlobConfigError()`로 판별되며, 클라이언트에는 **503**과 함께  
    `"이미지 저장 설정이 되어 있지 않아 업로드할 수 없습니다. 관리자에게 문의해 주세요."`  
    만 노출됩니다.  
- **서버 로그**  
  - 각 라우트에서 `console.error("[경로] error:", e)`로 로그를 남기므로, Vercel 로그에서 `[admin/upload-image]`, `[avg-proof]` 등으로 Blob/토큰 관련 스택을 확인할 수 있습니다.  
  - 관리자 업로드의 경우, 토큰이 없을 때는 **선행 검사**에서  
    `[admin/upload-image] BLOB_READ_WRITE_TOKEN is not set in deployment.`  
    로그가 남습니다.

---

## 4. Blob 업로드 호출 여부

- **호출 여부**: 모든 위 이미지 업로드 API는 **실제로 Blob 업로드를 호출**합니다.  
  - `uploadToBlob(processed)` → `process.env.BLOB_READ_WRITE_TOKEN` 존재 시 `put(processed.blobPath, processed.buffer, { access: "public", contentType })` 실행.  
- **토큰이 없을 때**  
  - 배포 환경에서는 `uploadToBlob()` 진입 후 곧바로 **throw**하므로 `put()`은 호출되지 않습니다.  
  - 관리자 업로드(`/api/admin/upload-image`)는 **요청 처리 초반**에  
    `VERCEL === "1" && !BLOB_READ_WRITE_TOKEN` 이면 **즉시 503**을 반환해, 이미지 처리/Blob 호출 없이 실패합니다.

---

## 5. 파일 크기/형식 제한

- **정책**: `lib/image-policies.ts`의 `IMAGE_POLICIES`에 종류별로 정의됩니다.  
  - 예: logo 2MB, banner/venue/tournament 5MB, content/section 3MB, proof 2MB, community 3MB, billiard 2MB 등.  
- **검증 위치**: `processUploadedImage()` 내부에서  
  - `file.size > policy.maxFileSize` → throw (용량 초과)  
  - `!isAllowedMime(mime, policy)` → throw (허용 형식 아님)  
  - 위 경우 클라이언트에는 **400**과 함께 해당 메시지가 반환됩니다.  
- **Vercel 본문 크기**: 서버리스 기본 제한(예: 4.5MB)을 넘는 요청은 프레임워크/프록시 단에서 413 등으로 끊길 수 있으므로, 정책 상한(예: 5MB)과 충돌하지 않도록 주의합니다.

---

## 6. 업로드 성공 후 DB 저장

- **URL만 반환하는 API** (Blob URL 반환 후 DB 저장 없음)  
  - `POST /api/admin/upload-image`  
  - `POST /api/admin/site-settings/logo`  
  - `POST /api/admin/site-settings/footer-partner-logo`  
  - `POST /api/community/upload-image`  
  - `POST /api/community/billiard-notes/upload-image`  
  - `POST /api/tournaments/apply/upload-avg-proof`  
  → 업로드 실패 원인은 **Blob 단** 또는 **토큰/정책**으로만 보면 됩니다.  
- **DB 저장까지 하는 API**  
  - `POST /api/mypage/avg-proof`: Blob 업로드 성공 후 `prisma.memberProfile.upsert`로 `avgProofUrl` 저장.  
  → 여기서 실패하면 **500**과 함께 Prisma/DB 관련 에러가 로그에 남습니다. 이 경우 “업로드 자체 실패”가 아니라 “저장 단계 실패”로 구분할 수 있습니다.

---

## 7. 수정 파일과 수정 내용

### 7.1 `lib/image-upload.ts`
- **추가**: `BLOB_SERVICE_UNAVAILABLE_MESSAGE` (클라이언트용 503 메시지).  
- **추가**: `isBlobConfigError(message: string)`  
  - `BLOB_READ_WRITE_TOKEN`, "배포 환경에서는 이미지가 저장되지 않습니다", blob/token/unauthorized/403 등 포함 여부로 Blob 설정/API 오류 여부 판별.  
- **용도**: 모든 이미지 업로드 라우트에서 Blob 관련 실패 시 **503 + 동일 메시지**로 통일.

### 7.2 `app/api/admin/upload-image/route.ts`
- **선행 검사**: `VERCEL === "1" && !process.env.BLOB_READ_WRITE_TOKEN` 이면 **즉시 503** 반환 및 로그 출력.  
- **catch**: `isBlobConfigError(message)` 이면 **503** + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`.

### 7.3 `app/api/admin/site-settings/logo/route.ts`
- **catch**: `isBlobConfigError(message)` 이면 **503** + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`.

### 7.4 `app/api/admin/site-settings/footer-partner-logo/route.ts`
- **catch**: `isBlobConfigError(message)` 이면 **503** + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`.

### 7.5 `app/api/community/upload-image/route.ts`
- **catch**: `isBlobConfigError(message)` 이면 **503** + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`.

### 7.6 `app/api/community/billiard-notes/upload-image/route.ts`
- **catch**: `isBlobConfigError(message)` 이면 **503** + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`.

### 7.7 `app/api/mypage/avg-proof/route.ts`
- **catch**: 기존 Blob 오류 판별 로직을 `isBlobConfigError` + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`로 통일, **503** 반환.

### 7.8 `app/api/tournaments/apply/upload-avg-proof/route.ts`
- **catch**: 동일하게 `isBlobConfigError` + `BLOB_SERVICE_UNAVAILABLE_MESSAGE`로 **503** 반환.

### 7.9 `lib/uploads/image-upload.ts`
- **재노출**: `BLOB_SERVICE_UNAVAILABLE_MESSAGE`, `UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE`, `isBlobConfigError`.

---

## 8. 배포 환경에서 확인할 것

1. **BLOB_READ_WRITE_TOKEN**  
   - Vercel 프로젝트 → Settings → Environment Variables에 **Production** 등 해당 환경에 설정되어 있는지 확인.  
   - 변경 후 **Redeploy** 해야 반영됩니다.  

2. **관리자 이미지 업로드 요청**  
   - 브라우저 개발자 도구 → Network에서  
     `POST /api/admin/upload-image` (또는 로고/섹션 등 사용하는 경로)  
     - **503** 이면: 응답 본문 `error`가 `"이미지 저장 설정이 되어 있지 않아..."` 인지 확인 → 토큰 미설정 또는 Blob 오류 가능성.  
     - **500** 이면: 서버 로그에 `[admin/upload-image] error:` 또는 `[site-settings logo] upload error:` 등으로 스택 확인.  

3. **서버 로그**  
   - Vercel Dashboard → 프로젝트 → Logs (Runtime Logs)  
   - `BLOB_READ_WRITE_TOKEN is not set in deployment` 또는 `[admin/upload-image] error:` 등 Blob/토큰 관련 메시지 검색.  

4. **503이 남는 조건**  
   - **이미지 업로드**에서 503을 반환하는 경우는 다음으로 한정됩니다.  
     - 배포 환경에서 토큰이 없을 때 (`uploadToBlob` throw 또는 관리자 선행 검사).  
     - Blob API 오류 메시지가 `isBlobConfigError()`에 걸릴 때.  
   - DB 미연결 등 다른 이유로는 이미지 업로드 API가 503을 쓰지 않습니다.
