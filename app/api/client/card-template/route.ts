import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getClientStatusByUserId, getUserById } from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function canReadTemplate() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return false;

  const user = await getUserById(session.userId);
  if (!user) return false;
  if (user.role === "PLATFORM") return true;
  if (user.role !== "CLIENT") return false;

  const status = await getClientStatusByUserId(user.id);
  return status === "APPROVED";
}

export async function GET() {
  const allowed = await canReadTemplate();
  if (!allowed) {
    return NextResponse.json({ error: "Template read access denied." }, { status: 403 });
  }

  const now = new Date().toISOString();
  const template = {
    id: "main-card-template-tournament",
    name: "기본 메인 게시카드 템플릿",
    textAreaStructure: "상단 제목 + 하단 보조문구",
    imageSlotStructure: "대표 이미지 1칸",
    defaultLayout: "고정 레이아웃",
    createdAt: now,
    updatedAt: now,
  };
  return NextResponse.json({ template });
}
