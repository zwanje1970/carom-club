"use client";

/**
 * 대회카드 편집(v2) 배경 이미지 파일 업로드 전용 — 공개 메인 등 다른 라우트에서 import 하지 않는다.
 * 고해상도 원본 대신 표시 방향 기준 JPEG 축소본만 `/api/upload/image` 로 보낸다.
 */

const JPEG_QUALITY = 0.82;

/** 저장·상세(w640 슬롯)에 맞춘 업로드 본문 상한 — 긴 변 기준 */
const UPLOAD_LONG_EDGE_PRIMARY_PX = 640;

/**
 * 카드 미리보기·배경(w320 슬롯)은 서버가 업로드본에서 폭 320 변형을 만들며, 여기서는 긴 변 360급 재시도를 포함한다.
 * 업로드 본문은 긴 변 최대 640 JPEG 한 장이며, 서버가 동일 입력으로 w320/w640 을 생성한다.
 */
const RETRY_LONG_EDGE_PX = [480, 360, 320] as const;

async function decodeOrientedBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return await createImageBitmap(file);
  }
}

async function bitmapToJpegBlob(bitmap: ImageBitmap, longEdgeMax: number): Promise<Blob> {
  const w = bitmap.width;
  const h = bitmap.height;
  const longEdge = Math.max(w, h);
  const scale = longEdge <= 0 ? 1 : Math.min(1, longEdgeMax / longEdge);
  const tw = Math.max(1, Math.round(w * scale));
  const th = Math.max(1, Math.round(h * scale));

  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("canvas 2d unsupported");
  }
  ctx.drawImage(bitmap, 0, 0, tw, th);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", JPEG_QUALITY);
  });
  if (!blob || blob.size === 0) {
    throw new Error("jpeg encode failed");
  }
  return blob;
}

/**
 * 원본 파일을 표시 방향 기준으로 디코드한 뒤 긴 변이 `UPLOAD_LONG_EDGE_PRIMARY_PX` 를 넘지 않는 JPEG 로 만든다.
 * 변환 실패 시 480 → 360 → 320px 긴 변 순으로 재시도한다.
 */
export async function normalizeCardEditorBackgroundUpload(file: File): Promise<File> {
  const bitmap = await decodeOrientedBitmap(file);
  try {
    const attempts = [UPLOAD_LONG_EDGE_PRIMARY_PX, ...RETRY_LONG_EDGE_PX];
    let lastErr: unknown;
    for (const edge of attempts) {
      try {
        const blob = await bitmapToJpegBlob(bitmap, edge);
        const base =
          file.name.replace(/\.[^.\\/]+$/i, "").trim() || "card-background";
        return new File([blob], `${base}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
  } finally {
    bitmap.close();
  }
}
