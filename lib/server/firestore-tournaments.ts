import * as admin from "firebase-admin";
import { randomUUID } from "crypto";
import { AuthRole } from "../auth/roles";
import {
  CACHE_TAG_MAIN_SLIDE_SNAPSHOTS,
  CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST,
  cacheTagTournamentById,
} from "../cache-tags";
import { revalidateSiteDataTag } from "../revalidate-site-data-tag";
import { isEmptyOutlineHtml } from "../outline-content-helpers";
import type { OutlineDisplayMode } from "../outline-content-types";
import { assertClientFirestorePersistenceConfigured, listApprovedClientOrganizationsFirestore } from "./firestore-client-applications";
import { getSharedFirestoreDb } from "./firestore-users";
import type {
  ClientOrganizationStored,
  Tournament,
  TournamentRuleSnapshot,
  TournamentStatusBadge,
} from "./platform-backing-store";
import { isEntityLifecycleVisibleForList } from "./entity-lifecycle";
import {
  buildTournamentFromParsedRow,
  finalizeTournamentDates,
  normalizeTournament,
  normalizeTournamentRule,
  normalizeTournamentStatusBadge,
  parseTournamentEventDates,
  parseTournamentExtraVenues,
  resolveVenueGuideVenueIdFromOrgs,
  tournamentToClientDashboardPreview,
  type ClientDashboardTournamentPreviewRow,
  validateTournamentRuleForCreate,
} from "./platform-backing-store";

const COLLECTION = "v3_tournaments";

/** `buildTournamentFromParsedRow`가 읽는 필드만 — 문서에 다른 대용량 필드가 있어도 전송 제외 */
const TOURNAMENT_FIRESTORE_LEAN_BUILD_FIELDS = [
  "title",
  "date",
  "location",
  "maxParticipants",
  "entryFee",
  "createdBy",
  "createdAt",
  "rule",
  "posterImageUrl",
  "summary",
  "prizeInfo",
  "outlineDisplayMode",
  "outlineHtml",
  "outlineImageUrl",
  "outlinePdfUrl",
  "venueGuideVenueId",
  "statusBadge",
  "eventDates",
  "extraVenues",
  "devSeedSource",
  "status",
  "deletedAt",
  "deletedBy",
  "deleteReason",
  "gatheringTime",
  "reminderSentAt",
] as const;

/** 대회 원본·게시카드 변경 후 공개 목록·메인 슬라이드·해당 대회 캐시 무효화 */
export function revalidatePublicTournamentCache(tournamentId: string): void {
  const id = tournamentId.trim();
  if (!id) return;
  revalidateSiteDataTag(cacheTagTournamentById(id));
  revalidateSiteDataTag(CACHE_TAG_SITE_PUBLIC_TOURNAMENTS_LIST);
  revalidateSiteDataTag(CACHE_TAG_MAIN_SLIDE_SNAPSHOTS);
}

async function rebuildPublicTournamentListSnapshotsSafe(): Promise<void> {
  try {
    const { rebuildSitePublicTournamentListSnapshots } = await import("./site-public-list-snapshots-kv");
    await rebuildSitePublicTournamentListSnapshots();
  } catch (e) {
    console.warn("[firestore-tournaments] rebuild tournament list snapshots failed", e);
  }
}

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
  if (t.status === "ACTIVE" || t.status === "DELETED") base.status = t.status;
  if (typeof t.deletedAt === "string" && t.deletedAt.trim() !== "") base.deletedAt = t.deletedAt.trim();
  if (typeof t.deletedBy === "string" && t.deletedBy.trim() !== "") base.deletedBy = t.deletedBy.trim();
  if (typeof t.deleteReason === "string") base.deleteReason = t.deleteReason;
  if (typeof t.gatheringTime === "string" && t.gatheringTime.trim() !== "") base.gatheringTime = t.gatheringTime.trim();
  if (typeof t.reminderSentAt === "string" && t.reminderSentAt.trim() !== "") base.reminderSentAt = t.reminderSentAt.trim();
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

/** `/client/tournaments/[id]` — 안내·신청 링크용 필드만 `select` 후 정규화(문서 내 기타 필드 미전송) */
export async function getClientTournamentDetailPreviewByIdFirestore(tournamentId: string): Promise<Tournament | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const fsSelect = [...TOURNAMENT_FIRESTORE_LEAN_BUILD_FIELDS];
  const qSnap = await db
    .collection(COLLECTION)
    .where(admin.firestore.FieldPath.documentId(), "==", id)
    .limit(1)
    .select(...fsSelect)
    .get();
  if (qSnap.empty) return null;
  const doc = qSnap.docs[0]!;
  const data = doc.data() as Record<string, unknown> | undefined;
  const t = buildTournamentFromParsedRow({ id: doc.id, ...(data ?? {}) }, orgs);
  return normalizeTournament(t, undefined, orgs);
}

/** 대진표 API 권한 검증 전용 — `createdBy`·문서 존재·삭제 여부만 */
export async function getTournamentOwnerAccessPreviewByIdFirestore(tournamentId: string): Promise<{
  id: string;
  createdBy: string;
  status: "ACTIVE" | "DELETED";
} | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  const db = getSharedFirestoreDb();
  const qSnap = await db
    .collection(COLLECTION)
    .where(admin.firestore.FieldPath.documentId(), "==", id)
    .limit(1)
    .select("createdBy", "status")
    .get();
  if (qSnap.empty) return null;
  const doc = qSnap.docs[0]!;
  const data = doc.data() as Record<string, unknown> | undefined;
  const createdBy = typeof data?.createdBy === "string" ? data.createdBy : "";
  const st = data?.status;
  const status: "ACTIVE" | "DELETED" = st === "DELETED" ? "DELETED" : "ACTIVE";
  return { id: doc.id, createdBy, status };
}

/** 정산 장부 API 전용 — `title`·소유자·삭제 여부만 (전체 `normalizeTournament` 없음). */
export async function getTournamentSettlementAccessFieldsByIdFirestore(tournamentId: string): Promise<{
  id: string;
  title: string;
  createdBy: string;
  status: "ACTIVE" | "DELETED";
} | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  const db = getSharedFirestoreDb();
  const qSnap = await db
    .collection(COLLECTION)
    .where(admin.firestore.FieldPath.documentId(), "==", id)
    .limit(1)
    .select("title", "createdBy", "status")
    .get();
  if (qSnap.empty) return null;
  const doc = qSnap.docs[0]!;
  const data = doc.data() as Record<string, unknown> | undefined;
  const title = typeof data?.title === "string" ? data.title : "";
  const createdBy = typeof data?.createdBy === "string" ? data.createdBy : "";
  const st = data?.status;
  const status: "ACTIVE" | "DELETED" = st === "DELETED" ? "DELETED" : "ACTIVE";
  return { id: doc.id, title, createdBy, status };
}

/**
 * 메인 슬라이드 등: 대회 문서의 `date`·`location`만 배치 조회(정규화·venue 해석 없음).
 * `getTournamentByIdFirestore` 대비 라운드트립·CPU 부담을 줄인다.
 */
export async function getTournamentDateLocationFieldsByIdsFirestore(
  tournamentIds: string[],
): Promise<Map<string, { date: string; location: string }>> {
  assertClientFirestorePersistenceConfigured();
  const unique = [...new Set(tournamentIds.map((id) => String(id).trim()).filter(Boolean))];
  const out = new Map<string, { date: string; location: string }>();
  if (unique.length === 0) return out;
  const db = getSharedFirestoreDb();
  for (let i = 0; i < unique.length; i += 10) {
    const chunk = unique.slice(i, i + 10);
    const refs = chunk.map((id) => db.collection(COLLECTION).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) continue;
      const data = snap.data() as Record<string, unknown> | undefined;
      const date = typeof data?.date === "string" ? data.date : "";
      const location = typeof data?.location === "string" ? data.location : "";
      out.set(snap.id, { date, location });
    }
  }
  return out;
}

export async function setTournamentReminderSentAtFirestore(tournamentId: string): Promise<void> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  if (!tid) return;
  const db = getSharedFirestoreDb();
  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(tid).set({ reminderSentAt: now }, { merge: true });
  revalidatePublicTournamentCache(tid);
}

export async function listTournamentsByCreatorFirestore(userId: string): Promise<Tournament[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  let q;
  try {
    q = await db
      .collection(COLLECTION)
      .where("createdBy", "==", userId.trim())
      .orderBy("createdAt", "desc")
      .get();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    // Missing composite index(createdBy + createdAt) fallback: read by creator only and sort in memory.
    if (!message.includes("FAILED_PRECONDITION")) {
      throw error;
    }
    q = await db.collection(COLLECTION).where("createdBy", "==", userId.trim()).get();
  }
  const out: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    const n = await normalizeTournament(t, undefined, orgs);
    if (isEntityLifecycleVisibleForList(n.status)) out.push(n);
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

/** `/api/client/dashboard-summary` 전용: `normalizeTournament` 없이 id·미리보기 최소 필드만 */
export async function listClientDashboardTournamentRollupFirestore(userId: string): Promise<{
  visibleTournamentIds: string[];
  recentTournamentsForSummary: ClientDashboardTournamentPreviewRow[];
}> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const uid = userId.trim();
  const fsSelect = [...TOURNAMENT_FIRESTORE_LEAN_BUILD_FIELDS];
  let q;
  try {
    q = await db
      .collection(COLLECTION)
      .where("createdBy", "==", uid)
      .orderBy("createdAt", "desc")
      .select(...fsSelect)
      .get();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("FAILED_PRECONDITION")) {
      throw error;
    }
    q = await db.collection(COLLECTION).where("createdBy", "==", uid).select(...fsSelect).get();
  }
  const built: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    if (isEntityLifecycleVisibleForList(t.status)) built.push(t);
  }
  built.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const visibleTournamentIds = built.map((t) => t.id);
  const recentTournamentsForSummary =
    built.length === 0 ? [] : [tournamentToClientDashboardPreview(built[0]!)];
  return { visibleTournamentIds, recentTournamentsForSummary };
}

const DASHBOARD_TOURNAMENT_SCAN_LIMIT = 40;
const DASHBOARD_TOURNAMENT_FIRST_VISIBLE_FIELDS = [
  "createdAt",
  "status",
  "isDeleted",
] as const;

/**
 * 대시보드 요약 전용: 전체 대회 목록을 만들지 않고 최근 N건 중 첫 “표시 가능” 대회 1개만 탐색.
 */
export async function listClientDashboardTournamentFirstVisibleFirestore(userId: string): Promise<{
  hasAnyTournament: boolean;
  firstTournamentId: string;
}> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const uid = userId.trim();
  const fsSelect = [...DASHBOARD_TOURNAMENT_FIRST_VISIBLE_FIELDS];
  let q;
  try {
    q = await db
      .collection(COLLECTION)
      .where("createdBy", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(DASHBOARD_TOURNAMENT_SCAN_LIMIT)
      .select(...fsSelect)
      .get();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error ?? "");
    if (!message.includes("FAILED_PRECONDITION")) {
      throw error;
    }
    q = await db
      .collection(COLLECTION)
      .where("createdBy", "==", uid)
      .limit(DASHBOARD_TOURNAMENT_SCAN_LIMIT)
      .select(...fsSelect)
      .get();
  }
  const docs = q.docs.slice().sort((a, b) => {
    const ac = String(a.data()?.createdAt ?? "");
    const bc = String(b.data()?.createdAt ?? "");
    return bc.localeCompare(ac);
  });
  for (const doc of docs) {
    const raw = doc.data() as Record<string, unknown> | undefined;
    if (
      isEntityLifecycleVisibleForList(raw?.status, {
        legacyIsDeleted: raw?.isDeleted === true,
      })
    ) {
      return { hasAnyTournament: true, firstTournamentId: doc.id };
    }
  }
  return { hasAnyTournament: false, firstTournamentId: "" };
}

export async function listAllTournamentsFirestore(): Promise<Tournament[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const q = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  const out: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    const n = await normalizeTournament(t, undefined, orgs);
    if (isEntityLifecycleVisibleForList(n.status)) out.push(n);
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(id);
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
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(tid);
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
  const now = new Date().toISOString();
  await db.collection(COLLECTION).doc(id).set(
    {
      status: "DELETED",
      deletedAt: now,
      deletedBy: params.actorUserId.trim(),
      deleteReason: "",
    },
    { merge: true },
  );
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(id);
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

/** 소프트 삭제: 문서는 유지하고 status·삭제 메타만 기록한다. */
export async function softDeleteTournamentDocumentFirestore(params: {
  tournamentId: string;
  deletedBy: string;
  deleteReason?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const id = params.tournamentId.trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const now = new Date().toISOString();
  await ref.set(
    {
      status: "DELETED",
      deletedAt: now,
      deletedBy: params.deletedBy.trim(),
      deleteReason: typeof params.deleteReason === "string" ? params.deleteReason : "",
    },
    { merge: true },
  );
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(id);
  return { ok: true };
}

/** 백업함: 소프트 삭제된 대회만 */
export async function listDeletedTournamentsFirestore(): Promise<Tournament[]> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  const orgs = await loadResolutionOrgs();
  const q = await db.collection(COLLECTION).orderBy("createdAt", "desc").get();
  const out: Tournament[] = [];
  for (const doc of q.docs) {
    const t = buildTournamentFromParsedRow({ id: doc.id, ...doc.data() }, orgs);
    const n = await normalizeTournament(t, undefined, orgs);
    if (n.status === "DELETED") out.push(n);
  }
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return out;
}

export async function restoreTournamentDocumentFirestore(
  tournamentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const raw = snap.data() as Record<string, unknown> | undefined;
  if (raw?.status !== "DELETED") {
    return { ok: false, error: "백업함에 있는 삭제된 대회만 복구할 수 있습니다." };
  }
  const FV = admin.firestore.FieldValue;
  await ref.set(
    {
      status: "ACTIVE",
      deletedAt: FV.delete(),
      deletedBy: FV.delete(),
      deleteReason: FV.delete(),
    },
    { merge: true },
  );
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(id);
  return { ok: true };
}

/** 백업함에서만: 문서 물리 삭제 */
export async function permanentlyDeleteTournamentDocumentFirestore(
  tournamentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return { ok: false, error: "잘못된 요청입니다." };
  const db = getSharedFirestoreDb();
  const ref = db.collection(COLLECTION).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const raw = snap.data() as Record<string, unknown> | undefined;
  if (raw?.status !== "DELETED") {
    return { ok: false, error: "백업함에 있는 삭제된 대회만 완전 삭제할 수 있습니다." };
  }
  await ref.delete();
  await rebuildPublicTournamentListSnapshotsSafe();
  revalidatePublicTournamentCache(id);
  return { ok: true };
}
