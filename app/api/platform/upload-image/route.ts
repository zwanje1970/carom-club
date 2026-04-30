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
import { getUserById } from "../../../../lib/platform-api";

export const runtime = "nodejs";

const useLocalProofImageDisk = process.env.NODE_ENV === "development";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

/**
 * 플랫폼 전용: 메인 슬라이드 광고 등 공개 노출용 이미지.
 * 항상 sitePublic 메타로 저장하여 비로그인 방문자도 `/site-images/...` 로 조회 가능.
 */
export async function POST(request: Request) {
  const user = await requirePlatformUser();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }
  if (!useLocalProofImageDisk && !isFirestoreUsersBackendConfigured()) {
    return NextResponse.json(
      { error: "운영 환경에서 이미지 업로드는 Firebase(Firestore/Storage) 자격 증명이 설정된 경우에만 사용할 수 있습니다." },
      { status: 503 }
    );
  }

  const formData = await request.formData();
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

  const imageId = randomUUID();
  const buffer = Buffer.from(await imageFile.arrayBuffer());

  const result = await persistProofImageW320W640Variants({
    imageId,
    buffer,
    ext,
    uploaderUserId: user.id,
    sitePublic: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json({
    ok: true,
    image160Url: result.w160Url,
    image320Url: result.w320Url,
    image640Url: result.w640Url,
  });
}
