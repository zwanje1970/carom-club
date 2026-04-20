import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  buildProtectedProofImageUrl,
  buildSitePublicImageUrl,
  createProofImageAsset,
  getClientStatusByUserId,
  getUserById,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

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

  const baseUploadDir = path.join(process.cwd(), "data", "proof-images");
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

  try {
    await writeFile(originalPath, buffer);
    await sharp(buffer)
      .resize({ width: 320, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(w320Path);
    await sharp(buffer)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 88 })
      .toFile(w640Path);
  } catch (err) {
    console.error("[api/upload/image] 저장 또는 이미지 처리 실패:", err);
    return NextResponse.json(
      { error: "이미지를 처리하지 못했습니다. jpg/png/webp 파일인지 확인 후 다시 시도해 주세요." },
      { status: 400 }
    );
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
