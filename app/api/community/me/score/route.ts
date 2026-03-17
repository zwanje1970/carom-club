import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getLevelFromScore, getTierName, getTierColor } from "@/lib/community-level";

/** 현재 로그인 사용자의 커뮤니티 점수·레벨·등급 */
export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { communityScore: true },
  });
  const score = user?.communityScore ?? 0;
  const level = getLevelFromScore(score);

  return NextResponse.json({
    score,
    level,
    tierName: getTierName(level),
    tierColor: getTierColor(level),
  });
}
