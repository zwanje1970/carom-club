import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** POST: 이메일로 가입된 아이디(username) 조회 */
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
      select: { username: true },
    });
    if (!user) {
      return NextResponse.json(
        { error: "해당 이메일로 가입된 계정이 없습니다." },
        { status: 404 }
      );
    }
    return NextResponse.json({ username: user.username });
  } catch (e) {
    console.error("[find-username] error:", e);
    return NextResponse.json(
      { error: "조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
