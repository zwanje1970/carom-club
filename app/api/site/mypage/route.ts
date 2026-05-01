import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getClientStatusByUserId,
  getUserById,
  updateUserProfile,
  type TournamentApplicationStatus,
} from "../../../../lib/platform-api";
import { listTournamentApplicationsByUserIdFirestore } from "../../../../lib/server/firestore-tournament-applications";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";

export const runtime = "nodejs";

function getUnauthorizedResponse() {
  return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
}

function isTournamentOngoing(dateText: string): boolean {
  const parsed = new Date(`${dateText}T23:59:59`);
  if (Number.isNaN(parsed.getTime())) return true;
  return parsed.getTime() >= Date.now();
}

async function getMypageApplicationRowsPayload(userId: string) {
  try {
    const applications = await listTournamentApplicationsByUserIdFirestore(userId);
    const applicationRows = await Promise.all(
      applications.map(async (application) => {
        const tournament = await getTournamentByIdFirestore(application.tournamentId);
        return { application, tournament };
      }),
    );

    const visibleStatuses: TournamentApplicationStatus[] = [
      "APPLIED",
      "VERIFYING",
      "WAITING_PAYMENT",
      "APPROVED",
    ];
    const visibleRows = applicationRows.filter((row) => {
      if (!row.tournament) return false;
      if (!visibleStatuses.includes(row.application.status)) return false;
      if (row.application.status === "APPROVED" || row.application.status === "APPLIED") {
        return isTournamentOngoing(row.tournament.date);
      }
      return true;
    });

    return visibleRows.map((row) => ({
      applicationId: row.application.id,
      tournamentId: row.application.tournamentId,
      status: row.application.status,
      createdAt: row.application.createdAt,
      tournamentTitle: row.tournament?.title ?? "대회",
      tournamentDate: row.tournament?.date || row.application.createdAt.slice(0, 10),
    }));
  } catch (e) {
    console.warn("[api/site/mypage] getMypageApplicationRowsPayload", e);
    return [];
  }
}

/** 마이페이지 클라이언트 지연 로드용 — RSC 초기 렌더와 분리 */
export async function GET(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return getUnauthorizedResponse();

  const user = await getUserById(session.userId);
  if (!user) return getUnauthorizedResponse();

  const part = new URL(request.url).searchParams.get("part");

  if (part === "footer") {
    let clientApplicationStatus: Awaited<ReturnType<typeof getClientStatusByUserId>> = null;
    try {
      clientApplicationStatus = await getClientStatusByUserId(user.id);
    } catch (e) {
      console.warn("[api/site/mypage?part=footer] getClientStatusByUserId", e);
    }
    return NextResponse.json({ clientApplicationStatus });
  }

  if (part === "applications") {
    const applicationRows = await getMypageApplicationRowsPayload(user.id);
    return NextResponse.json({ applicationRows });
  }

  let clientApplicationStatus: Awaited<ReturnType<typeof getClientStatusByUserId>> = null;
  let applicationRows: Awaited<ReturnType<typeof getMypageApplicationRowsPayload>> = [];
  try {
    clientApplicationStatus = await getClientStatusByUserId(user.id);
  } catch (e) {
    console.warn("[api/site/mypage] getClientStatusByUserId", e);
  }
  try {
    applicationRows = await getMypageApplicationRowsPayload(user.id);
  } catch (e) {
    console.warn("[api/site/mypage] getMypageApplicationRowsPayload (full)", e);
  }

  return NextResponse.json({
    clientApplicationStatus,
    applicationRows,
  });
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return getUnauthorizedResponse();

  const user = await getUserById(session.userId);
  if (!user) return getUnauthorizedResponse();

  let body: {
    name?: unknown;
    nickname?: unknown;
    phone?: unknown;
    password?: unknown;
    passwordConfirm?: unknown;
    pushMarketingAgreed?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "요청 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name : "";
  const nickname = typeof body.nickname === "string" ? body.nickname : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const password = typeof body.password === "string" ? body.password : "";
  const passwordConfirm = typeof body.passwordConfirm === "string" ? body.passwordConfirm : "";

  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "비밀번호 확인이 일치하지 않습니다." }, { status: 400 });
    }
  }

  const pushMarketingAgreed =
    typeof body.pushMarketingAgreed === "boolean" ? body.pushMarketingAgreed : undefined;

  const result = await updateUserProfile({
    userId: user.id,
    name,
    nickname,
    phone,
    password: password || undefined,
    pushMarketingAgreed,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      name: result.user.name,
      nickname: result.user.nickname,
      role: result.user.role,
      email: result.user.email,
      phone: result.user.phone,
      pushMarketingAgreed: result.user.pushMarketingAgreed,
    },
  });
}
