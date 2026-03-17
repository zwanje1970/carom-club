import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";

const REPORT_REASONS = ["PROFANITY", "AD_SPAM", "INAPPROPRIATE", "MISINFO", "CONFLICT", "OTHER"] as const;

/** 게시글 또는 댓글 신고. 동일 사용자 동일 대상 중복 불가 */
export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "DB 연결되지 않음" }, { status: 503 });
  }
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  let body: { targetType: "post" | "comment"; targetId: string; reason: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (!body.targetType || !body.targetId || !REPORT_REASONS.includes(body.reason as (typeof REPORT_REASONS)[number])) {
    return NextResponse.json({ error: "targetType, targetId, reason(욕설/비방, 광고/도배, 음란/부적절, 허위정보, 분쟁유발, 기타)가 필요합니다." }, { status: 400 });
  }

  if (body.targetType === "post") {
    const post = await prisma.communityPost.findUnique({
      where: { id: body.targetId },
      select: { id: true },
    });
    if (!post) return NextResponse.json({ error: "글을 찾을 수 없습니다." }, { status: 404 });
  } else {
    const comment = await prisma.communityComment.findUnique({
      where: { id: body.targetId },
      select: { id: true, postId: true },
    });
    if (!comment) return NextResponse.json({ error: "댓글을 찾을 수 없습니다." }, { status: 404 });
  }

  const existing = await prisma.communityReport.findUnique({
    where: {
      reporterId_targetType_targetId: {
        reporterId: session.id,
        targetType: body.targetType,
        targetId: body.targetId,
      },
    },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 신고한 글/댓글입니다." }, { status: 400 });
  }

  await prisma.communityReport.create({
    data: {
      reporterId: session.id,
      targetType: body.targetType,
      targetId: body.targetId,
      postId: body.targetType === "post" ? body.targetId : null,
      commentId: body.targetType === "comment" ? body.targetId : null,
      reason: body.reason,
    },
  });
  return NextResponse.json({ ok: true });
}
