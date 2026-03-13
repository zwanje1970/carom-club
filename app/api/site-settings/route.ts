import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSiteSettings, updateSiteSettings, SITE_NAME } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";

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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
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
    });
    revalidatePath("/", "layout");
    return NextResponse.json(settings);
  } catch (e) {
    console.error("[site-settings] PUT error:", e);
    return NextResponse.json(
      { error: "설정 저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
