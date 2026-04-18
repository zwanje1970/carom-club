import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getUserById,
  listClientInquiriesForPlatform,
  resolveClientInquiryPlatformDisplayBatch,
  type ClientInquiryType,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function requirePlatform() {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function GET(request: Request) {
  const user = await requirePlatform();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const typeRaw = searchParams.get("type")?.trim().toUpperCase();
  const type: ClientInquiryType | undefined =
    typeRaw === "ERROR" ? "ERROR" : typeRaw === "FEATURE" ? "FEATURE" : undefined;
  const items = await listClientInquiriesForPlatform(type ? { type } : undefined);
  const displays = await resolveClientInquiryPlatformDisplayBatch(items);
  return NextResponse.json({
    items: items.map((x, i) => {
      const d = displays[i]!;
      return {
        id: x.id,
        type: x.type,
        title: x.title,
        status: x.status,
        createdAt: x.createdAt,
        updatedAt: x.updatedAt,
        senderName: d.senderName,
        contactDisplay: d.contactDisplay,
        organizationDisplay: d.organizationDisplay,
      };
    }),
  });
}
