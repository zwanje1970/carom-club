import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** 레거시: `<img src>`는 `/site-images/{variant}/{id}` 사용. 이 경로는 바이너리 URL로 리다이렉트만 한다. */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ imageId: string }> }
) {
  const { imageId } = await context.params;
  const normalizedImageId = imageId.trim();
  const variantRaw = request.nextUrl.searchParams.get("variant")?.trim() ?? "w640";
  const variant =
    variantRaw === "original" || variantRaw === "w160" || variantRaw === "w320" || variantRaw === "w640"
      ? variantRaw
      : null;
  if (!normalizedImageId || !variant) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const dest = new URL(request.url);
  dest.pathname = `/site-images/${variant}/${encodeURIComponent(normalizedImageId)}`;
  dest.search = "";
  return NextResponse.redirect(dest, 307);
}
