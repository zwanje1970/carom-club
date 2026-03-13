/**
 * 권한·업체 스코핑: CLIENT_ADMIN은 본인 소유 업체만, PLATFORM_ADMIN은 전체.
 * API/서버에서 소유권 검증 시 사용.
 */
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/types/auth";
import { isClientAdmin, isPlatformAdmin } from "@/types/auth";

/** CLIENT_ADMIN인 경우 본인 소유 업체 ID 1개 반환, 없으면 null. PLATFORM_ADMIN이면 null(전체 접근). */
export async function getClientAdminOrganizationId(
  session: SessionUser | null
): Promise<string | null> {
  if (!session || !isClientAdmin(session)) return null;
  const org = await prisma.organization.findFirst({
    where: { ownerUserId: session.id },
    select: { id: true },
  });
  return org?.id ?? null;
}

/** 세션으로 접근 가능한 업체 ID 목록. PLATFORM_ADMIN이면 null(전체), CLIENT_ADMIN이면 본인 소유 1개. */
export async function getAllowedOrganizationIds(
  session: SessionUser | null
): Promise<string[] | null> {
  if (!session) return [];
  if (isPlatformAdmin(session)) return null; // null = no filter, all orgs
  const id = await getClientAdminOrganizationId(session);
  return id ? [id] : [];
}
