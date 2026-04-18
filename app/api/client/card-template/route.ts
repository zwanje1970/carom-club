import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import { getClientStatusByUserId, getMainCardTemplate, getUserById } from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function canReadTemplate() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return false;

  const user = await getUserById(session.userId);
  if (!user) return false;
  if (user.role === "PLATFORM") return true;
  if (user.role !== "CLIENT") return false;

  const status = await getClientStatusByUserId(user.id);
  return status === "APPROVED";
}

export async function GET() {
  const allowed = await canReadTemplate();
  if (!allowed) {
    return NextResponse.json({ error: "Template read access denied." }, { status: 403 });
  }

  const template = await getMainCardTemplate();
  return NextResponse.json({ template });
}
