import { cache } from "react";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../auth/session";
import { getClientStatusByUserId, getUserById } from "./platform-backing-store";

export type AdminFabSessionUser = {
  role: string;
  clientStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
};

/** 요청당 1회 — RSC·레이아웃에서 `getUserById` 중복 호출 방지 */
export const getRequestSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  return getUserById(session.userId);
});

/** 루트 FAB용 — 로그인 없으면 null, 플랫폼·승인 클라이언트만 FAB에 필요한 필드 */
export async function getAdminFloatingFabSessionUser(): Promise<AdminFabSessionUser | null> {
  const user = await getRequestSessionUser();
  if (!user) return null;
  if (user.role === "PLATFORM") {
    return { role: "PLATFORM", clientStatus: null };
  }
  if (user.role === "CLIENT") {
    const st = await getClientStatusByUserId(user.id);
    return { role: "CLIENT", clientStatus: st };
  }
  return { role: user.role, clientStatus: null };
}
