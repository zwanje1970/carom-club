"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef } from "react";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListImage160 from "../components/SiteListImage160";
import TournamentsFilterBar from "./tournaments-filter-bar";
import {
  buildTournamentsListScrollSignature,
  type TournamentStatusFilter,
} from "./tournament-list-url";

const TOURNAMENTS_SCROLL_STORAGE_KEY = "carom.site.tournaments.scrollY";

function readStoredListScroll(signature: string): { scrollY: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(TOURNAMENTS_SCROLL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { signature?: unknown; scrollY?: unknown };
    if (parsed.signature !== signature || typeof parsed.scrollY !== "number") return null;
    return { scrollY: parsed.scrollY };
  } catch {
    return null;
  }
}

function writeStoredListScroll(signature: string, scrollY: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      TOURNAMENTS_SCROLL_STORAGE_KEY,
      JSON.stringify({ signature, scrollY: Math.max(0, scrollY) }),
    );
  } catch {
    /* ignore */
  }
}

function shouldSaveScrollBeforeDetailNavigate(ev: React.MouseEvent): boolean {
  if (ev.defaultPrevented) return false;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
  if (ev.button !== 0) return false;
  return true;
}

export type SiteTournamentListRow = {
  id: string;
  statusBadge: string;
  title: string;
  scheduleLine: string;
  locationLine: string;
  bracketParen: string | null;
  posterSrc: string | null;
  tournamentTypeLabel: string;
  firstPrizeLabel: string;
  deadlineLabel: string;
};

function tournamentStatusBadgeClassName(statusBadge: string): string {
  const s = statusBadge.trim();
  if (s === "모집중") return "badge-status";
  if (s === "마감임박") return "site-board-status-badge site-board-status-badge--urgent";
  if (s === "마감") return "site-board-status-badge site-board-status-badge--closed";
  if (s === "종료") return "site-board-status-badge site-board-status-badge--ended";
  return "site-board-status-badge site-board-status-badge--muted";
}

/** 스냅샷 `dateLabel` 표시만: `YYYY.MM.DD` → `YY/MM/DD`, 한 줄. */
function formatTournamentListScheduleDisplay(scheduleLine: string): string {
  const s = scheduleLine.trim().replace(/\s*\r?\n+\s*/g, " ");
  if (!s) return "";
  return s.replace(/\b(\d{4})\.(\d{2})\.(\d{2})\b/g, (_, y: string, m: string, d: string) => `${y.slice(2)}/${m}/${d}`);
}

/** 목록 표시용: `1등 N만` → `1등 N만원` (스냅샷 문자열은 그대로 두고 화면에서만 보정). */
function displayFirstPrizeForList(raw: string): string {
  const t = raw.replace(/\u00a0/g, " ").trim();
  if (!t) return "";
  if (/만원\s*$/.test(t)) return t;
  if (/만\s*$/.test(t)) return `${t}원`;
  return t;
}

function splitPlayScaleBracket(playScale: string | null): { num: string; suffix: string } | null {
  if (!playScale?.trim()) return null;
  const m = /^(\d+)\s*(강)$/.exec(playScale.trim());
  if (!m) return null;
  return { num: m[1]!, suffix: m[2]! };
}

type Props = {
  rows: SiteTournamentListRow[];
  searchParams: Record<string, string | string[] | undefined>;
  currentStatus: TournamentStatusFilter;
};

export default function SiteTournamentsDistanceShell({ rows, searchParams, currentStatus }: Props) {
  const listScrollSignature = useMemo(() => buildTournamentsListScrollSignature(searchParams), [searchParams]);
  const didRestoreForSignatureRef = useRef<string | null>(null);

  const saveScrollBeforeDetail = useCallback(() => {
    writeStoredListScroll(listScrollSignature, window.scrollY || window.pageYOffset || 0);
  }, [listScrollSignature]);

  useEffect(() => {
    if (rows.length === 0) return;
    if (didRestoreForSignatureRef.current === listScrollSignature) return;
    const stored = readStoredListScroll(listScrollSignature);
    didRestoreForSignatureRef.current = listScrollSignature;
    if (!stored) return;
    const y = stored.scrollY;
    const apply = () => {
      window.scrollTo(0, y);
    };
    requestAnimationFrame(() => {
      requestAnimationFrame(apply);
    });
  }, [rows, listScrollSignature]);

  return (
    <SiteShellFrame
      brandTitle="대회안내"
      auxiliaryBarClassName="site-shell-controls--site-list"
      auxiliary={<TournamentsFilterBar searchParams={searchParams} currentStatus={currentStatus} />}
    >
      <section className="site-site-gray-main v3-stack site-tournaments-list-page">
        {rows.length === 0 ? (
          <p className="v3-muted site-list-empty-hint">등록된 대회가 없습니다.</p>
        ) : (
          <ul className="site-board-card-list site-site-list--tournaments">
            {rows.map((tournament) => (
              <li key={tournament.id} className="site-board-card site-board-card--tournament-row">
                <Link
                  prefetch={false}
                  className="site-tournament-list-link"
                  href={`/site/tournaments/${tournament.id}`}
                  onClick={(ev) => {
                    if (!shouldSaveScrollBeforeDetailNavigate(ev)) return;
                    saveScrollBeforeDetail();
                  }}
                >
                  <div className="site-tournament-list-left">
                    {tournament.bracketParen ? (
                      (() => {
                        const parts = splitPlayScaleBracket(tournament.bracketParen);
                        if (!parts) {
                          return (
                            <span className="site-tournament-list-bracket site-tournament-list-bracket--plain">
                              {tournament.bracketParen}
                            </span>
                          );
                        }
                        return (
                          <span className="site-tournament-list-bracket">
                            <span className="site-tournament-list-bracket-num">{parts.num}</span>
                            {parts.suffix}
                          </span>
                        );
                      })()
                    ) : null}
                    {tournament.scheduleLine ? (
                      <span className="site-tournament-schedule">
                        {formatTournamentListScheduleDisplay(tournament.scheduleLine)}
                      </span>
                    ) : null}
                  </div>
                  <div className="site-tournament-list-center">
                    <span className="site-tournament-card-title">{tournament.title}</span>
                    {tournament.locationLine ? (
                      <span className="site-tournament-location">{tournament.locationLine}</span>
                    ) : null}
                  </div>
                  <div className="site-tournament-list-right">
                    <span className={tournamentStatusBadgeClassName(tournament.statusBadge)}>
                      {tournament.statusBadge}
                    </span>
                    {tournament.firstPrizeLabel.replace(/\u00a0/g, " ").trim() ? (
                      <span className="site-tournament-list-prize">
                        {displayFirstPrizeForList(tournament.firstPrizeLabel)}
                      </span>
                    ) : null}
                  </div>
                  {tournament.posterSrc ? (
                    <div className="site-tournament-list-thumb">
                      <SiteListImage160
                        src={tournament.posterSrc}
                        alt={`${tournament.title} 포스터`}
                        placeholderClassName="site-tournament-list-thumb-placeholder"
                      />
                    </div>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </SiteShellFrame>
  );
}
