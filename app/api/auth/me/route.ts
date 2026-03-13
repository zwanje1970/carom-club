import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

/** GET: 현재 로그인 사용자의 이름·이메일·연락처 (클라이언트 신청 폼 자동 채움용) */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ name: null, email: null, phone: null }, { status: 200 });
  }
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { name: session.name ?? "", email: session.email ?? "", phone: "" },
      { status: 200 }
    );
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.id },
      select: { name: true, email: true, phone: true },
    });
    if (!user) {
      return NextResponse.json(
        { name: session.name ?? "", email: session.email ?? "", phone: "" },
        { status: 200 }
      );
    }
    return NextResponse.json({
      name: user.name ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
    });
  } catch {
    return NextResponse.json(
      { name: session.name ?? "", email: session.email ?? "", phone: "" },
      { status: 200 }
    );
  }
}
