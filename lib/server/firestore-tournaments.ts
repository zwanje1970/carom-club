import { randomUUID } from "crypto";
import { AuthRole } from "../auth/roles";
import { isEmptyOutlineHtml } from "../outline-content-helpers";
import type { OutlineDisplayMode } from "../outline-content-types";
import { assertClientFirestorePersistenceConfigured, listApprovedClientOrganizationsFirestore } from "./firestore-client-applications";
import { getSharedFirestoreDb } from "./firestore-users";
import type {
  ClientOrganizationStored,
  Tournament,
  TournamentRuleSnapshot,
  TournamentStatusBadge,
} from "./dev-store";
import {
  buildTournamentFromParsedRow,
  finalizeTournamentDates,
  normalizeTournament,
  normalizeTournamentRule,
  normalizeTournamentStatusBadge,
  parseTournamentEventDates,
  parseTournamentExtraVenues,
  resolveVenueGuideVenueIdFromOrgs,
  validateTournamentRuleForCreate,
} from "./dev-store";

const COLLECTION = "v3_tournaments";

function tournamentToFirestorePlain(t: Tournament): Record<string, unknown> {
  const base: Record<string, unknown> = {
    id: t.id,
    title: t.title,
    date: t.date,
    eventDates: t.eventDates,
    location: t.location,
    extraVenues: t.extraVenues,
    maxParticipants: t.maxParticipants,
    entryFee: t.entryFee,
    createdBy: t.createdBy,
    createdAt: t.createdAt,
    posterImageUrl: t.posterImageUrl,
    statusBadge: t.statusBadge,
    summary: t.summary,
    prizeInfo: t.prizeInfo,
    outlineDisplayMode: t.outlineDisplayMode,
    outlineHtml: t.outlineHtml,
    outlineImageUrl: t.outlineImageUrl,
    outlinePdfUrl: t.outlinePdfUrl,
    venueGuideVenueId: t.venueGuideVenueId,
    rule: t.rule,
  };
  if (t.devSeedSource != null) base.devSeedSource = t.devSeedSource;
  return base;
}

async function loadResolutionOrgs(): Promise<ClientOrganizationStored[]> {
  return listApprovedClientOrganizationsFirestore({ status: "all", clientType: "all" });
}

async function fetchAndNormalizeTournament(
  id: string,
  venueOrgs: ClientOrganizationStored[] | null
): Promise<Tournament | null> {
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown> | undefined;
  const orgs = venueOrgs ?? (await loadResolutionOrgs());
  const t = buildTournamentFromParsedRow({ id, ...(data ?? {}) }, orgs);
  return normalizeTournament(t, undefined, orgs);
}

export async function getTournamentByIdFirestore(tournamentId: string): Promise<Tournament | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  return fetchAndNormalizeTournament(id, null);
}

export async function listTournamentsByCreatorFirestore(userId: string): Promise<Tournament[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const q = await db
    .collection(COLLECTION)
    .where("createdBy", "==", userId.trim())
    .orderBy("createdAt", "desc")
    .get();
  const out: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    out.push(await normalizeTournament(t, undefined, orgs));
  }
  return out;
}

export async function listAllTournamentsFirestore(): Promise<Tournament[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const q = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  const out: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    out.push(await normalizeTournament(t, undefined, orgs));
  }
  return out;
}

export async function createTournamentFirestore(params: {
  title: string;
  date: string;
  location: string;
  maxParticipants: number;
  entryFee: number;
  createdBy: string;
  rule?: Partial<TournamentRuleSnapshot>;
  posterImageUrl?: string | null;
  statusBadge?: TournamentStatusBadge;
  summary?: string | null;
  prizeInfo?: string | null;
  outlineDisplayMode?: OutlineDisplayMode | null;
  outlineHtml?: string | null;
  outlineImageUrl?: string | null;
  outlinePdfUrl?: string | null;
  venueGuideVenueId?: string | null;
  eventDates?: unknown;
  extraVenues?: unknown;
}): Promise<{ ok: true; tournament: Tournament } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const title = params.title.trim();
  const location = params.location.trim();
  const maxParticipants = Number(params.maxParticipants);
  const entryFee = Number(params.entryFee);

  if (!title) return { ok: false, error: "대회명을 입력해 주세요." };
  if (!location) return { ok: false, error: "장소를 입력해 주세요." };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "모집 인원은 1명 이상이어야 합니다." };
  }
  if (!Number.isFinite(entryFee) || entryFee < 0) {
    return { ok: false, error: "참가비는 0 이상이어야 합니다." };
  }

  const rule = normalizeTournamentRule(params.rule);
  const validated = validateTournamentRuleForCreate(rule);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const eventDatesParsed = parseTournamentEventDates(params.eventDates);
  const datesFinal = finalizeTournamentDates(params.date, eventDatesParsed, rule);
  if (!datesFinal.ok) return { ok: false, error: datesFinal.error };
  const date = datesFinal.date;
  const eventDates = datesFinal.eventDates;

  const extraVenues = parseTournamentExtraVenues(params.extraVenues);

  const posterImageUrl =
    params.posterImageUrl != null && String(params.posterImageUrl).trim() !== ""
      ? String(params.posterImageUrl).trim()
      : null;
  const summary =
    params.summary != null && String(params.summary).trim() !== "" ? String(params.summary).trim() : null;
  const prizeInfo =
    params.prizeInfo != null && String(params.prizeInfo).trim() !== "" ? String(params.prizeInfo).trim() : null;

  const om = params.outlineDisplayMode;
  const outlineDisplayMode: OutlineDisplayMode | null =
    om === "TEXT" || om === "IMAGE" || om === "PDF" ? om : null;
  const outlineHtml =
    params.outlineHtml != null && String(params.outlineHtml) !== "" ? String(params.outlineHtml) : null;
  const outlineImageUrl =
    params.outlineImageUrl != null && String(params.outlineImageUrl).trim() !== ""
      ? String(params.outlineImageUrl).trim()
      : null;
  const outlinePdfUrl =
    params.outlinePdfUrl != null && String(params.outlinePdfUrl).trim() !== ""
      ? String(params.outlinePdfUrl).trim()
      : null;

  const venueOrgs = await loadResolutionOrgs();
  const venueGuideVenueId = resolveVenueGuideVenueIdFromOrgs(venueOrgs, params.venueGuideVenueId);

  const id = randomUUID();
  const tournament: Tournament = {
    id,
    title,
    date,
    eventDates,
    location,
    extraVenues,
    maxParticipants: Math.floor(maxParticipants),
    entryFee: Math.floor(entryFee),
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    posterImageUrl,
    statusBadge: params.statusBadge != null ? normalizeTournamentStatusBadge(params.statusBadge) : "초안",
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule,
  };

  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).set(tournamentToFirestorePlain(tournament));
  return { ok: true, tournament: await normalizeTournament(tournament, undefined, venueOrgs) };
}

export async function updateTournamentFirestore(params: {
  tournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
  title: string;
  date: string;
  location: string;
  maxParticipants: number;
  entryFee: number;
  rule?: Partial<TournamentRuleSnapshot>;
  posterImageUrl?: string | null;
  summary?: string | null;
  prizeInfo?: string | null;
  outlineDisplayMode?: OutlineDisplayMode | null;
  outlineHtml?: string | null;
  outlineImageUrl?: string | null;
  outlinePdfUrl?: string | null;
  venueGuideVenueId?: string | null;
  eventDates?: unknown;
  extraVenues?: unknown;
}): Promise<
  { ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus?: 403 | 404 }
> {
  assertClientFirestorePersistenceConfigured();
  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.tournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const title = params.title.trim();
  const location = params.location.trim();
  const maxParticipants = Number(params.maxParticipants);
  const entryFee = Number(params.entryFee);

  if (!title) return { ok: false, error: "대회명을 입력해 주세요." };
  if (!location) return { ok: false, error: "장소를 입력해 주세요." };
  if (!Number.isFinite(maxParticipants) || maxParticipants <= 0) {
    return { ok: false, error: "모집 인원은 1명 이상이어야 합니다." };
  }
  if (!Number.isFinite(entryFee) || entryFee < 0) {
    return { ok: false, error: "참가비는 0 이상이어야 합니다." };
  }

  const rule = normalizeTournamentRule(params.rule);
  const validated = validateTournamentRuleForCreate(rule);
  if (!validated.ok) {
    return { ok: false, error: validated.error };
  }

  const eventDatesParsed = parseTournamentEventDates(params.eventDates);
  const datesFinal = finalizeTournamentDates(params.date, eventDatesParsed, rule);
  if (!datesFinal.ok) return { ok: false, error: datesFinal.error };
  const date = datesFinal.date;
  const eventDates = datesFinal.eventDates;

  const extraVenues = parseTournamentExtraVenues(params.extraVenues);

  const posterImageUrl =
    params.posterImageUrl != null && String(params.posterImageUrl).trim() !== ""
      ? String(params.posterImageUrl).trim()
      : null;
  const summary =
    params.summary != null && String(params.summary).trim() !== "" ? String(params.summary).trim() : null;
  const prizeInfo =
    params.prizeInfo != null && String(params.prizeInfo).trim() !== "" ? String(params.prizeInfo).trim() : null;

  const outlineHtmlRaw = params.outlineHtml;
  const outlineHtmlCandidate = typeof outlineHtmlRaw === "string" ? outlineHtmlRaw : "";
  const outlineHtml =
    outlineHtmlCandidate !== "" && !isEmptyOutlineHtml(outlineHtmlCandidate) ? outlineHtmlCandidate : null;
  const outlineImageUrl =
    params.outlineImageUrl != null && String(params.outlineImageUrl).trim() !== ""
      ? String(params.outlineImageUrl).trim()
      : null;
  const outlinePdfUrl =
    params.outlinePdfUrl != null && String(params.outlinePdfUrl).trim() !== ""
      ? String(params.outlinePdfUrl).trim()
      : null;
  const outlineModeParsed = params.outlineDisplayMode;
  const hasAnyOutline = Boolean(outlineHtml || outlineImageUrl || outlinePdfUrl);
  const outlineDisplayMode: OutlineDisplayMode | null = hasAnyOutline
    ? outlineModeParsed === "TEXT" || outlineModeParsed === "IMAGE" || outlineModeParsed === "PDF"
      ? outlineModeParsed
      : "TEXT"
    : null;

  const venueOrgs = await loadResolutionOrgs();
  const venueGuideVenueId = resolveVenueGuideVenueIdFromOrgs(venueOrgs, params.venueGuideVenueId);

  const existing = gate.tournament;
  const updated: Tournament = {
    ...existing,
    title,
    date,
    eventDates,
    location,
    extraVenues,
    maxParticipants: Math.floor(maxParticipants),
    entryFee: Math.floor(entryFee),
    posterImageUrl,
    summary,
    prizeInfo,
    outlineDisplayMode,
    outlineHtml,
    outlineImageUrl,
    outlinePdfUrl,
    venueGuideVenueId,
    rule,
  };

  const db = getSharedFirestoreDb();
  const tid = params.tournamentId.trim();
  await db.collection(COLLECTION).doc(tid).set(tournamentToFirestorePlain(updated), { merge: true });
  return { ok: true, tournament: await normalizeTournament(updated, undefined, venueOrgs) };
}

export async function deleteTournamentFirestore(params: {
  tournamentId: string;
  actorUserId: string;
  actorRole: AuthRole;
}): Promise<{ ok: true } | { ok: false; error: string; httpStatus?: 403 | 404 }> {
  assertClientFirestorePersistenceConfigured();
  const gate = await assertClientCanManageTournamentFirestore({
    actorUserId: params.actorUserId,
    actorRole: params.actorRole,
    tournamentId: params.tournamentId,
  });
  if (!gate.ok) return { ok: false, error: gate.error, httpStatus: gate.httpStatus };

  const id = params.tournamentId.trim();
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).delete();
  return { ok: true };
}

export async function assertClientCanManageTournamentFirestore(params: {
  actorUserId: string;
  actorRole: AuthRole;
  tournamentId: string;
}): Promise<
  { ok: true; tournament: Tournament } | { ok: false; error: string; httpStatus: 403 | 404 }
> {
  assertClientFirestorePersistenceConfigured();
  const tid = params.tournamentId.trim();
  if (!tid) return { ok: false, error: "잘못된 요청입니다.", httpStatus: 404 };
  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다.", httpStatus: 404 };
  if (params.actorRole === "PLATFORM") return { ok: true, tournament };
  if (tournament.createdBy !== params.actorUserId) {
    return { ok: false, error: "접근 권한이 없습니다.", httpStatus: 403 };
  }
  return { ok: true, tournament };
}
