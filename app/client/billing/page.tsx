import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import Link from "next/link";
import { ClientBillingSettlementConsole } from "@/components/client/console/ClientBillingSettlementConsole";

export const metadata = {
  title: "대회 정산",
};

export default async function ClientBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;

  const orgId = await getClientAdminOrganizationId(session);
  const sp = await searchParams;

  if (!orgId) {
    return (
      <div className="space-y-4 text-sm">
        <p className="text-zinc-600 dark:text-zinc-400">소속 업체가 없습니다. 클라이언트 신청 승인 후 이용할 수 있습니다.</p>
        <Link
          href="/client/setup"
          className="inline-block rounded-sm border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white dark:border-zinc-400 dark:bg-zinc-200 dark:text-zinc-900"
        >
          업체 설정
        </Link>
      </div>
    );
  }

  return <ClientBillingSettlementConsole initialTournamentId={sp.tournament ?? null} />;
}
