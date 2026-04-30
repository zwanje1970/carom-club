/**
 * 정산 API 라우트용: 세션 `userId` → 사용자는 `resolveUserForApiBySessionUserId`(마이페이지와 동일 경로).
 * 기능 게이트는 `checkClientFeatureAccessByUserId`(getUserById + 클라이언트 상태·대시보드 정책).
 */
import type { AuthRole } from "../auth/roles";
import { checkClientFeatureAccessByUserId } from "./platform-backing-store";
import { resolveUserForApiBySessionUserId } from "./request-session-user";

export async function settlementApiGetSessionUser(userId: string): Promise<{
  id: string;
  role: AuthRole;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
} | null> {
  const user = await resolveUserForApiBySessionUserId(userId);
  if (!user) return null;
  const status = user.status === "SUSPENDED" || user.status === "DELETED" ? user.status : "ACTIVE";
  return { id: user.id, role: user.role as AuthRole, status };
}

export async function settlementApiCheckClientFeatureAccess(params: {
  userId: string;
  feature: "SETTLEMENT" | "BRACKET";
}): Promise<Awaited<ReturnType<typeof checkClientFeatureAccessByUserId>>> {
  return checkClientFeatureAccessByUserId(params);
}
