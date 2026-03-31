import Link from "next/link";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedZoneIds } from "@/lib/auth-zone";
import { canViewZone } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ZoneDetailTabs } from "@/components/zone/ZoneDetailTabs";

export default async function ZoneParticipantsPage({
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
        <h1 className="text-2xl font-bold text-site-text">{zone.name} · 참가자</h1>
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
          권역별 참가자 목록은 대회-권역 연결 후 제공됩니다. 현재는 대회 단위로만 참가자가 관리됩니다.
        </p>
        <p className="mt-2 text-sm text-gray-500">
          대회 총관리자(클라이언트 관리자)가 권역을 대회에 연결하고 참가자를 권역에 배정하면, 여기서 해당 권역 참가자만 조회·출석 확인할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
