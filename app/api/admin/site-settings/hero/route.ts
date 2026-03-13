import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHeroSettings, updateHeroSettings, getDefaultHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { revalidatePath } from "next/cache";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const settings = await getHeroSettings();
    return NextResponse.json(settings ?? getDefaultHeroSettings());
  } catch (e) {
    console.error("[admin/site-settings/hero] GET error:", e);
    return NextResponse.json(
      { error: "히어로 설정을 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: HeroSettings;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    const saved = await updateHeroSettings(body);
    revalidatePath("/", "layout");
    return NextResponse.json(saved);
  } catch (e) {
    console.error("[admin/site-settings/hero] PATCH error:", e);
    return NextResponse.json(
      { error: "저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
