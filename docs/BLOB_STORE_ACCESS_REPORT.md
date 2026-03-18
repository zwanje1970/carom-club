# Vercel Blob 스토어 접근 정책 보고서

## 원인

- **에러**: `Cannot use public access on a private store. The store is configured with private access.`
- **원인**: Vercel Blob 스토어가 **private**로 생성되어 있는데, 코드에서는 `put()` 호출 시 `access: "public"`을 사용하고 있음.

---

## 1. public access를 사용하는 코드 위치

| 파일 | 위치 | 내용 |
|------|------|------|
| **lib/image-upload.ts** | 119–126행 | `uploadToBlob()` 내부 `put(..., { access: options?.access ?? "public", contentType })` — 기본값 **public** |
| **app/api/admin/upload-pdf/route.ts** | 50–53행 | `put(blobPath, buffer, { access: "public", contentType: "application/pdf" })` — 명시적 **public** |

**호출 경로 (모두 `uploadToBlob()` → 위 `put()` 사용):**

- `app/api/admin/upload-image/route.ts`
- `app/api/admin/site-settings/logo/route.ts`
- `app/api/admin/site-settings/footer-partner-logo/route.ts`
- `app/api/community/upload-image/route.ts`
- `app/api/community/billiard-notes/upload-image/route.ts`
- `app/api/mypage/avg-proof/route.ts`
- `app/api/tournaments/apply/upload-avg-proof/route.ts`

---

## 2. 현재 서비스에 맞는 정책: **public 권장**

- **용도**: 로고, 배너, 커뮤니티 이미지, AVG 증빙, 대회 이미지, 프로모션 PDF 등 → 모두 **공개 URL로 저장 후 DB에 URL만 저장**하고, 프론트에서 `<img src={url}>` / `<a href={url}>` 로 직접 노출.
- **결론**: URL만 알면 누구나 접근하는 구조이므로, 스토어를 **public**으로 두는 것이 현재 설계와 일치하고 구현도 단순함.
- **private 유지 시**: `access: "private"`로 바꾸고, 이미지/PDF 표시를 **서버 API에서 signed URL 또는 `get()`으로 읽어서 반환**하는 방식으로 전면 재설계 필요 (DB에 저장된 URL만으로는 접근 불가).

---

## 3. 조치: 스토어를 public으로 사용하기

Vercel에서는 **기존 스토어의 접근 타입(public/private)을 변경할 수 없습니다.**  
private 스토어를 그대로 두고 코드만 바꿀 수는 없고, 다음 둘 중 하나가 필요합니다.

### 옵션 A (권장): 새 **public** Blob 스토어 생성 후 토큰 교체

1. **Vercel 대시보드**
   - 프로젝트 → **Storage** → **Create Database** → **Blob** 선택  
   - **Access** 를 **Public** 으로 선택 후 스토어 생성  
   - 생성된 스토어에 연결된 **BLOB_READ_WRITE_TOKEN** 이 프로젝트 환경 변수에 자동 추가됨 (기존 토큰이 있으면 새 스토어용 토큰으로 **교체** 필요할 수 있음).

2. **CLI 사용 시**
   ```bash
   vercel blob create-store <store-name> --access public
   ```
   - 팀/프로젝트에 스토어 연결 후, 해당 스토어의 토큰을 프로젝트 환경 변수 `BLOB_READ_WRITE_TOKEN` 으로 설정.

3. **코드 변경**: 없음. 현재 코드는 이미 `access: "public"` 을 전제로 하므로, **public 스토어 + 위 토큰**이면 업로드 성공.

### 옵션 B: 기존 스토어를 private 로 유지

1. **코드 수정**
   - `lib/image-upload.ts`: `put(..., { access: "private", ... })` (또는 `options?.access ?? "private"`).
   - `app/api/admin/upload-pdf/route.ts`: `put(..., { access: "private", ... })`.
2. **프론트/표시 방식 재설계**
   - DB에는 blob path 또는 blob URL을 저장하고, 실제 노출은 **API 라우트**에서 `@vercel/blob` 의 `get()` 으로 읽어서 스트리밍하거나, signed URL을 생성해 반환하는 방식으로 변경해야 함.  
   - 모든 `<img src={url}>` / `<a href={url}>` 가 **해당 API 경로**를 가리키도록 수정 필요.

---

## 4. 수정 파일 및 Vercel 설정 요약

| 구분 | 내용 |
|------|------|
| **코드 수정 (옵션 A)** | 없음. public 스토어 + 올바른 토큰만 필요. |
| **코드 수정 (옵션 B)** | `lib/image-upload.ts`, `app/api/admin/upload-pdf/route.ts` 에서 `access: "private"` 로 변경 + 이미지/PDF 제공 API 및 프론트 전반 수정. |
| **Vercel 설정 (옵션 A)** | 새 Blob 스토어를 **Public** 으로 생성하고, 해당 스토어의 `BLOB_READ_WRITE_TOKEN` 을 프로젝트 환경 변수에 설정(기존 private 스토어 토큰 대체). |
| **변경 후 업로드 성공 여부** | 옵션 A 적용 후 동일 API로 업로드 시도하여 200 + `url` 수신 여부로 확인. |

---

## 5. 참고

- [Vercel Blob - Public Storage](https://vercel.com/docs/storage/vercel-blob/public-storage)
- [Vercel Blob - Private Storage](https://vercel.com/docs/vercel-blob/private-storage)
- 스토어 생성 시 선택한 **Access** 가 해당 스토어에 고정되며, 이후 대시보드에서 public ↔ private 전환 불가.
