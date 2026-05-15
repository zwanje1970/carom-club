import { NextResponse } from "next/server";
import { getMainSlideAdSettingsForSite } from "../../../../lib/surface-read";
import { getMainSlideAdSettingsForSite as loadMainSlideAdSettingsDirect } from "../../../../lib/server/platform-backing-store";
import { normalizeMainSlideAdConfig } from "../../../../lib/site/main-slide-stream";

export const runtime = "nodejs";

/** 공개 메인 — 슬라이드 광고·이동 속도 설정 지연 로드용(초기 SSR 미포함) */
export async function GET() {
  try {
    const settings =
      process.env.NODE_ENV === "development"
        ? await loadMainSlideAdSettingsDirect()
        : await getMainSlideAdSettingsForSite();
    return NextResponse.json({
      config: settings.config,
      activeAds: settings.activeAds,
    });
  } catch {
    return NextResponse.json({
      config: normalizeMainSlideAdConfig(undefined),
      activeAds: [],
    });
  }
}
