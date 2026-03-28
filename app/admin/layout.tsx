import { AdminLayoutServer } from "./AdminLayoutServer";

export const metadata = {
  title: { template: "%s | 캐롬클럽 관리자", default: "캐롬클럽 관리자" },
};

/** 서버에서 항상 세션 검사하므로 캐시 비적용 */
export const dynamic = "force-dynamic";

export default async function AdminLayoutRoot({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutServer>{children}</AdminLayoutServer>;
}
