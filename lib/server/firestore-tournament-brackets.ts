import { randomUUID } from "crypto";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { listApprovedParticipantsByTournamentIdFirestore } from "./firestore-tournament-applications";
import {
  getTournamentBracketPointerFieldsFirestore,
  getTournamentByIdFirestore,
  mergeTournamentActiveBracketPointerFirestore,
} from "./firestore-tournaments";
import { getSharedFirestoreDb } from "./firestore-users";
import type {
  Bracket,
  BracketDraftMatchInput,
  BracketMatch,
  BracketParticipantSnapshot,
  BracketPlayer,
  MutableBracket,
  MutableBracketMatch,
  MutableBracketRound,
} from "./platform-backing-store";
import {
  applyBracketDefaultsInPlace,
  deriveRoundStatus,
  normalizeBracket,
} from "./platform-backing-store";
import {
  collectAllPlayersFromBracket,
  findMutableMatchById,
  hasDownstreamRoundInSlice,
  normalizeRoundStatusesEverywhere,
  normalizeRoundStatusesInSlice,
  rebuildChainFromRoundInSlice,
  resolveRoundsForSliceKey,
  shuffleRoundSlotValuesInSlice,
  syncFinalBlockFromQualifiersInPlace,
  truncateRoundsAfterInSlice,
} from "./bracket-round-slices";

const SNAPSHOTS = "v3_tournament_participant_snapshots";
const BRACKETS = "v3_tournament_brackets";

const BRACKET_PROGRESS_BLOCKS_SPLIT_OR_SHUFFLE_KO =
  "이미 경기가 진행된 대진표는 조분할 또는 재생성을 할 수 없습니다.";

/** 클라이언트 `bracketHasAnyRecordedWinner` 와 동일: 실제 승자 기록이 있으면 조분할·1라운드 재생성 금지 */
function bracketHasRecordedWinnerForSplitShuffleGuard(b: {
  rounds: Bracket["rounds"];
  bracketMode?: Bracket["bracketMode"];
  blocks?: Bracket["blocks"];
  finalBlock?: Bracket["finalBlock"];
}): boolean {
  const scanMatches = (matches: BracketMatch[]) => {
    for (const m of matches) {
      const w = typeof m.winnerUserId === "string" ? m.winnerUserId.trim() : "";
      if (w !== "" && !w.startsWith("__")) return true;
    }
    return false;
  };
  const scanRounds = (rounds: Bracket["rounds"]) => {
    for (const r of rounds) {
      if (scanMatches(r.matches ?? [])) return true;
    }
    return false;
  };
  if (b.bracketMode === "multi_block") {
    for (const bl of b.blocks ?? []) {
      if (scanRounds(bl.rounds)) return true;
    }
    if (b.finalBlock?.rounds?.length && scanRounds(b.finalBlock.rounds)) return true;
    return false;
  }
  return scanRounds(b.rounds);
}

class BracketOpReject extends Error {}

function snapshotFromDoc(docId: string, data: Record<string, unknown> | undefined): BracketParticipantSnapshot | null {
  if (!data || typeof data !== "object") return null;
  const tournamentId = typeof data.tournamentId === "string" ? data.tournamentId : "";
  const createdAt = typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString();
  const parts = Array.isArray(data.participants) ? data.participants : [];
  const participants: BracketParticipantSnapshot["participants"] = [];
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    const o = p as Record<string, unknown>;
    const userId = typeof o.userId === "string" ? o.userId : "";
    const applicantName = typeof o.applicantName === "string" ? o.applicantName : "";
    const phone = typeof o.phone === "string" ? o.phone : "";
    if (!userId) continue;
    participants.push({ userId, applicantName, phone });
  }
  if (!tournamentId || participants.length === 0) return null;
  const zr = data.zoneId;
  const zoneId =
    typeof zr === "string" && zr.trim() !== ""
      ? zr.trim()
      : zr === null
        ? null
        : undefined;
  return {
    id: docId,
    tournamentId,
    participants,
    createdAt,
    ...(zoneId !== undefined ? { zoneId } : {}),
  };
}

function bracketFromDoc(docId: string, data: Record<string, unknown> | undefined): Bracket | null {
  if (!data || typeof data !== "object") return null;
  const zr = data.zoneId;
  const zoneId =
    typeof zr === "string" && zr.trim() !== ""
      ? zr.trim()
      : zr === null
        ? null
        : undefined;
  const raw: Bracket = {
    id: docId,
    tournamentId: typeof data.tournamentId === "string" ? data.tournamentId : "",
    snapshotId: typeof data.snapshotId === "string" ? data.snapshotId : "",
    rounds: (Array.isArray(data.rounds) ? data.rounds : []) as Bracket["rounds"],
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
    ...(zoneId !== undefined ? { zoneId } : {}),
    ...(data.bracketMode === "multi_block" ? { bracketMode: "multi_block" as const } : {}),
    ...(Array.isArray(data.blocks) ? { blocks: data.blocks as Bracket["blocks"] } : {}),
    ...(data.finalBlock && typeof data.finalBlock === "object"
      ? { finalBlock: data.finalBlock as Bracket["finalBlock"] }
      : {}),
    ...(data.finalBlockSlotManual && typeof data.finalBlockSlotManual === "object"
      ? { finalBlockSlotManual: data.finalBlockSlotManual as Bracket["finalBlockSlotManual"] }
      : {}),
    ...(data.blockSplit && typeof data.blockSplit === "object"
      ? { blockSplit: data.blockSplit as Bracket["blockSplit"] }
      : {}),
  };
  return normalizeBracket(raw);
}

/** 확정 대진표 문서의 `createdAt`을 최종 생성·재생성 시각으로 덮어쓴다(히스토리 필드 없음). */
async function bumpBracketCreatedAtOnDocumentFirestore(bracket: Bracket): Promise<Bracket> {
  const now = new Date().toISOString();
  const db = getSharedFirestoreDb();
  await db.collection(BRACKETS).doc(bracket.id.trim()).update({ createdAt: now });
  return normalizeBracket({ ...bracket, createdAt: now });
}

function bracketToPlain(b: Bracket): Record<string, unknown> {
  const plain: Record<string, unknown> = {
    id: b.id,
    tournamentId: b.tournamentId,
    snapshotId: b.snapshotId,
    rounds: b.rounds,
    createdAt: b.createdAt,
  };
  if (typeof b.zoneId === "string" && b.zoneId.trim() !== "") plain.zoneId = b.zoneId.trim();
  else if (b.zoneId === null) plain.zoneId = null;
  if (b.bracketMode === "multi_block") plain.bracketMode = "multi_block";
  if (Array.isArray(b.blocks)) plain.blocks = b.blocks;
  if (b.finalBlock) plain.finalBlock = b.finalBlock;
  if (b.finalBlockSlotManual && Object.keys(b.finalBlockSlotManual).length > 0) {
    plain.finalBlockSlotManual = b.finalBlockSlotManual;
  }
  if (b.blockSplit) plain.blockSplit = b.blockSplit;
  return plain;
}

export async function getBracketParticipantSnapshotByIdFirestore(
  snapshotId: string
): Promise<BracketParticipantSnapshot | null> {
  assertClientFirestorePersistenceConfigured();
  const sid = snapshotId.trim();
  if (!sid) return null;
  const db = getSharedFirestoreDb();
  const snap = await db.collection(SNAPSHOTS).doc(sid).get();
  if (!snap.exists) return null;
  return snapshotFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

export async function listBracketParticipantSnapshotsByTournamentIdFirestore(
  tournamentId: string
): Promise<BracketParticipantSnapshot[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(SNAPSHOTS)
    .where("tournamentId", "==", id)
    .orderBy("createdAt", "desc")
    .get();
  const out: BracketParticipantSnapshot[] = [];
  for (const doc of q.docs) {
    const s = snapshotFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (s) out.push(s);
  }
  return out;
}

export const UNASSIGNED_ZONE_BRACKET_ERROR =
  "모든 참가자를 권역에 배정해야 대진표를 생성할 수 있습니다.";

async function assertAllApprovedParticipantsHaveZoneIdFirestore(
  tournamentId: string,
  tournament: { zonesEnabled?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (tournament.zonesEnabled !== true) return { ok: true };
  const approved = await listApprovedParticipantsByTournamentIdFirestore(tournamentId);
  for (const a of approved) {
    const z = typeof a.zoneId === "string" ? a.zoneId.trim() : "";
    if (!z) return { ok: false, error: UNASSIGNED_ZONE_BRACKET_ERROR };
  }
  return { ok: true };
}

export type BracketParticipantSnapshotScope = "legacy" | { zoneId: string };

export async function getLatestBracketParticipantSnapshotByTournamentIdFirestore(
  tournamentId: string,
  scope?: BracketParticipantSnapshotScope
): Promise<BracketParticipantSnapshot | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  if (scope === undefined) {
    const db = getSharedFirestoreDb();
    const q = await db
      .collection(SNAPSHOTS)
      .where("tournamentId", "==", id)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    if (q.empty) return null;
    const doc = q.docs[0]!;
    return snapshotFromDoc(doc.id, doc.data() as Record<string, unknown>);
  }
  const list = await listBracketParticipantSnapshotsByTournamentIdFirestore(id);
  for (const s of list) {
    const z = typeof s.zoneId === "string" ? s.zoneId.trim() : "";
    if (scope === "legacy") {
      if (!z) return s;
    } else if (z === scope.zoneId.trim()) {
      return s;
    }
  }
  return null;
}

export async function createBracketParticipantSnapshotFirestore(params: {
  tournamentId: string;
  zoneId?: string | null;
}): Promise<{ ok: true; snapshot: BracketParticipantSnapshot } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  if (tournament.zonesEnabled === true) {
    const gate = await assertAllApprovedParticipantsHaveZoneIdFirestore(params.tournamentId, tournament);
    if (!gate.ok) return gate;
    const zid = typeof params.zoneId === "string" ? params.zoneId.trim() : "";
    if (!zid) {
      return { ok: false, error: "권역을 선택해 주세요." };
    }
  }

  let approvedParticipants = await listApprovedParticipantsByTournamentIdFirestore(params.tournamentId);
  if (tournament.zonesEnabled === true) {
    const zid = String(params.zoneId ?? "").trim();
    approvedParticipants = approvedParticipants.filter((item) => {
      const z = typeof item.zoneId === "string" ? item.zoneId.trim() : "";
      return z === zid;
    });
  }

  if (approvedParticipants.length === 0) {
    return { ok: false, error: "APPROVED 참가자가 없어 스냅샷을 생성할 수 없습니다." };
  }

  const snapshot: BracketParticipantSnapshot = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    participants: approvedParticipants.map((item) => ({
      userId: item.userId,
      applicantName: item.applicantName,
      phone: item.phone,
    })),
    createdAt: new Date().toISOString(),
    ...(tournament.zonesEnabled === true && typeof params.zoneId === "string" && params.zoneId.trim() !== ""
      ? { zoneId: params.zoneId.trim() }
      : {}),
  };

  const db = getSharedFirestoreDb();
  const plain: Record<string, unknown> = {
    id: snapshot.id,
    tournamentId: snapshot.tournamentId,
    participants: snapshot.participants,
    createdAt: snapshot.createdAt,
  };
  if (typeof snapshot.zoneId === "string" && snapshot.zoneId.trim() !== "") {
    plain.zoneId = snapshot.zoneId.trim();
  } else if (snapshot.zoneId === null) {
    plain.zoneId = null;
  }
  await db.collection(SNAPSHOTS).doc(snapshot.id).set(plain);
  return { ok: true, snapshot };
}

export async function listBracketsByTournamentIdFirestore(tournamentId: string): Promise<Bracket[]> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return [];
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(BRACKETS)
    .where("tournamentId", "==", id)
    .orderBy("createdAt", "desc")
    .get();
  const out: Bracket[] = [];
  for (const doc of q.docs) {
    const b = bracketFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (b) out.push(b);
  }
  return out;
}

export async function getBracketByIdFirestore(bracketId: string): Promise<Bracket | null> {
  assertClientFirestorePersistenceConfigured();
  const bid = bracketId.trim();
  if (!bid) return null;
  const db = getSharedFirestoreDb();
  const snap = await db.collection(BRACKETS).doc(bid).get();
  if (!snap.exists) return null;
  return bracketFromDoc(snap.id, snap.data() as Record<string, unknown>);
}

function bracketBelongsToScope(
  b: Bracket,
  tournamentId: string,
  zoneScope: string | null,
  zonesEnabled: boolean,
): boolean {
  if (b.tournamentId.trim() !== tournamentId.trim()) return false;
  if (!zonesEnabled) return true;
  const bz = typeof b.zoneId === "string" ? b.zoneId.trim() : "";
  if (zoneScope) return bz === zoneScope;
  return bz === "";
}

/**
 * 대회 문서의 활성 브래킷 포인터(ID)를 우선하고, 없거나 깨졌을 때만 createdAt 최신 문서로 후보를 고른 뒤 포인터를 보정한다.
 * zonesEnabled이고 zoneScope가 없으면(TV 등) 후보만 고르고 포인터는 자동 보정하지 않는다.
 */
export async function resolveActiveBracketDocumentFirestore(
  tournamentId: string,
  zoneScope: string | null,
): Promise<Bracket | null> {
  const tid = tournamentId.trim();
  if (!tid) return null;

  const pointers = await getTournamentBracketPointerFieldsFirestore(tid);
  const zonesEnabled = pointers?.zonesEnabled === true;

  let pointerId: string | null = null;
  if (pointers) {
    if (zonesEnabled && zoneScope) {
      pointerId = pointers.activeBracketByZoneId?.[zoneScope] ?? null;
    } else if (!zonesEnabled) {
      pointerId = pointers.activeBracketId ?? null;
    } else {
      pointerId = pointers.activeBracketId ?? null;
    }
  }

  if (pointerId) {
    const b = await getBracketByIdFirestore(pointerId);
    if (b && bracketBelongsToScope(b, tid, zoneScope, zonesEnabled)) {
      return b;
    }
  }

  const list = await listBracketsByTournamentIdFirestore(tid);
  let picked: Bracket | null = null;
  if (zonesEnabled && zoneScope) {
    for (const br of list) {
      const bz = typeof br.zoneId === "string" ? br.zoneId.trim() : "";
      if (bz === zoneScope) {
        picked = br;
        break;
      }
    }
  } else {
    picked = list[0] ?? null;
  }

  if (picked) {
    if (!zonesEnabled) {
      await mergeTournamentActiveBracketPointerFirestore({
        tournamentId: tid,
        bracketId: picked.id,
        zonesEnabled: false,
      });
    } else if (zoneScope) {
      await mergeTournamentActiveBracketPointerFirestore({
        tournamentId: tid,
        bracketId: picked.id,
        zonesEnabled: true,
        zoneId: zoneScope,
      });
    }
  }

  return picked;
}

export async function getLatestBracketByTournamentIdFirestore(tournamentId: string): Promise<Bracket | null> {
  return resolveActiveBracketDocumentFirestore(tournamentId.trim(), null);
}

export async function getLatestBracketByTournamentIdAndZoneIdFirestore(
  tournamentId: string,
  zoneId: string,
): Promise<Bracket | null> {
  const zid = zoneId.trim();
  if (!tournamentId.trim() || !zid) return null;
  return resolveActiveBracketDocumentFirestore(tournamentId.trim(), zid);
}

export async function createBracketFromSnapshotFirestore(
  snapshotId: string
): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const snapshot = await getBracketParticipantSnapshotByIdFirestore(snapshotId);
  if (!snapshot) {
    return { ok: false, error: "대상자 스냅샷을 찾을 수 없습니다." };
  }

  const tournament = await getTournamentByIdFirestore(snapshot.tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  const zoneScopeSnap =
    tournament.zonesEnabled === true && typeof snapshot.zoneId === "string" && snapshot.zoneId.trim() !== ""
      ? snapshot.zoneId.trim()
      : null;
  const existingSnap = await resolveActiveBracketDocumentFirestore(snapshot.tournamentId, zoneScopeSnap);
  if (
    existingSnap &&
    bracketBelongsToScope(existingSnap, snapshot.tournamentId, zoneScopeSnap, tournament.zonesEnabled === true)
  ) {
    const bracket = await bumpBracketCreatedAtOnDocumentFirestore(existingSnap);
    return { ok: true, bracket };
  }

  const pairCount = Math.floor(snapshot.participants.length / 2);
  if (pairCount === 0) {
    return { ok: false, error: "대진표 생성을 위해 최소 2명의 참가자가 필요합니다." };
  }

  const matches: BracketMatch[] = [];
  for (let i = 0; i < pairCount * 2; i += 2) {
    const p1 = snapshot.participants[i]!;
    const p2 = snapshot.participants[i + 1]!;
    matches.push({
      id: randomUUID(),
      player1: { userId: p1.userId, name: p1.applicantName },
      player2: { userId: p2.userId, name: p2.applicantName },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }

  const bracket: Bracket = {
    id: randomUUID(),
    tournamentId: snapshot.tournamentId,
    snapshotId: snapshot.id,
    rounds: [
      {
        roundNumber: 1,
        matches,
        status: "PENDING",
      },
    ],
    createdAt: new Date().toISOString(),
    ...(typeof snapshot.zoneId === "string" && snapshot.zoneId.trim() !== ""
      ? { zoneId: snapshot.zoneId.trim() }
      : {}),
  };

  const db = getSharedFirestoreDb();
  await db.collection(BRACKETS).doc(bracket.id).set(bracketToPlain(normalizeBracket(bracket)));
  const normalizedSnap = normalizeBracket(bracket);
  await mergeTournamentActiveBracketPointerFirestore({
    tournamentId: snapshot.tournamentId,
    bracketId: normalizedSnap.id,
    zonesEnabled: tournament.zonesEnabled === true,
    zoneId: zoneScopeSnap ?? undefined,
  });
  return { ok: true, bracket: normalizedSnap };
}

export async function createBracketFromDraftFirestore(params: {
  tournamentId: string;
  snapshotId: string;
  matches: BracketDraftMatchInput[];
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }
  if (tournament.zonesEnabled === true) {
    const gate = await assertAllApprovedParticipantsHaveZoneIdFirestore(params.tournamentId, tournament);
    if (!gate.ok) return gate;
  }

  const snapshot = await getBracketParticipantSnapshotByIdFirestore(params.snapshotId.trim());
  if (!snapshot || snapshot.tournamentId !== params.tournamentId) {
    return { ok: false, error: "유효한 대진표 대상자 스냅샷을 찾을 수 없습니다." };
  }
  if (!Array.isArray(params.matches) || params.matches.length === 0) {
    return { ok: false, error: "확정 저장할 매치가 없습니다." };
  }

  const zoneScopeDraft =
    tournament.zonesEnabled === true && typeof snapshot.zoneId === "string" && snapshot.zoneId.trim() !== ""
      ? snapshot.zoneId.trim()
      : null;
  const existingDraft = await resolveActiveBracketDocumentFirestore(params.tournamentId, zoneScopeDraft);
  if (
    existingDraft &&
    bracketBelongsToScope(existingDraft, params.tournamentId, zoneScopeDraft, tournament.zonesEnabled === true)
  ) {
    const bracket = await bumpBracketCreatedAtOnDocumentFirestore(existingDraft);
    return { ok: true, bracket };
  }

  const snapshotParticipants = new Map(snapshot.participants.map((participant) => [participant.userId, participant]));
  const assignedUserIds = new Set<string>();
  const normalizedMatches: BracketMatch[] = [];

  for (const draftMatch of params.matches) {
    const p1Id = draftMatch.player1?.userId?.trim() ?? "";
    const p2Id = draftMatch.player2?.userId?.trim() ?? "";
    if (!p1Id || !p2Id || p1Id === p2Id) {
      return { ok: false, error: "매치 참가자 정보가 올바르지 않습니다." };
    }
    if (assignedUserIds.has(p1Id) || assignedUserIds.has(p2Id)) {
      return { ok: false, error: "같은 참가자가 중복 배정되었습니다." };
    }

    const p1Snapshot = snapshotParticipants.get(p1Id);
    const p2Snapshot = snapshotParticipants.get(p2Id);
    if (!p1Snapshot || !p2Snapshot) {
      return { ok: false, error: "스냅샷에 없는 참가자가 포함되어 있습니다." };
    }

    assignedUserIds.add(p1Id);
    assignedUserIds.add(p2Id);
    normalizedMatches.push({
      id: randomUUID(),
      player1: { userId: p1Snapshot.userId, name: p1Snapshot.applicantName },
      player2: { userId: p2Snapshot.userId, name: p2Snapshot.applicantName },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }

  const bracket: Bracket = {
    id: randomUUID(),
    tournamentId: params.tournamentId,
    snapshotId: snapshot.id,
    rounds: [
      {
        roundNumber: 1,
        matches: normalizedMatches,
        status: "PENDING",
      },
    ],
    createdAt: new Date().toISOString(),
    ...(typeof snapshot.zoneId === "string" && snapshot.zoneId.trim() !== ""
      ? { zoneId: snapshot.zoneId.trim() }
      : {}),
  };

  const db = getSharedFirestoreDb();
  await db.collection(BRACKETS).doc(bracket.id).set(bracketToPlain(normalizeBracket(bracket)));
  const normalizedDraft = normalizeBracket(bracket);
  await mergeTournamentActiveBracketPointerFirestore({
    tournamentId: params.tournamentId,
    bracketId: normalizedDraft.id,
    zonesEnabled: tournament.zonesEnabled === true,
    zoneId: zoneScopeDraft ?? undefined,
  });
  return { ok: true, bracket: normalizedDraft };
}

async function resolveLatestBracketForMutationFirestore(params: {
  tournamentId: string;
  tournament: { zonesEnabled?: boolean };
  bracketZoneId?: string | null;
}): Promise<Bracket | null> {
  const tid = params.tournamentId.trim();
  if (params.tournament.zonesEnabled === true) {
    const qz = typeof params.bracketZoneId === "string" ? params.bracketZoneId.trim() : "";
    if (!qz) {
      return null;
    }
    return getLatestBracketByTournamentIdAndZoneIdFirestore(tid, qz);
  }
  return getLatestBracketByTournamentIdFirestore(tid);
}

export async function updateBracketMatchResultFirestore(params: {
  tournamentId: string;
  matchId: string;
  winnerUserId: string | null;
  actorUserId?: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  if (!tournamentId || !matchId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const normalizedWinnerUserId = params.winnerUserId === null ? null : params.winnerUserId.trim();
  if (normalizedWinnerUserId !== null && !normalizedWinnerUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const docSnap = await tx.get(ref);
      if (!docSnap.exists) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }
      const latestBracket = bracketFromDoc(docSnap.id, docSnap.data() as Record<string, unknown>) as MutableBracket;
      if (!latestBracket) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }

      applyBracketDefaultsInPlace(latestBracket);

      const found = findMutableMatchById(latestBracket, matchId);
      if (!found) {
        throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      }
      const { rounds: sliceRounds, round: targetRound, match: targetMatch } = found;
      if (sliceRounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
        throw new BracketOpReject("다음 라운드가 이미 생성되어 있어 수정할 수 없습니다.");
      }

      if (normalizedWinnerUserId === null) {
        if (targetMatch.status === "PENDING" && !targetMatch.winnerUserId) {
          throw new BracketOpReject("이미 처리된 상태입니다.");
        }
        targetMatch.winnerUserId = null;
        targetMatch.winnerName = null;
        targetMatch.status = "PENDING";
      } else {
        const winner =
          targetMatch.player1.userId === normalizedWinnerUserId
            ? targetMatch.player1
            : targetMatch.player2.userId === normalizedWinnerUserId
              ? targetMatch.player2
              : null;
        if (!winner) {
          throw new BracketOpReject("승자는 player1 또는 player2 중 하나여야 합니다.");
        }
        if (targetMatch.status === "COMPLETED" && targetMatch.winnerUserId === winner.userId) {
          throw new BracketOpReject("이미 처리된 상태입니다.");
        }

        targetMatch.winnerUserId = winner.userId;
        targetMatch.winnerName = winner.name;
        targetMatch.status = "COMPLETED";
      }

      targetRound.status = deriveRoundStatus(targetRound.matches);
      normalizeRoundStatusesEverywhere(latestBracket);
      syncFinalBlockFromQualifiersInPlace(latestBracket);

      const normalized = normalizeBracket(latestBracket as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function replaceBracketMatchPlayerFirestore(params: {
  tournamentId: string;
  matchId: string;
  slot: "player1" | "player2";
  replacementUserId: string;
  actorUserId?: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  const replacementUserId = params.replacementUserId.trim();
  if (!tournamentId || !matchId || !replacementUserId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (params.slot !== "player1" && params.slot !== "player2") {
    return { ok: false, error: "잘못된 요청입니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
  }

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const docSnap = await tx.get(ref);
      if (!docSnap.exists) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }
      const latestBracket = bracketFromDoc(docSnap.id, docSnap.data() as Record<string, unknown>) as MutableBracket;
      if (!latestBracket) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }

      applyBracketDefaultsInPlace(latestBracket);

      const found = findMutableMatchById(latestBracket, matchId);
      if (!found) {
        throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      }
      const { rounds: sliceRounds, round: targetRound, match: targetMatch } = found;
      if (sliceRounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
        throw new BracketOpReject("다음 라운드가 이미 생성되어 참가자를 교체할 수 없습니다.");
      }

      const playerMap = collectAllPlayersFromBracket(latestBracket);
      const replacement = playerMap.get(replacementUserId);
      if (!replacement) {
        throw new BracketOpReject("같은 대진표 참가자만 교체할 수 있습니다.");
      }

      const currentPlayerUserId = params.slot === "player1" ? targetMatch.player1.userId : targetMatch.player2.userId;
      if (replacement.userId === currentPlayerUserId) {
        throw new BracketOpReject("이미 처리된 상태입니다.");
      }

      const oppositeUserId = params.slot === "player1" ? targetMatch.player2.userId : targetMatch.player1.userId;
      if (replacement.userId === oppositeUserId) {
        throw new BracketOpReject("동일 매치 내 중복 참가자는 허용되지 않습니다.");
      }

      if (params.slot === "player1") {
        targetMatch.player1 = replacement;
      } else {
        targetMatch.player2 = replacement;
      }

      targetMatch.winnerUserId = null;
      targetMatch.winnerName = null;
      targetMatch.status = "PENDING";
      normalizeRoundStatusesEverywhere(latestBracket);
      syncFinalBlockFromQualifiersInPlace(latestBracket);

      const normalized = normalizeBracket(latestBracket as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

export async function advanceBracketRoundFirestore(
  bracketId: string,
  roundNumber: number,
  sliceKey?: string,
): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(bracketId.trim());
      const doc = await tx.get(ref);
      if (!doc.exists) {
        throw new BracketOpReject("대진표를 찾을 수 없습니다.");
      }
      const bracketMut = bracketFromDoc(doc.id, doc.data() as Record<string, unknown>) as MutableBracket;
      if (!bracketMut) {
        throw new BracketOpReject("대진표를 찾을 수 없습니다.");
      }

      applyBracketDefaultsInPlace(bracketMut);

      const rounds = resolveRoundsForSliceKey(bracketMut, sliceKey);
      if (!rounds) {
        throw new BracketOpReject(
          bracketMut.bracketMode === "multi_block"
            ? "분할 대진표에서는 sliceKey(예: block:조ID 또는 final)가 필요합니다."
            : "대상 라운드 트리를 찾을 수 없습니다.",
        );
      }

      const currentRound = rounds.find((round) => round.roundNumber === roundNumber);
      if (!currentRound) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      if (currentRound.status !== "COMPLETED") {
        throw new BracketOpReject("현재 라운드가 아직 완료되지 않았습니다.");
      }
      if (rounds.some((round) => round.roundNumber === roundNumber + 1)) {
        throw new BracketOpReject("다음 라운드가 이미 생성되어 있습니다.");
      }

      const winners = currentRound.matches
        .map((match) =>
          match.status === "COMPLETED" && match.winnerUserId && match.winnerName
            ? { userId: match.winnerUserId, name: match.winnerName }
            : null
        )
        .filter((item): item is BracketPlayer => item !== null);

      const pairCount = Math.floor(winners.length / 2);
      if (pairCount === 0) {
        throw new BracketOpReject("다음 라운드를 만들 승자 페어가 부족합니다.");
      }

      const nextMatches: MutableBracketMatch[] = [];
      for (let i = 0; i < pairCount * 2; i += 2) {
        const p1 = winners[i]!;
        const p2 = winners[i + 1]!;
        nextMatches.push({
          id: randomUUID(),
          player1: p1,
          player2: p2,
          winnerUserId: null,
          winnerName: null,
          status: "PENDING",
        });
      }

      rounds.push({
        roundNumber: roundNumber + 1,
        matches: nextMatches,
        status: "PENDING",
      });
      normalizeRoundStatusesEverywhere(bracketMut);
      syncFinalBlockFromQualifiersInPlace(bracketMut);

      const normalized = normalizeBracket(bracketMut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) {
      return { ok: false, error: e.message };
    }
    throw e;
  }
}

function matchWinnerPlayerOrNull(match: MutableBracketMatch): BracketPlayer | null {
  if (match.status !== "COMPLETED") return null;
  const wid = typeof match.winnerUserId === "string" ? match.winnerUserId.trim() : "";
  const wnm = typeof match.winnerName === "string" ? match.winnerName.trim() : "";
  if (!wid || !wnm) return null;
  return { userId: wid, name: wnm };
}

function tbdPlayer(nextRoundNumber: number, pairIndex: number, slot: "player1" | "player2"): BracketPlayer {
  return {
    userId: `__TBD__:${nextRoundNumber}:${pairIndex}:${slot}`,
    name: "TBD",
  };
}

function buildNextRoundMatchesFromRound(params: {
  currentRound: MutableBracketRound;
  nextRoundNumber: number;
  allowPartial: boolean;
}): MutableBracketMatch[] {
  const { currentRound, nextRoundNumber, allowPartial } = params;
  const pairCount = Math.floor(currentRound.matches.length / 2);
  const nextMatches: MutableBracketMatch[] = [];
  for (let i = 0; i < pairCount; i += 1) {
    const m1 = currentRound.matches[i * 2]!;
    const m2 = currentRound.matches[i * 2 + 1]!;
    const w1 = matchWinnerPlayerOrNull(m1);
    const w2 = matchWinnerPlayerOrNull(m2);
    if (!allowPartial && (!w1 || !w2)) {
      throw new BracketOpReject("해당 라운드에 승자가 확정되지 않은 매치가 있어 재생성할 수 없습니다.");
    }
    nextMatches.push({
      id: randomUUID(),
      player1: w1 ?? tbdPlayer(nextRoundNumber, i, "player1"),
      player2: w2 ?? tbdPlayer(nextRoundNumber, i, "player2"),
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }
  return nextMatches;
}

function normalizeRoundStatusesInPlace(bracket: MutableBracket): void {
  normalizeRoundStatusesEverywhere(bracket);
}

export async function resetBracketRoundsAfterFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  bracketZoneId?: string | null;
  sliceKey?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const roundNumber = Math.floor(Number(params.roundNumber));
  if (!tournamentId || !Number.isFinite(roundNumber) || roundNumber <= 0) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      const rounds = resolveRoundsForSliceKey(mut, params.sliceKey);
      if (!rounds) {
        throw new BracketOpReject(
          mut.bracketMode === "multi_block"
            ? "분할 대진표에서는 sliceKey가 필요합니다."
            : "대상 라운드 트리를 찾을 수 없습니다.",
        );
      }
      if (!rounds.some((r) => r.roundNumber === roundNumber)) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      truncateRoundsAfterInSlice(rounds, roundNumber);
      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

export async function rebuildBracketRoundFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  allowPartial?: boolean;
  bracketZoneId?: string | null;
  sliceKey?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const roundNumber = Math.floor(Number(params.roundNumber));
  if (!tournamentId || !Number.isFinite(roundNumber) || roundNumber <= 0) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }
  const allowPartial = params.allowPartial === true;
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      const rounds = resolveRoundsForSliceKey(mut, params.sliceKey);
      if (!rounds) {
        throw new BracketOpReject(
          mut.bracketMode === "multi_block"
            ? "분할 대진표에서는 sliceKey가 필요합니다."
            : "대상 라운드 트리를 찾을 수 없습니다.",
        );
      }
      const currentRound = rounds.find((r) => r.roundNumber === roundNumber);
      if (!currentRound) throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      if (!allowPartial && currentRound.status !== "COMPLETED") {
        throw new BracketOpReject("현재 라운드가 완료되지 않아 재생성할 수 없습니다.");
      }
      truncateRoundsAfterInSlice(rounds, roundNumber);
      const nextRoundNumber = roundNumber + 1;
      const nextMatches = buildNextRoundMatchesFromRound({
        currentRound,
        nextRoundNumber,
        allowPartial,
      });
      if (nextMatches.length === 0) {
        throw new BracketOpReject("다음 라운드를 만들 매치가 부족합니다.");
      }
      rounds.push({
        roundNumber: nextRoundNumber,
        matches: nextMatches,
        status: "PENDING",
      });
      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

function rebuildChainFromRoundInPlace(params: {
  bracket: MutableBracket;
  startRoundNumber: number;
  allowPartial: boolean;
}): void {
  const { bracket, startRoundNumber, allowPartial } = params;
  rebuildChainFromRoundInSlice({
    rounds: bracket.rounds,
    startRoundNumber,
    allowPartial,
  });
  normalizeRoundStatusesEverywhere(bracket);
}

export async function rebuildBracketFromRoundFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  allowPartial?: boolean;
  bracketZoneId?: string | null;
  sliceKey?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const roundNumber = Math.floor(Number(params.roundNumber));
  if (!tournamentId || !Number.isFinite(roundNumber) || roundNumber <= 0) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }
  const allowPartial = params.allowPartial === true;
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      const rounds = resolveRoundsForSliceKey(mut, params.sliceKey);
      if (!rounds) {
        throw new BracketOpReject(
          mut.bracketMode === "multi_block"
            ? "분할 대진표에서는 sliceKey가 필요합니다."
            : "대상 라운드 트리를 찾을 수 없습니다.",
        );
      }
      const startRound = rounds.find((r) => r.roundNumber === roundNumber);
      if (!startRound) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      if (!allowPartial && startRound.status !== "COMPLETED") {
        throw new BracketOpReject("시작 라운드가 완료되지 않아 전체 재생성이 불가능합니다.");
      }
      rebuildChainFromRoundInSlice({ rounds, startRoundNumber: roundNumber, allowPartial });
      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

type ReassignOperation =
  | { type: "swap_within_match"; matchId: string }
  | { type: "swap_between_matches"; matchAId: string; slotA: "player1" | "player2"; matchBId: string; slotB: "player1" | "player2" };

export async function reassignBracketMatchesFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  operations: ReassignOperation[];
  autoRebuildAfter?: boolean;
  allowPartialRebuild?: boolean;
  bracketZoneId?: string | null;
  /** 분할 대진표에서 라운드 트리 지정(미입력 시 매치 id로 자동 추론) */
  sliceKey?: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const roundNumber = Math.floor(Number(params.roundNumber));
  if (!tournamentId || !Number.isFinite(roundNumber) || roundNumber <= 0) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (!Array.isArray(params.operations) || params.operations.length === 0) {
    return { ok: false, error: "재배치 작업이 없습니다." };
  }
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }
  const autoRebuildAfter = params.autoRebuildAfter !== false;
  const allowPartialRebuild = params.allowPartialRebuild !== false;
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);

      let sliceRounds = resolveRoundsForSliceKey(mut, params.sliceKey);
      if (!sliceRounds && params.sliceKey === undefined && mut.bracketMode === "multi_block") {
        const firstOp = params.operations[0];
        const probeId =
          firstOp?.type === "swap_within_match"
            ? firstOp.matchId.trim()
            : firstOp?.type === "swap_between_matches"
              ? firstOp.matchAId.trim()
              : "";
        const loc = probeId ? findMutableMatchById(mut, probeId) : null;
        sliceRounds = loc?.rounds ?? null;
      }
      if (!sliceRounds) {
        throw new BracketOpReject(
          mut.bracketMode === "multi_block"
            ? "분할 대진표에서는 대상 블록을 특정할 수 없습니다. sliceKey 또는 유효한 matchId가 필요합니다."
            : "대상 라운드를 찾을 수 없습니다.",
        );
      }

      const round = sliceRounds.find((r) => r.roundNumber === roundNumber);
      if (!round) throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      const matchMap = new Map<string, MutableBracketMatch>();
      for (const m of round.matches) matchMap.set(m.id, m);

      for (const op of params.operations) {
        if (op.type === "swap_within_match") {
          const m = matchMap.get(op.matchId.trim());
          if (!m) throw new BracketOpReject("재배치 대상 매치를 찾을 수 없습니다.");
          const p1 = m.player1;
          m.player1 = m.player2;
          m.player2 = p1;
          m.winnerUserId = null;
          m.winnerName = null;
          m.status = "PENDING";
          continue;
        }
        if (op.type === "swap_between_matches") {
          const a = matchMap.get(op.matchAId.trim());
          const b = matchMap.get(op.matchBId.trim());
          if (!a || !b) throw new BracketOpReject("재배치 대상 매치를 찾을 수 없습니다.");
          const pa = op.slotA === "player1" ? a.player1 : a.player2;
          const pb = op.slotB === "player1" ? b.player1 : b.player2;
          if (op.slotA === "player1") a.player1 = pb; else a.player2 = pb;
          if (op.slotB === "player1") b.player1 = pa; else b.player2 = pa;
          a.winnerUserId = null;
          a.winnerName = null;
          a.status = "PENDING";
          b.winnerUserId = null;
          b.winnerName = null;
          b.status = "PENDING";
          continue;
        }
      }

      normalizeRoundStatusesEverywhere(mut);
      const hasDownstream = hasDownstreamRoundInSlice(sliceRounds, roundNumber);
      if (hasDownstream) {
        if (!autoRebuildAfter) {
          throw new BracketOpReject("이후 라운드가 있어 재배치할 수 없습니다. reset-after/rebuild를 먼저 실행해 주세요.");
        }
        rebuildChainFromRoundInSlice({
          rounds: sliceRounds,
          startRoundNumber: roundNumber,
          allowPartial: allowPartialRebuild,
        });
        normalizeRoundStatusesEverywhere(mut);
      }
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

export async function updateBracketMatchPlayerNameFirestore(params: {
  tournamentId: string;
  matchId: string;
  slot: "player1" | "player2";
  /** 빈 문자열이면 표시 오버레이 제거(원래 이름으로 복귀) */
  displayName: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  const displayName = params.displayName.trim();
  if (!tournamentId || !matchId) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  if (params.slot !== "player1" && params.slot !== "player2") {
    return { ok: false, error: "잘못된 슬롯입니다." };
  }
  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };
  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }
  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      const found = findMutableMatchById(mut, matchId);
      const target = found?.match ?? null;
      if (!target) throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      const player = params.slot === "player1" ? target.player1 : target.player2;
      if (!displayName) {
        delete (player as { displayName?: string }).displayName;
      } else {
        player.displayName = displayName;
      }
      const labelAfter =
        typeof player.displayName === "string" && player.displayName.trim() !== ""
          ? player.displayName.trim()
          : player.name;
      if (typeof target.winnerUserId === "string" && target.winnerUserId === player.userId) {
        target.winnerName = labelAfter;
      }
      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

function nextPowerOfTwoBracket(n: number): number {
  let p = 1;
  while (p < n) p <<= 1;
  return Math.max(1, p);
}

function splitParticipantsByBlockSize<T>(items: T[], blockSize: number): T[][] {
  const size = Math.max(1, Math.floor(blockSize));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function splitParticipantsByBlockCount<T>(items: T[], blockCount: number): T[][] {
  const bc = Math.max(1, Math.floor(blockCount));
  const n = items.length;
  const base = Math.floor(n / bc);
  const rem = n % bc;
  const out: T[][] = [];
  let idx = 0;
  for (let g = 0; g < bc; g += 1) {
    const sz = base + (g < rem ? 1 : 0);
    out.push(items.slice(idx, idx + sz));
    idx += sz;
  }
  return out;
}

/** 확정 1라운드 슬롯 순서 그대로 매치 생성(부전승·이름 유지, 추가 BYE 없음) */
function buildRoundOneMatchesFromCopiedSlots(slots: BracketPlayer[]): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let i = 0; i < slots.length; i += 2) {
    const p1 = slots[i];
    const p2 = slots[i + 1];
    if (!p1 || !p2) break;
    matches.push({
      id: randomUUID(),
      player1: { ...p1 },
      player2: { ...p2 },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }
  return matches;
}

function extractRoundOneSlotsFlat(rounds: MutableBracketRound[]): BracketPlayer[] | null {
  const r1 = rounds.find((r) => r.roundNumber === 1);
  if (!r1?.matches.length) return null;
  const slots: BracketPlayer[] = [];
  for (const m of r1.matches) {
    slots.push({ ...m.player1 }, { ...m.player2 });
  }
  return slots;
}

function buildEmptyFinalRoundOneMatches(qualifierCount: number): BracketMatch[] {
  const n = nextPowerOfTwoBracket(qualifierCount);
  const matches: BracketMatch[] = [];
  for (let i = 0; i < n; i += 2) {
    matches.push({
      id: randomUUID(),
      player1: { userId: `__FIN_SLOT__:${i}`, name: "" },
      player2: { userId: `__FIN_SLOT__:${i + 1}`, name: "" },
      winnerUserId: null,
      winnerName: null,
      status: "PENDING",
    });
  }
  return matches;
}

/** 확정 단일 대진표(root rounds) 1라운드 슬롯을 그대로 나누어 multi_block으로 변환(동일 문서 덮어쓰기) */
export async function convertLatestBracketToMultiBlockFirestore(params: {
  tournamentId: string;
  bracketZoneId?: string | null;
  blockSize?: number;
  blockCount?: number;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const bs = params.blockSize;
  const bc = params.blockCount;
  const hasBs = typeof bs === "number" && Number.isFinite(bs) && bs > 0;
  const hasBc = typeof bc === "number" && Number.isFinite(bc) && bc > 0;
  if (hasBs === hasBc) {
    return { ok: false, error: "blockSize 또는 blockCount 중 하나만 지정해야 합니다." };
  }

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);

      if (mut.bracketMode === "multi_block") {
        throw new BracketOpReject("이미 분할된 대진표입니다.");
      }

      if (bracketHasRecordedWinnerForSplitShuffleGuard(mut)) {
        throw new BracketOpReject(BRACKET_PROGRESS_BLOCKS_SPLIT_OR_SHUFFLE_KO);
      }

      const slots = extractRoundOneSlotsFlat(mut.rounds);
      if (!slots?.length) {
        throw new BracketOpReject("1라운드 슬롯이 없어 분할할 수 없습니다.");
      }
      if (slots.length % 2 !== 0) {
        throw new BracketOpReject("1라운드 슬롯 수가 홀수입니다.");
      }

      const chunks = hasBs
        ? splitParticipantsByBlockSize(slots, Math.floor(bs as number))
        : splitParticipantsByBlockCount(slots, Math.floor(bc as number));

      for (const chunk of chunks) {
        if (chunk.length % 2 !== 0) {
          throw new BracketOpReject("블록별 슬롯 수는 짝수여야 합니다. blockSize를 짝수로 조정해 주세요.");
        }
      }

      const blocks = chunks.map((chunk, index) => {
        const label = index < 26 ? String.fromCharCode(65 + index) : `조${index + 1}`;
        return {
          id: `block-${index + 1}`,
          label,
          rounds: [
            {
              roundNumber: 1,
              matches: buildRoundOneMatchesFromCopiedSlots(chunk),
              status: "PENDING" as const,
            },
          ],
        };
      });

      const finalMatches = buildEmptyFinalRoundOneMatches(blocks.length);

      mut.bracketMode = "multi_block";
      mut.blocks = blocks;
      mut.finalBlock = {
        rounds: [
          {
            roundNumber: 1,
            matches: finalMatches,
            status: "PENDING",
          },
        ],
      };
      mut.rounds = [];
      mut.blockSplit = hasBs
        ? { mode: "blockSize" as const, blockSize: Math.floor(bs as number) }
        : { mode: "blockCount" as const, blockCount: Math.floor(bc as number) };

      applyBracketDefaultsInPlace(mut);
      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

/** 예선 조 1개: 1라운드 대진 유지·승패·진행만 제거, 결선은 1라운드만 남기고 동기화 */
function resetQualifierBlockResultsInPlace(mut: MutableBracket, blockId: string): void {
  if (mut.bracketMode !== "multi_block" || !mut.blocks?.length) {
    throw new BracketOpReject("분할된 예선 조가 아닙니다.");
  }
  const bid = blockId.trim();
  const block = mut.blocks.find((b) => b.id === bid);
  if (!block) throw new BracketOpReject("대상 조를 찾을 수 없습니다.");

  const rounds = block.rounds;
  truncateRoundsAfterInSlice(rounds, 1);
  const r1 = rounds.find((r) => r.roundNumber === 1);
  if (!r1?.matches.length) throw new BracketOpReject("1라운드가 없습니다.");
  for (const m of r1.matches) {
    m.winnerUserId = null;
    m.winnerName = null;
    m.status = "PENDING";
  }
  normalizeRoundStatusesInSlice(rounds);

  if (mut.finalBlock?.rounds?.length) {
    truncateRoundsAfterInSlice(mut.finalBlock.rounds, 1);
    const fr1 = mut.finalBlock.rounds.find((r) => r.roundNumber === 1);
    if (fr1) {
      for (const m of fr1.matches) {
        m.winnerUserId = null;
        m.winnerName = null;
        m.status = "PENDING";
      }
    }
  }
  syncFinalBlockFromQualifiersInPlace(mut);
  normalizeRoundStatusesEverywhere(mut);
}

/** 조분할 해제: 각 조 1라운드 슬롯을 순서대로 병합해 단일 예선 1라운드로 복귀(배치·상대 유지, 결과 없음) */
function revertMultiBlockBracketToSingleInPlace(mut: MutableBracket): void {
  if (mut.bracketMode !== "multi_block" || !mut.blocks?.length) {
    throw new BracketOpReject("조분할된 대진표가 아닙니다.");
  }
  const slots: BracketPlayer[] = [];
  for (const block of mut.blocks) {
    const r1 = block.rounds.find((r) => r.roundNumber === 1);
    if (!r1?.matches.length) {
      throw new BracketOpReject("병합할 1라운드 데이터가 없습니다.");
    }
    for (const m of r1.matches) {
      slots.push({ ...m.player1 }, { ...m.player2 });
    }
  }
  if (slots.length < 2 || slots.length % 2 !== 0) {
    throw new BracketOpReject("병합할 1라운드 슬롯이 올바르지 않습니다.");
  }
  const matches = buildRoundOneMatchesFromCopiedSlots(slots);
  mut.rounds = [
    {
      roundNumber: 1,
      matches,
      status: "PENDING",
    },
  ];
  delete (mut as { bracketMode?: string }).bracketMode;
  mut.blocks = undefined;
  mut.finalBlock = undefined;
  mut.finalBlockSlotManual = undefined;
  mut.blockSplit = undefined;
  applyBracketDefaultsInPlace(mut);
  normalizeRoundStatusesEverywhere(mut);
}

export async function resetQualifierBlockResultsFirestore(params: {
  tournamentId: string;
  bracketZoneId?: string | null;
  blockId: string;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const blockId = params.blockId.trim();
  if (!tournamentId || !blockId) return { ok: false, error: "잘못된 요청입니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      resetQualifierBlockResultsInPlace(mut, blockId);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

/** 예선 각 조·결선 트리에 라운드 1만 있을 때(분할 직후·진출 전) */
function multiBlockQualifiersFinalOnlyRoundOne(mut: MutableBracket): boolean {
  if (mut.bracketMode !== "multi_block" || !mut.blocks?.length) return false;
  for (const bl of mut.blocks) {
    if (bl.rounds.some((r) => r.roundNumber > 1)) return false;
  }
  if (mut.finalBlock?.rounds?.some((r) => r.roundNumber > 1)) return false;
  return true;
}

/**
 * 가벼운 분할 취소: 조 병합만 수행(순서·상대 유지, 승패 없음·1라운드만 있을 때).
 * 비밀번호 전체 초기화(`revertMultiBlockBracketToSingleFirestore`)와 달리 진행 중 상태에서는 호출 불가.
 */
export async function cancelMultiBlockSplitFirestore(params: {
  tournamentId: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      if (mut.bracketMode !== "multi_block" || !mut.blocks?.length) {
        throw new BracketOpReject("조분할된 대진표가 아닙니다.");
      }
      if (bracketHasRecordedWinnerForSplitShuffleGuard(mut)) {
        throw new BracketOpReject(BRACKET_PROGRESS_BLOCKS_SPLIT_OR_SHUFFLE_KO);
      }
      if (!multiBlockQualifiersFinalOnlyRoundOne(mut)) {
        throw new BracketOpReject(
          "예선·결선에 1라운드보다 깊은 라운드가 있으면 분할 취소를 할 수 없습니다. 필요 시 위험 작업의 전체 초기화를 이용해 주세요.",
        );
      }
      revertMultiBlockBracketToSingleInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

export async function revertMultiBlockBracketToSingleFirestore(params: {
  tournamentId: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);
      revertMultiBlockBracketToSingleInPlace(mut);
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}

export async function shuffleBracketRoundFirestore(params: {
  tournamentId: string;
  bracketZoneId?: string | null;
  roundNumber: number;
  scope: "all_blocks" | "qualifiers_only" | "final_only" | { blockId: string };
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  if (!tournamentId) return { ok: false, error: "잘못된 요청입니다." };

  const rn = Math.floor(Number(params.roundNumber));
  if (!Number.isFinite(rn) || rn < 1) {
    return { ok: false, error: "roundNumber가 올바르지 않습니다." };
  }

  const tournament = await getTournamentByIdFirestore(tournamentId);
  if (!tournament) return { ok: false, error: "대회를 찾을 수 없습니다." };

  const resolved = await resolveLatestBracketForMutationFirestore({
    tournamentId,
    tournament,
    bracketZoneId: params.bracketZoneId,
  });
  if (!resolved) {
    return {
      ok: false,
      error:
        tournament.zonesEnabled === true
          ? "권역(zoneId)를 지정하거나 해당 권역의 확정 대진표가 없습니다."
          : "확정 대진표가 없습니다.",
    };
  }

  const runShuffle = (rounds: MutableBracketRound[]) => {
    try {
      shuffleRoundSlotValuesInSlice(rounds, rn);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "셔플에 실패했습니다.";
      throw new BracketOpReject(msg);
    }
  };

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const ref = db.collection(BRACKETS).doc(resolved.id);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new BracketOpReject("확정 대진표가 없습니다.");
      const mut = bracketFromDoc(snap.id, snap.data() as Record<string, unknown>) as MutableBracket;
      if (!mut) throw new BracketOpReject("확정 대진표가 없습니다.");
      applyBracketDefaultsInPlace(mut);

      if (mut.bracketMode === "multi_block") {
        throw new BracketOpReject(
          "조분할 상태에서는 다시 섞기를 사용할 수 없습니다. 「분할취소」로 단일 예선으로 복귀한 뒤 이용해 주세요.",
        );
      }

      if (bracketHasRecordedWinnerForSplitShuffleGuard(mut)) {
        throw new BracketOpReject(BRACKET_PROGRESS_BLOCKS_SPLIT_OR_SHUFFLE_KO);
      }

      runShuffle(mut.rounds);

      normalizeRoundStatusesEverywhere(mut);
      syncFinalBlockFromQualifiersInPlace(mut);
      mut.createdAt = new Date().toISOString();
      const normalized = normalizeBracket(mut as Bracket);
      tx.set(ref, bracketToPlain(normalized));
      return normalized;
    });
    return { ok: true, bracket };
  } catch (e) {
    if (e instanceof BracketOpReject) return { ok: false, error: e.message };
    throw e;
  }
}
