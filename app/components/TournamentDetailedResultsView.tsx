"use client";

import type { DetailedResultsBundle, DetailedResultsPlayerBlock } from "../../lib/tournament-detailed-results";

function dash(s: string | null | undefined): string {
  const t = (s ?? "").trim();
  return t || "—";
}

function SummaryLines({
  wins,
  losses,
  rank,
  hasDetailedMatches,
  avgMean,
  avgBest,
  highRunBest,
}: Pick<
  DetailedResultsPlayerBlock,
  "wins" | "losses" | "rank" | "hasDetailedMatches" | "avgMean" | "avgBest" | "highRunBest"
>) {
  const meanStr = avgMean != null && Number.isFinite(avgMean) ? avgMean.toFixed(3) : "—";
  const bestStr = avgBest != null && Number.isFinite(avgBest) ? avgBest.toFixed(3) : "—";
  const hrStr = highRunBest != null && Number.isFinite(highRunBest) ? String(highRunBest) : "—";
  const rankStr = rank != null && Number.isFinite(rank) ? String(rank) : "—";
  return (
    <div className="tournament-detailed-results__summary" style={{ marginTop: "0.45rem", fontSize: "0.88rem", lineHeight: 1.55 }}>
      <p style={{ margin: 0, fontWeight: 800 }}>
        {wins}승 {losses}패
      </p>
      <p style={{ margin: 0 }}>순위 {rankStr}</p>
      {hasDetailedMatches ? (
        <>
          <p style={{ margin: 0 }}>대회 AVG {meanStr}</p>
          <p style={{ margin: 0 }}>최고 AVG {bestStr}</p>
          <p style={{ margin: 0 }}>하이런 {hrStr}</p>
        </>
      ) : null}
    </div>
  );
}

function PlayerBlock({ block, showPlayerTitle = true }: { block: DetailedResultsPlayerBlock; showPlayerTitle?: boolean }) {
  return (
    <section className="tournament-detailed-results__player" style={{ marginBottom: "1.25rem" }}>
      {showPlayerTitle ? (
        <h3 style={{ margin: "0 0 0.45rem", fontSize: "1.02rem", fontWeight: 800 }}>{block.playerDisplayName}</h3>
      ) : null}
      <div className="tournament-detailed-results__rows v3-stack" style={{ gap: "0.28rem" }}>
        {block.rows.map((row, i) => {
          const hasDetail = row.avgDisplay != null;
          return (
            <p
              key={`${block.playerUserId}-${i}-${row.opponentName}-${row.sortKey}`}
              style={{
                margin: 0,
                fontSize: "0.88rem",
                lineHeight: 1.45,
                fontVariantNumeric: "tabular-nums",
                wordBreak: "keep-all",
              }}
            >
              <span style={{ fontWeight: 700 }}>{row.opponentName}</span>
              <span style={{ marginLeft: "0.35rem", fontWeight: 800 }}>{row.outcome}</span>
              {hasDetail ? (
                <>
                  <span style={{ marginLeft: "0.35rem" }}>{dash(row.scoreDisplay)}</span>
                  <span style={{ marginLeft: "0.35rem" }}>{dash(row.inningsDisplay)}</span>
                  <span style={{ marginLeft: "0.35rem" }}>경기 AVG {dash(row.avgDisplay)}</span>
                </>
              ) : null}
            </p>
          );
        })}
      </div>
      <hr
        style={{
          border: 0,
          borderTop: "1px dashed #cbd5e1",
          margin: "0.55rem 0 0.35rem",
        }}
      />
      <SummaryLines
        wins={block.wins}
        losses={block.losses}
        rank={block.rank}
        hasDetailedMatches={block.hasDetailedMatches}
        avgMean={block.avgMean}
        avgBest={block.avgBest}
        highRunBest={block.highRunBest}
      />
    </section>
  );
}

export default function TournamentDetailedResultsView({ bundle }: { bundle: DetailedResultsBundle | null }) {
  if (!bundle || bundle.players.length === 0) {
    return <p className="v3-muted" style={{ margin: 0 }}>표시할 경기 기록이 없습니다.</p>;
  }
  return (
    <div className="tournament-detailed-results-root">
      {bundle.players.map((p) => (
        <PlayerBlock key={p.playerUserId} block={p} />
      ))}
    </div>
  );
}

export function TournamentDetailedResultsSinglePlayerView({
  block,
  showPlayerTitle = false,
}: {
  block: DetailedResultsPlayerBlock | null;
  showPlayerTitle?: boolean;
}) {
  if (!block || block.rows.length === 0) {
    return <p className="v3-muted" style={{ margin: 0 }}>이 대회에서 표시할 경기 기록이 없습니다.</p>;
  }
  return <PlayerBlock block={block} showPlayerTitle={showPlayerTitle} />;
}
