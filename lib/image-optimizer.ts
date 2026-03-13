/**
 * 서버 전용 이미지 최적화 (sharp)
 * - API Route에서만 사용. 클라이언트 번들에 포함되지 않도록 동적 import 또는 서버 전용 모듈로 유지.
 */

import type { ImagePolicy } from "./image-policies";

export interface OptimizeResult {
  buffer: Buffer;
  contentType: string;
  width: number;
  height: number;
}

/** 입력이 SVG면 true. SVG는 sharp로 처리하지 않음 */
function isSvg(mime: string, buffer: Buffer): boolean {
  if (mime === "image/svg+xml") return true;
  const head = buffer.slice(0, 256).toString("utf8");
  return /<svg[\s>]/i.test(head);
}

/**
 * 이미지 버퍼를 정책에 따라 리사이즈·포맷 변환.
 * SVG는 원본 유지. sharp 실패 시 원본 버퍼 반환 (에러 throw 안 함).
 */
export async function optimizeImage(
  inputBuffer: Buffer,
  mimeType: string,
  policy: ImagePolicy
): Promise<OptimizeResult> {
  if (policy.allowSvg && isSvg(mimeType, inputBuffer)) {
    return {
      buffer: inputBuffer,
      contentType: "image/svg+xml",
      width: 0,
      height: 0,
    };
  }

  try {
    const sharp = (await import("sharp")).default;
    let pipeline = sharp(inputBuffer, { failOnError: false });
    pipeline = pipeline.rotate(); // EXIF 제거 및 방향 정규화
    const meta = await pipeline.metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    const needResize =
      policy.maxWidth > 0 &&
      w > policy.maxWidth &&
      (policy.maxHeight <= 0 || (policy.maxHeight > 0 && h > policy.maxHeight));
    if (needResize) {
      pipeline = pipeline.resize({
        width: policy.maxWidth,
        height: policy.maxHeight > 0 ? policy.maxHeight : undefined,
        fit: "inside",
        withoutEnlargement: true,
      });
    }

    const outFormat = policy.format;
    if (outFormat === "webp") {
      pipeline = pipeline.webp({ quality: policy.quality });
    } else if (outFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: policy.quality, mozjpeg: true });
    } else if (outFormat === "png") {
      pipeline = pipeline.png({ quality: Math.min(100, policy.quality + 20) });
    }
    // original: 리사이즈만 하고 포맷 유지
    const outBuffer = await pipeline.toBuffer();
    const outMeta = await sharp(outBuffer).metadata();
    const contentType =
      outFormat === "webp"
        ? "image/webp"
        : outFormat === "jpeg"
          ? "image/jpeg"
          : outFormat === "png"
            ? "image/png"
            : mimeType;

    return {
      buffer: outBuffer,
      contentType,
      width: outMeta.width ?? 0,
      height: outMeta.height ?? 0,
    };
  } catch (e) {
    console.warn("[image-optimizer] sharp failed, using original:", e);
    return {
      buffer: inputBuffer,
      contentType: mimeType,
      width: 0,
      height: 0,
    };
  }
}

/** MIME이 정책에서 허용되는지 */
export function isAllowedMime(mime: string, policy: ImagePolicy): boolean {
  if (policy.allowedMimeTypes.includes(mime)) return true;
  if (policy.allowSvg && mime === "image/svg+xml") return true;
  return false;
}
