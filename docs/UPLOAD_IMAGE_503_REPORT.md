# POST /api/admin/upload-image 503 원인 분석 및 보고

## 1. Vercel Function Logs 기준 503 분기 확정

### 1.1 로그로 확인할 항목

| 항목 | 의미 | 503 분기 판단 |
|------|------|----------------|
| **hasBlobToken** | `Boolean(process.env.BLOB_READ_WRITE_TOKEN)` | `false` → 토큰 미노출 가능성 |
| **blobTokenLength** | 토큰 문자열 길이 (0이면 미설정) | `0` 이면 토큰 없음 |
| **NODE_ENV** | 실행 환경 (production 등) | 참고용 |
| **VERCEL** | `"1"` 이면 Vercel 배포 환경 | `"1"` 이면서 토큰 없으면 **분기 A** |

### 1.2 코드 상 503 반환 분기 (2곳)

| 분기 | 위치 | 조건 | 로그 키워드 |
|------|------|------|-------------|
| **A** | 라우트 상단 (파일/세션 검사 직후) | `process.env.VERCEL === "1"` **이고** `!process.env.BLOB_READ_WRITE_TOKEN` | `503 조건 충족: VERCEL=1 이고 BLOB_READ_WRITE_TOKEN 없음. 반환 직전.` |
| **B** | `try/catch` 내부 (uploadToBlob 실패 후) | `isBlobConfigError(message)` 가 true | `503 조건: catch 블록 내 isBlobConfigError. message:` |

- **분기 A**가 찍히면: 런타임에서 토큰을 전혀 읽지 못한 상태.
- **분기 B**가 찍히면: 토큰은 있거나, Blob API 호출 중 예외가 발생해 `isBlobConfigError` 로 503 반환.

---

## 2. 원인별 분류

| 분류 | 설명 | 로그/조건 |
|------|------|-----------|
| **토큰 미노출** | Vercel 환경 변수에 `BLOB_READ_WRITE_TOKEN` 이 설정되지 않았거나, 런타임(Node.js Function)에서 읽히지 않음. | `hasBlobToken: false`, `blobTokenLength: 0`, **분기 A** 로그 |
| **토큰은 있으나 Blob API 호출 실패** | 토큰은 읽히지만 `uploadToBlob()` 호출 시 Vercel Blob API 오류(네트워크, 권한, 할당량 등)로 예외 발생. | `hasBlobToken: true`, **분기 B** 로그, `message` 내용으로 Blob/토큰 관련 문구 |
| **기타 예외** | 이미지 처리(`processUploadedImage`) 오류 등으로 예외가 나지만 `isBlobConfigError(message)` 가 false 인 경우. | 503이 아닌 **500** 반환. (이 경우 이미지 첨부 실패 원인은 503이 아님.) |

---

## 3. 보고 형식 (확인 후 채우기)

배포 후 이미지 업로드 실패를 재현하고, Vercel Function Logs에서 아래를 확인한 뒤 채우세요.

### 3.1 실제 503 발생 분기

- [ ] **분기 A** (VERCEL=1 이고 BLOB_READ_WRITE_TOKEN 없음)
- [ ] **분기 B** (catch 블록 내 isBlobConfigError)

### 3.2 서버 로그 내용

```
[admin/upload-image] DEBUG env: { "runtime": "...", "NODE_ENV": "...", "VERCEL": "...", "hasBlobToken": ..., "blobTokenLength": ... }
```

(위 한 줄을 복사해 붙여넣거나, hasBlobToken / blobTokenLength / NODE_ENV / VERCEL 값만 정리)

분기 B인 경우 추가:

```
[admin/upload-image] 503 조건: catch 블록 내 isBlobConfigError. message: ...
```

### 3.3 원인 판정

- [ ] **토큰 미노출** (분기 A, hasBlobToken false)
- [ ] **토큰은 있으나 Blob API 호출 실패** (분기 B, hasBlobToken true)
- [ ] **기타** (설명: ________________)

### 3.4 수정 파일

- `app/api/admin/upload-image/route.ts` — 디버그 로그 추가됨 (원인 확정 후 제거 권장)
- `components/RichEditor.tsx` — 업로드 실패 시 사용자 알림(토스트) 추가

### 3.5 UX 개선 반영 여부

- [x] **반영함** — RichEditor에서 이미지 업로드 실패 시 화면 하단 중앙에 토스트 노출 (6초 후 자동 제거):  
  "이미지 업로드에 실패했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요."

---

## 4. 수정 파일 요약

| 파일 | 변경 내용 |
|------|-----------|
| `app/api/admin/upload-image/route.ts` | 디버그 로그 유지 (hasBlobToken, blobTokenLength, NODE_ENV, VERCEL, 503 분기 로그). 원인 확정 후 제거 권장. |
| `components/RichEditor.tsx` | `useImageUpload(onUploadError)` 콜백 추가, 업로드 실패 시 토스트 메시지 표시. |
| `docs/UPLOAD_IMAGE_503_REPORT.md` | 503 분기·원인 분류·보고 형식 문서. |
