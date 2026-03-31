"use client";

import Link from "next/link";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";

/** id 문자열을 0~1 사이 값으로 해시 */
function hashToFloat(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h << 5) - h + id.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) % 1000 / 1000;
}

/** 파스텔 톤 배경색 (검은색·흰색 제외): hsl 기준 밝은 색 */
function pastelBg(id: string): string {
  const h = hashToFloat(id) * 360;
  const s = 45 + hashToFloat(id + "s") * 25;
  const l = 82 + hashToFloat(id + "l") * 12;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

type TournamentRow = {
  id: string;
  name: string;
  startAt: Date;
  maxParticipants: number | null;
  organization: { name: string } | null;
  _count: { entries: number };
  confirmedCount: number;
};

export function ClientTournamentCards({ tournaments }: { tournaments: TournamentRow[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((t) => {
        const max = t.maxParticipants ?? 0;
        const confirmed = t.confirmedCount ?? 0;
        return (
          <Link
            key={t.id}
            href={`/client/tournaments/${t.id}`}
            className="block rounded-lg border border-site-border overflow-hidden bg-white shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
          >
            {/* 상단: 랜덤 파스텔 배경, 대회명, 날짜 */}
            <div
              className="p-4 min-h-[100px] flex flex-col justify-end text-site-text"
              style={{ backgroundColor: pastelBg(t.id) }}
            >
              <h2 className="font-semibold line-clamp-2 text-base">{t.name}</h2>
              <p className="mt-1.5 text-sm opacity-90">{formatKoreanDateWithWeekday(t.startAt)}</p>
            </div>
            {/* 하단: 흰 배경, 좌 당구장명 / 우 신청현황 */}
            <div className="flex items-center justify-between gap-3 p-3 bg-white border-t border-site-border">
              <span className="text-sm text-site-text-muted truncate">
                {t.organization?.name ?? "—"}
              </span>
              <span className="text-sm font-medium text-site-text shrink-0">
                신청 {confirmed}{max > 0 ? `/${max}` : ""}명
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
