import { randomUUID } from "crypto";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { listApprovedParticipantsByTournamentIdFirestore } from "./firestore-tournament-applications";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
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

const SNAPSHOTS = "v3_tournament_participant_snapshots";
const BRACKETS = "v3_tournament_brackets";

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
  };
  return normalizeBracket(raw);
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

export async function createBracketFromSnapshotFirestore(
  snapshotId: string
): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const snapshot = await getBracketParticipantSnapshotByIdFirestore(snapshotId);
  if (!snapshot) {
    return { ok: false, error: "대상자 스냅샷을 찾을 수 없습니다." };
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
  return { ok: true, bracket: normalizeBracket(bracket) };
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
  return { ok: true, bracket: normalizeBracket(bracket) };
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

export async function getLatestBracketByTournamentIdFirestore(tournamentId: string): Promise<Bracket | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
  const db = getSharedFirestoreDb();
  const q = await db
    .collection(BRACKETS)
    .where("tournamentId", "==", id)
    .orderBy("createdAt", "desc")
    .limit(1)
    .get();
  if (q.empty) return null;
  const doc = q.docs[0]!;
  return bracketFromDoc(doc.id, doc.data() as Record<string, unknown>);
}

export async function getLatestBracketByTournamentIdAndZoneIdFirestore(
  tournamentId: string,
  zoneId: string
): Promise<Bracket | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  const zid = zoneId.trim();
  if (!id || !zid) return null;
  const list = await listBracketsByTournamentIdFirestore(id);
  for (const b of list) {
    const z = typeof b.zoneId === "string" ? b.zoneId.trim() : "";
    if (z === zid) return b;
  }
  return null;
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

      let targetRound: MutableBracketRound | null = null;
      let targetMatch: MutableBracketMatch | null = null;
      for (const round of latestBracket.rounds) {
        const match = round.matches.find((item) => item.id === matchId);
        if (match) {
          targetRound = round;
          targetMatch = match;
          break;
        }
      }
      if (!targetRound || !targetMatch) {
        throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      }
      if (latestBracket.rounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
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
      for (const round of latestBracket.rounds) {
        round.status = deriveRoundStatus(round.matches);
      }

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

      let targetRound: MutableBracketRound | null = null;
      let targetMatch: MutableBracketMatch | null = null;
      for (const round of latestBracket.rounds) {
        const match = round.matches.find((item) => item.id === matchId);
        if (match) {
          targetRound = round;
          targetMatch = match;
          break;
        }
      }
      if (!targetRound || !targetMatch) {
        throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      }
      if (latestBracket.rounds.some((round) => round.roundNumber === targetRound.roundNumber + 1)) {
        throw new BracketOpReject("다음 라운드가 이미 생성되어 참가자를 교체할 수 없습니다.");
      }

      const playerMap = new Map<string, BracketPlayer>();
      for (const round of latestBracket.rounds) {
        for (const match of round.matches) {
          playerMap.set(match.player1.userId, match.player1);
          playerMap.set(match.player2.userId, match.player2);
        }
      }
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
      for (const round of latestBracket.rounds) {
        round.status = deriveRoundStatus(round.matches);
      }

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
  roundNumber: number
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

      const currentRound = bracketMut.rounds.find((round) => round.roundNumber === roundNumber);
      if (!currentRound) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      if (currentRound.status !== "COMPLETED") {
        throw new BracketOpReject("현재 라운드가 아직 완료되지 않았습니다.");
      }
      if (bracketMut.rounds.some((round) => round.roundNumber === roundNumber + 1)) {
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

      bracketMut.rounds.push({
        roundNumber: roundNumber + 1,
        matches: nextMatches,
        status: "PENDING",
      });
      for (const round of bracketMut.rounds) {
        round.status = deriveRoundStatus(round.matches);
      }

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
  for (const round of bracket.rounds) {
    round.status = deriveRoundStatus(round.matches);
  }
}

function truncateRoundsAfter(bracket: MutableBracket, roundNumber: number): void {
  bracket.rounds = bracket.rounds.filter((round) => round.roundNumber <= roundNumber);
}

export async function resetBracketRoundsAfterFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  bracketZoneId?: string | null;
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
      if (!mut.rounds.some((r) => r.roundNumber === roundNumber)) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      truncateRoundsAfter(mut, roundNumber);
      normalizeRoundStatusesInPlace(mut);
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
      const currentRound = mut.rounds.find((r) => r.roundNumber === roundNumber);
      if (!currentRound) throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      if (!allowPartial && currentRound.status !== "COMPLETED") {
        throw new BracketOpReject("현재 라운드가 완료되지 않아 재생성할 수 없습니다.");
      }
      truncateRoundsAfter(mut, roundNumber);
      const nextRoundNumber = roundNumber + 1;
      const nextMatches = buildNextRoundMatchesFromRound({
        currentRound,
        nextRoundNumber,
        allowPartial,
      });
      if (nextMatches.length === 0) {
        throw new BracketOpReject("다음 라운드를 만들 매치가 부족합니다.");
      }
      mut.rounds.push({
        roundNumber: nextRoundNumber,
        matches: nextMatches,
        status: "PENDING",
      });
      normalizeRoundStatusesInPlace(mut);
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
  truncateRoundsAfter(bracket, startRoundNumber);
  let currentRoundNumber = startRoundNumber;
  while (true) {
    const currentRound = bracket.rounds.find((r) => r.roundNumber === currentRoundNumber);
    if (!currentRound) break;
    if (!allowPartial && currentRound.status !== "COMPLETED") break;
    const nextRoundNumber = currentRoundNumber + 1;
    const nextMatches = buildNextRoundMatchesFromRound({ currentRound, nextRoundNumber, allowPartial });
    if (nextMatches.length === 0) break;
    bracket.rounds.push({
      roundNumber: nextRoundNumber,
      matches: nextMatches,
      status: "PENDING",
    });
    currentRoundNumber = nextRoundNumber;
    if (nextMatches.length === 1) break;
  }
  normalizeRoundStatusesInPlace(bracket);
}

export async function rebuildBracketFromRoundFirestore(params: {
  tournamentId: string;
  roundNumber: number;
  allowPartial?: boolean;
  bracketZoneId?: string | null;
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
      const startRound = mut.rounds.find((r) => r.roundNumber === roundNumber);
      if (!startRound) {
        throw new BracketOpReject("대상 라운드를 찾을 수 없습니다.");
      }
      if (!allowPartial && startRound.status !== "COMPLETED") {
        throw new BracketOpReject("시작 라운드가 완료되지 않아 전체 재생성이 불가능합니다.");
      }
      rebuildChainFromRoundInPlace({ bracket: mut, startRoundNumber: roundNumber, allowPartial });
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
      const round = mut.rounds.find((r) => r.roundNumber === roundNumber);
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

      normalizeRoundStatusesInPlace(mut);
      const hasDownstream = mut.rounds.some((r) => r.roundNumber > roundNumber);
      if (hasDownstream) {
        if (!autoRebuildAfter) {
          throw new BracketOpReject("이후 라운드가 있어 재배치할 수 없습니다. reset-after/rebuild를 먼저 실행해 주세요.");
        }
        rebuildChainFromRoundInPlace({
          bracket: mut,
          startRoundNumber: roundNumber,
          allowPartial: allowPartialRebuild,
        });
      }
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
  displayName: string;
  bracketZoneId?: string | null;
}): Promise<{ ok: true; bracket: Bracket } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = params.tournamentId.trim();
  const matchId = params.matchId.trim();
  const displayName = params.displayName.trim();
  if (!tournamentId || !matchId || !displayName) {
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
      let target: MutableBracketMatch | null = null;
      for (const round of mut.rounds) {
        const m = round.matches.find((x) => x.id === matchId);
        if (m) {
          target = m;
          break;
        }
      }
      if (!target) throw new BracketOpReject("대상 매치를 찾을 수 없습니다.");
      const player = params.slot === "player1" ? target.player1 : target.player2;
      player.name = displayName;
      if (typeof target.winnerUserId === "string" && target.winnerUserId === player.userId) {
        target.winnerName = displayName;
      }
      normalizeRoundStatusesInPlace(mut);
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
