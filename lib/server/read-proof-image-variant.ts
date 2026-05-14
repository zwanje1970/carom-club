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
  variant: "w160" | "w320" | "w640",
  imageId: string,
  originalExt: ProofImageOriginalExt
): Promise<{ buffer: Buffer; ext: string } | null> {
  const dir = path.join(/* turbopackIgnore: true */ getProofImagesBaseDir(), variant);
  const fileUnderDir = (name: string) => dir + path.sep + name;
  if (originalExt === "png") {
    const pngPath = fileUnderDir(`${imageId}.png`);
    try {
      return { buffer: await readFile(pngPath), ext: "png" };
    } catch {
      const jpgPath = fileUnderDir(`${imageId}.jpg`);
      try {
        return { buffer: await readFile(jpgPath), ext: "jpg" };
      } catch {
        return null;
      }
    }
  }
  const jpgPath = fileUnderDir(`${imageId}.jpg`);
  try {
    return { buffer: await readFile(jpgPath), ext: "jpg" };
  } catch {
    const altPath = fileUnderDir(`${imageId}.${originalExt}`);
    try {
      return { buffer: await readFile(altPath), ext: originalExt };
    } catch {
      return null;
    }
  }
}

export async function readProofImageVariantFile(
  imageId: string,
  variant: "original" | "w160" | "w320" | "w640",
  originalExt: ProofImageOriginalExt
): Promise<{ buffer: Buffer; ext: string } | null> {
  if (variant === "original") {
    const base = getProofImagesBaseDir();
    const legacy = base + path.sep + "original" + path.sep + imageId + "." + originalExt;
    try {
      return { buffer: await readFile(legacy), ext: originalExt };
    } catch {
      return readW320W640DirFiles("w640", imageId, originalExt);
    }
  }
  return readW320W640DirFiles(variant, imageId, originalExt);
}
