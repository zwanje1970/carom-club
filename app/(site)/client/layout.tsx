import { ClientLayoutServer } from "./ClientLayoutServer";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessClientDashboard } from "@/types/auth";

export const metadata = {
  title: { template: "%s | 대회 운영 콘솔", default: "캐롬클럽 대회 운영 콘솔" },
};

/** 서버 세션·권한 — 캐시와 맞지 않음 */
export const dynamic = "force-dynamic";

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!canAccessClientDashboard(session)) {
    redirect("/mypage");
  }
  return <ClientLayoutServer>{children}</ClientLayoutServer>;
}
