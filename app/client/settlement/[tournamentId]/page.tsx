"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { computeLedgerTotalsFromLines } from "../../../../lib/settlement-ledger-v2";

type DraftLine = {
  key: string;
  flow: "INCOME" | "EXPENSE";
  amountKrw: number;
  label: string;
  note: string;
  entryDate: string;
};

function todayYmd() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function newDraftLine(): DraftLine {
  return {
    key: `k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    flow: "INCOME",
    amountKrw: 0,
    label: "",
    note: "",
    entryDate: todayYmd(),
  };
}

function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function parseAmountDigits(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (digits === "") return 0;
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.max(0, n));
}

export default function ClientSettlementLedgerEditPage() {
  const params = useParams<{ tournamentId: string }>();
  const tournamentId = typeof params.tournamentId === "string" ? params.tournamentId : "";

  const [title, setTitle] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    return computeLedgerTotalsFromLines(lines.map((L) => ({ flow: L.flow, amountKrw: L.amountKrw })));
  }, [lines]);

  const load = useCallback(async () => {
    if (!tournamentId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/settlement/ledger`);
      const json = (await res.json()) as {
        tournament?: { title: string; date: string };
        lines?: Array<{
          flow: string;
          amountKrw: number;
          label: string | null;
          note: string | null;
          id: string;
          entryDate?: string | null;
        }>;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "불러오지 못했습니다.");
        return;
      }
      if (json.tournament) {
        setTitle(json.tournament.title);
      }
      const loaded: DraftLine[] = (json.lines ?? []).map((L) => ({
        key: L.id,
        flow: L.flow === "EXPENSE" ? "EXPENSE" : "INCOME",
        amountKrw: L.amountKrw,
        label: L.label ?? "",
        note: L.note ?? "",
        entryDate:
          typeof L.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(L.entryDate) ? L.entryDate : todayYmd(),
      }));
      setLines(loaded.length > 0 ? loaded : [newDraftLine()]);
    } catch {
      setError("불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!tournamentId || saving) return;
    setSaving(true);
    setSaveState("saving");
    setError("");
    try {
      const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/settlement/ledger`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: lines.map((L) => ({
            category: "OTHER",
            flow: L.flow,
            amountKrw: L.amountKrw,
            label: L.label.trim() || null,
            note: L.note.trim() || null,
            entryDate: /^\d{4}-\d{2}-\d{2}$/.test(L.entryDate.trim()) ? L.entryDate.trim() : null,
          })),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setError(json.error ?? "저장에 실패했습니다.");
        setSaveState("error");
        return;
      }
      setSaveState("success");
      await load();
    } catch {
      setError("저장 중 오류가 발생했습니다.");
      setSaveState("error");
    } finally {
      setSaving(false);
    }
  }

  if (!tournamentId) {
    return (
      <main className="v3-page v3-stack">
        <p className="v3-muted">잘못된 경로입니다.</p>
        <Link href="/client/settlement">정산으로</Link>
      </main>
    );
  }

  return (
    <main
      className="v3-page ui-client-dashboard"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        paddingBottom: 0,
        gap: 0,
      }}
    >
      <header
        style={{
          flexShrink: 0,
          paddingBottom: "0.75rem",
          borderBottom: "1px solid #e5e7eb",
          marginBottom: "0.65rem",
        }}
      >
        <div className="v3-row" style={{ alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client/settlement" style={{ padding: "0.5rem 0.9rem" }}>
            ← 정산 목록
          </Link>
        </div>
        {!loading ? (
          <div style={{ marginTop: "0.5rem" }}>
            <h1 className="v3-h1" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.35 }}>
              {title || "—"}
            </h1>
            <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
              게시된 대회 장부 · 수입·지출을 날짜순으로 기록합니다.
            </p>
          </div>
        ) : (
          <p className="v3-muted" style={{ margin: "0.5rem 0 0" }}>
            불러오는 중…
          </p>
        )}
      </header>

      {error ? (
        <p style={{ color: "#b91c1c", margin: "0 0 0.5rem", flexShrink: 0, fontSize: "0.9rem" }}>{error}</p>
      ) : null}

      {!loading ? (
        <div
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflow: "auto",
            paddingBottom: "0.5rem",
          }}
        >
          <div className="v3-row" style={{ marginBottom: "0.5rem", justifyContent: "flex-start" }}>
            <button type="button" className="v3-btn" onClick={() => setLines((p) => [...p, newDraftLine()])}>
              항목 추가
            </button>
          </div>

          <div style={{ overflowX: "auto", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.82rem",
                minWidth: "28rem",
              }}
            >
              <thead>
                <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #d1d5db", textAlign: "left" }}>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700, whiteSpace: "nowrap" }}>날짜</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700, whiteSpace: "nowrap" }}>유형</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700 }}>항목명</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700, whiteSpace: "nowrap" }}>금액</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700 }}>메모</th>
                  <th style={{ padding: "0.45rem 0.5rem", fontWeight: 700, width: "4rem", textAlign: "center" }}>삭제</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((L) => (
                  <tr key={L.key} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle" }}>
                      <input
                        type="date"
                        value={L.entryDate}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x) => (x.key === L.key ? { ...x, entryDate: e.target.value } : x)))
                        }
                        disabled={saving}
                        style={{ padding: "0.3rem 0.25rem", fontSize: "0.82rem", maxWidth: "10rem" }}
                      />
                    </td>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      <select
                        value={L.flow}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === L.key ? { ...x, flow: e.target.value === "EXPENSE" ? "EXPENSE" : "INCOME" } : x
                            )
                          )
                        }
                        disabled={saving}
                        style={{ padding: "0.3rem 0.25rem", fontSize: "0.82rem" }}
                      >
                        <option value="INCOME">수입</option>
                        <option value="EXPENSE">지출</option>
                      </select>
                    </td>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle" }}>
                      <input
                        value={L.label}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x) => (x.key === L.key ? { ...x, label: e.target.value } : x)))
                        }
                        disabled={saving}
                        placeholder="항목명"
                        style={{ padding: "0.3rem 0.35rem", width: "100%", minWidth: "5rem", fontSize: "0.82rem" }}
                      />
                    </td>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={L.amountKrw === 0 ? "" : String(L.amountKrw)}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((x) =>
                              x.key === L.key ? { ...x, amountKrw: parseAmountDigits(e.target.value) } : x
                            )
                          )
                        }
                        disabled={saving}
                        style={{ padding: "0.3rem 0.35rem", textAlign: "right", width: "100%", minWidth: "5rem", fontSize: "0.82rem" }}
                      />
                    </td>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle" }}>
                      <input
                        value={L.note}
                        onChange={(e) =>
                          setLines((prev) => prev.map((x) => (x.key === L.key ? { ...x, note: e.target.value } : x)))
                        }
                        disabled={saving}
                        placeholder="선택"
                        style={{ padding: "0.3rem 0.35rem", width: "100%", minWidth: "4rem", fontSize: "0.82rem" }}
                      />
                    </td>
                    <td style={{ padding: "0.35rem 0.45rem", verticalAlign: "middle", textAlign: "center" }}>
                      <button
                        type="button"
                        className="v3-btn"
                        style={{ padding: "0.28rem 0.5rem", fontSize: "0.8rem" }}
                        disabled={saving}
                        onClick={() => setLines((prev) => prev.filter((x) => x.key !== L.key))}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {!loading ? (
        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 4,
            flexShrink: 0,
            marginTop: "auto",
            paddingTop: "0.6rem",
            paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
            background: "linear-gradient(to top, #f8fafc 92%, transparent)",
          }}
        >
          <div
            className="v3-box"
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              boxShadow: "0 -4px 14px rgba(15, 23, 42, 0.07)",
              background: "#fff",
            }}
          >
            <div
              className="v3-row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <div
                className="v3-row"
                style={{ gap: "1rem", flexWrap: "wrap", fontSize: "0.88rem", alignItems: "baseline" }}
              >
                <span>
                  총 수입 <strong>{formatWon(totals.income)}</strong>
                </span>
                <span>
                  총 지출 <strong>{formatWon(totals.expense)}</strong>
                </span>
                <span>
                  차액 <strong>{formatWon(totals.net)}</strong>
                </span>
              </div>
              <div className="v3-row" style={{ alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                {saveState !== "idle" ? (
                  <span
                    className="v3-muted"
                    style={{
                      fontSize: "0.85rem",
                      color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280",
                    }}
                  >
                    {saveState === "success" ? "저장됨" : saveState === "error" ? "저장 실패" : "저장 중"}
                  </span>
                ) : null}
                <button
                  type="button"
                  className="ui-btn-primary-solid"
                  disabled={saving}
                  onClick={() => void save()}
                  style={{ padding: "0.6rem 1.2rem", fontSize: "0.95rem", fontWeight: 700, minWidth: "6rem" }}
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
