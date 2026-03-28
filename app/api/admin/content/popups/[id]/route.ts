import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession } from "@/lib/auth";
import { getPopupById, savePopup } from "@/lib/content/service";

/** 팝업 비활성화(soft delete). 실제 레코드는 유지하고 isVisible=false 처리 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const { id } = await params;
  const popup = await getPopupById(id);
  if (!popup) {
    return NextResponse.json({ error: "팝업을 찾을 수 없습니다." }, { status: 404 });
  }

  const saved = await savePopup({
    id: popup.id,
    title: popup.title,
    description: popup.description,
    imageUrl: popup.imageUrl,
    buttonName: popup.buttonName,
    buttonLink: popup.buttonLink,
    page: popup.page,
    startAt: popup.startAt,
    endAt: popup.endAt,
    hideForTodayEnabled: popup.hideForTodayEnabled,
    showCloseButton: popup.showCloseButton,
    isVisible: false,
    sortOrder: popup.sortOrder,
  });

  revalidateTag("common-page-data");
  return NextResponse.json({ ok: true, id: saved.id, isVisible: saved.isVisible });
}
