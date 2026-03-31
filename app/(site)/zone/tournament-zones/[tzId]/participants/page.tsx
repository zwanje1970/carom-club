import { ZoneParticipantsClient } from "@/components/zone/ZoneParticipantsClient";

export default async function ZoneTournamentZoneParticipantsPage({
  params,
}: {
  params: Promise<{ tzId: string }>;
}) {
  const { tzId } = await params;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-site-text">참가자</h2>
      <ZoneParticipantsClient tzId={tzId} />
    </div>
  );
}
