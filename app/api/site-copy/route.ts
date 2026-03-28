import { NextResponse } from "next/server";
import { getAdminCopy } from "@/lib/admin-copy-server";

/** 사이트 전역 안내/설명 문구 (관리자 메뉴·문구에서 수정한 값). 인증 없이 호출 가능. */
export async function GET() {
  try {
    const copy = await getAdminCopy();
    return NextResponse.json(copy);
  } catch (e) {
    console.error("[site-copy] GET error:", e);
    return NextResponse.json(
      { error: "문구를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}
