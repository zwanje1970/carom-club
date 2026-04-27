import { NextResponse } from "next/server";
import { incrementMainSlideAdMetric } from "../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { adId?: unknown; metric?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const adId = typeof body.adId === "string" ? body.adId.trim() : "";
  const metric =
    body.metric === "impressions" || body.metric === "clicks" ? body.metric : null;
  if (!adId || !metric) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const result = await incrementMainSlideAdMetric(adId, metric);
  return NextResponse.json(result, { status: result.ok ? 200 : 404 });
}
