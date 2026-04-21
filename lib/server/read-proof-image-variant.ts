import { readFile } from "fs/promises";
import path from "path";

export type ProofImageOriginalExt = "jpg" | "png" | "webp";

export function mimeTypeFromProofExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

/**
 * w320/w640: sharp 성공 시 `.jpg`만 존재.
 * sharp 실패 시 업로드가 원본 바이트를 `${id}.${originalExt}` 로 저장할 수 있음 → 둘 다 시도.
 */
export async function readProofImageVariantFile(
  imageId: string,
  variant: "original" | "w320" | "w640",
  originalExt: ProofImageOriginalExt
): Promise<{ buffer: Buffer; ext: string } | null> {
  const dir = path.join(process.cwd(), "data", "proof-images", variant);
  if (variant === "original") {
    const p = path.join(dir, `${imageId}.${originalExt}`);
    try {
      return { buffer: await readFile(p), ext: originalExt };
    } catch {
      return null;
    }
  }
  const jpgPath = path.join(dir, `${imageId}.jpg`);
  try {
    return { buffer: await readFile(jpgPath), ext: "jpg" };
  } catch {
    const altPath = path.join(dir, `${imageId}.${originalExt}`);
    try {
      return { buffer: await readFile(altPath), ext: originalExt };
    } catch {
      return null;
    }
  }
}
