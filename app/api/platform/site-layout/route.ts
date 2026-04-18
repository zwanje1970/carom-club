import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getSiteLayoutConfig, getUserById, patchSiteLayoutConfig, type SiteLayoutConfig } from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

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

  const config = await getSiteLayoutConfig();
  return NextResponse.json({ config });
}

type PatchSiteLayoutRequest = {
  header?: SiteLayoutConfig["header"];
  footer?: SiteLayoutConfig["footer"];
};

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

  const parsed = body as { header?: unknown; footer?: unknown };
  if (parsed.header !== undefined && (!parsed.header || typeof parsed.header !== "object")) {
    return NextResponse.json({ error: "header must be an object." }, { status: 400 });
  }
  if (parsed.footer !== undefined && (!parsed.footer || typeof parsed.footer !== "object")) {
    return NextResponse.json({ error: "footer must be an object." }, { status: 400 });
  }

  if (parsed.header === undefined && parsed.footer === undefined) {
    return NextResponse.json({ error: "header or footer is required." }, { status: 400 });
  }

  const config = await patchSiteLayoutConfig({
    header: parsed.header as PatchSiteLayoutRequest["header"] | undefined,
    footer: parsed.footer as PatchSiteLayoutRequest["footer"] | undefined,
  });
  return NextResponse.json({ ok: true, config });
}
