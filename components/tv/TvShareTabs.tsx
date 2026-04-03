"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type ZoneItem = {
  id: string;
  name: string;
  code: string | null;
};

export function TvShareTabs({
  token,
  tournamentName,
  zones,
}: {
  token: string;
  tournamentName: string;
  zones: ZoneItem[];
}) {
  const pathname = usePathname() ?? "";
  const overviewHref = `/tv/share/${token}/overview`;
  const bracketHref = `/tv/share/${token}/bracket`;
  const zoneHref = zones[0] ? `/tv/share/${token}/zones/${zones[0].id}` : null;

  const baseTabClass =
    "rounded-full px-4 py-2 text-sm font-semibold transition border";
  const activeClass = "border-cyan-300 bg-cyan-400/15 text-cyan-200";
  const inactiveClass = "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10";

  const isOverviewActive = pathname === overviewHref;
  const isBracketActive = pathname === bracketHref;
  const isZoneActive = pathname.startsWith(`/tv/share/${token}/zones/`);

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-4 px-5 py-4 md:px-8">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-300">TV SHARE</p>
            <h1 className="text-2xl font-black md:text-3xl">{tournamentName}</h1>
          </div>
          <p className="text-sm text-slate-400">탭으로 개요 / 대진표 / 권역 화면을 전환할 수 있습니다.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={overviewHref} className={`${baseTabClass} ${isOverviewActive ? activeClass : inactiveClass}`}>
            개요
          </Link>
          <Link href={bracketHref} className={`${baseTabClass} ${isBracketActive ? activeClass : inactiveClass}`}>
            대진표
          </Link>
          {zoneHref ? (
            <Link href={zoneHref} className={`${baseTabClass} ${isZoneActive ? activeClass : inactiveClass}`}>
              권역
            </Link>
          ) : (
            <span className={`${baseTabClass} border-dashed border-white/10 bg-white/5 text-slate-500`}>권역 없음</span>
          )}
        </div>

        {zones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {zones.map((zone) => {
              const href = `/tv/share/${token}/zones/${zone.id}`;
              const active = pathname === href;
              return (
                <Link
                  key={zone.id}
                  href={href}
                  className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "border-amber-300 bg-amber-400/15 text-amber-100"
                      : "border-white/10 bg-white/5 text-slate-300 hover:border-white/25 hover:bg-white/10"
                  }`}
                >
                  {zone.name}
                  {zone.code ? <span className="ml-1 text-xs text-slate-400">{zone.code}</span> : null}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
