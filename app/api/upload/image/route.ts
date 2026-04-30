import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { isFirestoreUsersBackendConfigured } from "../../../../lib/server/firestore-users";
import {
  getImageExtFromFileName,
  getImageExtFromMimeType,
  persistProofImageW320W640Variants,
} from "../../../../lib/server/persist-proof-image-w320-w640-variants";
import { getClientStatusByUserId, getUserById } from "../../../../lib/platform-api";

export const runtime = "nodejs";

const useLocalProofImageDisk = process.env.NODE_ENV === "development";

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
  const purposeRaw = formData.get("purpose");
  const purpose = typeof purposeRaw === "string" ? purposeRaw.trim() : "";
  const preservePngFromPurpose = purpose === "published-card-snapshot";
  const preservePngRaw = formData.get("preservePng");
  const preservePngFlag =
    preservePngRaw === "1" || preservePngRaw === "true" || preservePngRaw === "yes";
  const preservePngTransparency = preservePngFromPurpose || preservePngFlag;
  const imageFile = formData.get("file");
  if (!(imageFile instanceof File)) {
    return NextResponse.json({ error: "업로드 파일이 필요합니다." }, { status: 400 });
  }

  let ext = getImageExtFromMimeType(imageFile.type);
  if (!ext) {
    ext = getImageExtFromFileName(imageFile.name);
  }
  if (!ext) {
    return NextResponse.json({ error: "지원하지 않는 이미지 형식입니다. (jpg/png/webp)" }, { status: 400 });
  }

  if (preservePngTransparency && ext !== "png") {
    return NextResponse.json(
      { error: "게시 카드 스냅샷(purpose=published-card-snapshot 또는 preservePng)은 PNG 파일만 업로드할 수 있습니다." },
      { status: 400 },
    );
  }

  const imageId = randomUUID();
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  const result = await persistProofImageW320W640Variants({
    imageId,
    buffer,
    ext,
    uploaderUserId: auth.user.id,
    sitePublic,
    ...(preservePngTransparency ? { preservePngTransparency: true } : {}),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json({
    imageId: result.imageId,
    w160Url: result.w160Url,
    w320Url: result.w320Url,
    w640Url: result.w640Url,
  });
}
