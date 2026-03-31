import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedZoneIds } from "@/lib/auth-zone";
import { canViewZone } from "@/lib/permissions";
import { prisma } from "@/lib/db";

export default async function ZoneIdLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ zoneId: string }>;
}) {
  const { zoneId } = await params;
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const assignedIds = await getAssignedZoneIds(session);
  if (!assignedIds || !canViewZone(session, zoneId, assignedIds)) notFound();

  const zone = await prisma.zone.findUnique({
    where: { id: zoneId },
    select: { id: true },
  });
  if (!zone) notFound();

  return <>{children}</>;
}
