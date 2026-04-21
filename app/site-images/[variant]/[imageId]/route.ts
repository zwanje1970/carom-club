import { NextRequest, NextResponse } from "next/server";
import { getProofImageAssetById, isSiteImagePubliclyAccessible } from "../../../../lib/server/dev-store";
import { mimeTypeFromProofExt, readProofImageVariantFile } from "../../../../lib/server/read-proof-image-variant";

export const runtime = "nodejs";

/** 공개 사이트 이미지 — 경로만으로 바이너리 제공(?variant 쿼리 없음). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ variant: string; imageId: string }> }
) {
  const { variant: variantParam, imageId: imageIdParam } = await context.params;
  const normalizedImageId = decodeURIComponent(imageIdParam ?? "").trim();
  const variantRaw = (variantParam ?? "").trim().toLowerCase();
  const variant =
    variantRaw === "original" || variantRaw === "w320" || variantRaw === "w640" ? variantRaw : null;

  if (!normalizedImageId || !variant) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const proofImage = await getProofImageAssetById(normalizedImageId);
  if (!proofImage) {
    return NextResponse.json({ error: "존재하지 않는 데이터입니다." }, { status: 404 });
  }

  const accessible = await isSiteImagePubliclyAccessible(normalizedImageId);
  if (!accessible) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const read = await readProofImageVariantFile(normalizedImageId, variant, proofImage.originalExt);
  if (!read) {
    return NextResponse.json({ error: "존재하지 않는 데이터입니다." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(read.buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeTypeFromProofExt(read.ext),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
