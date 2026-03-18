"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { TournamentListRow } from "@/lib/db-tournaments";
import { sanitizeImageSrc } from "@/lib/image-src";
import { formatDistanceKm } from "@/lib/distance";

type TabId = "upcoming" | "closed" | "finished";
type SortId = "distance" | "deadline" | "date";

type TournamentItem = TournamentListRow & { distanceKm?: number | null };

const TABS: { id: TabId; label: string }[] = [
  { id: "upcoming", label: "예정대회" },
  { id: "closed", label: "마감대회" },
  { id: "finished", label: "종료대회" },
];

const SORT_OPTIONS: Record<TabId, { id: SortId; label: string }[]> = {
  upcoming: [
    { id: "distance", label: "거리순" },
    { id: "deadline", label: "마감임박순" },
    { id: "date", label: "날짜순" },
  ],
  closed: [
    { id: "distance", label: "거리순" },
    { id: "date", label: "날짜순" },
  ],
  finished: [
    { id: "distance", label: "거리순" },
    { id: "date", label: "날짜순" },
  ],
};

function formatDate(d: Date | string) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(typeof d === "string" ? new Date(d) : d);
}

export function TournamentsListWithFilters({
  copy,
  useMock,
}: {
  copy: Record<string, string>;
  useMock: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") || "upcoming") as TabId;
  const sortBy = (searchParams.get("sortBy") || (tab === "upcoming" ? "date" : "date")) as SortId;
  const national = searchParams.get("national") === "1";

  const [list, setList] = useState<TournamentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const setParams = useCallback(
    (updates: { tab?: TabId; sortBy?: SortId; national?: boolean }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (updates.tab !== undefined) {
        next.set("tab", updates.tab);
        const sorts = SORT_OPTIONS[updates.tab];
        const currentSort = next.get("sortBy") as SortId;
        if (!sorts.some((s) => s.id === currentSort)) next.set("sortBy", "date");
      }
      if (updates.sortBy !== undefined) next.set("sortBy", updates.sortBy);
      if (updates.national !== undefined) next.set("national", updates.national ? "1" : "0");
      router.push(`/tournaments?${next.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("sortBy", sortBy);
    if (national) params.set("national", "1");
    fetch(`/api/public/tournaments?${params.toString()}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "목록 조회 실패")));
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setList(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "목록을 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, sortBy, national]);

  const sortOptions = SORT_OPTIONS[tab];
  const effectiveSortBy = sortOptions.some((s) => s.id === sortBy) ? sortBy : "date";

  return (
    <div className="mt-8 space-y-4">
      {/* 탭 */}
      <nav className="flex border-b border-site-border" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams({ tab: t.id })}
            className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-site-primary text-site-primary"
                : "border-transparent text-site-text-muted hover:text-site-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* 정렬 + 필터 */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-site-text-muted">정렬</span>
        <select
          value={effectiveSortBy}
          onChange={(e) => setParams({ sortBy: e.target.value as SortId })}
          className="rounded border border-site-border bg-site-card px-3 py-1.5 text-sm text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
        >
          {sortOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-site-text cursor-pointer">
          <input
            type="checkbox"
            checked={national}
            onChange={(e) => setParams({ national: e.target.checked })}
            className="rounded border-site-border text-site-primary focus:ring-site-primary"
          />
          <span>전국대회</span>
        </label>
      </div>

      {loading && <p className="text-sm text-site-text-muted">불러오는 중...</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!loading && !error && list.length === 0 && (
        <div className="rounded-xl border border-site-border bg-site-card p-12 text-center">
          <p className="text-gray-600">{copy["site.tournaments.empty"] ?? "등록된 대회가 없습니다."}</p>
          <p className="mt-2 text-sm text-gray-500">{copy["site.tournaments.emptyHint"] ?? ""}</p>
        </div>
      )}

      {!loading && !error && list.length > 0 && (
        <ul className="space-y-3 sm:grid sm:grid-cols-1 sm:gap-3 md:grid-cols-2">
          {list.map((t) => {
            const max = t.maxParticipants ?? 0;
            const confirmed = t.confirmedCount ?? 0;
            const remaining = max > 0 ? Math.max(0, max - confirmed) : null;
            const almostFull = remaining !== null && remaining > 0 && remaining <= 3;
            const isFull = remaining !== null && remaining <= 0;
            const statusBadge = isFull ? "정원 마감" : almostFull ? `마지막 ${remaining}자리` : null;
            const hasImage = (t.posterImageUrl || t.imageUrl)?.trim();
            return (
              <li key={t.id}>
                <Link
                  href={`/tournaments/${t.id}`}
                  className="block rounded-lg border border-site-border bg-site-card overflow-hidden shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
                >
                  <div
                    className={`relative ${hasImage ? "aspect-[2/1] bg-site-bg" : "min-h-[80px] bg-site-primary/10"} flex flex-col justify-end p-3`}
                  >
                    {(() => {
                      const src = sanitizeImageSrc(hasImage);
                      if (!src) return null;
                      return (
                        <div className="absolute inset-0 flex items-center justify-center min-h-[80px]">
                          <img
                            src={src}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain"
                            data-debug-src={src}
                          />
                        </div>
                      );
                    })()}
                    <div className="relative z-10">
                      <h2 className="font-semibold text-site-text line-clamp-2 text-sm sm:text-base">{t.name}</h2>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-site-text-muted">
                        {t.gameFormat && <span>{t.gameFormat}</span>}
                        {t.prizeInfo && <span>· {t.prizeInfo}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 border-t border-site-border">
                    <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-site-text-muted">
                      <span>{formatDate(t.startAt)}</span>
                      {statusBadge && (
                        <span
                          className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusBadge === "정원 마감"
                              ? "bg-site-bg text-site-text-muted"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                          }`}
                        >
                          {statusBadge}
                        </span>
                      )}
                    </div>
                    {(t.venue || t.organization?.name) && (
                      <p className="mt-1 text-xs text-site-text-muted truncate">
                        {t.venue || t.organization?.name}
                      </p>
                    )}
                    {"distanceKm" in t && t.distanceKm != null && (
                      <p className="mt-1 text-xs text-site-text-muted">
                        {formatDistanceKm(t.distanceKm)}
                      </p>
                    )}
                    {max > 0 && (
                      <p className="mt-1 text-xs font-medium text-site-text">
                        신청 현황 <span className="text-site-primary">{confirmed}</span>/{max}명
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
