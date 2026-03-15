import { mdiTrophy } from "@mdi/js";
import { getSession } from "@/lib/auth";
import { getClientAdminOrganizationId } from "@/lib/auth-org";
import { prisma } from "@/lib/db";
import { normalizeSlugs } from "@/lib/normalize-slug";
import { isPlatformAdmin } from "@/types/auth";
import { MOCK_ORGANIZATIONS_LIST } from "@/lib/mock-data";
import { TournamentNewForm } from "@/components/admin/TournamentNewForm";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminTournamentsNewPage() {
  const session = await getSession();
  if (session && isPlatformAdmin(session)) {
    return (
      <SectionMain>
        <SectionTitleLineWithButton icon={mdiTrophy} title="대회 생성" />
        <CardBox>
          <p className="font-medium text-gray-900 dark:text-slate-100">대회 생성은 클라이언트 관리자 전용 기능입니다.</p>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
            플랫폼 관리자는 대회를 생성·수정할 수 없습니다. 대회 운영은 클라이언트 관리자(/client) 콘솔에서 진행해 주세요.
          </p>
          <p className="mt-4">
            <Button href="/admin" label="대시보드로" color="contrast" outline small />
            <Button href="/admin/tournaments" label="대회 현황" color="info" small className="ml-2" />
          </p>
        </CardBox>
      </SectionMain>
    );
  }

  let organizations: { id: string; name: string; slug: string; type: string; address: string | null }[] = [];
  try {
    const orgs = await prisma.organization.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, type: true, address: true },
    });
    organizations = normalizeSlugs(orgs);
  } catch {
    organizations = normalizeSlugs(
      MOCK_ORGANIZATIONS_LIST.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        type: "CLUB",
        address: null,
      }))
    );
  }

  let isVenueClient = false;
  let readOnlyVenueInfo: { name: string; address: string } | null = null;
  let isLessonClient = false;
  try {
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
