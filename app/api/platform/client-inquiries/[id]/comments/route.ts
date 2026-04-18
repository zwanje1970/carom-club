import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  appendClientInquiryCommentAsPlatform,
  getUserById,
  listClientInquiryCommentViewsForInquiry,
  resolveClientInquiryPlatformDisplay,
  type ClientInquiryStatus,
  type ClientInquiryStored,
} from "../../../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function inquiryPayloadForPlatform(row: ClientInquiryStored) {
  const d = await resolveClientInquiryPlatformDisplay(row);
  return {
    ...row,
    senderName: d.senderName,
    contactDisplay: d.contactDisplay,
    organizationDisplay: d.organizationDisplay,
  };
}

async function requirePlatform() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requirePlatform();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { body?: unknown; imageUrls?: unknown; status?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const text = typeof body.body === "string" ? body.body : "";
  const imageUrls = Array.isArray(body.imageUrls)
    ? body.imageUrls.map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean)
    : [];
  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const statusOptional: ClientInquiryStatus | null =
    statusRaw === "DONE" ? "DONE" : statusRaw === "CHECKED" ? "CHECKED" : statusRaw === "OPEN" ? "OPEN" : null;

  const result = await appendClientInquiryCommentAsPlatform({
    inquiryId: id,
    platformUserId: user.id,
    body: text,
    imageUrls,
    status: statusOptional,
  });
  if (!result.ok) {
    const st = result.error.includes("찾을 수") ? 404 : result.error.includes("권한") ? 403 : 400;
    return NextResponse.json({ error: result.error }, { status: st });
  }
  const comments = await listClientInquiryCommentViewsForInquiry(id);
  return NextResponse.json({
    ok: true,
    inquiry: await inquiryPayloadForPlatform(result.inquiry),
    comments,
  });
}
