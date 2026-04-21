import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getSiteCommunityConfig,
  getUserById,
  patchSiteCommunityConfig,
  type SiteCommunityBoardConfig,
} from "../../../../lib/server/dev-store";
import { isSiteCommunityConfigWritePersistenceBlockedError } from "../../../../lib/server/platform-site-community-settings";

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

type CommunityPatchBody = {
  free?: Partial<SiteCommunityBoardConfig>;
  qna?: Partial<SiteCommunityBoardConfig>;
  reviews?: Partial<SiteCommunityBoardConfig>;
  extra1?: Partial<SiteCommunityBoardConfig>;
  extra2?: Partial<SiteCommunityBoardConfig>;
};

function isValidBoardPatch(value: unknown): value is Partial<SiteCommunityBoardConfig> {
  if (!value || typeof value !== "object") return false;
  const row = value as { visible?: unknown; label?: unknown; order?: unknown };
  if (row.visible !== undefined && typeof row.visible !== "boolean") return false;
  if (row.label !== undefined && typeof row.label !== "string") return false;
  if (row.order !== undefined && typeof row.order !== "number") return false;
  return row.visible !== undefined || row.label !== undefined || row.order !== undefined;
}

export async function GET() {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  const config = await getSiteCommunityConfig();
  return NextResponse.json({ config });
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

  const parsed = body as {
    free?: unknown;
    qna?: unknown;
    reviews?: unknown;
    extra1?: unknown;
    extra2?: unknown;
  };

  const nextPatch: CommunityPatchBody = {};
  let hasValidField = false;

  if (parsed.free !== undefined) {
    if (!isValidBoardPatch(parsed.free)) return NextResponse.json({ error: "free is invalid." }, { status: 400 });
    nextPatch.free = parsed.free;
    hasValidField = true;
  }
  if (parsed.qna !== undefined) {
    if (!isValidBoardPatch(parsed.qna)) return NextResponse.json({ error: "qna is invalid." }, { status: 400 });
    nextPatch.qna = parsed.qna;
    hasValidField = true;
  }
  if (parsed.reviews !== undefined) {
    if (!isValidBoardPatch(parsed.reviews)) {
      return NextResponse.json({ error: "reviews is invalid." }, { status: 400 });
    }
    nextPatch.reviews = parsed.reviews;
    hasValidField = true;
  }
  if (parsed.extra1 !== undefined) {
    if (!isValidBoardPatch(parsed.extra1)) return NextResponse.json({ error: "extra1 is invalid." }, { status: 400 });
    nextPatch.extra1 = parsed.extra1;
    hasValidField = true;
  }
  if (parsed.extra2 !== undefined) {
    if (!isValidBoardPatch(parsed.extra2)) return NextResponse.json({ error: "extra2 is invalid." }, { status: 400 });
    nextPatch.extra2 = parsed.extra2;
    hasValidField = true;
  }

  if (!hasValidField) {
    return NextResponse.json({ error: "No valid fields provided." }, { status: 400 });
  }

  try {
    const config = await patchSiteCommunityConfig(nextPatch);
    return NextResponse.json({ ok: true, config });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save site community config.";
    console.error("[platform/site-community] PATCH persist failed", e);
    if (isSiteCommunityConfigWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        { error: message, code: "SITE_COMMUNITY_CONFIG_PERSISTENCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
