"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DetailedResultsPlayerBlock } from "../../../../lib/tournament-detailed-results";
import { TournamentDetailedResultsSinglePlayerView } from "../../../components/TournamentDetailedResultsView";

type TournamentRow = {
  tournamentId: string;
  tournamentTitle: string;
  dateLine: string;
  player: DetailedResultsPlayerBlock;
};

export default function MypageMatchRecordsClient() {
  const [rows, setRows] = useState<TournamentRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/site/mypage/match-records", { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as { tournaments?: TournamentRow[]; error?: string };
      if (!res.ok) {
        setRows(null);
        setErr(json.error ?? "불러오지 못했습니다.");
        return;
      }
      setRows(Array.isArray(json.tournaments) ? json.tournaments : []);
    } catch {
      setRows(null);
      setErr("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="v3-stack" style={{ gap: "0.75rem", maxWidth: 720 }}>
      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.45rem", alignItems: "center" }}>
        <Link prefetch={false} href="/site/mypage" className="secondary-button" style={{ fontWeight: 700 }}>
          마이페이지
        </Link>
        <button type="button" className="secondary-button" onClick={() => void load()} disabled={loading} style={{ fontWeight: 700 }}>
          {loading ? "불러오는 중…" : "다시 불러오기"}
        </button>
      </div>
      <h1 className="site-detail-hero-title" style={{ margin: 0 }}>
        내 경기기록
      </h1>
      {err ? <p style={{ margin: 0, color: "#b91c1c", fontWeight: 700 }}>{err}</p> : null}
      {loading && !err ? <p className="v3-muted">불러오는 중…</p> : null}
      {!loading && !err && rows && rows.length === 0 ? (
        <p className="v3-muted" style={{ margin: 0 }}>
          표시할 경기 기록이 없습니다. (승패가 확정된 경기가 있어야 합니다.)
        </p>
      ) : null}
      {!loading && !err && rows && rows.length > 0
        ? rows.map((t) => (
            <section key={t.tournamentId} className="card-clean site-detail-inner-stack" style={{ gap: "0.45rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.02rem", fontWeight: 900 }}>[{t.tournamentTitle}]</h2>
              {t.dateLine ? (
                <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
                  {t.dateLine}
                </p>
              ) : null}
              <TournamentDetailedResultsSinglePlayerView block={t.player} showPlayerTitle={false} />
            </section>
          ))
        : null}
    </div>
  );
}
