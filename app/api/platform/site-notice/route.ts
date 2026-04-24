import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getSiteNotice, getUserById, patchSiteNotice } from "../../../../lib/server/dev-store";
import { isSiteNoticeWritePersistenceBlockedError } from "../../../../lib/server/platform-site-notice-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requirePlatformUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;
  const user = await getUserById(session.userId);
  if (!user || user.role !== "PLATFORM") return null;
  return user;
}

export async function GET() {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  const notice = await getSiteNotice();
  return NextResponse.json({ notice });
}

export async function PATCH(request: Request) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = body as { enabled?: unknown; text?: unknown };
  if (parsed.enabled === undefined && parsed.text === undefined) {
    return NextResponse.json({ error: "enabled or text is required." }, { status: 400 });
  }
  if (parsed.enabled !== undefined && typeof parsed.enabled !== "boolean") {
    return NextResponse.json({ error: "enabled must be a boolean." }, { status: 400 });
  }
  if (parsed.text !== undefined && typeof parsed.text !== "string") {
    return NextResponse.json({ error: "text must be a string." }, { status: 400 });
  }

  try {
    const notice = await patchSiteNotice({
      enabled: parsed.enabled as boolean | undefined,
      text: parsed.text as string | undefined,
    });
    return NextResponse.json({ ok: true, notice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save site notice.";
    console.error("[platform/site-notice] PATCH persist failed", e);
    if (isSiteNoticeWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        {
          error: message,
          code: "SITE_NOTICE_PERSISTENCE_UNAVAILABLE",
        },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
