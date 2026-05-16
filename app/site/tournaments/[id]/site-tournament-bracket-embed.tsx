"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isTournamentPastAutoEndSchedule } from "../../../../lib/tournament-auto-end-schedule";

type MatchJson = {
  id: string;
  player1: { userId: string; name: string; displayName?: string | null };
  player2: { userId: string; name: string; displayName?: string | null };
  winnerUserId: string | null;
  winnerName: string | null;
  status: string;
};

type RoundJson = {
  roundNumber: number;
  status: string;
  matches: MatchJson[];
};

type BracketJson = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  rounds: RoundJson[];
  bracketMode?: string;
  blocks?: Array<{ id: string; label?: string; rounds: RoundJson[] }>;
  finalBlock?: { rounds: RoundJson[] };
};

function slotName(p: { name: string; displayName?: string | null }): string {
  const d = typeof p.displayName === "string" ? p.displayName.trim() : "";
  return d || p.name.trim() || "—";
}

function bracketLooksLikeSplitLayout(b: BracketJson | null): boolean {
  if (!b) return false;
  if (b.bracketMode === "multi_block") return true;
  if (Array.isArray(b.blocks) && b.blocks.length > 0) return true;
  if (b.finalBlock != null) return true;
  return false;
}

function getFinalRoundFromBracketJson(b: BracketJson): RoundJson | null {
  if (bracketLooksLikeSplitLayout(b) && b.finalBlock?.rounds?.length) {
    const finals = b.finalBlock.rounds;
    return finals[finals.length - 1] ?? null;
  }
  const rs = b.rounds ?? [];
  return rs.length > 0 ? rs[rs.length - 1]! : null;
}

function isFinalMatchConfirmedInBracketJson(b: BracketJson | null): boolean {
  if (!b) return false;
  const finalRound = getFinalRoundFromBracketJson(b);
  const finalMatch = finalRound?.matches?.[0] ?? null;
  if (!finalRound || !finalMatch) return false;
  return (
    finalRound.matches.length === 1 &&
    finalMatch.status === "COMPLETED" &&
    typeof finalMatch.winnerUserId === "string" &&
    finalMatch.winnerUserId.trim() !== ""
  );
}

export default function SiteTournamentBracketEmbed({
  tournamentId,
  fastPoll: _fastPoll,
  statusBadge,
  schedule,
}: {
  tournamentId: string;
  /** @deprecated 진행중 여부와 무관하게 공개 화면은 30초 간격 메타 폴링으로 통일 */
  fastPoll: boolean;
  statusBadge?: string;
  schedule?: { date?: string; eventDates?: string[] | null };
}) {
  const [title, setTitle] = useState("");
  const [rounds, setRounds] = useState<RoundJson[]>([]);
  const [fullBracket, setFullBracket] = useState<BracketJson | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [multiBlock, setMultiBlock] = useState(false);
  const remoteSigRef = useRef("");

  const applyBracketJson = useCallback((b: BracketJson | null) => {
    if (!b) {
      setRounds([]);
      setFullBracket(null);
      setMultiBlock(false);
      remoteSigRef.current = "";
      return;
    }
    setFullBracket(b);
    const u = typeof b.updatedAt === "string" && b.updatedAt.trim() !== "" ? b.updatedAt.trim() : "";
    remoteSigRef.current = u || (typeof b.createdAt === "string" ? b.createdAt : "") || "";
    const isMulti = b.bracketMode === "multi_block" && Boolean(b.blocks?.[0]?.rounds?.length);
    setMultiBlock(isMulti);
    const flat: RoundJson[] = isMulti && b.blocks?.[0]?.rounds?.length ? b.blocks[0].rounds : (b.rounds ?? []);
    setRounds([...flat].sort((a, b) => a.roundNumber - b.roundNumber));
  }, []);

  const load = useCallback(async () => {
    const id = tournamentId.trim();
    if (!id) return;
    try {
      const res = await fetch(`/api/site/tournaments/${encodeURIComponent(id)}/bracket`, { cache: "no-store" });
      const json = (await res.json()) as {
        bracket?: BracketJson | null;
        tournamentTitle?: string;
        error?: string;
      };
      if (!res.ok) {
        setErr(json.error ?? "대진표를 불러오지 못했습니다.");
        return;
      }
      setErr(null);
      setTitle(json.tournamentTitle ?? "");
      applyBracketJson(json.bracket ?? null);
    } catch {
      setErr("대진표 요청 중 오류가 발생했습니다.");
    }
  }, [applyBracketJson, tournamentId]);

  const pollTick = useCallback(async () => {
    const id = tournamentId.trim();
    if (!id || (typeof document !== "undefined" && document.hidden)) return;
    try {
      const res = await fetch(`/api/site/tournaments/${encodeURIComponent(id)}/bracket?meta=1`, { cache: "no-store" });
      const json = (await res.json()) as { updatedAt?: string | null; error?: string };
      if (!res.ok) return;
      const sig =
        typeof json.updatedAt === "string" && json.updatedAt.trim() !== "" ? json.updatedAt.trim() : null;
      if (!sig || sig === remoteSigRef.current) return;
      await load();
    } catch {
      /* ignore */
    }
  }, [load, tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const POLL_MS = 30_000;
    const tick = () => void pollTick();
    const onVis = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVis);
    const t = window.setInterval(tick, POLL_MS);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, pollTick]);

  const r1 = rounds.find((r) => r.roundNumber === 1);

  const showResultsPendingNotice = useMemo(() => {
    if ((statusBadge ?? "").trim() !== "진행중") return false;
    if (!isFinalMatchConfirmedInBracketJson(fullBracket)) return false;
    if (!schedule) return false;
    return !isTournamentPastAutoEndSchedule({
      date: typeof schedule.date === "string" ? schedule.date : "",
      eventDates: schedule.eventDates ?? null,
    });
  }, [fullBracket, schedule, statusBadge]);

  return (
    <div className="site-tournament-bracket-embed card-clean site-detail-inner-stack" style={{ gap: "0.5rem" }}>
      <div className="v3-row" style={{ justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: "0.35rem" }}>
        <h2 className="site-detail-section-title" style={{ margin: 0 }}>
          실시간 대진표
        </h2>
        <Link prefetch={false} className="secondary-button" href={`/site/tournaments/${encodeURIComponent(tournamentId)}/bracket`} style={{ fontSize: "0.82rem" }}>
          전체 보기
        </Link>
      </div>
      {title ? <p className="site-detail-body-text" style={{ margin: 0 }}>{title}</p> : null}
      {multiBlock ? (
        <p className="v3-muted" style={{ margin: 0, fontSize: "0.8rem", lineHeight: 1.4 }}>
          분할 대진표입니다. 공개 화면에서는 첫 예선 조의 1라운드를 대표로 보여 줍니다.
        </p>
      ) : null}
      {err ? (
        <p className="v3-muted" style={{ margin: 0 }}>{err}</p>
      ) : !r1 || r1.matches.length === 0 ? (
        <p className="v3-muted" style={{ margin: 0 }}>표시할 대진표가 없습니다.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ textAlign: "left", padding: "0.35rem 0.25rem" }}>#</th>
                <th style={{ textAlign: "left", padding: "0.35rem 0.25rem" }}>선수 1</th>
                <th style={{ textAlign: "center", padding: "0.35rem 0.25rem" }} />
                <th style={{ textAlign: "left", padding: "0.35rem 0.25rem" }}>선수 2</th>
                <th style={{ textAlign: "left", padding: "0.35rem 0.25rem" }}>결과</th>
              </tr>
            </thead>
            <tbody>
              {r1.matches.map((m, i) => {
                const done =
                  m.status === "COMPLETED" && typeof m.winnerUserId === "string" && m.winnerUserId.trim() !== "";
                const w =
                  done && m.winnerUserId === m.player1.userId
                    ? slotName(m.player1)
                    : done && m.winnerUserId === m.player2.userId
                      ? slotName(m.player2)
                      : "—";
                return (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <td style={{ padding: "0.35rem 0.25rem", color: "#64748b" }}>{i + 1}</td>
                    <td style={{ padding: "0.35rem 0.25rem", fontWeight: m.winnerUserId === m.player1.userId ? 800 : 500 }}>
                      {slotName(m.player1)}
                    </td>
                    <td style={{ padding: "0.35rem 0.25rem", textAlign: "center", color: "#94a3b8" }}>
                      vs
                    </td>
                    <td style={{ padding: "0.35rem 0.25rem", fontWeight: m.winnerUserId === m.player2.userId ? 800 : 500 }}>
                      {slotName(m.player2)}
                    </td>
                    <td style={{ padding: "0.35rem 0.25rem", color: "#475569" }}>{w}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showResultsPendingNotice ? (
        <p
          className="v3-muted"
          style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", lineHeight: 1.45, wordBreak: "keep-all" }}
        >
          대회결과는 대회 다음날 오전에 반영됩니다.
        </p>
      ) : null}
    </div>
  );
}
