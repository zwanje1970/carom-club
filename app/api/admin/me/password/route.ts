import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { verifyPassword, hashPassword } from "@/lib/auth";

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다. .env에 DATABASE_URL을 설정해 주세요." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const body = await request.json();
  const { currentPassword, newPassword } = body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "현재 비밀번호와 6자 이상의 새 비밀번호를 입력해주세요." },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
  });
  if (!user) {
    return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const ok = await verifyPassword(currentPassword, user.password);
  if (!ok) {
    return NextResponse.json(
      { error: "현재 비밀번호가 일치하지 않습니다." },
      { status: 400 }
    );
  }

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: session.id },
    data: { password: hashed },
  });

  return NextResponse.json({ ok: true });
}
