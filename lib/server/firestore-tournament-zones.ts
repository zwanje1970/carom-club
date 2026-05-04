import { randomUUID } from "crypto";
import { assertClientFirestorePersistenceConfigured } from "./firestore-client-applications";
import { findTournamentIdByTvAccessTokenFirestore } from "./firestore-tournaments";
import { getSharedFirestoreDb } from "./firestore-users";
import { generateTvAccessToken } from "./tv-access";

const COLLECTION = "v3_tournament_zones";

export type TournamentZoneStored = {
  id: string;
  tournamentId: string;
  zoneName: string;
  zoneCode: string | null;
  sortOrder: number;
  zoneManagerUserIds: string[];
  status: "ACTIVE" | "INACTIVE";
  tvAccessToken: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTournamentZoneInput = {
  tournamentId: string;
  zoneName: string;
  zoneCode?: string | null;
  sortOrder?: number;
  zoneManagerUserIds?: string[];
  status?: "ACTIVE" | "INACTIVE";
};

export type UpdateTournamentZoneInput = {
  tournamentId: string;
  id: string;
  zoneName?: string;
  zoneCode?: string | null;
  sortOrder?: number;
  zoneManagerUserIds?: string[];
  status?: "ACTIVE" | "INACTIVE";
  tvAccessToken?: string | null;
};

function parseZoneManagerUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x === "string" && x.trim() !== "") out.push(x.trim());
  }
  return out;
}

function zoneFromDoc(docId: string, data: Record<string, unknown> | undefined): TournamentZoneStored | null {
  if (!data || typeof data !== "object") return null;
  const tournamentId = typeof data.tournamentId === "string" ? data.tournamentId.trim() : "";
  const zoneName = typeof data.zoneName === "string" ? data.zoneName.trim() : "";
  if (!tournamentId || !zoneName) return null;
  const zoneCodeRaw = data.zoneCode;
  const zoneCode =
    zoneCodeRaw === null || zoneCodeRaw === undefined
      ? null
      : typeof zoneCodeRaw === "string"
        ? zoneCodeRaw.trim() || null
        : null;
  const sortOrder =
    typeof data.sortOrder === "number" && Number.isFinite(data.sortOrder) ? Math.floor(data.sortOrder) : 0;
  const zoneManagerUserIds = parseZoneManagerUserIds(data.zoneManagerUserIds);
  const st = data.status;
  const status: TournamentZoneStored["status"] = st === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const tvRaw = data.tvAccessToken;
  const tvAccessToken =
    typeof tvRaw === "string" && tvRaw.trim() !== "" ? tvRaw.trim() : tvRaw === null ? null : null;
  const createdAt =
    typeof data.createdAt === "string" && data.createdAt.trim() !== "" ? data.createdAt : new Date().toISOString();
  const updatedAt =
    typeof data.updatedAt === "string" && data.updatedAt.trim() !== "" ? data.updatedAt : createdAt;
  return {
    id: docId,
    tournamentId,
    zoneName,
    zoneCode,
    sortOrder,
    zoneManagerUserIds,
    status,
    tvAccessToken,
    createdAt,
    updatedAt,
  };
}

function zoneToPlain(z: TournamentZoneStored): Record<string, unknown> {
  return {
    id: z.id,
    tournamentId: z.tournamentId,
    zoneName: z.zoneName,
    zoneCode: z.zoneCode,
    sortOrder: z.sortOrder,
    zoneManagerUserIds: z.zoneManagerUserIds,
    status: z.status,
    tvAccessToken: z.tvAccessToken,
    createdAt: z.createdAt,
    updatedAt: z.updatedAt,
  };
}

export async function listTournamentZones(tournamentId: string): Promise<TournamentZoneStored[]> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  if (!tid) return [];
  const db = getSharedFirestoreDb();
  const q = await db.collection(COLLECTION).where("tournamentId", "==", tid).get();
  const out: TournamentZoneStored[] = [];
  for (const doc of q.docs) {
    const z = zoneFromDoc(doc.id, doc.data() as Record<string, unknown>);
    if (z) out.push(z);
  }
  out.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return out;
}

export async function getTournamentZoneById(tournamentId: string, zoneId: string): Promise<TournamentZoneStored | null> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  const zid = zoneId.trim();
  if (!tid || !zid) return null;
  const db = getSharedFirestoreDb();
  const snap = await db.collection(COLLECTION).doc(zid).get();
  if (!snap.exists) return null;
  const z = zoneFromDoc(snap.id, snap.data() as Record<string, unknown>);
  if (!z || z.tournamentId !== tid) return null;
  return z;
}

export async function createTournamentZone(input: CreateTournamentZoneInput): Promise<TournamentZoneStored> {
  assertClientFirestorePersistenceConfigured();
  const tournamentId = input.tournamentId.trim();
  const zoneName = input.zoneName.trim();
  if (!tournamentId || !zoneName) {
    throw new Error("tournamentId와 zoneName이 필요합니다.");
  }
  const zoneCode =
    input.zoneCode === null || input.zoneCode === undefined
      ? null
      : typeof input.zoneCode === "string"
        ? input.zoneCode.trim() || null
        : null;
  const sortOrder =
    typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder) ? Math.floor(input.sortOrder) : 0;
  const zoneManagerUserIds = Array.isArray(input.zoneManagerUserIds)
    ? input.zoneManagerUserIds.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
    : [];
  const status: TournamentZoneStored["status"] = input.status === "INACTIVE" ? "INACTIVE" : "ACTIVE";
  const now = new Date().toISOString();
  const id = randomUUID();
  const row: TournamentZoneStored = {
    id,
    tournamentId,
    zoneName,
    zoneCode,
    sortOrder,
    zoneManagerUserIds,
    status,
    tvAccessToken: null,
    createdAt: now,
    updatedAt: now,
  };
  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).set(zoneToPlain(row));
  return row;
}

export async function updateTournamentZone(input: UpdateTournamentZoneInput): Promise<TournamentZoneStored | null> {
  assertClientFirestorePersistenceConfigured();
  const tid = input.tournamentId.trim();
  const id = input.id.trim();
  if (!tid || !id) return null;
  const existing = await getTournamentZoneById(tid, id);
  if (!existing) return null;

  const next: TournamentZoneStored = { ...existing };
  if (typeof input.zoneName === "string") {
    const n = input.zoneName.trim();
    if (n) next.zoneName = n;
  }
  if (input.zoneCode !== undefined) {
    next.zoneCode =
      input.zoneCode === null
        ? null
        : typeof input.zoneCode === "string"
          ? input.zoneCode.trim() || null
          : null;
  }
  if (typeof input.sortOrder === "number" && Number.isFinite(input.sortOrder)) {
    next.sortOrder = Math.floor(input.sortOrder);
  }
  if (input.zoneManagerUserIds !== undefined) {
    next.zoneManagerUserIds = Array.isArray(input.zoneManagerUserIds)
      ? input.zoneManagerUserIds.filter((x) => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
      : [];
  }
  if (input.status === "ACTIVE" || input.status === "INACTIVE") {
    next.status = input.status;
  }
  if (input.tvAccessToken !== undefined) {
    next.tvAccessToken =
      input.tvAccessToken === null
        ? null
        : typeof input.tvAccessToken === "string" && input.tvAccessToken.trim() !== ""
          ? input.tvAccessToken.trim()
          : null;
  }
  next.updatedAt = new Date().toISOString();

  const db = getSharedFirestoreDb();
  await db.collection(COLLECTION).doc(id).set(zoneToPlain(next), { merge: true });
  return next;
}

export async function findTournamentZoneByTvAccessToken(token: string): Promise<TournamentZoneStored | null> {
  assertClientFirestorePersistenceConfigured();
  const tok = token.trim();
  if (!tok) return null;
  const db = getSharedFirestoreDb();
  const q = await db.collection(COLLECTION).where("tvAccessToken", "==", tok).limit(1).get();
  if (q.empty) return null;
  const doc = q.docs[0]!;
  return zoneFromDoc(doc.id, doc.data() as Record<string, unknown>);
}

/**
 * 권역 TV 토큰이 없으면 생성·저장하고, 있으면 기존 값을 유지한다.
 */
export async function ensureTournamentZoneTvAccessTokenFirestore(
  tournamentId: string,
  zoneId: string,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  assertClientFirestorePersistenceConfigured();
  const tid = tournamentId.trim();
  const zid = zoneId.trim();
  if (!tid || !zid) return { ok: false, error: "잘못된 요청입니다." };
  const zone = await getTournamentZoneById(tid, zid);
  if (!zone) return { ok: false, error: "권역을 찾을 수 없습니다." };
  const cur = zone.tvAccessToken?.trim();
  if (cur) return { ok: true, token: cur };

  for (let attempt = 0; attempt < 8; attempt++) {
    const token = generateTvAccessToken();
    const zoneHit = await findTournamentZoneByTvAccessToken(token);
    if (zoneHit && zoneHit.id !== zid) continue;
    const tournamentHit = await findTournamentIdByTvAccessTokenFirestore(token);
    if (tournamentHit) continue;
    const updated = await updateTournamentZone({ tournamentId: tid, id: zid, tvAccessToken: token });
    if (!updated) return { ok: false, error: "TV 토큰을 저장하지 못했습니다." };
    return { ok: true, token };
  }
  return { ok: false, error: "TV 토큰을 생성하지 못했습니다." };
}
