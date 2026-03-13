import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllNoticeBars, saveNoticeBar } from "@/lib/content/service";
import type { NoticeBar } from "@/types/notice-bar";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const list = await getAllNoticeBars();
    return NextResponse.json(list);
  } catch (e) {
    console.error("[content/notice-bars] GET error:", e);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

/** 생성 또는 수정 (관리자). body: NoticeBar (createdAt/updatedAt 제외) */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const data = (await request.json()) as Omit<NoticeBar, "createdAt" | "updatedAt">;
    const saved = await saveNoticeBar(data);
    return NextResponse.json(saved);
  } catch (e) {
    console.error("[content/notice-bars] POST error:", e);
    const message = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
