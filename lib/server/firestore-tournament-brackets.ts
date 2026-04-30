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
  return { id: docId, tournamentId, participants, createdAt };
}

function bracketFromDoc(docId: string, data: Record<string, unknown> | undefined): Bracket | null {
  if (!data || typeof data !== "object") return null;
  const raw: Bracket = {
    id: docId,
    tournamentId: typeof data.tournamentId === "string" ? data.tournamentId : "",
    snapshotId: typeof data.snapshotId === "string" ? data.snapshotId : "",
    rounds: (Array.isArray(data.rounds) ? data.rounds : []) as Bracket["rounds"],
    createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
  };
  return normalizeBracket(raw);
}

function bracketToPlain(b: Bracket): Record<string, unknown> {
  return {
    id: b.id,
    tournamentId: b.tournamentId,
    snapshotId: b.snapshotId,
    rounds: b.rounds,
    createdAt: b.createdAt,
  };
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

export async function getLatestBracketParticipantSnapshotByTournamentIdFirestore(
  tournamentId: string
): Promise<BracketParticipantSnapshot | null> {
  assertClientFirestorePersistenceConfigured();
  const id = tournamentId.trim();
  if (!id) return null;
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

export async function createBracketParticipantSnapshotFirestore(params: {
  tournamentId: string;
}): Promise<{ ok: true; snapshot: BracketParticipantSnapshot } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const approvedParticipants = await listApprovedParticipantsByTournamentIdFirestore(params.tournamentId);
  if (approvedParticipants.length === 0) {
    return { ok: false, error: "APPROVED 참가자가 없어 스냅샷을 생성할 수 없습니다." };
  }

  const tournament = await getTournamentByIdFirestore(params.tournamentId);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다." };
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
  };

  const db = getSharedFirestoreDb();
  const plain: Record<string, unknown> = {
    id: snapshot.id,
    tournamentId: snapshot.tournamentId,
    participants: snapshot.participants,
    createdAt: snapshot.createdAt,
  };
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

export async function updateBracketMatchResultFirestore(params: {
  tournamentId: string;
  matchId: string;
  winnerUserId: string | null;
  actorUserId?: string;
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

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const q = db
        .collection(BRACKETS)
        .where("tournamentId", "==", tournamentId)
        .orderBy("createdAt", "desc")
        .limit(1);
      const qs = await tx.get(q);
      if (qs.empty) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }
      const docSnap = qs.docs[0]!;
      const ref = docSnap.ref;
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

  const db = getSharedFirestoreDb();
  try {
    const bracket = await db.runTransaction(async (tx) => {
      const q = db
        .collection(BRACKETS)
        .where("tournamentId", "==", tournamentId)
        .orderBy("createdAt", "desc")
        .limit(1);
      const qs = await tx.get(q);
      if (qs.empty) {
        throw new BracketOpReject("확정 대진표가 없습니다.");
      }
      const docSnap = qs.docs[0]!;
      const ref = docSnap.ref;
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
