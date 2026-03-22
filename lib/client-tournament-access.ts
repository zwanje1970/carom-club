/**
 * /client 콘솔 — 대회 생성·수정 시 조직 단위 권한.
 * OrganizationMember(OWNER/ADMIN) 및 Organization.ownerUserId 반영.
 * (canManageTournament는 소유자만 보므로, 클라이언트 API는 여기서 별도 검증)
 */
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import { canAccessClientDashboard } from "@/types/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";

export type ClientOrgMutationRole = "OWNER" | "ADMIN";

/** 활성 조직에서 대회 데이터 변경 가능 여부 (소유자 또는 OWNER/ADMIN 멤버) */
export async function getClientOrgTournamentMutationRole(
  userId: string,
  organizationId: string
): Promise<ClientOrgMutationRole | null> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerUserId: true },
  });
  if (!org) return null;
  if (org.ownerUserId === userId) return "OWNER";
  const m = await prisma.organizationMember.findFirst({
    where: {
      userId,
      organizationId,
      status: "ACTIVE",
      role: { in: ["OWNER", "ADMIN"] },
    },
    select: { role: true },
  });
  if (!m) return null;
  return m.role === "OWNER" ? "OWNER" : "ADMIN";
}

export async function assertClientActiveOrgCanMutateTournaments(
  session: SessionUser | null
): Promise<
  | { ok: true; organizationId: string; role: ClientOrgMutationRole }
  | { ok: false; status: 401 | 403; error: string }
> {
  if (!session) {
    return { ok: false, status: 401, error: "로그인이 필요합니다." };
  }
  if (!canAccessClientDashboard(session)) {
    return { ok: false, status: 403, error: "대회 운영 콘솔 권한이 필요합니다." };
  }
  const organizationId = await getClientAdminOrganizationId(session);
  if (!organizationId) {
    return { ok: false, status: 403, error: "선택된 운영 조직이 없거나 접근 권한이 없습니다." };
  }
  const role = await getClientOrgTournamentMutationRole(session.id, organizationId);
  if (!role) {
    return { ok: false, status: 403, error: "이 조직에서 대회를 만들거나 수정할 권한이 없습니다." };
  }
  return { ok: true, organizationId, role };
}

export async function assertClientCanMutateTournamentById(
  session: SessionUser | null,
  tournamentId: string
): Promise<
  | { ok: true; organizationId: string; tournament: { id: string; organizationId: string; name: string; status: string } }
  | { ok: false; status: 401 | 403 | 404; error: string }
> {
  const base = await assertClientActiveOrgCanMutateTournaments(session);
  if (!base.ok) return base;

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { id: true, organizationId: true, name: true, status: true },
  });
  if (!tournament) {
    return { ok: false, status: 404, error: "대회를 찾을 수 없습니다." };
  }
  if (tournament.organizationId !== base.organizationId) {
    return { ok: false, status: 403, error: "현재 선택한 조직에 속하지 않은 대회입니다." };
  }
  return {
    ok: true,
    organizationId: base.organizationId,
    tournament,
  };
}
