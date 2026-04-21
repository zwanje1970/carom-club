import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getPlatformOperationSettings,
  getUserById,
  patchPlatformOperationSettings,
} from "../../../../lib/server/dev-store";
import { isPlatformOperationSettingsWritePersistenceBlockedError } from "../../../../lib/server/platform-operation-settings";

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
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  const settings = await getPlatformOperationSettings();
  return NextResponse.json(settings);
}

export async function PATCH(request: Request) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  try {
    const settings = await patchPlatformOperationSettings({
      annualMembershipVisible:
        typeof body.annualMembershipVisible === "boolean" ? body.annualMembershipVisible : undefined,
      annualMembershipEnforced:
        typeof body.annualMembershipEnforced === "boolean" ? body.annualMembershipEnforced : undefined,
    });
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save platform operation settings.";
    console.error("[platform/platform-settings] PATCH persist failed", e);
    if (isPlatformOperationSettingsWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        { error: message, code: "PLATFORM_OPERATION_SETTINGS_PERSISTENCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
