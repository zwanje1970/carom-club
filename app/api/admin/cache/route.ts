import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { isPlatformAdmin } from "@/types/auth";

/** 사이트 캐시 초기화 / 페이지 재검증. 플랫폼 관리자 전용 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: { action: "revalidate_all" | "revalidate_path"; path?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (body.action === "revalidate_path" && body.path) {
    revalidatePath(body.path);
    return NextResponse.json({ ok: true, revalidated: body.path });
  }
  if (body.action === "revalidate_all") {
    const paths = ["/", "/tournaments", "/venues", "/community", "/mypage", "/notice", "/login", "/signup"];
    for (const p of paths) {
      try {
        revalidatePath(p);
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ok: true, revalidated: paths.length });
  }
  return NextResponse.json({ error: "action이 필요합니다." }, { status: 400 });
}
