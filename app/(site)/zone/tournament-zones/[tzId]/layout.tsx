import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAssignedTournamentZones } from "@/lib/auth-zone";
import { ZoneTournamentZoneTabs } from "@/components/zone/ZoneTournamentZoneTabs";

export default async function ZoneTournamentZoneLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tzId: string }>;
}) {
  const { tzId } = await params;
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const list = await getAssignedTournamentZones(session);
  const tz = list.find((t) => t.tournamentZoneId === tzId);
  if (!tz) notFound();

  return (
    <div className="space-y-4">
      <ZoneTournamentZoneTabs tzId={tzId} />
      {children}
    </div>
  );
}
