import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings, SITE_NAME } from "@/lib/site-settings";
import {
  SITE_CUSTOM_COLOR_THEME_PRESET,
  parseSiteThemeCustomTokens,
  type SiteColorThemeId,
  type SiteThemeCssTokens,
} from "@/lib/site-color-themes";
import { revalidatePath, revalidateTag } from "next/cache";

export async function GET() {
  try {
    const settings = await getSiteSettings();
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[site-settings] GET error:", e);
    return NextResponse.json(
      {
        siteName: SITE_NAME,
        siteDescription: null,
        logoUrl: null,
        primaryColor: "#d97706",
        secondaryColor: "#b91c1c",
        colorThemePreset: null,
        colorThemeCustom: null,
        homeCarouselFlowSpeed: 50,
        minSolutionLevelForUser: 1,
      },
      { status: 200 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: {
    siteName?: string;
    siteDescription?: string | null;
    logoUrl?: string | null;
    primaryColor?: string;
    secondaryColor?: string;
    withdrawRejoinDays?: number;
    headerBgColor?: string | null;
    headerTextColor?: string | null;
    headerActiveColor?: string | null;
    homeCarouselFlowSpeed?: number;
    colorThemePreset?: SiteColorThemeId | typeof SITE_CUSTOM_COLOR_THEME_PRESET | null;
    colorThemeCustom?: SiteThemeCssTokens | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }

  if (
    body.colorThemePreset === SITE_CUSTOM_COLOR_THEME_PRESET &&
    !parseSiteThemeCustomTokens(body.colorThemeCustom ?? null)
  ) {
    return NextResponse.json(
      { error: "커스텀 테마는 primary·secondary·배경·표면·텍스트·muted·테두리 색상(hex)이 모두 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const settings = await updateSiteSettings({
      siteName: body.siteName,
      siteDescription: body.siteDescription,
      logoUrl: body.logoUrl,
      primaryColor: body.primaryColor,
      secondaryColor: body.secondaryColor,
      withdrawRejoinDays: body.withdrawRejoinDays,
      headerBgColor: body.headerBgColor,
      headerTextColor: body.headerTextColor,
      headerActiveColor: body.headerActiveColor,
      homeCarouselFlowSpeed: body.homeCarouselFlowSpeed,
      colorThemePreset: body.colorThemePreset,
      colorThemeCustom: body.colorThemeCustom,
    });
    revalidatePath("/", "layout");
    revalidateTag("common-page-data");
    revalidateTag("site-settings");
    return NextResponse.json(settings);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[site-settings] PUT error:", message, e);
    return NextResponse.json(
      { error: "설정 저장에 실패했습니다.", detail: process.env.NODE_ENV === "development" ? message : undefined },
      { status: 500 }
    );
  }
}
