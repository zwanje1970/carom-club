import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { canAccessClientDashboard } from "@/types/auth";

type FeedbackType = "FEATURE" | "BUG";

type RequestBody = {
  type?: unknown;
  title?: unknown;
  content?: unknown;
  imageUrl?: unknown;
  pagePath?: unknown;
};

function parseFeedbackType(raw: unknown): FeedbackType | null {
  if (raw === "FEATURE" || raw === "BUG") return raw;
  return null;
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "데이터베이스가 연결되지 않았습니다." }, { status: 503 });
  }

  const session = await getSession();
  if (!session || !canAccessClientDashboard(session)) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const type = parseFeedbackType(body.type);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
  const pagePath = typeof body.pagePath === "string" && body.pagePath.trim() ? body.pagePath.trim() : null;

  if (!type) {
    return NextResponse.json({ error: "유형이 올바르지 않습니다." }, { status: 400 });
  }
  if (!title) {
    return NextResponse.json({ error: "제목을 입력해 주세요." }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "내용을 입력해 주세요." }, { status: 400 });
  }
  if (title.length > 120) {
    return NextResponse.json({ error: "제목은 120자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (content.length > 5000) {
    return NextResponse.json({ error: "내용은 5000자 이하로 입력해 주세요." }, { status: 400 });
  }
  if (pagePath && (!pagePath.startsWith("/") || pagePath.length > 500)) {
    return NextResponse.json({ error: "발생 위치는 내부 경로만 입력해 주세요." }, { status: 400 });
  }
  if (imageUrl && imageUrl.length > 2000) {
    return NextResponse.json({ error: "첨부 이미지 경로가 너무 깁니다." }, { status: 400 });
  }

  const saved = await prisma.clientFeedback.create({
    data: {
      type,
      title,
      content,
      imageUrl,
      pagePath,
      userId: session.id,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    feedback: {
      id: saved.id,
      createdAt: saved.createdAt.toISOString(),
    },
  });
}
