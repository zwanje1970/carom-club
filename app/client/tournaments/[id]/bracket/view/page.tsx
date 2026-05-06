"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

const InteractiveBracketBoard = dynamic(
  () => import("../InteractiveBracketBoard"),
  { ssr: false, loading: () => <p className="v3-muted">인터랙티브 대진표 보드를 불러오는 중…</p> },
);

type BracketRoundView = {
  roundNumber: number;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  matches: Array<{
    id: string;
    player1: { userId: string; name: string };
    player2: { userId: string; name: string };
    winnerUserId: string | null;
    winnerName: string | null;
    status: "PENDING" | "COMPLETED";
  }>;
};

type Bracket = {
  id: string;
  tournamentId: string;
  zoneId?: string | null;
  rounds: BracketRoundView[];
  createdAt: string;
  bracketMode?: "single" | "multi_block";
  blocks?: Array<{ id: string; label?: string; rounds: BracketRoundView[] }>;
  finalBlock?: { rounds: BracketRoundView[] };
};

export default function TournamentBracketBoardViewPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tournamentId = useMemo(() => (typeof params.id === "string" ? params.id : ""), [params.id]);
  const urlZoneId = useMemo(() => searchParams.get("zoneId")?.trim() ?? "", [searchParams]);

  const [zonesEnabled, setZonesEnabled] = useState(false);
  const [zoneOptions, setZoneOptions] = useState<{ id: string; zoneName: string }[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [isTournamentClosed, setIsTournamentClosed] = useState(false);
  const [tournamentTitle, setTournamentTitle] = useState("");
  const [tournamentDate, setTournamentDate] = useState("");
  const [tournamentLocation, setTournamentLocation] = useState("");
  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [message, setMessage] = useState("");
  const [boardSliceKey, setBoardSliceKey] = useState<string | null>(null);

  const bracketZoneQuery = useMemo(() => {
    if (!zonesEnabled || !selectedZoneId) return "";
    return `?zoneId=${encodeURIComponent(selectedZoneId)}`;
  }, [zonesEnabled, selectedZoneId]);

  const loadBracket = useCallback(async () => {
    if (!tournamentId) return;
    if (zonesEnabled && !selectedZoneId) {
      setBracket(null);
      return;
    }
    try {
      const url = zonesEnabled
        ? `/api/client/tournaments/${tournamentId}/bracket/zones/${encodeURIComponent(selectedZoneId)}`
        : `/api/client/tournaments/${tournamentId}/bracket`;
      const response = await fetch(url, { credentials: "same-origin" });
      const result = (await response.json()) as { bracket?: Bracket | null; error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "대진표 조회에 실패했습니다.");
        return;
      }
      setBracket(result.bracket ?? null);
      setMessage("");
    } catch {
      setMessage("대진표 조회 중 오류가 발생했습니다.");
    }
  }, [selectedZoneId, tournamentId, zonesEnabled]);

  useEffect(() => {
    if (!tournamentId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`, { credentials: "same-origin" });
        const json = (await res.json()) as {
          tournament?: {
            zonesEnabled?: boolean;
            statusBadge?: string | null;
            title?: string;
            date?: string;
            location?: string;
          };
        };
        if (!res.ok || cancelled || !json.tournament) return;
        setZonesEnabled(json.tournament.zonesEnabled === true);
        setIsTournamentClosed((json.tournament.statusBadge ?? "") === "종료");
        setTournamentTitle((json.tournament.title ?? "").trim());
        setTournamentDate((json.tournament.date ?? "").trim());
        setTournamentLocation((json.tournament.location ?? "").trim());
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!tournamentId || !zonesEnabled) {
      setZoneOptions([]);
      if (!zonesEnabled) setSelectedZoneId("");
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}/zones`, { credentials: "same-origin" });
        const json = (await res.json()) as { zones?: Array<{ id?: string; zoneName?: string; status?: string }> };
        if (!res.ok || cancelled || !Array.isArray(json.zones)) return;
        const opts: { id: string; zoneName: string }[] = [];
        for (const z of json.zones) {
          if (!z || z.status !== "ACTIVE") continue;
          const id = typeof z.id === "string" ? z.id.trim() : "";
          const zoneName = typeof z.zoneName === "string" ? z.zoneName.trim() : "";
          if (id && zoneName) opts.push({ id, zoneName });
        }
        setZoneOptions(opts);
        setSelectedZoneId((prev) => {
          if (urlZoneId && opts.some((o) => o.id === urlZoneId)) return urlZoneId;
          if (prev && opts.some((o) => o.id === prev)) return prev;
          return opts[0]?.id ?? "";
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tournamentId, zonesEnabled, urlZoneId]);

  useEffect(() => {
    void loadBracket();
  }, [loadBracket]);

  useEffect(() => {
    if (!bracket) {
      setBoardSliceKey(null);
      return;
    }
    if (bracket.bracketMode === "multi_block" && bracket.blocks?.[0]) {
      setBoardSliceKey(`block:${bracket.blocks[0].id}`);
    } else {
      setBoardSliceKey(null);
    }
  }, [bracket?.id, bracket?.bracketMode, bracket?.blocks]);

  const boardBracket = useMemo(() => {
    if (!bracket) return null;
    let rounds: BracketRoundView[];
    if (bracket.bracketMode === "multi_block" && boardSliceKey) {
      if (boardSliceKey === "final") {
        rounds = bracket.finalBlock?.rounds ?? [];
      } else if (boardSliceKey.startsWith("block:")) {
        const bid = boardSliceKey.slice("block:".length);
        rounds = bracket.blocks?.find((b) => b.id === bid)?.rounds ?? [];
      } else {
        rounds = [];
      }
    } else {
      rounds = bracket.rounds;
    }
    const suffix = boardSliceKey ?? "root";
    return { id: `${bracket.id}:${suffix}`, rounds };
  }, [bracket, boardSliceKey]);

  return (
    <main
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100dvh",
        overflow: "hidden",
        background: "#f8fafc",
        overscrollBehavior: "none",
      }}
    >
      <header
        style={{
          position: "absolute",
          top: "max(env(safe-area-inset-top, 0px), 0px)",
          left: "max(env(safe-area-inset-left, 0px), 0px)",
          right: "max(env(safe-area-inset-right, 0px), 0px)",
          zIndex: 90,
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(6px)",
          borderBottom: "1px solid rgba(148,163,184,0.35)",
          paddingTop: "max(env(safe-area-inset-top, 0px), 0px)",
          paddingRight: "max(env(safe-area-inset-right, 0px), 0px)",
          paddingBottom: "0.6rem",
          paddingLeft: "max(env(safe-area-inset-left, 0px), 0px)",
          display: "flex",
          alignItems: "center",
          gap: "0.55rem",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="v3-btn"
          onClick={() => router.push(`/client/tournaments/${tournamentId}/bracket${bracketZoneQuery}`)}
        >
          ← 돌아가기
        </button>
        <strong style={{ fontSize: "0.92rem" }}>대진표 보기</strong>
        {bracket?.bracketMode === "multi_block" && bracket.blocks?.length ? (
          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", alignItems: "center" }}>
            {bracket.blocks.map((bl) => (
              <button
                key={bl.id}
                type="button"
                className="v3-btn"
                style={{
                  minHeight: 32,
                  fontSize: "0.82rem",
                  padding: "0.25rem 0.55rem",
                  fontWeight: boardSliceKey === `block:${bl.id}` ? 700 : 600,
                  border: boardSliceKey === `block:${bl.id}` ? "2px solid #2563eb" : undefined,
                }}
                onClick={() => setBoardSliceKey(`block:${bl.id}`)}
              >
                조 {bl.label ?? bl.id}
              </button>
            ))}
            {bracket.finalBlock?.rounds?.length ? (
              <button
                type="button"
                className="v3-btn"
                style={{
                  minHeight: 32,
                  fontSize: "0.82rem",
                  padding: "0.25rem 0.55rem",
                  fontWeight: boardSliceKey === "final" ? 700 : 600,
                  border: boardSliceKey === "final" ? "2px solid #2563eb" : undefined,
                }}
                onClick={() => setBoardSliceKey("final")}
              >
                결선
              </button>
            ) : null}
          </div>
        ) : null}
        {zonesEnabled ? (
          <select
            className="v3-btn"
            value={selectedZoneId}
            onChange={(e) => setSelectedZoneId(e.target.value)}
            disabled={zoneOptions.length === 0}
            style={{ minHeight: 34, fontWeight: 600 }}
          >
            {zoneOptions.length === 0 ? <option value="">권역 없음</option> : null}
            {zoneOptions.map((z) => (
              <option key={z.id} value={z.id}>
                {z.zoneName}
              </option>
            ))}
          </select>
        ) : null}
        {message ? <span className="v3-muted">{message}</span> : null}
      </header>

      <section
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
        }}
      >
        {zonesEnabled && !selectedZoneId ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#e2e8f0",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            <p>권역을 선택해야 대진표를 볼 수 있습니다.</p>
          </div>
        ) : !bracket ? (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "#e2e8f0",
              padding: "1rem",
              textAlign: "center",
            }}
          >
            <p>아직 확정된 대진표가 없습니다.</p>
          </div>
        ) : boardBracket ? (
          <InteractiveBracketBoard
            bracket={boardBracket}
            tournamentTitle={tournamentTitle}
            tournamentDate={tournamentDate}
            tournamentLocation={tournamentLocation}
            interactionDisabled={isTournamentClosed}
            actionBusy={false}
            canUndo={false}
          />
        ) : null}
      </section>
    </main>
  );
}

