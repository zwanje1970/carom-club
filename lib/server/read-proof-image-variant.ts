import { readFile } from "fs/promises";
import path from "path";
import { getProofImagesBaseDir } from "./proof-images-base-dir";

export type ProofImageOriginalExt = "jpg" | "png" | "webp";

export function mimeTypeFromProofExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

async function readW320W640DirFiles(
  variant: "w320" | "w640",
  imageId: string,
  originalExt: ProofImageOriginalExt
): Promise<{ buffer: Buffer; ext: string } | null> {
  const dir = path.join(getProofImagesBaseDir(), variant);
  if (originalExt === "png") {
    const pngPath = path.join(dir, `${imageId}.png`);
    try {
      return { buffer: await readFile(pngPath), ext: "png" };
    } catch {
      const jpgPath = path.join(dir, `${imageId}.jpg`);
      try {
        return { buffer: await readFile(jpgPath), ext: "jpg" };
      } catch {
        return null;
      }
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

/**
 * variant `original` 은 w640(최대 해상도)을 가리킨다. (신규: `w640/` 만 사용)
 * `original/` 구버전 경로는 기존 데이터용으로만 읽는다.
 */
export async function readProofImageVariantFile(
  imageId: string,
  variant: "original" | "w320" | "w640",
  originalExt: ProofImageOriginalExt
): Promise<{ buffer: Buffer; ext: string } | null> {
  if (variant === "original") {
    const fromW640 = await readW320W640DirFiles("w640", imageId, originalExt);
    if (fromW640) return fromW640;
    const legacy = path.join(getProofImagesBaseDir(), "original", `${imageId}.${originalExt}`);
    try {
      return { buffer: await readFile(legacy), ext: originalExt };
    } catch {
      return null;
    }
  }
  return readW320W640DirFiles(variant, imageId, originalExt);
}
