import { ClientLayoutServer } from "./ClientLayoutServer";

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
  return <ClientLayoutServer>{children}</ClientLayoutServer>;
}
