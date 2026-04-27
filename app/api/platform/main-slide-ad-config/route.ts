import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getMainSlideAdConfigForPlatformAdmin,
  getUserById,
  patchMainSlideAdConfigForPlatformAdmin,
} from "../../../../lib/platform-api";
import { isMainSlideAdSettingsWritePersistenceBlockedError } from "../../../../lib/server/platform-main-slide-ad-settings";

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

function extractConfigPayload(body: unknown): unknown {
  if (!body || typeof body !== "object" || Array.isArray(body)) return undefined;
  const o = body as { config?: unknown };
  if ("config" in o && o.config != null && typeof o.config === "object" && !Array.isArray(o.config)) {
    return o.config;
  }
  return body;
}

export async function GET() {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  const config = await getMainSlideAdConfigForPlatformAdmin();
  return NextResponse.json({ ok: true, config });
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

  const raw = extractConfigPayload(body);
  if (raw == null || typeof raw !== "object") {
    return NextResponse.json({ error: "config object is required." }, { status: 400 });
  }

  try {
    const config = await patchMainSlideAdConfigForPlatformAdmin(raw);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save main slide ad config.";
    console.error("[platform/main-slide-ad-config] PATCH persist failed", e);
    if (isMainSlideAdSettingsWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        { error: message, code: "MAIN_SLIDE_AD_SETTINGS_PERSISTENCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  return PATCH(request);
}
