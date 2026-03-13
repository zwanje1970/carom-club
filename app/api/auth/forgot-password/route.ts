import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const TOKEN_EXIRY_HOURS = 1;

/** POST: 비밀번호 재설정 링크 요청 (이메일로 토큰 발급) */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스에 연결할 수 없습니다." },
      { status: 503 }
    );
  }
  try {
    const body = await request.json();
    const email = (body.email as string)?.trim();
    if (!email) {
      return NextResponse.json(
        { error: "이메일을 입력해 주세요." },
        { status: 400 }
      );
    }
    const user = await prisma.user.findFirst({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "해당 이메일로 가입된 계정이 없습니다." },
        { status: 404 }
      );
    }
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + TOKEN_EXIRY_HOURS * 60 * 60 * 1000);
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const resetLink = `${baseUrl}/login/reset-password?token=${token}`;
    if (process.env.NODE_ENV !== "production") {
      console.log("[forgot-password] Reset link (dev):", resetLink);
    }
    return NextResponse.json({
      message: "등록된 이메일로 비밀번호 재설정 링크를 보냅니다. 이메일 발송이 설정되지 않은 경우 관리자에게 문의하세요.",
      resetLink: process.env.NODE_ENV !== "production" ? resetLink : undefined,
    });
  } catch (e) {
    console.error("[forgot-password] error:", e);
    return NextResponse.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
