import type { AuthRole } from "../auth/roles";
import {
  checkClientFeatureAccessByUserId,
  getClientStatusByUserId,
  resolveCanonicalUserIdForAuth,
} from "../platform-api";
import { getTournamentByIdFirestore } from "./firestore-tournaments";
import type { Tournament } from "./platform-backing-store";
import { getTournamentZoneById, listTournamentZones } from "./firestore-tournament-zones";

export const TOURNAMENT_ZONE_FORBIDDEN_ERROR = "해당 권역에 대한 권한이 없습니다.";

type SessionUser = { id: string; role: AuthRole };

/**
 * PLATFORM·대회 생성자는 항상 true.
 * 그 외 CLIENT는 해당 zone의 zoneManagerUserIds에 포함될 때만 true.
 */
export async function canManageTournamentZone(params: {
  userId: string;
  userRole: AuthRole;
  tournamentId: string;
  zoneId: string;
}): Promise<boolean> {
  const tid = params.tournamentId.trim();
  const zid = params.zoneId.trim();
  if (!tid || !zid) return false;
  if (params.userRole === "PLATFORM") return true;

  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) return false;

  const actor =
    params.userRole === "CLIENT"
      ? await resolveCanonicalUserIdForAuth(params.userId.trim())
      : params.userId.trim();
  if (tournament.createdBy === actor || tournament.createdBy === params.userId.trim()) {
    return true;
  }

  const zone = await getTournamentZoneById(tid, zid);
  if (!zone) return false;
  return zone.zoneManagerUserIds.some((m) => {
    const t = m.trim();
    return t === actor || t === params.userId.trim();
  });
}

export type TournamentZoneClientAccess =
  | { kind: "full" }
  | { kind: "zone_manager"; managedZoneIds: string[] };

export async function resolveTournamentZoneClientAccess(params: {
  user: SessionUser;
  tournamentId: string;
}): Promise<
  | { ok: true; tournament: Tournament; access: TournamentZoneClientAccess }
  | { ok: false; error: string; httpStatus: 400 | 403 | 404 }
> {
  const tid = params.tournamentId.trim();
  if (!tid) {
    return { ok: false, error: "잘못된 요청입니다.", httpStatus: 400 };
  }

  const tournament = await getTournamentByIdFirestore(tid);
  if (!tournament) {
    return { ok: false, error: "대회를 찾을 수 없습니다.", httpStatus: 404 };
  }

  if (params.user.role === "PLATFORM") {
    return { ok: true, tournament, access: { kind: "full" } };
  }

  if (params.user.role !== "CLIENT") {
    return { ok: false, error: "권한이 없습니다.", httpStatus: 403 };
  }

  const clientStatus = await getClientStatusByUserId(params.user.id);
  if (clientStatus !== "APPROVED") {
    return { ok: false, error: "클라이언트 승인 후 이용할 수 있습니다.", httpStatus: 403 };
  }

  const actorId = await resolveCanonicalUserIdForAuth(params.user.id);
  if (tournament.createdBy === actorId || tournament.createdBy === params.user.id.trim()) {
    return { ok: true, tournament, access: { kind: "full" } };
  }

  if (tournament.zonesEnabled !== true) {
    return { ok: false, error: "접근 권한이 없습니다.", httpStatus: 403 };
  }

  const zones = await listTournamentZones(tid);
  const managed = zones
    .filter((z) =>
      z.zoneManagerUserIds.some((m) => {
        const t = m.trim();
        return t === actorId || t === params.user.id.trim();
      })
    )
    .map((z) => z.id);

  if (managed.length === 0) {
    return { ok: false, error: "접근 권한이 없습니다.", httpStatus: 403 };
  }

  return { ok: true, tournament, access: { kind: "zone_manager", managedZoneIds: managed } };
}

/** 대진표 API: 권역 관리자는 BRACKET 기능 게이트를 추가로 통과해야 한다. */
export async function authorizeClientTournamentBracketContext(params: {
  user: SessionUser;
  tournamentId: string;
}): Promise<
  | { ok: true; tournament: Tournament; access: TournamentZoneClientAccess }
  | { ok: false; error: string; httpStatus: number }
> {
  const base = await resolveTournamentZoneClientAccess(params);
  if (!base.ok) {
    return { ok: false, error: base.error, httpStatus: base.httpStatus };
  }
  if (base.access.kind === "zone_manager") {
    const bf = await checkClientFeatureAccessByUserId({ userId: params.user.id, feature: "BRACKET" });
    if (!bf.ok) {
      return { ok: false, error: bf.error, httpStatus: 403 };
    }
  }
  return { ok: true, tournament: base.tournament, access: base.access };
}

export function zoneManagerMayAccessZoneId(
  access: TournamentZoneClientAccess,
  zoneId: string | null | undefined
): boolean {
  if (access.kind === "full") return true;
  const z = typeof zoneId === "string" ? zoneId.trim() : "";
  if (!z) return false;
  return access.managedZoneIds.includes(z);
}
