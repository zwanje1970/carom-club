import { NextRequest, NextResponse } from "next/server";
import { getProofImageAssetById, isSiteImagePubliclyAccessible } from "../../../../lib/surface-read";
import { getStoredProofImageVariantUrl } from "../../../../lib/server/proof-image-storage-url";
import { mimeTypeFromProofExt, readProofImageVariantFile } from "../../../../lib/server/read-proof-image-variant";

export const runtime = "nodejs";

/** 삭제·누락 썸네일: JSON 404(51B) 대신 1×1 투명 PNG — `<img>`·목록 공통 노이즈 제거 */
const MISSING_PUBLIC_IMAGE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

function missingPublicImagePngResponse(): NextResponse {
  return new NextResponse(MISSING_PUBLIC_IMAGE_PNG, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300",
    },
  });
}

/** 공개 사이트 이미지 — 경로만으로 바이너리 제공(?variant 쿼리 없음). */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ variant: string; imageId: string }> }
) {
  const { variant: variantParam, imageId: imageIdParam } = await context.params;
  const normalizedImageId = decodeURIComponent(imageIdParam ?? "").trim();
  const variantRaw = (variantParam ?? "").trim().toLowerCase();
  const variant =
    variantRaw === "original" || variantRaw === "w160" || variantRaw === "w320" || variantRaw === "w640"
      ? variantRaw
      : null;

  if (!normalizedImageId || !variant) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const proofImage = await getProofImageAssetById(normalizedImageId);
  if (!proofImage) {
    return missingPublicImagePngResponse();
  }

  const accessible = await isSiteImagePubliclyAccessible(normalizedImageId);
  if (!accessible) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const redirectUrl = getStoredProofImageVariantUrl(proofImage, variant);
  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, 307);
  }

  const read = await readProofImageVariantFile(normalizedImageId, variant, proofImage.originalExt);
  if (!read) {
    return missingPublicImagePngResponse();
  }

  return new NextResponse(new Uint8Array(read.buffer), {
    status: 200,
    headers: {
      "Content-Type": mimeTypeFromProofExt(read.ext),
      "Cache-Control": "public, max-age=3600",
    },
  });
}
