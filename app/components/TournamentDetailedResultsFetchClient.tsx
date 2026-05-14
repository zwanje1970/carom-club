"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { DetailedResultsBundle } from "../../lib/tournament-detailed-results";
import TournamentDetailedResultsView from "./TournamentDetailedResultsView";

type ApiOk = { bundle: DetailedResultsBundle; tournamentTitle?: string };
type ApiErr = { error?: string };

export default function TournamentDetailedResultsFetchClient({
  fetchUrl,
  backHref,
  backLabel,
}: {
  fetchUrl: string;
  backHref: string;
  backLabel: string;
}) {
  const [bundle, setBundle] = useState<DetailedResultsBundle | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(fetchUrl, { credentials: "include", cache: "no-store" });
      const json = (await res.json()) as ApiOk & ApiErr;
      if (!res.ok) {
        setBundle(null);
        setErr(json.error ?? "불러오지 못했습니다.");
        return;
      }
      setBundle(json.bundle ?? { players: [] });
      setTitle(typeof json.tournamentTitle === "string" ? json.tournamentTitle.trim() : "");
    } catch {
      setBundle(null);
      setErr("요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="v3-stack" style={{ gap: "0.65rem" }}>
      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <Link prefetch={false} href={backHref} className="v3-btn" style={{ fontWeight: 700 }}>
          {backLabel}
        </Link>
        <button type="button" className="v3-btn" onClick={() => void load()} disabled={loading} style={{ fontWeight: 700 }}>
          {loading ? "불러오는 중…" : "다시 불러오기"}
        </button>
      </div>
      {title ? (
        <p style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0f172a" }}>{title}</p>
      ) : null}
      <h1 className="v3-h2" style={{ margin: 0, fontSize: "clamp(1.05rem, 4vw, 1.2rem)", fontWeight: 900 }}>
        대회결과
      </h1>
      {err ? <p style={{ margin: 0, color: "#b91c1c", fontWeight: 700 }}>{err}</p> : null}
      {loading && !err ? <p className="v3-muted" style={{ margin: 0 }}>불러오는 중…</p> : null}
      {!loading && !err ? <TournamentDetailedResultsView bundle={bundle} /> : null}
    </div>
  );
}
