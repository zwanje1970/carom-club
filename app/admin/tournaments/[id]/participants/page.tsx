import { notFound } from "next/navigation";
import { mdiAccountGroup } from "@mdi/js";
import { prisma } from "@/lib/db";
import { getDisplayName } from "@/lib/display-name";
import { ParticipantsTable } from "@/components/admin/ParticipantsTable";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminTournamentParticipantsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  type TournamentWithEntries = Awaited<
    ReturnType<
      typeof prisma.tournament.findUnique<{
        where: { id: string };
        include: {
          entries: {
            include: { user: { include: { memberProfile: true } }; attendances: true };
            orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }];
          };
        };
      }>
    >
  >;
  let tournament: TournamentWithEntries | null = null;
  try {
    tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        entries: {
          include: {
            user: { include: { memberProfile: true } },
            attendances: true,
          },
          orderBy: [{ status: "asc" }, { waitingListOrder: "asc" }, { createdAt: "asc" }],
        },
      },
    });
  } catch {
    tournament = { id, name: "대회 (미리보기)", entries: [] } as unknown as TournamentWithEntries;
  }
  if (!tournament) notFound();

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiAccountGroup} title="참가자 관리">
        <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-gray-600 dark:text-slate-400">{tournament.name}</p>
      <CardBox hasTable>
        <ParticipantsTable
          tournamentId={id}
          entries={tournament.entries.map((e) => ({
            id: e.id,
            userId: e.userId,
            userName: getDisplayName(e.user),
            userPhone: e.user.phone ?? null,
            handicap: e.user.memberProfile?.handicap ?? null,
            avg: e.user.memberProfile?.avg ?? null,
            depositorName: e.depositorName,
            status: e.status,
            waitingListOrder: e.waitingListOrder,
            paidAt: e.paidAt?.toISOString() ?? null,
            attended: e.attendances[0]?.attended ?? null,
          }))}
        />
      </CardBox>
    </SectionMain>
  );
}
