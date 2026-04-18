import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getMainCardTemplates, getUserById, upsertMainCardTemplate } from "../../../../lib/server/dev-store";

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

  const templates = await getMainCardTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: Request) {
  const user = await requirePlatformUser();
  if (!user) return NextResponse.json({ error: "Platform role is required." }, { status: 403 });

  let body: {
    type?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const type = body.type === "venue" ? "venue" : body.type === "tournament" ? "tournament" : null;
  if (!type) {
    return NextResponse.json({ error: "type is required." }, { status: 400 });
  }
  const template = await upsertMainCardTemplate({ type });

  return NextResponse.json({ ok: true, template });
}
