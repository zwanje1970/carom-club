import { notFound } from "next/navigation";
import { mdiTrophy } from "@mdi/js";
import { prisma } from "@/lib/db";
import { OutlineEditor } from "@/components/admin/OutlineEditor";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminTournamentOutlinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let tournament: Awaited<
    ReturnType<
      typeof prisma.tournament.findUnique<{
        where: { id: string };
        select: {
          id: true;
          name: true;
          outlineDraft: true;
          outlinePublished: true;
          outlinePublishedAt: true;
        };
      }>
    >
  > | null = null;
  try {
    tournament = await prisma.tournament.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        outlineDraft: true,
        outlinePublished: true,
        outlinePublishedAt: true,
      },
    });
  } catch {
    tournament = {
      id,
      name: "대회 (미리보기)",
      outlineDraft: "",
      outlinePublished: "",
      outlinePublishedAt: null,
    };
  }
  if (!tournament) notFound();

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title="대회요강 편집">
        <Button href={`/admin/tournaments/${id}`} label="← 대회 상세" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-gray-600 dark:text-slate-400">{tournament.name}</p>
      <CardBox>
        <OutlineEditor
          tournamentId={id}
          initialDraft={tournament.outlineDraft ?? ""}
          initialPublished={tournament.outlinePublished ?? ""}
          publishedAt={tournament.outlinePublishedAt?.toISOString() ?? null}
        />
      </CardBox>
    </SectionMain>
  );
}
