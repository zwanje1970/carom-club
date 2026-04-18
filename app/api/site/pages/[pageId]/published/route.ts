import { NextRequest, NextResponse } from "next/server";
import { getSitePageBuilderPublishedByPageId } from "../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  const { pageId } = await context.params;
  const normalizedPageId = pageId.trim();
  if (!normalizedPageId) {
    return NextResponse.json({ error: "pageId is required." }, { status: 400 });
  }

  const published = await getSitePageBuilderPublishedByPageId(normalizedPageId);
  return NextResponse.json({ pageId: normalizedPageId, published: published ?? null });
}
