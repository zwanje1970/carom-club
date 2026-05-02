import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../../../../lib/auth/session";
import {
  getCardSnapshotById,
  getClientStatusByUserId,
  getUserById,
  listCardSnapshotsByTournamentId,
  resolveCanonicalUserIdForAuth,
  setCardSnapshotActive,
  upsertTournamentPublishedCard,
  type PublishedCardSnapshot,
  type TournamentCardBackground,
  type TournamentCardTemplate,
  type TournamentCardTheme,
} from "../../../../lib/platform-api";
import { getTournamentByIdFirestore } from "../../../../lib/server/firestore-tournaments";
import { isTournamentPublishedCardsWritePersistenceBlockedError } from "../../../../lib/server/platform-tournament-published-cards-settings";

export const runtime = "nodejs";

const CARD_SNAPSHOTS_EDITOR_MODE_PARAM = "editor";
/** `card-publish-v2` loadSnapshots — 최신순 상위 N건만(작성 화면은 [0]·active만 사용) */
const CARD_SNAPSHOTS_EDITOR_LIST_LIMIT = 3;

/** 게시카드 작성 화면 복원에 필요한 필드만 (`loadSnapshots` 기준) */
function publishedCardSnapshotToEditorGetBody(s: PublishedCardSnapshot): Record<string, unknown> {
  const out: Record<string, unknown> = {
    title: s.title,
    cardExtraLine1: s.cardExtraLine1 ?? null,
    cardExtraLine2: s.cardExtraLine2 ?? null,
    tournamentCardTemplate: s.tournamentCardTemplate,
    tournamentTheme: s.tournamentTheme,
    tournamentBackgroundType: s.tournamentBackgroundType,
    image320Url: s.image320Url,
    imageId: s.imageId,
    tournamentCardDisplayDate: s.tournamentCardDisplayDate ?? null,
    tournamentCardDisplayLocation: s.tournamentCardDisplayLocation ?? null,
    cardLeadTextColor: s.cardLeadTextColor ?? null,
    cardTitleTextColor: s.cardTitleTextColor ?? null,
    cardDescriptionTextColor: s.cardDescriptionTextColor ?? null,
    cardFooterDateTextColor: s.cardFooterDateTextColor ?? null,
    cardFooterPlaceTextColor: s.cardFooterPlaceTextColor ?? null,
  };
  if (s.tournamentCardTextShadowEnabled === true) {
    out.tournamentCardTextShadowEnabled = true;
  }
  if (s.tournamentCardSurfaceLayout === "full") {
    out.tournamentCardSurfaceLayout = "full";
  }
  if (typeof s.tournamentMediaBackground === "string") {
    out.tournamentMediaBackground = s.tournamentMediaBackground;
  }
  if (typeof s.tournamentImageOverlayBlend === "boolean") {
    out.tournamentImageOverlayBlend = s.tournamentImageOverlayBlend;
  }
  if (typeof s.tournamentImageOverlayOpacity === "number") {
    out.tournamentImageOverlayOpacity = s.tournamentImageOverlayOpacity;
  }
  return out;
}

async function publisherTournamentOwnerId(user: { id: string; role: string }): Promise<string> {
  if (user.role === "PLATFORM") return user.id;
  return resolveCanonicalUserIdForAuth(user.id);
}

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
    cardLeadTextColor?: unknown;
    cardTitleTextColor?: unknown;
    cardDescriptionTextColor?: unknown;
    cardTextShadowEnabled?: unknown;
    cardSurfaceLayout?: unknown;
    cardFooterDateTextColor?: unknown;
    cardFooterPlaceTextColor?: unknown;
    publishedCardImageUrl?: unknown;
    publishedCardImage320Url?: unknown;
  } = {};

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const tournamentId = typeof body.tournamentId === "string" ? body.tournamentId : "";
  let tournament: Awaited<ReturnType<typeof getTournamentByIdFirestore>>;
  try {
    tournament = await getTournamentByIdFirestore(tournamentId);
  } catch (e) {
    console.error("[api/client/card-snapshots] POST tournament lookup failed", {
      step: "tournament-lookup",
      tournamentId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Tournament lookup failed.", code: "TOURNAMENT_LOOKUP_FAILED" }, { status: 500 });
  }
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }

  const ownerId = await publisherTournamentOwnerId(publisher.user);
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== ownerId) {
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

  const cardLeadTextColor = typeof body.cardLeadTextColor === "string" ? body.cardLeadTextColor : undefined;
  const cardTitleTextColor = typeof body.cardTitleTextColor === "string" ? body.cardTitleTextColor : undefined;
  const cardDescriptionTextColor =
    typeof body.cardDescriptionTextColor === "string" ? body.cardDescriptionTextColor : undefined;
  const cardTextShadowEnabled = body.cardTextShadowEnabled === true;
  const cardSurfaceLayout = body.cardSurfaceLayout === "full" ? "full" : "split";
  const cardFooterDateTextColor =
    body.cardFooterDateTextColor === null
      ? null
      : typeof body.cardFooterDateTextColor === "string"
        ? body.cardFooterDateTextColor
        : undefined;
  const cardFooterPlaceTextColor =
    body.cardFooterPlaceTextColor === null
      ? null
      : typeof body.cardFooterPlaceTextColor === "string"
        ? body.cardFooterPlaceTextColor
        : undefined;

  const publishedCardImageUrl =
    !draftOnly && typeof body.publishedCardImageUrl === "string" ? body.publishedCardImageUrl : undefined;
  const publishedCardImage320Url =
    !draftOnly && typeof body.publishedCardImage320Url === "string" ? body.publishedCardImage320Url : undefined;

  let result: Awaited<ReturnType<typeof upsertTournamentPublishedCard>>;
  try {
    result = await upsertTournamentPublishedCard({
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
      ...(cardLeadTextColor !== undefined ? { cardLeadTextColor } : {}),
      ...(cardTitleTextColor !== undefined ? { cardTitleTextColor } : {}),
      ...(cardDescriptionTextColor !== undefined ? { cardDescriptionTextColor } : {}),
      cardTextShadowEnabled,
      cardSurfaceLayout,
      ...(cardFooterDateTextColor !== undefined ? { cardFooterDateTextColor } : {}),
      ...(cardFooterPlaceTextColor !== undefined ? { cardFooterPlaceTextColor } : {}),
      ...(publishedCardImageUrl !== undefined ? { publishedCardImageUrl } : {}),
      ...(publishedCardImage320Url !== undefined ? { publishedCardImage320Url } : {}),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save tournament card.";
    if (isTournamentPublishedCardsWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        { error: message, code: "TOURNAMENT_PUBLISHED_CARDS_PERSISTENCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("[api/client/card-snapshots] POST persist failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json(
      { error: "error" in result ? result.error : "Request failed." },
      { status: 400 },
    );
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

  let tournament: Awaited<ReturnType<typeof getTournamentByIdFirestore>>;
  try {
    tournament = await getTournamentByIdFirestore(tournamentId);
  } catch (e) {
    console.error("[api/client/card-snapshots] GET tournament lookup failed", {
      step: "tournament-lookup",
      tournamentId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Tournament lookup failed.", code: "TOURNAMENT_LOOKUP_FAILED" }, { status: 500 });
  }
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  const ownerIdGet = await publisherTournamentOwnerId(publisher.user);
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== ownerIdGet) {
    return NextResponse.json({ error: "You can read only your tournaments." }, { status: 403 });
  }

  const snapshots = await listCardSnapshotsByTournamentId(tournamentId);
  const activeSnapshot = snapshots.find((item) => item.isActive) ?? null;
  const tournamentPayload = {
    title: tournament.title,
    date: tournament.date,
    location: tournament.location,
    statusBadge: tournament.statusBadge,
    summary: tournament.summary,
    prizeInfo: tournament.prizeInfo,
  };

  const mode = (url.searchParams.get("mode") ?? "").trim().toLowerCase();
  if (mode === CARD_SNAPSHOTS_EDITOR_MODE_PARAM) {
    const editorSnapshots = snapshots
      .slice(0, CARD_SNAPSHOTS_EDITOR_LIST_LIMIT)
      .map((s) => publishedCardSnapshotToEditorGetBody(s));
    const editorActive = activeSnapshot ? publishedCardSnapshotToEditorGetBody(activeSnapshot) : null;
    return NextResponse.json({
      snapshots: editorSnapshots,
      activeSnapshot: editorActive,
      tournament: tournamentPayload,
    });
  }

  return NextResponse.json({
    snapshots,
    activeSnapshot,
    tournament: tournamentPayload,
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

  let tournament: Awaited<ReturnType<typeof getTournamentByIdFirestore>>;
  try {
    tournament = await getTournamentByIdFirestore(snapshot.tournamentId);
  } catch (e) {
    console.error("[api/client/card-snapshots] PATCH tournament lookup failed", {
      step: "tournament-lookup",
      snapshotId,
      tournamentId: snapshot.tournamentId,
      message: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json({ error: "Tournament lookup failed.", code: "TOURNAMENT_LOOKUP_FAILED" }, { status: 500 });
  }
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found." }, { status: 404 });
  }
  const ownerIdPatch = await publisherTournamentOwnerId(publisher.user);
  if (publisher.user.role !== "PLATFORM" && tournament.createdBy !== ownerIdPatch) {
    return NextResponse.json({ error: "You can update only your snapshots." }, { status: 403 });
  }

  let result: Awaited<ReturnType<typeof setCardSnapshotActive>>;
  try {
    result = await setCardSnapshotActive({ snapshotId, isActive });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update snapshot.";
    if (isTournamentPublishedCardsWritePersistenceBlockedError(e)) {
      return NextResponse.json(
        { error: message, code: "TOURNAMENT_PUBLISHED_CARDS_PERSISTENCE_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("[api/client/card-snapshots] PATCH persist failed", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, snapshot: result.snapshot });
}
