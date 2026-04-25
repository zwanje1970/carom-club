import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../../../lib/auth/session";
import {
  getUserById,
  SitePageBuilderDraftSection,
  upsertSitePageBuilderPublishedPage,
} from "../../../../../../lib/platform-api";

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

type PublishPageRequest = {
  sections?: unknown;
};

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ pageId: string }> }
) {
  const user = await requirePlatformUser();
  if (!user) {
    return NextResponse.json({ error: "Platform role is required." }, { status: 403 });
  }

  const { pageId } = await context.params;
  const normalizedPageId = pageId.trim();
  if (!normalizedPageId) {
    return NextResponse.json({ error: "pageId is required." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as PublishPageRequest | null;
  if (!body || !Array.isArray(body.sections)) {
    return NextResponse.json({ error: "sections is required." }, { status: 400 });
  }

  const result = await upsertSitePageBuilderPublishedPage({
    pageId: normalizedPageId,
    sections: body.sections as SitePageBuilderDraftSection[],
    actorUserId: user.id,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, published: result.published });
}
