import { NextResponse } from "next/server";
import { getSiteNotice } from "../../../../lib/surface-read";
import { getSiteNotice as loadSiteNoticeDirect } from "../../../../lib/server/platform-backing-store";

export const runtime = "nodejs";

/** 공개 메인 — 공지 지연 로드용(초기 SSR 미포함) */
export async function GET() {
  try {
    const notice =
      process.env.NODE_ENV === "development" ? await loadSiteNoticeDirect() : await getSiteNotice();
    return NextResponse.json({
      enabled: Boolean(notice.enabled),
      text: typeof notice.text === "string" ? notice.text : "",
    });
  } catch {
    return NextResponse.json({ enabled: false, text: "" });
  }
}
