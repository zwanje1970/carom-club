import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getSiteSettings, updateFooterSettings } from "@/lib/site-settings";
import { revalidatePath } from "next/cache";
import type { FooterSettings } from "@/lib/footer-settings";
import { DEFAULT_FOOTER } from "@/lib/footer-settings";

/** GET: 관리자용 푸터 설정 로드. 데이터 없거나 오류 시 기본값 반환(500 방지). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "PLATFORM_ADMIN") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const settings = await getSiteSettings();
    const footer = settings?.footer ?? DEFAULT_FOOTER;
    return NextResponse.json(footer);
  } catch (e) {
    console.error("[admin/site-settings/footer] GET error:", e);
    return NextResponse.json(DEFAULT_FOOTER);
  }
}

/** PATCH: 푸터 설정 저장 */
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: Partial<FooterSettings>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "잘못된 요청입니다." },
      { status: 400 }
    );
  }
  try {
    const footer = await updateFooterSettings(body);
    revalidatePath("/", "layout");
    return NextResponse.json(footer);
  } catch (e) {
    console.error("[admin/site-settings/footer] PATCH error:", e);
    return NextResponse.json(
      { error: "저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
