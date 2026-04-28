import { getAdminFloatingFabSessionUser } from "../../lib/server/request-session-user";
import AdminDashboardFloatingFab from "./AdminDashboardFloatingFab";

/** `cookies()` 격리 — 이 레이아웃이 적용된 세그먼트만 동적 렌더 */
export default async function AdminFabServerBridge() {
  const initialFabSessionUser = await getAdminFloatingFabSessionUser();
  return <AdminDashboardFloatingFab initialFabSessionUser={initialFabSessionUser} />;
}
