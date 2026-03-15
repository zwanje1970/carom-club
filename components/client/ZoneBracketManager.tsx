"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ZoneCount = { tournamentZoneId: string; zoneName: string; zoneCode: string | null; count: number };
type TzRow = { id: string; name: string; code: string | null; zoneId: string };

export function ZoneBracketManager({
  tournamentId,
  tournamentZones,
}: {
  tournamentId: string;
  tournamentZones: TzRow[];
}) {
  const router = useRouter();
  const [generating, setGenerating] = useState<string | null>(null);
  const [zoneCounts, setZoneCounts] = useState<ZoneCount[]>([]);
  const [bracketStats, setBracketStats] = useState<Record<string, { total: number; completed: number }>>({});

  useEffect(() => {
    fetch(`/api/admin/tournaments/${tournamentId}/zone-assignments`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.zoneCounts) setZoneCounts(d.zoneCounts);
      });
  }, [tournamentId]);

  useEffect(() => {
    tournamentZones.forEach((tz) => {
      fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tz.id}/bracket`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (d?.stats) {
            setBracketStats((prev) => ({ ...prev, [tz.id]: { total: d.stats.total, completed: d.stats.completed } }));
          }
        });
    });
  }, [tournamentId, tournamentZones]);

  async function generateBracket(tzId: string) {
    setGenerating(tzId);
    try {
      const res = await fetch(`/api/admin/tournaments/${tournamentId}/tournament-zones/${tzId}/bracket`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "대진 생성 실패");
        return;
      }
      setBracketStats((prev) => ({ ...prev, [tzId]: { total: data.matchCount ?? 0, completed: 0 } }));
      router.refresh();
    } finally {
      setGenerating(null);
    }
  }

  if (tournamentZones.length === 0) return null;

  const countByTz = Object.fromEntries(zoneCounts.map((zc) => [zc.tournamentZoneId, zc.count]));

  return (
    <div className="rounded-lg border border-site-border bg-site-card p-6">
      <h2 className="text-lg font-medium text-site-text">권역별 대진표</h2>
      <p className="mt-1 text-sm text-gray-500">
        각 권역에 대해 대진표를 생성하고, 대진표/결과를 확인·입력할 수 있습니다.
      </p>
      <ul className="mt-4 space-y-3">
        {tournamentZones.map((tz) => {
          const participants = countByTz[tz.id] ?? 0;
          const stats = bracketStats[tz.id];
          const hasBracket = stats && stats.total > 0;
          return (
            <li
              key={tz.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded border border-site-border bg-site-bg p-3"
            >
              <div>
                <span className="font-medium text-site-text">{tz.name}</span>
                {tz.code && <span className="ml-2 text-sm text-gray-500">({tz.code})</span>}
                <span className="ml-2 text-sm text-gray-500">참가 {participants}명</span>
                {hasBracket && (
                  <span className="ml-2 text-sm text-green-600">
                    · 경기 {stats.completed}/{stats.total}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {!hasBracket ? (
                  <button
                    type="button"
                    disabled={generating === tz.id || participants < 2}
                    onClick={() => generateBracket(tz.id)}
                    className="rounded-lg bg-site-primary px-3 py-1.5 text-sm text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {generating === tz.id ? "생성 중..." : "대진 생성"}
                  </button>
                ) : (
                  <>
                    <Link
                      href={`/client/tournaments/${tournamentId}/zones/${tz.id}/bracket`}
                      className="rounded-lg border border-site-border px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:hover:bg-slate-800"
                    >
                      대진표 보기
                    </Link>
                    <Link
                      href={`/client/tournaments/${tournamentId}/zones/${tz.id}/results`}
                      className="rounded-lg bg-site-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                    >
                      결과 입력
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
