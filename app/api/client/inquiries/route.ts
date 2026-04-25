import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  createClientInquiry,
  getClientStatusByUserId,
  getUserById,
  listClientInquiriesByClientUserIdWithAdminReplyFlag,
  type ClientInquiryType,
} from "../../../../lib/platform-api";

export const runtime = "nodejs";

async function requireApprovedClient() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "CLIENT") return null;
  if ((await getClientStatusByUserId(user.id)) !== "APPROVED") return null;
  return user;
}

export async function GET() {
  const user = await requireApprovedClient();
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const items = await listClientInquiriesByClientUserIdWithAdminReplyFlag(user.id);
  return NextResponse.json({
    items: items.map(({ inquiry: x, hasAdminReply }) => ({
      id: x.id,
      type: x.type,
      title: x.title,
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
      hasAdminReply,
    })),
  });
}

export async function POST(request: Request) {
  const user = await requireApprovedClient();
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  let body: { type?: unknown; title?: unknown; body?: unknown; imageUrls?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const typeRaw = typeof body.type === "string" ? body.type.trim().toUpperCase() : "";
  const type: ClientInquiryType = typeRaw === "FEATURE" ? "FEATURE" : "ERROR";
  const title = typeof body.title === "string" ? body.title : "";
  const textBody = typeof body.body === "string" ? body.body : "";
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
    : [];

  const result = await createClientInquiry({
    clientUserId: user.id,
    type,
    title,
    body: textBody,
    imageUrls,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: result.inquiry.id });
}
