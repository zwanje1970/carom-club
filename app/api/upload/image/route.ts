import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { getProofImagesBaseDir } from "../../../../lib/server/proof-images-base-dir";
import { uploadProofImageVariantsToFirebaseStorage } from "../../../../lib/server/firebase-storage-proof-images";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { isFirestoreUsersBackendConfigured } from "../../../../lib/server/firestore-users";
import {
  buildProtectedProofImageUrl,
  buildSitePublicImageUrl,
  createProofImageAsset,
  getClientStatusByUserId,
  getUserById,
} from "../../../../lib/platform-api";

export const runtime = "nodejs";

const useLocalProofImageDisk = process.env.NODE_ENV === "development";

function getExtFromMimeType(mimeType: string): "jpg" | "png" | "webp" | null {
  const m = mimeType.trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/jpg" || m === "image/pjpeg") return "jpg";
  if (m === "image/png") return "png";
  if (m === "image/webp") return "webp";
  return null;
}

/** 브라우저/OS에 따라 type 이 비어 있을 수 있어 확장자로만 판별 */
function getExtFromFileName(fileName: string): "jpg" | "png" | "webp" | null {
  const n = fileName.trim().toLowerCase();
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "jpg";
  if (n.endsWith(".png")) return "png";
  if (n.endsWith(".webp")) return "webp";
  return null;
}

async function canUploadImage() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return { allowed: false as const, user: null };
  const user = await getUserById(session.userId);
  if (!user) return { allowed: false as const, user: null };
  if (user.role === "USER") return { allowed: true as const, user };
  if (user.role === "PLATFORM") return { allowed: true as const, user };
  if (user.role !== "CLIENT") return { allowed: false as const, user: null };
  const status = await getClientStatusByUserId(user.id);
  return { allowed: status === "APPROVED", user: status === "APPROVED" ? user : null };
}

export async function POST(request: Request) {
  const auth = await canUploadImage();
  if (!auth.allowed || !auth.user) {
    return NextResponse.json({ error: "이미지 업로드 권한이 없습니다." }, { status: 403 });
  }
  if (!useLocalProofImageDisk && !isFirestoreUsersBackendConfigured()) {
    return NextResponse.json(
      { error: "운영 환경에서 이미지 업로드는 Firebase(Firestore/Storage) 자격 증명이 설정된 경우에만 사용할 수 있습니다." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
  const sitePublicRaw = formData.get("sitePublic");
  const sitePublic = sitePublicRaw === "1" || sitePublicRaw === "true";
  const imageFile = formData.get("file");
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: "업로드 파일이 필요합니다." }, { status: 400 });
  }

  let ext = getExtFromMimeType(imageFile.type);
  if (!ext) {
    ext = getExtFromFileName(imageFile.name);
  }
  if (!ext) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다. (jpg/png/webp)" }, { status: 400 });
  }

  const imageId = randomUUID();
  const buffer = Buffer.from(await imageFile.arrayBuffer());

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
      console.warn("[api/upload/image] w640 sharp 실패, 원본 바이트를 w640에 저장", err);
      w640ForDownstream = buffer;
      try {
        await writeFile(w640Alt, buffer);
      } catch (e2) {
        console.error("[api/upload/image] w640 저장 실패", e2);
        return NextResponse.json({ error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
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
      console.warn("[api/upload/image] w320 원본→320 sharp 실패, w640 기반 재시도", err);
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
        console.warn("[api/upload/image] w320 w640기반 sharp 실패, 원본 복사", err);
      }
    }
    if (!w320Ok) {
      const w320Alt = path.join(w320Dir, `${imageId}.${ext}`);
      try {
        await writeFile(w320Alt, buffer);
        w320Ok = true;
      } catch (err) {
        console.error("[api/upload/image] w320 저장 실패", err);
        return NextResponse.json({ error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
      }
    }

    const createAssetResult = await createProofImageAsset({
      imageId,
      uploaderUserId: auth.user.id,
      originalExt: ext,
      sitePublic,
    });
    if (!createAssetResult.ok) {
      return NextResponse.json({ error: "이미지 메타 저장에 실패했습니다." }, { status: 500 });
    }

    const buildUrl = sitePublic ? buildSitePublicImageUrl : buildProtectedProofImageUrl;
    return NextResponse.json({
      imageId,
      w320Url: buildUrl(imageId, "w320"),
      w640Url: buildUrl(imageId, "w640"),
    });
  }

  let w640Buffer: Buffer;
  try {
    w640Buffer = await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.warn("[api/upload/image] w640 sharp 실패(원본 바이트로 w640 업로드)", err);
    w640Buffer = buffer;
  }

  let w320Buffer: Buffer;
  try {
    w320Buffer = await sharp(buffer)
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("[api/upload/image] w320 원본→320 sharp 실패, w640 기반 재시도", err);
    try {
      w320Buffer = await sharp(w640Buffer)
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
    } catch (err2) {
      console.warn("[api/upload/image] w320 w640기반 sharp 실패, 원본 바이트 업로드", err2);
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
    console.error("[api/upload/image] Firebase Storage 업로드 실패", {
      step: "storage-upload",
      imageId,
      fileType: ext,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        code: "IMAGE_STORAGE_UPLOAD_FAILED",
      },
      { status: 500 }
    );
  }

  const createAssetResult = await createProofImageAsset({
    imageId,
    uploaderUserId: auth.user.id,
    originalExt: ext,
    sitePublic,
    storageOriginalUrl: storageUrls.storageW640Url,
    storageW320Url: storageUrls.storageW320Url,
    storageW640Url: storageUrls.storageW640Url,
  });
  if (!createAssetResult.ok) {
    console.error("[api/upload/image] 이미지 메타 저장 실패", {
      step: "asset-meta-save",
      imageId,
      fileType: ext,
      sitePublic,
      storageW640Url: storageUrls.storageW640Url,
    });
    return NextResponse.json({ error: "이미지 메타 저장에 실패했습니다.", code: "IMAGE_META_SAVE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    imageId,
    w320Url: storageUrls.storageW320Url,
    w640Url: storageUrls.storageW640Url,
  });
}
