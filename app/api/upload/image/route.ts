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
    const originalDir = path.join(baseUploadDir, "original");
    const w320Dir = path.join(baseUploadDir, "w320");
    const w640Dir = path.join(baseUploadDir, "w640");
    await mkdir(originalDir, { recursive: true });
    await mkdir(w320Dir, { recursive: true });
    await mkdir(w640Dir, { recursive: true });

    const originalFileName = `${imageId}.${ext}`;
    const w320FileName = `${imageId}.jpg`;
    const w640FileName = `${imageId}.jpg`;

    const originalPath = path.join(originalDir, originalFileName);
    const w320Path = path.join(w320Dir, w320FileName);
    const w640Path = path.join(w640Dir, w640FileName);
    const w320FallbackPath = path.join(w320Dir, originalFileName);
    const w640FallbackPath = path.join(w640Dir, originalFileName);

    try {
      await writeFile(originalPath, buffer);
    } catch (err) {
      console.error("[api/upload/image] 원본 저장 실패:", err);
      return NextResponse.json({ error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
    }

    let w320Ok = false;
    let w640Ok = false;
    try {
      await sharp(buffer)
        .resize({ width: 320, withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(w320Path);
      w320Ok = true;
    } catch (err) {
      console.warn("[api/upload/image] w320 sharp 생략(원본 복사):", err);
    }
    try {
      await sharp(buffer)
        .resize({ width: 640, withoutEnlargement: true })
        .jpeg({ quality: 88 })
        .toFile(w640Path);
      w640Ok = true;
    } catch (err) {
      console.warn("[api/upload/image] w640 sharp 생략(원본 복사):", err);
    }

    try {
      if (!w320Ok) {
        await writeFile(w320FallbackPath, buffer);
      }
      if (!w640Ok) {
        await writeFile(w640FallbackPath, buffer);
      }
    } catch (err) {
      console.error("[api/upload/image] 파생 파일(원본 복사) 저장 실패:", err);
      return NextResponse.json({ error: "이미지 파일을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
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
      originalUrl: buildUrl(imageId, "original"),
      w320Url: buildUrl(imageId, "w320"),
      w640Url: buildUrl(imageId, "w640"),
    });
  }

  let w320Buffer: Buffer;
  let w640Buffer: Buffer;
  try {
    w320Buffer = await sharp(buffer)
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (err) {
    console.warn("[api/upload/image] w320 sharp 생략(원본 바이트 업로드):", err);
    w320Buffer = buffer;
  }
  try {
    w640Buffer = await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toBuffer();
  } catch (err) {
    console.warn("[api/upload/image] w640 sharp 생략(원본 바이트 업로드):", err);
    w640Buffer = buffer;
  }

  let storageUrls: { storageOriginalUrl: string; storageW320Url: string; storageW640Url: string };
  try {
    storageUrls = await uploadProofImageVariantsToFirebaseStorage({
      imageId,
      originalExt: ext,
      originalBuffer: buffer,
      w320Buffer,
      w640Buffer,
    });
  } catch (err) {
    console.error("[api/upload/image] Firebase Storage 업로드 실패:", err);
    return NextResponse.json({ error: "이미지를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 500 });
  }

  const createAssetResult = await createProofImageAsset({
    imageId,
    uploaderUserId: auth.user.id,
    originalExt: ext,
    sitePublic,
    storageOriginalUrl: storageUrls.storageOriginalUrl,
    storageW320Url: storageUrls.storageW320Url,
    storageW640Url: storageUrls.storageW640Url,
  });
  if (!createAssetResult.ok) {
    return NextResponse.json({ error: "이미지 메타 저장에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    imageId,
    originalUrl: storageUrls.storageOriginalUrl,
    w320Url: storageUrls.storageW320Url,
    w640Url: storageUrls.storageW640Url,
  });
}
