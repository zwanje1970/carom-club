import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedZoneIds } from "@/lib/auth-zone";
import { canViewZone } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import { ZoneDetailTabs } from "@/components/zone/ZoneDetailTabs";

export default async function ZoneDetailPage({
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
  });
  if (!zone) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">{zone.name}</h1>
      {zone.code && (
        <p className="text-sm text-gray-500">코드: {zone.code}</p>
      )}

      <ZoneDetailTabs zoneId={zoneId} />

      <dl className="grid gap-2 rounded-lg border border-site-border bg-site-card p-6 text-sm">
        <dt className="text-gray-500">권역명</dt>
        <dd className="font-medium text-site-text">{zone.name}</dd>
        {zone.code && (
          <>
            <dt className="text-gray-500">코드</dt>
            <dd>{zone.code}</dd>
          </>
        )}
        <dt className="text-gray-500">설명</dt>
        <dd className="text-gray-600">
          이 권역의 참가자·대진표·결과는 위 탭에서 확인·관리할 수 있습니다. 전체 대회 설정·대진 생성은 대회 총관리자(클라이언트 관리자) 전용입니다.
        </dd>
      </dl>
    </div>
  );
}
