import { mdiTrophy } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/lib/permissions";
import type { TournamentForEdit } from "@/lib/db-tournaments";
import { TournamentEditForm } from "@/components/admin/tournament/TournamentEditForm";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { ClientOnlyBlock } from "@/components/admin/ClientOnlyBlock";

export default async function AdminTournamentEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session && isPlatformAdmin(session)) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiTrophy} title="대회 설정 수정" />
        <ClientOnlyBlock title="대회 수정은 클라이언트 관리자 전용입니다" backHref="/admin/tournaments" backLabel="대회 현황" />
      </SectionMain>
    );
  }

  const { id } = await params;
  let tournament: TournamentForEdit | null = null;
  try {
    tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        organization: true,
        rule: true,
        _count: { select: { entries: true } },
        tournamentVenues: {
          orderBy: { sortOrder: "asc" },
          include: { organization: { select: { id: true, name: true } } },
        },
      },
    });
  } catch {
    // DB 없을 때 화면만 표시하려면 mock 사용 가능. 여기서는 안내만 표시.
  }
  if (!tournament) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiTrophy} title="대회 설정 수정">
          <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" small />
        </SectionTitleLineWithButton>
        <CardBox>
          <p className="text-gray-600 dark:text-slate-400">
            데이터베이스 연결이 필요합니다. Neon 연결 후 다시 시도해 주세요.
          </p>
        </CardBox>
      </SectionMain>
    );
  }

  let confirmedCount = 0;
  try {
    confirmedCount = await prisma.tournamentEntry.count({
      where: {
        tournamentId: id,
        status: "CONFIRMED",
      },
    });
  } catch {
    confirmedCount = 0;
  }

  const entryFee = tournament.rule?.entryFee ?? 0;
  const operatingFeePerEntry = tournament.rule?.operatingFee ?? 0;
  const totalEntryFee = confirmedCount * entryFee;
  const totalOperatingFee = confirmedCount * operatingFeePerEntry;
  const prizeInfo = tournament.rule?.prizeInfo
    ? (JSON.parse(tournament.rule.prizeInfo) as Record<string, unknown>)
    : null;
  const totalPrize = prizeInfo?.ranks
    ? (prizeInfo.ranks as { amount?: number }[]).reduce((s, r) => s + (r.amount ?? 0), 0)
    : 0;

  const isVenueClient = tournament.organization.type === "VENUE";
  const readOnlyVenueInfo =
    isVenueClient && tournament.organization
      ? {
          name: tournament.organization.name,
          address: tournament.organization.address ?? "",
        }
      : null;

  let venueOrganizations: { id: string; name: string }[] = [];
  try {
    venueOrganizations = await prisma.organization.findMany({
      where: { type: "VENUE" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {
    venueOrganizations = [];
  }

  const initialTournamentVenues = tournament.tournamentVenues.map((tv) => ({
    id: tv.id,
    organizationId: tv.organizationId,
    organization: tv.organization,
  }));

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title="대회 설정 수정">
        <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" small />
      </SectionTitleLineWithButton>
      <CardBox>
        <TournamentEditForm
          tournamentId={id}
          initialBasic={{
            name: tournament.name,
            startAt: tournament.startAt.toISOString().slice(0, 16),
            venue: tournament.venue ?? (readOnlyVenueInfo?.address ?? ""),
            venueName: tournament.venueName ?? (readOnlyVenueInfo?.name ?? ""),
            status: tournament.status,
            gameFormat: tournament.gameFormat ?? "",
          }}
          isVenueClient={isVenueClient}
          readOnlyVenueInfo={readOnlyVenueInfo}
          initialTournamentVenues={initialTournamentVenues}
          venueOrganizations={venueOrganizations}
          initialEntry={{
            entryFee: tournament.rule?.entryFee ?? "",
            operatingFee: tournament.rule?.operatingFee ?? "",
            maxEntries: tournament.rule?.maxEntries ?? "",
            useWaiting: tournament.rule?.useWaiting ?? false,
            entryConditions: tournament.rule?.entryConditions ?? "",
          }}
          initialBracket={{
            gameFormatMain:
              (tournament.rule?.bracketConfig as { gameFormatMain?: string })?.gameFormatMain ??
              (tournament.rule?.bracketType ?? ""),
            tableCount:
              (tournament.rule?.bracketConfig as { tableCount?: number })?.tableCount ?? "",
            maxPerGroup:
              (tournament.rule?.bracketConfig as { maxPerGroup?: number })?.maxPerGroup ?? "",
            finalistCount:
              (tournament.rule?.bracketConfig as { finalistCount?: number })?.finalistCount ?? "",
            noRematch:
              (tournament.rule?.bracketConfig as { noRematch?: boolean })?.noRematch ?? false,
            detailFormat:
              (tournament.rule?.bracketConfig as { detailFormat?: string })?.detailFormat ?? "",
          }}
          initialPrize={parsePrizeFromRule(tournament.rule)}
          financeSummary={{
            totalEntryFee,
            totalPrize,
            operatingFee: totalOperatingFee,
            confirmedCount,
          }}
        />
      </CardBox>
    </SectionMain>
  );
}

type PrizeSettingsInit = {
  prizeType: string;
  fixed: { ranks: { rank: number; amount: number }[] };
  ratio: {
    entryFee: number;
    operatingFee: number;
    ranks: { rank: number; percent: number }[];
  };
  score: Record<string, unknown>;
};

function parsePrizeFromRule(rule: {
  prizeType?: string | null;
  prizeInfo?: string | null;
} | null): PrizeSettingsInit {
  const defaultFixed = {
    ranks: [
      { rank: 1, amount: 0 },
      { rank: 2, amount: 0 },
      { rank: 3, amount: 0 },
    ],
  };
  const defaultRatio = {
    entryFee: 0,
    operatingFee: 0,
    ranks: [
      { rank: 1, percent: 50 },
      { rank: 2, percent: 30 },
      { rank: 3, percent: 20 },
    ],
  };
  if (!rule) {
    return { prizeType: "", fixed: defaultFixed, ratio: defaultRatio, score: {} };
  }
  const info = rule.prizeInfo ? (JSON.parse(rule.prizeInfo) as Record<string, unknown>) : {};
  return {
    prizeType: rule.prizeType ?? "",
    fixed: info.ranks ? { ranks: info.ranks as { rank: number; amount: number }[] } : defaultFixed,
    ratio:
      info.entryFee !== undefined
        ? {
            entryFee: info.entryFee as number,
            operatingFee: info.operatingFee as number,
            ranks: (info.ranks as { rank: number; percent: number }[]) ?? [],
          }
        : defaultRatio,
    score: rule.prizeType === "score_proportional" ? info : {},
  };
}
