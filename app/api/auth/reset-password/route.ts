import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { hashPassword } from "@/lib/auth";

/** POST: 토큰으로 비밀번호 재설정 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스에 연결할 수 없습니다." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const { token, newPassword } = body as { token?: string; newPassword?: string };
    if (!token?.trim() || !newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: "링크가 올바르지 않거나 새 비밀번호는 6자 이상이어야 합니다." },
        { status: 400 }
      );
    }
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: token.trim() },
      include: { user: true },
    });
    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "만료되었거나 유효하지 않은 링크입니다. 비밀번호 찾기를 다시 시도해 주세요." },
        { status: 400 }
      );
    }
    const hashed = await hashPassword(newPassword);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { password: hashed },
      }),
      prisma.passwordResetToken.delete({ where: { id: record.id } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[reset-password] error:", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
