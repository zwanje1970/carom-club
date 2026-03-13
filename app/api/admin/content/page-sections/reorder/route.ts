import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { reorderPageSections } from "@/lib/content/service";
import type { PageSlug, PlacementSlug } from "@/types/page-section";

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { page?: string; placement?: string; sectionIds?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const { page, placement, sectionIds } = body;
  const pageSlugs: PageSlug[] = ["home", "venues", "tournaments", "community", "mypage"];
  const placementSlugs: PlacementSlug[] = [
    "below_header",
    "main_visual_bg",
    "below_main_copy",
    "above_content",
    "content_middle",
    "content_bottom",
  ];

  if (
    !page ||
    !placement ||
    !Array.isArray(sectionIds) ||
    !pageSlugs.includes(page as PageSlug) ||
    !placementSlugs.includes(placement as PlacementSlug)
  ) {
    return NextResponse.json(
      { error: "page, placement, sectionIds(배열)가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    await reorderPageSections(page as PageSlug, placement as PlacementSlug, sectionIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[content/page-sections/reorder] error:", e);
    return NextResponse.json({ error: "정렬 저장에 실패했습니다." }, { status: 500 });
  }
}
