import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "../auth/session";
import { countUnreadNotificationsByUserId, getUserById } from "./dev-store";

/** 읽지 않은 알림 개수만 반환(목록·내용 조회 없음). 헤더·GET /api/site/notifications/unread-count 공용 */
export async function getSiteUnreadNotificationCount(): Promise<number> {
  const cookieStore = await cookies();
  const session = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return 0;
  const user = await getUserById(session.userId);
  if (!user) return 0;
  return countUnreadNotificationsByUserId(user.id);
}
