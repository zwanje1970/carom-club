import { notFound } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAdminCopy, getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { prisma } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/db-mode";
import { getMockTournamentById } from "@/lib/mock-data";
import { getDisplayName } from "@/lib/display-name";
import { TournamentDetailView } from "@/components/tournament/TournamentDetailView";
import { STAGE_LABELS } from "@/lib/tournament-stage";
import { getServerTiming, logServerTiming } from "@/lib/perf";

function parseParticipantsListPublic(rule: { bracketConfig?: string | object | null } | null): boolean {
  if (!rule?.bracketConfig) return true;
  try {
    const raw =
      typeof rule.bracketConfig === "string" ? JSON.parse(rule.bracketConfig) : rule.bracketConfig;
    const c = raw as Record<string, unknown>;
    if (typeof c.participantsListPublic === "boolean") return c.participantsListPublic;
  } catch {
    // ignore
  }
  return true;
}

function buildTabs(copy: Record<AdminCopyKey, string>) {
  return [
    { id: "outline", label: "대회요강" },
    { id: "apply", label: "참가신청" },
    { id: "participants", label: "참가자 명단" },
    { id: "results", label: "결과" },
    { id: "inquiry", label: "시합문의" },
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
  let tournament: (TournamentDetail & { matchVenues?: Array<{ displayLabel: string; venueName?: string | null; address?: string | null; phone?: string | null }>; _count?: { tournamentZones: number; finalMatches: number } }) | null = null;
  let useMock = false;

  const dbStart = Date.now();
  if (isDatabaseConfigured()) {
    try {
      tournament = await prisma.tournament.findUnique({
        where: { id },
        include: {
          organization: true,
          rule: true,
          _count: { select: { tournamentZones: true, finalMatches: true } },
          matchVenues: { orderBy: { sortOrder: "asc" } },
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
      } as unknown as TournamentDetail & { matchVenues: [] };
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
    } as unknown as TournamentDetail & { matchVenues: [] };
    useMock = true;
  }
  logServerTiming("db", dbStart);

  if (!tournament) notFound();

  const copyStart = Date.now();
  const [copy, session] = await Promise.all([getAdminCopy(), getSession()]);
  logServerTiming("fetch_copy", copyStart);
  const c = copy as Record<AdminCopyKey, string>;
  const tabs = buildTabs(c);
  const myEntries = session
    ? tournament.entries.filter((e) => e.userId === session.id).map((e) => ({
        id: e.id,
        status: e.status,
        waitingListOrder: e.waitingListOrder,
        paymentMarkedByApplicantAt: e.paymentMarkedByApplicantAt?.toISOString() ?? null,
        slotNumber: e.slotNumber ?? 1,
      }))
    : [];
  const allowMultipleSlots = (() => {
    try {
      const bc = tournament.rule?.bracketConfig;
      const raw = bc == null ? null : typeof bc === "string" ? JSON.parse(bc) : bc;
      return (raw as Record<string, unknown>)?.allowMultipleSlots === true;
    } catch {
      return false;
    }
  })();

  const currentTab = (() => {
    const t = tabs.find((tab) => tab.id === (tabParam ?? "outline"));
    return t ? t.id : "outline";
  })();

  const participantsListPublic = parseParticipantsListPublic(tournament.rule);
  const confirmedCount = tournament.entries.filter((e) => e.status === "CONFIRMED").length;
  const matchVenues = Array.isArray(tournament.matchVenues)
    ? tournament.matchVenues.map((v) => ({
        displayLabel: v.displayLabel,
        venueName: v.venueName,
        address: v.address,
        phone: v.phone,
      }))
    : [];
  logServerTiming("page");

  return (
    <main className="min-h-screen overflow-x-hidden bg-site-bg">
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {useMock && (
          <p className="mb-4 text-center text-sm text-site-primary">DB 없이 미리보기 데이터로 표시 중입니다.</p>
        )}

        <TournamentDetailView
          tournamentId={id}
          tabs={tabs}
          currentTab={currentTab}
          infoEmptyText={getCopyValue(c, "site.tournamentDetail.infoEmpty")}
          participantsListPublic={participantsListPublic}
          tournament={{
            name: tournament.name,
            summary: tournament.summary ?? null,
            description: tournament.description ?? null,
            outlinePublished: tournament.outlinePublished ?? null,
            posterImageUrl: tournament.posterImageUrl ?? null,
            venue: tournament.venue ?? null,
            startAt: tournament.startAt instanceof Date ? tournament.startAt.toISOString() : String(tournament.startAt),
            endAt: tournament.endAt != null ? (tournament.endAt instanceof Date ? tournament.endAt.toISOString() : String(tournament.endAt)) : null,
            gameFormat: tournament.gameFormat ?? null,
            status: tournament.status,
            entryFee: tournament.entryFee ?? tournament.rule?.entryFee ?? null,
            prizeInfo: tournament.prizeInfo ?? null,
            entryCondition: tournament.entryCondition ?? null,
            maxParticipants: tournament.maxParticipants ?? null,
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
          matchVenues={matchVenues}
          confirmedCount={confirmedCount}
          isLoggedIn={!!session}
          myEntries={myEntries}
          allowMultipleSlots={allowMultipleSlots}
          entryFee={tournament.entryFee ?? tournament.rule?.entryFee ?? null}
          entries={tournament.entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            userName: getDisplayName(e.user),
            handicap: e.user.memberProfile?.handicap ?? null,
            avg: e.user.memberProfile?.avg ?? null,
            depositorName: e.depositorName,
            status: e.status,
            waitingListOrder: e.waitingListOrder,
            slotNumber: e.slotNumber ?? 1,
          }))}
        />

        {"tournamentStage" in tournament && tournament._count && (
          <section className="mt-8 rounded-xl border border-site-border bg-site-card p-4">
            <h2 className="text-sm font-semibold text-site-text mb-2">대진 · 결과</h2>
            <p className="text-xs text-site-text-muted mb-3">
              진행 상태: {STAGE_LABELS[(tournament.tournamentStage as keyof typeof STAGE_LABELS) ?? "SETUP"] ?? tournament.tournamentStage ?? "설정"}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/tournaments/${id}/zones`}
                className="inline-flex items-center rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200"
              >
                권역 예선
              </Link>
              {(tournament._count?.finalMatches ?? 0) > 0 && (
                <Link
                  href={`/tournaments/${id}/bracket`}
                  className="inline-flex items-center rounded-lg bg-violet-100 px-3 py-1.5 text-sm font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                >
                  본선 대진표
                </Link>
              )}
              <Link
                href={`/tournaments/${id}/results`}
                className="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              >
                경기 결과
              </Link>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
