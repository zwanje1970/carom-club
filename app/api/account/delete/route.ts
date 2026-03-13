import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/**
 * POST: 회원 탈퇴 (soft delete만 수행. 실제 삭제 금지)
 * - User.status = "DELETED", User.withdrawnAt 저장만 수행
 * - User 행 및 관련 데이터(문의, 알림, 신청, 참가 등)는 삭제하지 않음. FK 유지.
 * 응답: 200 성공 | 401 로그인 없음 | 403 관리자 탈퇴 불가 | 404 사용자 없음 | 400 이미 탈퇴 | 503 DB 미연결 | 500 서버 오류
 */
export async function POST() {
  try {
    if (!isDatabaseConfigured()) {
      console.error("[account/delete] DB not configured");
      return NextResponse.json(
        { error: "데이터베이스가 연결되지 않았습니다." },
        { status: 503 }
      );
    }

    const session = await getSession();
    if (!session) {
      console.error("[account/delete] No session");
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const userId = session.id;
    if (!userId) {
      console.error("[account/delete] session.user.id missing");
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    if (session.role !== "USER") {
      console.error("[account/delete] Admin account blocked from withdrawal, role:", session.role);
      return NextResponse.json(
        { error: "관리자 계정은 회원탈퇴할 수 없습니다." },
        { status: 403 }
      );
    }

    let existing;
    try {
      existing = await prisma.user.findUnique({
        where: { id: userId },
      });
    } catch (e) {
      console.error("[account/delete] findUnique error:", e);
      throw e;
    }

    if (!existing) {
      console.error("[account/delete] User not found:", userId);
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    let alreadyWithdrawn = false;
    try {
      const rows = await prisma.$queryRawUnsafe<{ withdrawnAt: Date | null }[]>(
        `SELECT "withdrawnAt" FROM "User" WHERE id = $1`,
        userId
      );
      alreadyWithdrawn = !!rows[0]?.withdrawnAt;
    } catch (colErr) {
      const msg = (colErr as Error)?.message ?? String(colErr);
      console.error("[account/delete] SELECT withdrawnAt failed (column may be missing):", msg);
      // 컬럼 없으면 아래 UPDATE에서 실패할 수 있음
    }

    if (alreadyWithdrawn) {
      return NextResponse.json({ error: "이미 탈퇴 처리된 계정입니다." }, { status: 400 });
    }

    const now = new Date();
    try {
      await prisma.$executeRawUnsafe(
        `UPDATE "User" SET "status" = $1, "withdrawnAt" = $2 WHERE id = $3`,
        "DELETED",
        now,
        userId
      );
    } catch (updateErr) {
      const err = updateErr as { code?: string; message?: string; meta?: unknown };
      console.error("[account/delete] UPDATE error — code:", err?.code, "message:", err?.message, "meta:", err?.meta);
      console.error("[account/delete] full error:", updateErr);
      if (
        typeof err?.message === "string" &&
        (err.message.includes('column "status"') ||
          err.message.includes('column "withdrawnAt"') ||
          err.message.includes("does not exist"))
      ) {
        console.error(
          "[account/delete] DB에 User.status 또는 User.withdrawnAt 컬럼이 없습니다. npx prisma migrate dev 또는 npx prisma migrate deploy 후 npx prisma generate 를 실행하세요."
        );
      }
      return NextResponse.json(
        { error: "탈퇴 처리 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const err = e as Error & { code?: string; message?: string; meta?: unknown };
    console.error("[account/delete] unexpected error:", err?.message ?? e);
    console.error("[account/delete] stack:", err?.stack);
    return NextResponse.json(
      { error: "탈퇴 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
