import { cache } from "react";
import { cookies, headers } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../auth/session";
import { isCaromClubMobileAppShell } from "../is-carom-club-mobile-app-shell";
import { getClientStatusByUserId, getUserById, type DevUser } from "./platform-backing-store";

export type AdminFabSessionUser = {
  role: string;
  clientStatus?: "PENDING" | "APPROVED" | "REJECTED" | null;
};

/**
 * 쿠키 세션의 `userId`로 사용자 레코드 조회.
 * 개발: 로컬 aggregate `getUserById`, 운영+Firebase: `getUserById` → Firestore (`useFirestoreUsersInProduction` 분기).
 * `/site/mypage` RSC의 `getRequestSessionUser`와 동일한 저장소 경로 — API 라우트에서도 이 함수를 거치도록 한다.
 */
export async function resolveUserForApiBySessionUserId(userId: string): Promise<DevUser | null> {
  return getUserById(userId.trim());
}

/** 요청당 1회 — RSC·레이아웃에서 사용자 조회 중복 방지 */
export const getRequestSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;
  return resolveUserForApiBySessionUserId(session.userId);
});

/** 루트 FAB용 — 로그인 없으면 null, 플랫폼·승인 클라이언트만 FAB에 필요한 필드 */
export async function getAdminFloatingFabSessionUser(): Promise<AdminFabSessionUser | null> {
  const user = await getRequestSessionUser();
  if (!user) return null;
  const headerList = await headers();
  if (user.role === "PLATFORM" && isCaromClubMobileAppShell(headerList)) {
    return null;
  }
  if (user.role === "PLATFORM") {
    return { role: "PLATFORM", clientStatus: null };
  }
  if (user.role === "CLIENT") {
    const st = await getClientStatusByUserId(user.id);
    return { role: "CLIENT", clientStatus: st };
  }
  return { role: user.role, clientStatus: null };
}
