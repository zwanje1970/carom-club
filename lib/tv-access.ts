import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import { canViewTournament } from "@/lib/permissions";
import { ORGANIZATION_SELECT_OWNER } from "@/lib/db-selects";

export function generateTvAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function findTournamentByTvAccessToken(token: string) {
  return prisma.tournament.findFirst({
    where: { tvAccessToken: token },
    include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
  });
}

export async function canAccessTournamentTv(
  session: SessionUser | null,
  tournamentId: string,
  token?: string | null
): Promise<boolean> {
  if (session) {
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { organization: { select: ORGANIZATION_SELECT_OWNER } },
    });
    if (tournament && canViewTournament(session, tournament, tournament.organization)) return true;
  }
  if (!token) return false;
  const tournament = await prisma.tournament.findFirst({
    where: { id: tournamentId, tvAccessToken: token },
    select: { id: true },
  });
  return Boolean(tournament);
}

export async function canAccessTournamentTvByToken(token: string): Promise<boolean> {
  const tournament = await findTournamentByTvAccessToken(token);
  return Boolean(tournament);
}
