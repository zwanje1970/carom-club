import { ZoneBracketClient } from "@/components/zone/ZoneBracketClient";

export default async function ZoneTournamentZoneResultsPage({
  params,
}: {
  params: Promise<{ tzId: string }>;
}) {
  const { tzId } = await params;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-site-text">결과 입력</h2>
      <p className="text-sm text-gray-500">경기 결과(점수·승자)를 입력하면 다음 라운드에 자동 반영됩니다.</p>
      <ZoneBracketClient tzId={tzId} allowEdit={true} />
    </div>
  );
}
