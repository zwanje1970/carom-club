import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedZoneIds } from "@/lib/auth-zone";
import { canViewZone, canManageZone } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ZoneDetailTabs } from "@/components/zone/ZoneDetailTabs";

export default async function ZoneResultsPage({
  params,
}: {
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const assignedIds = await getAssignedZoneIds(session);
  if (!assignedIds || !canViewZone(session, zoneId, assignedIds)) notFound();

  const canManage = canManageZone(session, zoneId, assignedIds);

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true, name: true },
  });
  if (!zone) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-site-text">{zone.name} · 결과 관리</h1>
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
          권역별 경기 결과 입력은 대회-권역 연결 후 제공됩니다. 배정된 권역에 한해 결과 입력·진출자 확정이 가능합니다.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          {canManage
            ? "이 권역에 대한 관리 권한이 있습니다. 대회-권역 연결이 완료되면 여기서 경기 결과를 입력할 수 있습니다."
            : "이 권역에 대한 결과 입력 권한이 없습니다."}
        </p>
      </div>
    </div>
  );
}
