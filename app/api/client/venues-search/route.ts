import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getUserById,
  searchRegisteredVenuesForTournament,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function getAuthorizedClientUser() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return null;

  const user = await getUserById(session.userId);
  if (!user) return null;

  if (user.role === "PLATFORM") {
    return { user, allowed: true as const };
  }

  if (user.role !== "CLIENT") {
    return { user, allowed: false as const };
  }

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { user, allowed: false as const };
  }

  return { user, allowed: true as const };
}

export async function GET(request: NextRequest) {
  const auth = await getAuthorizedClientUser();
  if (!auth) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!auth.allowed) {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }
  if (auth.user.role === "PLATFORM") {
    return NextResponse.json({ error: "클라이언트 전용입니다." }, { status: 403 });
  }

  const q = request.nextUrl.searchParams.get("q") ?? "";
  const venues = await searchRegisteredVenuesForTournament(q);
  return NextResponse.json({ venues });
}
