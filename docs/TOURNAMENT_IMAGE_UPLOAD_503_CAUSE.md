# 대회 생성/대회 안내 이미지 첨부가 안 되는 원인

## 현상
- 대회 생성·수정, 대회요강(안내) 편집 시 에디터에 이미지를 붙여넣기·드래그·파일 선택해도 **이미지가 삽입되지 않음**.

## 흐름

1. **에디터**: 대회 설정 수정(`TournamentEditForm`), 대회요강 편집(`OutlineEditor`), 대회 생성(`TournamentNewForm`) 등에서 **RichEditor**(`RichEditorLazy`) 사용.
2. **이미지 업로드**: RichEditor 내부 `useImageUpload()`가 이미지 선택/드래그/붙여넣기 시 **`POST /api/admin/upload-image`** 호출.
3. **API**: `app/api/admin/upload-image/route.ts`에서 세션 검사 후 Blob 저장.  
   - 배포(Vercel)에서는 **`BLOB_READ_WRITE_TOKEN`** 필요.  
   - 토큰이 없거나 Blob API 오류 시 **503** 반환.

## 원인 (503으로 첨부 실패)

| 구분 | 설명 |
|------|------|
| **직접 원인** | 배포 환경에서 **`/api/admin/upload-image`가 503**을 반환함. |
| **503이 나는 경우** | ① `VERCEL=1`인데 `BLOB_READ_WRITE_TOKEN`이 없음 (라우트 상단 분기)  
 ② `uploadToBlob()` 호출 중 예외 발생 후 `isBlobConfigError(message)`가 true인 경우 (토큰/Blob 관련 메시지). |
| **사용자 체감** | API가 503을 반환 → `useImageUpload`에서 `throw new Error(errorMessage)` → RichEditor는 `.then(..., (err) => console.error(err))`만 해서 **콘솔에만 에러 출력**, 화면에는 토스트/메시지 없음 → **“이미지가 첨부가 안 된다”**로 보임. |

즉, **이미지 첨부가 안 되는 이유 = 배포에서 업로드 API가 503을 내고 있고, 그 에러를 UI에서 알려주지 않기 때문**입니다.

## 확인 방법

1. **배포 사이트**에서 관리자로 로그인 → 대회 수정 또는 대회요강 편집 페이지 이동.
2. 에디터에 이미지 붙여넣기(또는 드래그).
3. 브라우저 **개발자 도구 → Network**에서 `upload-image` 요청 확인.
   - **Status 503** 이면 위 503 조건(토큰/Blob) 문제.
4. **Vercel Function Logs**에서 `[admin/upload-image] DEBUG env:` 및 `503 조건 충족` / `503 조건: catch 블록 내 isBlobConfigError` 로그로 어디서 503이 나는지 확인.

## 수정 방향

1. **503 제거 (근본)**  
   - Vercel 프로젝트 **Environment Variables**에 **`BLOB_READ_WRITE_TOKEN`** 설정 후 재배포.  
   - (이미 설정했는데도 503이면) 같은 라우트에 추가한 **디버그 로그**로 `hasBlobToken`, `blobTokenLength` 확인해, 런타임에서 토큰이 비어 있는지 검사.
2. **에러 노출 (UX)**  
   - RichEditor의 `uploadImage` 실패 시 `console.error`만 하지 말고, 토스트/알림으로 “이미지 업로드에 실패했습니다. 관리자에게 문의해 주세요.” 등 메시지 표시 (선택).

## 관련 파일

- `app/api/admin/upload-image/route.ts` — 업로드 API, 503 반환 및 디버그 로그
- `components/RichEditor.tsx` — `useImageUpload()`, `handleDrop` / `handlePaste` / 이미지 버튼에서 업로드 후 실패 시 `console.error`만 호출
- `lib/image-upload.ts` — `uploadToBlob`, `isBlobConfigError`
