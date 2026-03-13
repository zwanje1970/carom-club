import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

export async function PATCH(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      { error: "데이터베이스가 연결되지 않았습니다." },
      { status: 503 }
    );
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: {
    name?: string;
    email?: string;
    phone?: string;
    handicap?: string;
    avg?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { name, email, phone, handicap, avg } = body;
  const updates: { name?: string; email?: string; phone?: string | null } = {};
  if (name !== undefined) {
    const trimmed = name?.trim();
    if (!trimmed) {
      return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
    }
    updates.name = trimmed;
  }
  if (email !== undefined) {
    updates.email = email?.trim() ?? "";
  }
  if (phone !== undefined) {
    updates.phone = phone?.trim() || null;
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (Object.keys(updates).length > 0) {
        await tx.user.update({
          where: { id: session.id },
          data: updates,
        });
      }
      const profileUpdates: { handicap?: string | null; avg?: string | null } = {};
      if (handicap !== undefined) profileUpdates.handicap = handicap?.trim() || null;
      if (avg !== undefined) profileUpdates.avg = avg?.trim() || null;
      if (Object.keys(profileUpdates).length > 0) {
        await tx.memberProfile.upsert({
          where: { userId: session.id },
          create: {
            userId: session.id,
            ...profileUpdates,
          },
          update: profileUpdates,
        });
      }
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("mypage profile PATCH", e);
    return NextResponse.json(
      { error: "수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
