/**
 * 권한·업체 스코핑: CLIENT_ADMIN은 접근 가능한 조직(소유 + OrganizationMember) 범위 내에서만.
 * 활성 조직은 쿠키 `client_console_org_id` + `pickActiveOrganizationId` 로 결정.
 * PLATFORM_ADMIN은 플랫폼 관리자(/admin) 전용; 여기서는 세션 없이 빈 값 처리.
 */
import type { SessionUser } from "@/types/auth";
import { isClientAdmin, isPlatformAdmin } from "@/types/auth";
import {
  CLIENT_CONSOLE_ORG_COOKIE,
  getAccessibleClientOrganizationsCached,
  pickActiveOrganizationId,
} from "@/lib/client-console-org";

/**
 * 클라이언트 콘솔에서 현재 컨텍스트 조직 ID.
 * - 접근 가능 목록 + 쿠키 선호값(유효할 때만) + 없으면 목록 첫 항목
 */
export async function getClientAdminOrganizationId(
  session: SessionUser | null
): Promise<string | null> {
  if (!session || !isClientAdmin(session)) return null;
  const orgs = await getAccessibleClientOrganizationsCached(session.id);
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const preferred = cookieStore.get(CLIENT_CONSOLE_ORG_COOKIE)?.value ?? null;
  return pickActiveOrganizationId(orgs, preferred);
}

/**
 * 세션으로 필터 가능한 업체 ID 목록.
 * - PLATFORM_ADMIN: null (= 필터 없음, 전체)
 * - CLIENT_ADMIN: 접근 가능한 모든 조직 id
 */
export async function getAllowedOrganizationIds(
  session: SessionUser | null
): Promise<string[] | null> {
  if (!session) return [];
  if (isPlatformAdmin(session)) return null;
  if (!isClientAdmin(session)) return [];
  const orgs = await getAccessibleClientOrganizationsCached(session.id);
  return orgs.map((o) => o.id);
}
