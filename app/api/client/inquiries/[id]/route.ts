import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getClientInquiryByIdForClientUser,
  getClientStatusByUserId,
  getUserById,
  listClientInquiryCommentViewsForInquiry,
  updateClientInquiryByAuthor,
} from "../../../../../lib/server/dev-store";

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

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApprovedClient();
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const row = await getClientInquiryByIdForClientUser(id, user.id);
  if (!row) {
    return NextResponse.json({ error: "문의를 찾을 수 없습니다." }, { status: 404 });
  }
  const comments = await listClientInquiryCommentViewsForInquiry(id);
  return NextResponse.json({ inquiry: row, comments });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requireApprovedClient();
  if (!user) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { title?: unknown; body?: unknown; imageUrls?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }
  const patch: { title?: string; body?: string; imageUrls?: string[] } = {};
  if (typeof body.title === "string") patch.title = body.title;
  if (typeof body.body === "string") patch.body = body.body;
  if (Array.isArray(body.imageUrls)) {
    patch.imageUrls = body.imageUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  }
  const result = await updateClientInquiryByAuthor({
    inquiryId: id,
    authorUserId: user.id,
    ...patch,
  });
  if (!result.ok) {
    const st = result.error.includes("찾을 수") ? 404 : result.error.includes("권한") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status: st });
  }
  return NextResponse.json({ ok: true, inquiry: result.inquiry });
}
