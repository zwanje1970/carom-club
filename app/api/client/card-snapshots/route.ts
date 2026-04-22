import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getCardSnapshotById,
  getClientStatusByUserId,
  getTournamentById,
  getUserById,
  listCardSnapshotsByTournamentId,
  setCardSnapshotActive,
  upsertTournamentPublishedCard,
  type TournamentCardBackground,
  type TournamentCardTemplate,
  type TournamentCardTheme,
} from "../../../../lib/server/dev-store";

export const runtime = "nodejs";

async function getPublisher() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = parseSessionCookieValue(raw);
  if (!session) return { ok: false as const, error: "Login is required.", status: 401 };

  const user = await getUserById(session.userId);
  if (!user) return { ok: false as const, error: "User not found.", status: 401 };

  if (user.role === "PLATFORM") return { ok: true as const, user };

  if (user.role !== "CLIENT") return { ok: false as const, error: "CLIENT role is required.", status: 403 };

  const clientStatus = await getClientStatusByUserId(user.id);
  if (clientStatus !== "APPROVED") {
    return { ok: false as const, error: "Only APPROVED clients can publish.", status: 403 };
  }

  return { ok: true as const, user };
}

function parseCardTemplate(v: unknown): TournamentCardTemplate {
  return v === "B" ? "B" : "A";
}

function parseBackground(v: unknown): TournamentCardBackground {
  return v === "theme" ? "theme" : "image";
}

function parseTheme(v: unknown): TournamentCardTheme {
  if (v === "light") return "light";
  if (v === "natural") return "natural";
  return "dark";
}

export async function POST(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  let body: {
    tournamentId?: unknown;
    title?: unknown;
    textLine1?: unknown;
    textLine2?: unknown;
    textLine3?: unknown;
    cardTemplate?: unknown;
    backgroundType?: unknown;
    themeType?: unknown;
    imageId?: unknown;
    image320Url?: unknown;
    draftOnly?: unknown;
    mediaBackground?: unknown;
    imageOverlayBlend?: unknown;
    imageOverlayOpacity?: unknown;
    cardDisplayDate?: unknown;
    cardDisplayLocation?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== publisher.user.id) {
    return NextResponse.json({ error: "You can publish only your tournaments." }, { status: 403 });
  }

  const draftOnly = body.draftOnly === true;
  const backgroundType = parseBackground(body.backgroundType);
  const title = typeof body.title === "string" ? body.title : "";
  const t1 = typeof body.textLine1 === "string" ? body.textLine1 : null;
  const t2 = typeof body.textLine2 === "string" ? body.textLine2 : null;
  const t3 = typeof body.textLine3 === "string" ? body.textLine3 : null;
  const imageId = typeof body.imageId === "string" ? body.imageId : "";
  const image320Url = typeof body.image320Url === "string" ? body.image320Url : "";

  const mediaBackground =
    body.mediaBackground === null
      ? null
      : typeof body.mediaBackground === "string"
        ? body.mediaBackground
        : undefined;
  const imageOverlayBlend = typeof body.imageOverlayBlend === "boolean" ? body.imageOverlayBlend : undefined;
  const imageOverlayOpacityRaw = body.imageOverlayOpacity;
  const imageOverlayOpacity =
    typeof imageOverlayOpacityRaw === "number" && Number.isFinite(imageOverlayOpacityRaw)
      ? imageOverlayOpacityRaw
      : undefined;

  const cardDisplayDate =
    body.cardDisplayDate === null
      ? null
      : typeof body.cardDisplayDate === "string"
        ? body.cardDisplayDate
        : undefined;
  const cardDisplayLocation =
    body.cardDisplayLocation === null
      ? null
      : typeof body.cardDisplayLocation === "string"
        ? body.cardDisplayLocation
        : undefined;

  const result = await upsertTournamentPublishedCard({
    tournamentId,
    title,
    textLine1: t1,
    textLine2: t2,
    textLine3: t3,
    templateType: parseCardTemplate(body.cardTemplate),
    backgroundType,
    themeType: parseTheme(body.themeType),
    image320Url,
    imageId,
    targetDetailUrl: `/site/tournaments/${tournamentId}`,
    publishedBy: publisher.user.id,
    draftOnly,
    ...(mediaBackground !== undefined ? { mediaBackground } : {}),
    ...(imageOverlayBlend !== undefined ? { imageOverlayBlend } : {}),
    ...(imageOverlayOpacity !== undefined ? { imageOverlayOpacity } : {}),
    ...(cardDisplayDate !== undefined ? { cardDisplayDate } : {}),
    ...(cardDisplayLocation !== undefined ? { cardDisplayLocation } : {}),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}

export async function GET(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  const url = new URL(request.url);
  const tournamentId = url.searchParams.get("tournamentId") ?? "";
  if (!tournamentId) {
    return NextResponse.json({ error: "tournamentId is required." }, { status: 400 });
  }

  const tournament = await getTournamentById(tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== publisher.user.id) {
    return NextResponse.json({ error: "You can read only your tournaments." }, { status: 403 });
  }

  const snapshots = await listCardSnapshotsByTournamentId(tournamentId);
  const activeSnapshot = snapshots.find((item) => item.isActive) ?? null;
  return NextResponse.json({
    snapshots,
    activeSnapshot,
    tournament: {
      title: tournament.title,
      date: tournament.date,
      location: tournament.location,
      statusBadge: tournament.statusBadge,
      summary: tournament.summary,
      prizeInfo: tournament.prizeInfo,
    },
  });
}

export async function PATCH(request: Request) {
  const publisher = await getPublisher();
  if (!publisher.ok) {
    return NextResponse.json({ error: publisher.error }, { status: publisher.status });
  }

  let body: {
    snapshotId?: unknown;
    isActive?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const snapshotId = typeof body.snapshotId === "string" ? body.snapshotId : "";
  const isActive = typeof body.isActive === "boolean" ? body.isActive : null;
  if (!snapshotId || isActive == null) {
    return NextResponse.json({ error: "snapshotId and isActive are required." }, { status: 400 });
  }

  const snapshot = await getCardSnapshotById(snapshotId);
  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found." }, { status: 404 });
  }

  const tournament = await getTournamentById(snapshot.tournamentId);
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== publisher.user.id) {
    return NextResponse.json({ error: "You can update only your snapshots." }, { status: 403 });
  }

  const result = await setCardSnapshotActive({ snapshotId, isActive });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}
