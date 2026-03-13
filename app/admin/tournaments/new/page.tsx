import { mdiTrophy } from "@mdi/js";
import { prisma } from "@/lib/db";
import { MOCK_ORGANIZATIONS_LIST } from "@/lib/mock-data";
import { TournamentNewForm } from "@/components/admin/TournamentNewForm";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";

export default async function AdminTournamentsNewPage() {
  let organizations: Awaited<
    ReturnType<typeof prisma.organization.findMany<{ orderBy: { name: "asc" } }>>
  > = [];
  try {
    organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
    });
  } catch {
    organizations = MOCK_ORGANIZATIONS_LIST.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: "CLUB" as const,
      description: null,
      promoDraft: null,
      promoPublished: null,
      promoPublishedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as typeof organizations;
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title="대회 생성" />
      <CardBox>
        <TournamentNewForm organizations={organizations} />
      </CardBox>
    </SectionMain>
  );
}
