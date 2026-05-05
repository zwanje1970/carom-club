"use client";

import type { BracketForProgress } from "./bracket-progress-utils";
import { computeBracketProgress } from "./bracket-progress-utils";

export default function BracketProgressSummaryCard({ bracket }: { bracket: BracketForProgress }) {
  const s = computeBracketProgress(bracket);
  if (s.total <= 0) return null;

  return (
    <div
      className="v3-box"
      style={{
        padding: "0.65rem 0.85rem",
        background: "#f1f5f9",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        marginBottom: "0.65rem",
      }}
      aria-label="대진표 진행률 요약"
    >
      <p style={{ margin: 0, fontWeight: 800, fontSize: "0.88rem", color: "#0f172a" }}>대진표 진행률</p>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.84rem", color: "#334155", lineHeight: 1.45 }}>
        {s.currentRoundLabel} · 전체 {s.total}경기 · 완료 {s.completed}경기 · 남은 {s.remaining}경기
      </p>
      <div
        style={{
          marginTop: "0.45rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.2rem",
          fontSize: "0.8rem",
          color: "#475569",
        }}
      >
        {s.perRound
          .filter((row) => row.total > 0)
          .map((row) => (
            <div key={row.roundNumber} style={{ display: "flex", gap: "0.65rem", alignItems: "baseline" }}>
              <span style={{ fontWeight: 700, minWidth: "3.5rem" }}>{row.label}</span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>
                {row.completed}/{row.total}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
