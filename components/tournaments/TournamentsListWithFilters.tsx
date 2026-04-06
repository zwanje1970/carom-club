"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicTournamentListRow } from "@/lib/db-tournaments";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import { PUBLIC_TOURNAMENTS_PAGE_SIZE } from "@/lib/public-tournaments-list-request";

type TabId = "upcoming" | "closed" | "finished";
type SortId = "distance" | "deadline" | "date";

type TournamentItem = PublicTournamentListRow;

function getTournamentStatusLabel(status: string): string {
  if (status === "OPEN") return "모집중";
  if (status === "CLOSED" || status === "BRACKET_GENERATED") return "마감";
  if (status === "FINISHED") return "종료";
  return "진행중";
}

const TournamentListCard = memo(function TournamentListCard({
  t,
}: {
  t: TournamentItem;
}) {
  return (
    <li>
      <Link
        href={`/tournaments/${t.id}`}
        className="block rounded-lg border border-site-border bg-site-card p-3 shadow-sm transition hover:border-site-primary/40 hover:shadow-md"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-semibold text-site-text line-clamp-2 text-sm sm:text-base">
              {t.name}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-site-text-muted">
              <span>{formatKoreanDateWithWeekday(t.startAt)}</span>
              {t.venue ? <span>· {t.venue}</span> : null}
            </div>
          </div>
          <span className="shrink-0 inline-flex rounded-full bg-site-bg px-2.5 py-1 text-xs font-medium text-site-text-muted">
            {getTournamentStatusLabel(t.status)}
          </span>
        </div>
      </Link>
    </li>
  );
});

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

function normalizeTournamentItem(r: TournamentItem): TournamentItem {
  return {
    ...r,
    startAt: typeof r.startAt === "string" ? new Date(r.startAt) : r.startAt,
    endAt: r.endAt ? (typeof r.endAt === "string" ? new Date(r.endAt) : r.endAt) : null,
  };
}

function parseListResponse(data: unknown): { rows: TournamentItem[]; hasMore: boolean } {
  if (Array.isArray(data)) {
    return {
      rows: data as TournamentItem[],
      hasMore: data.length === PUBLIC_TOURNAMENTS_PAGE_SIZE,
    };
  }
  if (data && typeof data === "object" && "list" in data) {
    const list = (data as { list: unknown; hasMore?: unknown }).list;
    const hasMore = (data as { hasMore?: unknown }).hasMore;
    const rows = Array.isArray(list) ? (list as TournamentItem[]) : [];
    return {
      rows,
      hasMore: typeof hasMore === "boolean" ? hasMore : rows.length === PUBLIC_TOURNAMENTS_PAGE_SIZE,
    };
  }
  return { rows: [], hasMore: false };
}

export function TournamentsListWithFilters({
  copy,
  initialList,
  initialHasMore,
  initialQuery,
}: {
  copy: Record<string, string>;
  initialList: TournamentItem[];
  initialHasMore: boolean;
  initialQuery: { tab: TabId; sortBy: SortId; national: boolean };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") || "upcoming") as TabId;
  const sortBy = (searchParams.get("sortBy") || "date") as SortId;
  const national = searchParams.get("national") === "1";

  const [list, setList] = useState<TournamentItem[]>(() => initialList.map(normalizeTournamentItem));
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const leftInitialQueryRef = useRef(false);
  const loadMoreLockRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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

  const sortOptions = SORT_OPTIONS[tab];
  const effectiveSortBy = sortOptions.some((s) => s.id === sortBy) ? sortBy : "date";

  const buildListParams = useCallback(
    (skip: number) => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      params.set("sortBy", effectiveSortBy);
      params.set("take", String(PUBLIC_TOURNAMENTS_PAGE_SIZE));
      params.set("skip", String(skip));
      if (national) params.set("national", "1");
      return params;
    },
    [tab, effectiveSortBy, national]
  );

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || loadingMore || loadMoreLockRef.current) return;
    loadMoreLockRef.current = true;
    setLoadingMore(true);
    setError("");
    try {
      const params = buildListParams(list.length);
      const res = await fetch(`/api/public/tournaments?${params.toString()}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "목록 조회 실패");
      }
      const { rows, hasMore: more } = parseListResponse(await res.json());
      setList((prev) => {
        const ids = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        for (const raw of rows) {
          const item = normalizeTournamentItem(raw);
          if (!ids.has(item.id)) {
            ids.add(item.id);
            merged.push(item);
          }
        }
        return merged;
      });
      setHasMore(more);
    } catch (err) {
      setError(err instanceof Error ? err.message : "목록을 불러올 수 없습니다.");
    } finally {
      loadMoreLockRef.current = false;
      setLoadingMore(false);
    }
  }, [hasMore, loading, loadingMore, list.length, buildListParams]);

  useEffect(() => {
    const matchInitial =
      tab === initialQuery.tab &&
      effectiveSortBy === initialQuery.sortBy &&
      national === initialQuery.national;

    if (!leftInitialQueryRef.current && matchInitial) {
      setList(initialList.map(normalizeTournamentItem));
      setHasMore(initialHasMore);
      setLoading(false);
      setError("");
      return;
    }

    if (!matchInitial) {
      leftInitialQueryRef.current = true;
    }

    let cancelled = false;
    setLoading(true);
    setError("");
    const params = buildListParams(0);
    fetch(`/api/public/tournaments?${params.toString()}`)
      .then((res) => {
        if (!res.ok) return res.json().then((d) => Promise.reject(new Error(d.error || "목록 조회 실패")));
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        const { rows, hasMore: more } = parseListResponse(data);
        setList(rows.map(normalizeTournamentItem));
        setHasMore(more);
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
  }, [tab, effectiveSortBy, national, initialList, initialQuery, initialHasMore, buildListParams]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || loading || loadingMore) return;
    const ob = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { root: null, rootMargin: "280px", threshold: 0 }
    );
    ob.observe(el);
    return () => ob.disconnect();
  }, [hasMore, loading, loadingMore, loadMore, list.length]);

  return (
    <div className="mt-8 space-y-4">
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
        <div className="space-y-3">
          <ul className="space-y-3 sm:grid sm:grid-cols-1 sm:gap-3 md:grid-cols-2">
            {list.map((t) => (
              <TournamentListCard key={t.id} t={t} />
            ))}
          </ul>
          {hasMore && <div ref={sentinelRef} className="h-4 w-full shrink-0" aria-hidden />}
          {loadingMore && (
            <p className="text-center text-sm text-site-text-muted py-2">더 불러오는 중...</p>
          )}
        </div>
      )}
    </div>
  );
}
