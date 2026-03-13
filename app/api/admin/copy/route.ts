import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAdminCopy, updateAdminCopy } from "@/lib/admin-copy";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  try {
    const copy = await getAdminCopy();
    return NextResponse.json(copy);
  } catch (e) {
    console.error("[admin/copy] GET error:", e);
    return NextResponse.json(
      { error: "문구를 불러올 수 없습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PLATFORM_ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: { copy?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const copy = body.copy && typeof body.copy === "object" ? body.copy : {};
  try {
    await updateAdminCopy(copy);
    const updated = await getAdminCopy();
    return NextResponse.json(updated);
  } catch (e) {
    const err = e as { message?: string; code?: string };
    console.error("[admin/copy] PUT error:", e);
    const isTableMissing =
      typeof err.message === "string" &&
      (err.message.includes("AdminCopy") || err.message.includes("does not exist") || err.code === "42P01");
    return NextResponse.json(
      {
        error: isTableMissing
          ? "AdminCopy 테이블이 없습니다. 터미널에서 npx prisma db execute --file prisma/migrations/20260312000000_admin_copy/migration.sql 를 실행하세요."
          : "문구 저장에 실패했습니다.",
      },
      { status: 500 }
    );
  }
}
