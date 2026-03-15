import { ZoneBracketClient } from "@/components/zone/ZoneBracketClient";

export default async function ZoneTournamentZoneBracketPage({
  params,
}: {
  params: Promise<{ tzId: string }>;
}) {
  const { tzId } = await params;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-site-text">대진표</h2>
      <ZoneBracketClient tzId={tzId} allowEdit={false} />
    </div>
  );
}
