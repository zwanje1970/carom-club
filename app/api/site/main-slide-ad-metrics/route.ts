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
  /** 메인 초기 로딩: 삭제·비활성 광고 id 등으로 ok:false가 나와도 404 JSON을 쓰지 않음(클라이언트는 무시). */
  return NextResponse.json(result, { status: 200 });
}
