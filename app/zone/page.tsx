import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getAssignedTournamentZones } from "@/lib/auth-zone";

export default async function ZoneDashboardPage() {
  const session = await getSession();
  if (!session || session.role !== "ZONE_MANAGER") return null;

  const tournamentZones = await getAssignedTournamentZones(session);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-site-text">내가 맡은 권역</h1>
      <p className="text-sm text-gray-600">
        대회별로 배정된 권역만 조회·관리할 수 있습니다. 참가자, 대진표, 결과 입력은 각 권역 상세에서 진행하세요.
      </p>

      {tournamentZones.length === 0 ? (
        <div className="rounded-lg border border-site-border bg-site-card p-8 text-center">
          <p className="text-gray-600">배정된 대회 권역이 없습니다.</p>
          <p className="mt-2 text-sm text-gray-500">
            대회 총관리자(클라이언트 관리자)가 부/권역 설정에서 권역을 연결하고, 공동관리자/권역 관리자로 귀하를 배정하면 여기에 표시됩니다.
          </p>
          <Link href="/" className="mt-6 inline-block text-site-primary hover:underline">
            메인으로
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {tournamentZones.map((tz) => (
            <li
              key={tz.tournamentZoneId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-site-border bg-site-card p-4"
            >
              <div>
                <span className="font-medium text-site-text">{tz.tournamentName}</span>
                <span className="mx-2 text-gray-400">·</span>
                <span className="font-medium text-site-text">{tz.zoneName}</span>
                {tz.zoneCode && (
                  <span className="ml-2 text-sm text-gray-500">({tz.zoneCode})</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/zone/tournament-zones/${tz.tournamentZoneId}`}
                  className="rounded-lg border border-site-border px-3 py-1.5 text-sm font-medium hover:bg-site-bg"
                >
                  권역 상세
                </Link>
                <Link
                  href={`/zone/tournament-zones/${tz.tournamentZoneId}/participants`}
                  className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  참가자
                </Link>
                <Link
                  href={`/zone/tournament-zones/${tz.tournamentZoneId}/bracket`}
                  className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  대진표
                </Link>
                <Link
                  href={`/zone/tournament-zones/${tz.tournamentZoneId}/results`}
                  className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  결과 입력
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
