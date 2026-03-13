import { notFound } from "next/navigation";
import { mdiOfficeBuilding } from "@mdi/js";
import { prisma } from "@/lib/db";
import { PromoEditor } from "@/components/admin/PromoEditor";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";

export default async function AdminVenuePromoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let org: Awaited<
    ReturnType<
      typeof prisma.organization.findFirst<{
        where: { id: string; type: "VENUE" };
        select: {
          id: true;
          name: true;
          promoDraft: true;
          promoPublished: true;
          promoPublishedAt: true;
        };
      }>
    >
  > | null = null;
  try {
    org = await prisma.organization.findFirst({
      where: { id, type: "VENUE" },
      select: {
        id: true,
        name: true,
        promoDraft: true,
        promoPublished: true,
        promoPublishedAt: true,
      },
    });
  } catch {
    const { MOCK_VENUES_LIST } = await import("@/lib/mock-data");
    const v = MOCK_VENUES_LIST.find((x) => x.id === id);
    org = v
      ? {
          id: v.id,
          name: v.name,
          promoDraft: null,
          promoPublished: null,
          promoPublishedAt: null,
        }
      : null;
  }
  if (!org) notFound();

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiOfficeBuilding} title="홍보 페이지 편집">
        <Button href={`/admin/venues/${id}`} label="← 당구장 정보" color="contrast" small />
        <Button href="/admin/venues" label="클라이언트 목록" color="contrast" small />
      </SectionTitleLineWithButton>
      <p className="mb-6 text-gray-600 dark:text-slate-400">{org.name}</p>
      <CardBox>
        <PromoEditor
          organizationId={id}
          initialDraft={org.promoDraft ?? ""}
          initialPublished={org.promoPublished ?? ""}
          publishedAt={org.promoPublishedAt?.toISOString() ?? null}
        />
      </CardBox>
    </SectionMain>
  );
}
