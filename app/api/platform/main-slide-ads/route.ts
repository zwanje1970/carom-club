import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getMainSlideAdsForPlatformAdmin,
  getUserById,
  patchMainSlideAdsForPlatformAdmin,
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

export async function GET() {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  const ads = await getMainSlideAdsForPlatformAdmin();
  return NextResponse.json({ ok: true, ads });
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

  const adsRaw = (body as { ads?: unknown }).ads;
  if (!Array.isArray(adsRaw)) {
    return NextResponse.json({ error: "ads must be an array." }, { status: 400 });
  }

  try {
    const ads = await patchMainSlideAdsForPlatformAdmin(adsRaw);
    return NextResponse.json({ ok: true, ads });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save main slide ads.";
    console.error("[platform/main-slide-ads] PATCH persist failed", e);
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
