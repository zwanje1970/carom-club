import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../lib/auth/session";
import {
  getClientInquiryById,
  getUserById,
  listClientInquiryCommentViewsForInquiry,
  resolveClientInquiryPlatformDisplay,
  updateClientInquiryStatusByPlatform,
  type ClientInquiryStatus,
  type ClientInquiryStored,
} from "../../../../../lib/platform-api";

async function inquiryPayloadForPlatform(row: ClientInquiryStored) {
  const d = await resolveClientInquiryPlatformDisplay(row);
  return {
    ...row,
    senderName: d.senderName,
    contactDisplay: d.contactDisplay,
    organizationDisplay: d.organizationDisplay,
  };
}

export const runtime = "nodejs";

async function requirePlatform() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requirePlatform();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const row = await getClientInquiryById(id);
  if (!row) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const comments = await listClientInquiryCommentViewsForInquiry(id);
  return NextResponse.json({ inquiry: await inquiryPayloadForPlatform(row), comments });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await requirePlatform();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  let body: { status?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  const statusRaw = typeof body.status === "string" ? body.status.trim().toUpperCase() : "";
  const status: ClientInquiryStatus =
    statusRaw === "DONE" ? "DONE" : statusRaw === "CHECKED" ? "CHECKED" : "OPEN";
  const result = await updateClientInquiryStatusByPlatform({ inquiryId: id, status });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ ok: true, inquiry: await inquiryPayloadForPlatform(result.inquiry) });
}
