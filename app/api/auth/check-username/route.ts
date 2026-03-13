import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 아이디(닉네임) 중복 여부. ?username=xxx → { available: true } | { available: false, message: string } */
export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { available: false, message: "서비스를 일시적으로 사용할 수 없습니다." },
      { status: 503 }
    );
  }
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json(
      { available: false, message: "닉네임을 입력해주세요." },
      { status: 400 }
    );
  }

  if (username.length < 2) {
    return NextResponse.json(
      { available: false, message: "닉네임은 2자 이상 입력해주세요." },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true, withdrawnAt: true },
    });

    if (!existing) {
      return NextResponse.json({ available: true });
    }

    const withdrawnAt = (existing as { withdrawnAt?: Date | null }).withdrawnAt;
    if (withdrawnAt) {
      return NextResponse.json({
        available: true,
        message: "탈퇴한 계정의 닉네임으로, 재가입 시 사용 가능합니다.",
      });
    }

    return NextResponse.json({
      available: false,
      message: "이미 사용 중인 닉네임입니다.",
    });
  } catch {
    return NextResponse.json(
      { available: false, message: "확인 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
