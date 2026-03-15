/**
 * ZONE_MANAGER: 배정된 권역(Zone) 조회.
 * API/페이지에서 권역 스코핑 시 사용.
 */
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import { isZoneManager } from "@/lib/permissions";

/** ZONE_MANAGER인 경우 본인에게 배정된 zone id 목록. 없으면 []. 다른 역할이면 null(전체 접근 아님, 비권역 역할). */
export async function getAssignedZoneIds(
  session: SessionUser | null
): Promise<string[] | null> {
  if (!session || !isZoneManager(session)) return null;
  const assignments = await prisma.zoneManagerAssignment.findMany({
    where: { userId: session.id },
    select: { zoneId: true },
  });
  return assignments.map((a) => a.zoneId);
}

/** ZONE_MANAGER인 경우 본인에게 배정된 Zone 목록(이름·코드 등). 없으면 []. */
export async function getAssignedZones(
  session: SessionUser | null
): Promise<{ id: string; name: string; code: string | null; sortOrder: number }[]> {
  if (!session || !isZoneManager(session)) return [];
  const list = await prisma.zoneManagerAssignment.findMany({
    where: { userId: session.id },
    include: { zone: true },
    orderBy: { zone: { sortOrder: "asc" } },
  });
  return list.map((a) => ({
    id: a.zone.id,
    name: a.zone.name,
    code: a.zone.code,
    sortOrder: a.zone.sortOrder,
  }));
}

/** ZONE_MANAGER가 해당 TournamentZone(대회별 권역)을 관리할 수 있는지. tz.zoneId가 본인 배정 권역에 포함되어야 함. */
export async function canManageTournamentZone(
  session: SessionUser | null,
  tournamentZoneId: string
): Promise<boolean> {
  if (!session || !isZoneManager(session)) return false;
  const assigned = await getAssignedZoneIds(session);
  if (!assigned?.length) return false;
  const tz = await prisma.tournamentZone.findUnique({
    where: { id: tournamentZoneId },
    select: { zoneId: true },
  });
  return tz ? assigned.includes(tz.zoneId) : false;
}

/** ZONE_MANAGER가 해당 TournamentZone을 조회할 수 있는지 (동일 조건). */
export async function canViewTournamentZone(
  session: SessionUser | null,
  tournamentZoneId: string
): Promise<boolean> {
  return canManageTournamentZone(session, tournamentZoneId);
}

/** ZONE_MANAGER인 경우 본인이 관리할 수 있는 TournamentZone 목록 (대회명 포함). */
export async function getAssignedTournamentZones(
  session: SessionUser | null
): Promise<{ tournamentZoneId: string; tournamentId: string; tournamentName: string; zoneName: string; zoneCode: string | null }[]> {
  if (!session || !isZoneManager(session)) return [];
  const assignedZoneIds = await getAssignedZoneIds(session);
  if (!assignedZoneIds?.length) return [];
  const list = await prisma.tournamentZone.findMany({
    where: { zoneId: { in: assignedZoneIds } },
    include: { tournament: { select: { id: true, name: true } }, zone: { select: { name: true, code: true } } },
    orderBy: [{ tournament: { startAt: "desc" } }],
  });
  return list.map((tz) => ({
    tournamentZoneId: tz.id,
    tournamentId: tz.tournamentId,
    tournamentName: tz.tournament.name,
    zoneName: tz.name ?? tz.zone.name,
    zoneCode: tz.code ?? tz.zone.code,
  }));
}
