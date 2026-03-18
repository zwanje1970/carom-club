# 이미지 업로드 배포 대응 및 마이그레이션

## 1. 현재 로컬 uploads 저장 로직 위치

| 위치 | 역할 |
|------|------|
| **`lib/image-upload.ts`** | 이미지 공통: `processUploadedImage()` → `uploadToBlob()`. `uploadToBlob()` 내부에서 `BLOB_READ_WRITE_TOKEN` 없고 **로컬 개발**(`VERCEL !== "1"` && `NODE_ENV !== "production"`)일 때만 `uploadToLocal()` 호출. `uploadToLocal()`이 `public/uploads` 디렉터리 생성 후 파일 쓰기, 반환 URL: `/uploads/{blobPath}`. |
| **`app/api/admin/upload-pdf/route.ts`** | PDF 업로드. `BLOB_READ_WRITE_TOKEN` 없으면 **배포 환경**(`VERCEL === "1"` 또는 `NODE_ENV === "production"`)일 때 503 반환; 로컬일 때만 `public/uploads`에 저장 후 `/uploads/...` 반환. |

- **이미지**: `lib/image-upload.ts`만 사용. `public/uploads` 쓰기는 **로컬 개발 + 토큰 없음**일 때만 발생.
- **PDF**: `upload-pdf/route.ts`가 Blob 없을 때 로컬에만 저장하도록 동일 규칙 적용.

---

## 2. Blob/외부 저장소 업로드로 바꾼 파일 목록

- **로직 변경(이미 Blob 사용, 배포 시 로컬 저장만 차단)**  
  - **`lib/image-upload.ts`**  
    - `uploadToBlob()`: `VERCEL === "1"` 뿐 아니라 **`NODE_ENV === "production"`**일 때도 로컬 저장 금지, 에러 메시지 상수 `UPLOAD_DEPLOY_REQUIRES_BLOB_MESSAGE` 분리.  
  - **`app/api/admin/upload-pdf/route.ts`**  
    - `BLOB_READ_WRITE_TOKEN` 없고 `VERCEL === "1"` 또는 `NODE_ENV === "production"`이면 **로컬 저장 시도 없이 503** 반환.

- **Blob 사용은 기존과 동일**  
  - 다음 API는 모두 `lib/image-upload.ts`의 `processUploadedImage` + `uploadToBlob` 사용. 토큰이 있으면 **항상 Vercel Blob에 업로드 후 공개 URL 반환**.
  - `app/api/admin/upload-image/route.ts` (로고/커버/프로모/팝업/히어로/섹션/배너 등)
  - `app/api/admin/site-settings/logo/route.ts`
  - `app/api/admin/site-settings/footer-partner-logo/route.ts`
  - `app/api/community/upload-image/route.ts`
  - `app/api/community/billiard-notes/upload-image/route.ts`
  - `app/api/mypage/avg-proof/route.ts`
  - `app/api/tournaments/apply/upload-avg-proof/route.ts`  
- **PDF**  
  - `app/api/admin/upload-pdf/route.ts`: 토큰 있으면 `@vercel/blob` `put()`으로만 저장, 없고 배포 환경이면 503.

---

## 3. DB에 저장되는 최종 imageUrl 예시

- **Blob 사용 시 (권장)**  
  - 예: `https://xxxxx.public.blob.vercel-storage.com/logo/20260313-cmmonwn330003a28mz71cjzjx-vbor6rhl.jpg`  
  - 또는 `https://xxxxx.public.blob.vercel-storage.com/content/20260313-abc123def.jpg`  
  - DB 컬럼(예: `SiteSettings.logoUrl`, `PageSection.imageUrl`, `Popup.imageUrl` 등)에는 **위와 같은 전체 공개 URL**만 저장.

- **로컬 개발에서 토큰 없이 업로드한 경우 (배포 시 404)**  
  - 예: `/uploads/logo/20260313-cmmonwn330003a28mz71cjzjx-vbor6rhl.jpg`  
  - 배포(Vercel) 환경에서는 해당 파일이 없으므로 **이미지 표시 불가**.  
  - **배포 후 이미지는 반드시 Blob URL로 저장되도록** Vercel에 `BLOB_READ_WRITE_TOKEN` 설정 후, 새로 업로드하거나 기존 데이터 마이그레이션 필요.

---

## 4. 기존 /uploads 데이터 처리 방안

1. **Vercel Blob 설정**  
   - Vercel 대시보드 → Storage → Blob 생성 후, `BLOB_READ_WRITE_TOKEN`을 프로젝트 환경 변수에 설정.

2. **재업로드(권장)**  
   - 로고/히어로/팝업/섹션/대회/당구장 등 관리자 화면에서 해당 이미지를 다시 업로드.  
   - 저장 시 `uploadToBlob()`가 Blob URL을 반환하므로 DB에는 `https://....blob.vercel-storage.com/...` 형태로만 저장됨.

3. **DB 마이그레이션(선택)**  
   - 기존 `/uploads/...` 경로가 들어 있는 행을 찾아서:
     - 옵션 A: 해당 파일을 로컬/백업에서 읽어 Blob에 `put()` 후 받은 URL로 UPDATE.
     - 옵션 B: `imageUrl`/`logoUrl` 등을 null 또는 placeholder용 URL로 UPDATE 후, 관리자가 필요 시 재업로드.
   - 쿼리 예(참고):  
     `SELECT id, "logoUrl" FROM "SiteSettings" WHERE "logoUrl" LIKE '/uploads/%';`  
     동일 패턴으로 `PageSection`, `Popup`, `Tournament`, `Organization` 등 imageUrl 컬럼 검색 가능.

4. **표시 시 fallback**  
   - 프론트에서는 기존처럼 `sanitizeImageSrc(imageUrl)` 사용.  
   - `/uploads/...`인 URL은 배포 환경에서 404이므로, 필요 시 `<img onError={...}>`로 placeholder로 교체하는 방식은 그대로 사용 가능.

---

## 5. 배포 후 브라우저 표시 확인 결과

- **확인 방법**  
  1. Vercel에 `BLOB_READ_WRITE_TOKEN` 설정 후 재배포.  
  2. 관리자에서 로고/히어로/팝업/섹션 이미지 등 **새로 업로드** → DB에 `https://....public.blob.vercel-storage.com/...` 저장되는지 확인.  
  3. 브라우저에서 해당 페이지 접속 후 이미지 노출 여부 확인.  
  4. (선택) DB에서 `imageUrl`/`logoUrl` 조회해 저장값이 Blob 공개 URL인지 확인.

- **기대 결과**  
  - 새로 업로드한 이미지는 **Blob 공개 URL**로 저장되고, 배포 환경에서 정상 표시.  
  - 예전에 로컬에서만 올려 `/uploads/...`로 저장된 항목은 배포 환경에서는 404이므로, 위 4절 방안(재업로드 또는 마이그레이션) 적용 후 확인.
