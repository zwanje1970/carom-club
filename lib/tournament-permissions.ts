/**
 * 신규 공통 권한 레이어.
 * - ClientMembership 기반 조직 권한
 * - TournamentZoneManager 기반 권역 권한
 * - ZoneManagerApplication 승인/신청 흐름
 */

import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types/auth";

export async function getClientMembershipRole(userId: string, clientId: string) {
  const membership = await prisma.clientMembership.findUnique({
    where: { userId_clientId: { userId, clientId } },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== "APPROVED") return null;
  return membership.role;
}

export async function canManageClientTournament(user: SessionUser | null, clientId: string): Promise<boolean> {
  if (!user) return false;
  const role = await getClientMembershipRole(user.id, clientId);
  return role === "CLIENT_ADMIN";
}

export async function canViewClientTournament(user: SessionUser | null, clientId: string): Promise<boolean> {
  if (!user) return false;
  const role = await getClientMembershipRole(user.id, clientId);
  return role === "CLIENT_ADMIN" || role === "MEMBER" || role === "ZONE_MANAGER";
}

export async function canManageTournamentZone(user: SessionUser | null, zoneId: string): Promise<boolean> {
  if (!user) return false;
  const membership = await prisma.tournamentZoneManager.findUnique({
    where: { zoneId_userId: { zoneId, userId: user.id } },
    select: { approvedByUserId: true },
  });
  return membership?.approvedByUserId != null || membership != null;
}

export async function canViewTournamentZone(user: SessionUser | null, zoneId: string): Promise<boolean> {
  return canManageTournamentZone(user, zoneId);
}

export async function canApproveZoneManagerApplication(user: SessionUser | null, zoneId: string): Promise<boolean> {
  if (!user) return false;
  return canManageTournamentZone(user, zoneId);
}

export async function isZoneManagerApproved(userId: string, zoneId: string): Promise<boolean> {
  const row = await prisma.tournamentZoneManager.findUnique({
    where: { zoneId_userId: { zoneId, userId } },
    select: { id: true },
  });
  return row != null;
}
