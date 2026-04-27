import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getProofImagesBaseDir } from "./proof-images-base-dir";
import { uploadProofImageVariantsToFirebaseStorage } from "./firebase-storage-proof-images";
import {
  buildProtectedProofImageUrl,
  buildSitePublicImageUrl,
  createProofImageAsset,
} from "./platform-backing-store";

const useLocalProofImageDisk = process.env.NODE_ENV === "development";

export function getImageExtFromMimeType(mimeType: string): "jpg" | "png" | "webp" | null {
  const m = mimeType.trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg" || m === "image/pjpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

export function getImageExtFromFileName(fileName: string): "jpg" | "png" | "webp" | null {
  const n = fileName.trim().toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".webp")) return "webp";
  return null;
}

export type PersistProofImageW320W640Result =
  | { ok: true; imageId: string; w320Url: string; w640Url: string }
  | { ok: false; error: string; status: number; code?: string };

/**
 * 증빙/사이트 이미지와 동일 파이프라인: sharp로 w640·w320 생성 후 디스크 또는 Firebase Storage + proof 메타.
 */
export async function persistProofImageW320W640Variants(params: {
  imageId: string;
  buffer: Buffer;
  ext: "jpg" | "png" | "webp";
  uploaderUserId: string;
  sitePublic: boolean;
}): Promise<PersistProofImageW320W640Result> {
  const { imageId, buffer, ext, uploaderUserId, sitePublic } = params;

  if (useLocalProofImageDisk) {
    const baseUploadDir = getProofImagesBaseDir();
    const w320Dir = path.join(baseUploadDir, "w320");
    const w640Dir = path.join(baseUploadDir, "w640");
    await mkdir(w320Dir, { recursive: true });
    await mkdir(w640Dir, { recursive: true });

    const w320Jpg = path.join(w320Dir, `${imageId}.jpg`);
    const w640Jpg = path.join(w640Dir, `${imageId}.jpg`);
    const w640Alt = path.join(w640Dir, `${imageId}.${ext}`);

    let w640ForDownstream: Buffer;
    try {
      w640ForDownstream = await sharp(buffer)
        .resize({ width: 640, withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toBuffer();
      await writeFile(w640Jpg, w640ForDownstream);
    } catch (err) {
      console.warn("[persist-proof-image-w320-w640] w640 sharp 실패, 원본 바이트를 w640에 저장", err);
      w640ForDownstream = buffer;
      try {
        await writeFile(w640Alt, buffer);
      } catch (e2) {
        console.error("[persist-proof-image-w320-w640] w640 저장 실패", e2);
        return { ok: false, error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
      }
    }

    let w320Ok = false;
    try {
      const w320Buf = await sharp(buffer)
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      await writeFile(w320Jpg, w320Buf);
      w320Ok = true;
    } catch (err) {
      console.warn("[persist-proof-image-w320-w640] w320 원본→320 sharp 실패, w640 기반 재시도", err);
    }
    if (!w320Ok) {
      try {
        const w320Buf = await sharp(w640ForDownstream)
          .resize({ width: 320, withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        await writeFile(w320Jpg, w320Buf);
        w320Ok = true;
      } catch (err) {
        console.warn("[persist-proof-image-w320-w640] w320 w640기반 sharp 실패, 원본 복사", err);
      }
    }
    if (!w320Ok) {
      const w320Alt = path.join(w320Dir, `${imageId}.${ext}`);
      try {
        await writeFile(w320Alt, buffer);
        w320Ok = true;
      } catch (err) {
        console.error("[persist-proof-image-w320-w640] w320 저장 실패", err);
        return { ok: false, error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.", status: 500 };
      }
    }

    const createAssetResult = await createProofImageAsset({
      imageId,
      uploaderUserId,
      originalExt: ext,
      sitePublic,
    });
    if (!createAssetResult.ok) {
      return { ok: false, error: "이미지 메타 저장에 실패했습니다.", status: 500 };
    }

    const buildUrl = sitePublic ? buildSitePublicImageUrl : buildProtectedProofImageUrl;
    return {
      ok: true,
      imageId,
      w320Url: buildUrl(imageId, "w320"),
      w640Url: buildUrl(imageId, "w640"),
    };
  }

  let w640Buffer: Buffer;
  try {
    w640Buffer = await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.warn("[persist-proof-image-w320-w640] w640 sharp 실패(원본 바이트로 w640 업로드)", err);
    w640Buffer = buffer;
  }

  let w320Buffer: Buffer;
  try {
    w320Buffer = await sharp(buffer)
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("[persist-proof-image-w320-w640] w320 원본→320 sharp 실패, w640 기반 재시도", err);
    try {
      w320Buffer = await sharp(w640Buffer)
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (err2) {
      console.warn("[persist-proof-image-w320-w640] w320 w640기반 sharp 실패, 원본 바이트 업로드", err2);
      w320Buffer = buffer;
    }
  }

  let storageUrls: { storageW320Url: string; storageW640Url: string };
  try {
    storageUrls = await uploadProofImageVariantsToFirebaseStorage({
      imageId,
      w320Buffer,
      w640Buffer,
    });
  } catch (err) {
    console.error("[persist-proof-image-w320-w640] Firebase Storage 업로드 실패", {
      step: "storage-upload",
      imageId,
      fileType: ext,
      message: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      error: "이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      status: 500,
      code: "IMAGE_STORAGE_UPLOAD_FAILED",
    };
  }

  const createAssetResult = await createProofImageAsset({
    imageId,
    uploaderUserId,
    originalExt: ext,
    sitePublic,
    storageOriginalUrl: storageUrls.storageW640Url,
    storageW320Url: storageUrls.storageW320Url,
    storageW640Url: storageUrls.storageW640Url,
  });
  if (!createAssetResult.ok) {
    console.error("[persist-proof-image-w320-w640] 이미지 메타 저장 실패", {
      step: "asset-meta-save",
      imageId,
      fileType: ext,
      sitePublic,
      storageW640Url: storageUrls.storageW640Url,
    });
    return { ok: false, error: "이미지 메타 저장에 실패했습니다.", status: 500, code: "IMAGE_META_SAVE_FAILED" };
  }

  return {
    ok: true,
    imageId,
    w320Url: storageUrls.storageW320Url,
    w640Url: storageUrls.storageW640Url,
  };
}
