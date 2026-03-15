"use client";

import { useEffect, useState } from "react";

type Participant = {
  entryId: string;
  userId: string;
  userName: string;
  handicap: string | null;
  avg: string | null;
  status: string;
};

type Data = {
  tournamentZone: { id: string; name: string; code: string | null; tournamentId: string; tournamentName: string };
  participants: Participant[];
  count: number;
};

export function ZoneParticipantsClient({ tzId }: { tzId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/zone/tournament-zones/${tzId}/participants`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [tzId]);

  if (loading) return <p className="text-sm text-gray-500">불러오는 중...</p>;
  if (!data) return <p className="text-sm text-gray-500">데이터를 불러올 수 없습니다.</p>;

  return (
    <div className="rounded-lg border border-site-border bg-site-card overflow-hidden">
      <p className="p-3 text-sm text-gray-500 border-b border-site-border">
        {data.tournamentZone.tournamentName} · {data.tournamentZone.name} — {data.count}명
      </p>
      {data.participants.length === 0 ? (
        <p className="p-6 text-center text-gray-500">참가자가 없습니다.</p>
      ) : (
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 dark:bg-slate-800/50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-site-text">이름</th>
              <th className="px-4 py-2 text-left font-medium text-site-text">핸디</th>
              <th className="px-4 py-2 text-left font-medium text-site-text">AVG</th>
              <th className="px-4 py-2 text-left font-medium text-site-text">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-site-border">
            {data.participants.map((p) => (
              <tr key={p.entryId}>
                <td className="px-4 py-2 font-medium">{p.userName}</td>
                <td className="px-4 py-2 text-gray-600">{p.handicap ?? "-"}</td>
                <td className="px-4 py-2 text-gray-600">{p.avg ?? "-"}</td>
                <td className="px-4 py-2">{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
