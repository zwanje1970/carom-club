import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getMockTournamentById } from "@/lib/mock-data";
import { getDisplayName } from "@/lib/display-name";
import { TournamentDetailTabs } from "@/components/tournament/TournamentDetailTabs";

function buildTabs(copy: Record<AdminCopyKey, string>) {
  return [
    { id: "info", label: getCopyValue(copy, "site.tournamentDetail.tabInfo") },
    { id: "outline", label: "대회요강" },
    { id: "apply", label: "참가신청" },
    { id: "participants", label: "참가자 명단" },
    { id: "inquiry", label: "시합문의" },
    { id: "results", label: "결과" },
  ] as const;
}

export default async function TournamentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;

  type TournamentDetail = Awaited<
    ReturnType<
      typeof prisma.tournament.findUnique<{
        where: { id: string };
        include: {
          organization: true;
          rule: true;
          entries: {
            include: { user: { include: { memberProfile: true } } };
            orderBy: [{ status: "asc" }, { createdAt: "asc" }];
          };
        };
      }>
    >
  >;
  let tournament: TournamentDetail | null = null;
  let useMock = false;

  if (isDatabaseConfigured()) {
    try {
      tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          organization: true,
          rule: true,
          entries: {
            include: { user: { include: { memberProfile: true } } },
            orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          },
        },
      });
    } catch {
      const mock = getMockTournamentById(id);
      tournament = {
        id: mock.id,
        name: mock.name,
        description: mock.description,
        outlinePublished: mock.outlinePublished,
        venue: mock.venue,
        startAt: mock.startAt,
        endAt: mock.endAt ?? null,
        gameFormat: mock.gameFormat,
        status: mock.status,
        organizationId: mock.organization.id,
        organization: mock.organization,
        rule: mock.rule,
        entries: [],
      } as unknown as TournamentDetail;
      useMock = true;
    }
  } else {
    const mock = getMockTournamentById(id);
    tournament = {
      id: mock.id,
      name: mock.name,
      description: mock.description,
      outlinePublished: mock.outlinePublished,
      venue: mock.venue,
      startAt: mock.startAt,
      endAt: mock.endAt ?? null,
      gameFormat: mock.gameFormat,
      status: mock.status,
      organizationId: mock.organization.id,
      organization: mock.organization,
      rule: mock.rule,
      entries: [],
    } as unknown as TournamentDetail;
    useMock = true;
  }

  if (!tournament) notFound();

  const copy = await getAdminCopy();
  const c = copy as Record<AdminCopyKey, string>;
  const tabs = buildTabs(c);
  const session = await getSession();
  const myEntry = session
    ? tournament.entries.find((e) => e.userId === session.id)
    : null;

  const currentTab = tabs.find((t) => t.id === (tabParam ?? "info"))?.id ?? "info";

  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
        {useMock && (
          <p className="mb-2 text-center text-sm text-site-primary">DB 없이 미리보기 데이터로 표시 중입니다.</p>
        )}
        <Link href="/tournaments" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-block">
          ← 대회 목록
        </Link>
        <h1 className="text-2xl font-bold mb-2">{tournament.name}</h1>
        <p className="text-gray-600 text-sm mb-6">
          {new Date(tournament.startAt).toLocaleString("ko-KR")}
          {tournament.venue && ` · ${tournament.venue}`}
        </p>

        <TournamentDetailTabs
          tabs={tabs}
          currentTab={currentTab}
          tournamentId={id}
          infoEmptyText={getCopyValue(c, "site.tournamentDetail.infoEmpty")}
          tournament={{
            name: tournament.name,
            description: tournament.description,
            outlinePublished: tournament.outlinePublished,
            venue: tournament.venue,
            startAt: tournament.startAt instanceof Date ? tournament.startAt.toISOString() : String(tournament.startAt),
            gameFormat: tournament.gameFormat,
            status: tournament.status,
            rule: tournament.rule
              ? {
                  entryFee: tournament.rule.entryFee,
                  operatingFee: tournament.rule.operatingFee,
                  maxEntries: tournament.rule.maxEntries,
                  useWaiting: tournament.rule.useWaiting,
                  entryConditions: tournament.rule.entryConditions,
                }
              : null,
          }}
          isLoggedIn={!!session}
          myEntry={myEntry ? { id: myEntry.id, status: myEntry.status, waitingListOrder: myEntry.waitingListOrder } : null}
          entries={tournament.entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            userName: getDisplayName(e.user),
            handicap: e.user.memberProfile?.handicap ?? null,
            avg: e.user.memberProfile?.avg ?? null,
            depositorName: e.depositorName,
            status: e.status,
            waitingListOrder: e.waitingListOrder,
          }))}
        />
      </div>
    </main>
  );
}
