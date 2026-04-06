import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { ClientBillingSettlementConsole } from "@/components/client/console/ClientBillingSettlementConsole";
import { isAnnualMembershipVisible } from "@/lib/site-feature-flags";

export const metadata = {
  title: "정산",
};

export default async function ClientTournamentSettlementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "CLIENT_ADMIN") return null;
  const showPlatformBillingLink = await isAnnualMembershipVisible();

  const orgId = await getClientAdminOrganizationId(session);
  if (!orgId) {
    redirect("/client/setup");
  }

  const { id } = await params;
  const base = `/client/tournaments/${id}`;
  const tabs = [
    { href: "", label: "대회현황" },
    { href: "/edit", label: "대회수정" },
    { href: "/participants", label: "참가자" },
    { href: "/bracket", label: "대진표" },
    { href: "/card-publish", label: "카드발행" },
    { href: "/settlement", label: "정산" },
    { href: "/outline", label: "대회요강" },
    { href: "/zones", label: "경기장" },
    { href: "/results", label: "결과" },
    { href: "/co-admins", label: "공동관리자" },
    { href: "/promo", label: "홍보페이지" },
  ] as const;
  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => (
          <Link
            key={tab.href || "base"}
            href={tab.href ? `${base}${tab.href}` : base}
            className={`inline-flex min-h-[36px] items-center rounded-md px-2.5 text-[11px] font-semibold ${tab.href === "/settlement" ? "border border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"}`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <ClientBillingSettlementConsole
        initialTournamentId={id}
        fixedTournamentId={id}
        showPlatformBillingLink={showPlatformBillingLink}
      />
    </div>
  );
}
