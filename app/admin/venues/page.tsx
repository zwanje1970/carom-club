import { mdiOfficeBuilding } from "@mdi/js";
import { prisma } from "@/lib/db";
import { normalizeSlugs } from "@/lib/normalize-slug";
import { MOCK_VENUES_LIST } from "@/lib/mock-data";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import VenueListTable from "./VenueListTable";

const CLIENT_TYPES = ["VENUE", "CLUB", "FEDERATION", "INSTRUCTOR"] as const;

export type ClientListRow = {
  id: string;
  name: string;
  slug: string;
  type: string;
  status: string;
  adminRemarks: string | null;
  createdAt: Date;
  applicationCreatedAt: Date | null;
};

export default async function AdminVenuesPage() {
  let rows: ClientListRow[] = [];
  try {
    const [orgs, applications] = await Promise.all([
      prisma.organization.findMany({
        where: { type: { in: [...CLIENT_TYPES] } },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          slug: true,
          type: true,
          ownerUserId: true,
          status: true,
          adminRemarks: true,
          createdAt: true,
        },
      }),
      prisma.clientApplication.findMany({
        where: { status: "APPROVED" },
        select: { applicantUserId: true, organizationName: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const appMap = new Map<string, Date>();
    for (const app of applications) {
      if (!app.applicantUserId) continue;
      const key = `${app.applicantUserId}:${app.organizationName.trim().toLowerCase()}`;
      if (!appMap.has(key)) appMap.set(key, app.createdAt);
    }

    rows = normalizeSlugs(
      orgs.map((org) => {
        const key = org.ownerUserId
          ? `${org.ownerUserId}:${org.name.trim().toLowerCase()}`
          : "";
        return {
          id: org.id,
          name: org.name,
          slug: org.slug,
          type: org.type,
          status: (org as { status?: string }).status ?? "ACTIVE",
          adminRemarks: (org as { adminRemarks?: string | null }).adminRemarks ?? null,
          createdAt: org.createdAt,
          applicationCreatedAt: key ? appMap.get(key) ?? null : null,
        };
      })
    );
  } catch {
    try {
      const orgRows = await prisma.$queryRawUnsafe<
        { id: string; name: string; slug: string | null; type: string; ownerUserId: string | null; createdAt: Date }[]
      >(
        `SELECT id, name, slug, type, "ownerUserId", "createdAt" FROM "Organization" WHERE type IN ('VENUE','CLUB','FEDERATION','INSTRUCTOR') ORDER BY "createdAt" DESC`
      );
      rows = normalizeSlugs(
        orgRows.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
          type: o.type,
          status: "ACTIVE",
          adminRemarks: null as string | null,
          createdAt: o.createdAt,
          applicationCreatedAt: null,
        }))
      );
    } catch {
      rows = normalizeSlugs(
        (MOCK_VENUES_LIST as { id: string; name: string; slug: string }[]).map((v) => ({
          id: v.id,
          name: v.name,
          slug: v.slug,
          type: "VENUE",
          status: "ACTIVE",
          adminRemarks: null,
          createdAt: new Date(),
          applicationCreatedAt: null,
        }))
      );
    }
  }

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiOfficeBuilding} title="클라이언트 목록" />

      <CardBox hasTable>
        <VenueListTable rows={rows} />
      </CardBox>
    </SectionMain>
  );
}
