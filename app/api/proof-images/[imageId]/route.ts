import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getProofImageAssetById,
  getTournamentApplicationByProofImageId,
  getTournamentById,
  getUserById,
} from "../../../../lib/platform-api";
import { getStoredProofImageVariantUrl } from "../../../../lib/server/proof-image-storage-url";
import { mimeTypeFromProofExt, readProofImageVariantFile } from "../../../../lib/server/read-proof-image-variant";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 401 });
  }

  const { imageId } = await context.params;
  const normalizedImageId = imageId.trim();
  const variantRaw = request.nextUrl.searchParams.get("variant")?.trim() ?? "w640";
  const variant = variantRaw === "original" || variantRaw === "w320" || variantRaw === "w640" ? variantRaw : null;
  if (!normalizedImageId || !variant) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const proofImage = await getProofImageAssetById(normalizedImageId);
  if (!proofImage) {
    return NextResponse.json({ error: "존재하지 않는 데이터입니다." }, { status: 404 });
  }

  /** 문의 첨부·운영 확인 등 — 플랫폼 계정은 증빙 이미지 열람 허용 */
  let canView = proofImage.uploaderUserId === user.id || user.role === "PLATFORM";
  if (!canView) {
    const application = await getTournamentApplicationByProofImageId(normalizedImageId);
    if (application) {
      if (user.role === "PLATFORM" || application.userId === user.id) {
        canView = true;
      } else if (user.role === "CLIENT") {
        const tournament = await getTournamentById(application.tournamentId);
        if (tournament && tournament.createdBy === user.id) {
          const clientStatus = await getClientStatusByUserId(user.id);
          canView = clientStatus === "APPROVED";
        }
      }
    }
  }

  if (!canView) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const redirectUrl = getStoredProofImageVariantUrl(proofImage, variant);
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, 307);
  }

  const read = await readProofImageVariantFile(normalizedImageId, variant, proofImage.originalExt);
  if (!read) {
    return NextResponse.json({ error: "존재하지 않는 데이터입니다." }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(read.buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeTypeFromProofExt(read.ext),
      "Cache-Control": "private, no-store",
    },
  });
}
