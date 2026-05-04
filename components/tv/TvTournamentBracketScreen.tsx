"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";

/** TV 폴링용 — API JSON 형태만 반영 (클라이언트에서 platform-backing-store 미참조) */
type TvBracketMatchJson = {
  id: string;
  player1: { userId: string; name: string };
  player2: { userId: string; name: string };
  winnerUserId: string | null;
  winnerName: string | null;
  status: string;
};

type TvBracketRoundJson = {
  roundNumber: number;
  status: string;
  matches: TvBracketMatchJson[];
};

type TvBracketJson = {
  id: string;
  tournamentId: string;
  snapshotId: string;
  rounds: TvBracketRoundJson[];
  createdAt: string;
};

type TvBracketApiPayload = {
  bracket: TvBracketJson | null;
  tournamentTitle: string;
  zoneName?: string;
};

const POLL_MS = 8000;

function pickDisplayRound(rounds: TvBracketRoundJson[]): TvBracketRoundJson | null {
  if (!rounds.length) return null;
  const sorted = [...rounds].sort((a, b) => a.roundNumber - b.roundNumber);
  const inProgress = sorted.find((r) => r.status === "IN_PROGRESS");
  if (inProgress) return inProgress;
  const pendingRound = sorted.find(
    (r) => r.status === "PENDING" || r.matches.some((m) => m.status === "PENDING"),
  );
  if (pendingRound) return pendingRound;
  return sorted[sorted.length - 1] ?? null;
}

function roundStatusLabel(status: string): string {
  switch (status) {
    case "IN_PROGRESS":
      return "진행 중";
    case "COMPLETED":
      return "완료";
    case "PENDING":
      return "대기";
    default:
      return status;
  }
}

export function TvTournamentBracketScreen({
  tournamentId,
  zoneId,
  shareToken,
  shareZoneToken,
}: {
  tournamentId: string;
  /** 권역 TV용(클라이언트는 shareZoneToken URL로 해당 권역 대진표만 요청) */
  zoneId?: string | null;
  /** 설정 시 `/api/tv/share/[token]/bracket` 폴링 */
  shareToken?: string | null;
  /** 설정 시 `/api/tv/share/zones/[token]/bracket` 폴링(해당 권역 대진표) */
  shareZoneToken?: string | null;
}) {
  const zoneMainAttr =
    typeof zoneId === "string" && zoneId.trim() !== "" ? ({ "data-zone-id": zoneId.trim() } as const) : {};
  const [payload, setPayload] = useState<TvBracketApiPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const bracketUrl = useMemo(() => {
    const zt = shareZoneToken?.trim();
    if (zt) return `/api/tv/share/zones/${encodeURIComponent(zt)}/bracket`;
    const st = shareToken?.trim();
    if (st) return `/api/tv/share/${encodeURIComponent(st)}/bracket`;
    return `/api/tv/tournaments/${encodeURIComponent(tournamentId)}/bracket`;
  }, [shareToken, shareZoneToken, tournamentId]);

  const load = useCallback(async () => {
    if (!tournamentId) {
      setError("대회 ID가 없습니다.");
      return;
    }
    try {
      const res = await fetch(bracketUrl, {
        method: "GET",
        cache: "no-store",
      });
      const json = (await res.json()) as TvBracketApiPayload & { error?: string };
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "데이터를 불러오지 못했습니다.");
        setPayload(null);
        return;
      }
      setError(null);
      setPayload({
        bracket: json.bracket ?? null,
        tournamentTitle: json.tournamentTitle ?? "",
        zoneName: typeof json.zoneName === "string" ? json.zoneName : undefined,
      });
      setUpdatedAt(new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } catch {
      setError("네트워크 오류로 불러오지 못했습니다.");
      setPayload(null);
    }
  }, [bracketUrl, tournamentId]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(t);
  }, [load]);

  const displayRound = useMemo(() => {
    if (!payload?.bracket?.rounds?.length) return null;
    return pickDisplayRound(payload.bracket.rounds);
  }, [payload]);

  if (!tournamentId) {
    return <TvCenteredMessage text="대회 ID가 없습니다." />;
  }

  if (error) {
    return <TvCenteredMessage text={error} />;
  }

  if (!payload) {
    return <TvCenteredMessage text="대진표를 불러오는 중…" />;
  }

  const baseTitle = payload.tournamentTitle.trim() || "대회";
  const zn = payload.zoneName?.trim();
  const title = zn ? `${baseTitle} · ${zn}` : baseTitle;
  if (!payload.bracket) {
    return (
      <main {...zoneMainAttr} style={tvMainStyle}>
        <TvHeader title={title} subtitle="대진표 없음" updatedAt={updatedAt} />
        <p style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)", marginTop: "2rem", opacity: 0.85 }}>
          등록된 대진표가 없습니다.
        </p>
      </main>
    );
  }

  return (
    <main {...zoneMainAttr} style={tvMainStyle}>
      <TvHeader
        title={title}
        subtitle={
          displayRound
            ? `${displayRound.roundNumber}라운드 · ${roundStatusLabel(displayRound.status)}`
            : "라운드 없음"
        }
        updatedAt={updatedAt}
      />
      {displayRound && displayRound.matches.length > 0 ? (
        <ul style={matchListStyle}>
          {displayRound.matches.map((m) => (
            <li key={m.id} style={matchRowStyle}>
              <div style={nameColStyle}>
                <span style={playerNameStyle}>{m.player1.name || "—"}</span>
                <span style={vsStyle}>vs</span>
                <span style={playerNameStyle}>{m.player2.name || "—"}</span>
              </div>
              <div style={metaColStyle}>
                <span style={badgeStyle(m.status)}>{m.status === "COMPLETED" ? "종료" : "예정"}</span>
                {m.winnerName ? <span style={winnerStyle}>승: {m.winnerName}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)", marginTop: "2rem", opacity: 0.85 }}>표시할 경기가 없습니다.</p>
      )}
    </main>
  );
}

function TvHeader({
  title,
  subtitle,
  updatedAt,
}: {
  title: string;
  subtitle: string;
  updatedAt: string | null;
}) {
  return (
    <header style={{ marginBottom: "clamp(1.5rem, 4vw, 3rem)" }}>
      <p style={{ margin: 0, fontSize: "0.75rem", letterSpacing: "0.35em", color: "#5ec8ff", fontWeight: 600 }}>
        BRACKET TV
      </p>
      <h1 style={{ margin: "0.35rem 0 0", fontSize: "clamp(1.75rem, 5vw, 3.25rem)", fontWeight: 800, lineHeight: 1.15 }}>
        {title}
      </h1>
      <p style={{ margin: "0.5rem 0 0", fontSize: "clamp(1.1rem, 2.8vw, 1.75rem)", color: "#b8c5da" }}>{subtitle}</p>
      {updatedAt ? (
        <p style={{ margin: "0.75rem 0 0", fontSize: "0.95rem", color: "#7a8aa3" }}>갱신 {updatedAt}</p>
      ) : null}
    </header>
  );
}

function TvCenteredMessage({ text }: { text: string }) {
  return (
    <main style={{ ...tvMainStyle, justifyContent: "center", alignItems: "center", textAlign: "center" }}>
      <p style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)", maxWidth: "40rem" }}>{text}</p>
    </main>
  );
}

const tvMainStyle: CSSProperties = {
  minHeight: "100vh",
  padding: "clamp(1rem, 3vw, 2.5rem)",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
};

const matchListStyle: CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "clamp(0.75rem, 2vw, 1.25rem)",
};

const matchRowStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "1rem",
  padding: "clamp(1rem, 2.5vw, 1.5rem) clamp(1.25rem, 3vw, 2rem)",
  borderRadius: "12px",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(94,200,255,0.25)",
};

const nameColStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  alignItems: "center",
  gap: "0.75rem",
  flex: "1 1 280px",
};

const playerNameStyle: CSSProperties = {
  fontSize: "clamp(1.2rem, 3.2vw, 2rem)",
  fontWeight: 700,
};

const vsStyle: CSSProperties = {
  fontSize: "clamp(0.9rem, 2vw, 1.2rem)",
  color: "#7a8aa3",
  fontWeight: 600,
};

const metaColStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
  flex: "0 0 auto",
};

function badgeStyle(status: string): CSSProperties {
  const done = status === "COMPLETED";
  return {
    fontSize: "0.85rem",
    fontWeight: 700,
    padding: "0.35rem 0.65rem",
    borderRadius: "999px",
    background: done ? "rgba(72, 199, 142, 0.2)" : "rgba(255, 193, 7, 0.15)",
    color: done ? "#8ef0c2" : "#ffd666",
  };
}

const winnerStyle: CSSProperties = {
  fontSize: "clamp(0.95rem, 2vw, 1.2rem)",
  color: "#cde7ff",
};
