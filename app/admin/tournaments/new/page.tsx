import { mdiTrophy } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { isPlatformAdmin } from "@/types/auth";
import { MOCK_ORGANIZATIONS_LIST } from "@/lib/mock-data";
import { TournamentNewForm } from "@/components/admin/TournamentNewForm";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminTournamentsNewPage() {
  let organizations: { id: string; name: string; slug: string; type: string; address: string | null }[] = [];
  try {
    organizations = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, type: true, address: true },
    });
  } catch {
    organizations = MOCK_ORGANIZATIONS_LIST.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      type: "CLUB",
      address: null,
    }));
  }

  let isVenueClient = false;
  let readOnlyVenueInfo: { name: string; address: string } | null = null;
  let isLessonClient = false;
  try {
    const session = await getSession();
    if (session && !isPlatformAdmin(session)) {
      const orgId = await getClientAdminOrganizationId(session);
      if (orgId) {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { type: true, name: true, address: true },
        });
        if (org?.type === "INSTRUCTOR") {
          isLessonClient = true;
        } else if (org?.type === "VENUE") {
          isVenueClient = true;
          readOnlyVenueInfo = {
            name: org.name,
            address: org.address ?? "",
          };
        }
      }
    }
  } catch {
    // ignore
  }

  if (isLessonClient) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiTrophy} title="대회 생성" />
        <CardBox>
          <p className="text-gray-600 dark:text-slate-400">
            레슨 클라이언트는 대회 등록이 불가합니다.
          </p>
          <p className="mt-2">
            <Button href="/admin/tournaments" label="← 대회 목록" color="contrast" outline small />
          </p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiTrophy} title="대회 생성" />
      <CardBox>
        <TournamentNewForm
          organizations={organizations}
          isVenueClient={isVenueClient}
          readOnlyVenueInfo={readOnlyVenueInfo}
        />
      </CardBox>
    </SectionMain>
  );
}
