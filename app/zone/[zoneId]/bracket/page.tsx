import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedZoneIds } from "@/lib/auth-zone";
import { canViewZone } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ZoneDetailTabs } from "@/components/zone/ZoneDetailTabs";

export default async function ZoneBracketPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const assignedIds = await getAssignedZoneIds(session);
  if (!assignedIds || !canViewZone(session, zoneId, assignedIds)) notFound();

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  });
  if (!zone) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">{zone.name} · 대진표</h1>
        <Link
          href={`/zone/${zoneId}`}
          className="rounded-lg border border-site-border px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
        >
          권역 정보로
        </Link>
      </div>

      <ZoneDetailTabs zoneId={zoneId} />

      <div className="rounded-lg border border-site-border bg-site-card p-6">
        <p className="text-gray-600">
          권역별 대진표 조회는 대회-권역 연결 후 제공됩니다. 현재는 대회 단위로만 대진이 생성·관리됩니다.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          대회 총관리자가 대진을 생성한 뒤 권역별로 구간이 나뉘면, 여기서 본인 권역 대진표만 볼 수 있습니다. 다른 권역 대진표나 전체 브래킷 수정은 할 수 없습니다.
        </p>
      </div>
    </div>
  );
}
