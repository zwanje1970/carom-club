import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import { isCmsPageDraftKey } from "@/lib/content/cms-page-draft";
import {
  assertPageSectionAllowedOnPage,
  deletePageSection,
  getAllPageSections,
  getPageSectionByIdForAdmin,
  savePageSection,
} from "@/lib/content/service";
import { pageNotAllowedMessage } from "@/lib/content/page-section-page-rules";
import type { PageSection, PageSlug } from "@/types/page-section";

function revalidatePathsForPage(page: PageSlug) {
  revalidatePath("/", "layout");
  if (page === "community") revalidatePath("/community", "layout");
  if (page === "tournaments") revalidatePath("/tournaments", "layout");
}

/** 목록 조회 (관리자) */
export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const list = await getAllPageSections();
    return NextResponse.json(list);
  } catch (e) {
    console.error("[content/page-sections] GET error:", e);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

/** 생성 또는 수정 (관리자). body: PageSection (createdAt/updatedAt 제외) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const data = (await request.json()) as Omit<PageSection, "createdAt" | "updatedAt">;
    try {
      assertPageSectionAllowedOnPage(data.page, data.slotType, data.type);
    } catch {
      return NextResponse.json({ error: pageNotAllowedMessage() }, { status: 400 });
    }
    const saved = await savePageSection(data);
    if (!isCmsPageDraftKey(saved.page)) {
      revalidatePathsForPage(saved.page);
    }
    return NextResponse.json(saved);
  } catch (e) {
    console.error("[content/page-sections] POST error:", e);
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** 삭제 (관리자). query: id=섹션ID */
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id?.trim()) {
    return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
  }
  try {
    const existing = await getPageSectionByIdForAdmin(id.trim());
    await deletePageSection(id.trim());
    if (existing && !isCmsPageDraftKey(existing.page)) {
      revalidatePathsForPage(existing.page);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[content/page-sections] DELETE error:", e);
    const message = e instanceof Error ? e.message : "삭제에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
