import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { getProofImageAssetById, isSiteImagePubliclyAccessible } from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

function getMimeTypeFromExt(ext: string): string {
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/jpeg";
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
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

  const accessible = await isSiteImagePubliclyAccessible(normalizedImageId);
  if (!accessible) {
    return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
  }

  const ext = variant === "original" ? proofImage.originalExt : "jpg";
  const absolutePath = path.join(process.cwd(), "data", "proof-images", variant, `${normalizedImageId}.${ext}`);
  try {
    const fileBuffer = await readFile(absolutePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getMimeTypeFromExt(ext),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "존재하지 않는 데이터입니다." }, { status: 404 });
  }
}
