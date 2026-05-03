"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { computeLedgerTotalsFromLines } from "../../../../lib/settlement-ledger-v2";

type MoneyRow = { key: string; label: string; amountKrw: number };

function newMoneyRow(): MoneyRow {
  return {
    key: `k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    label: "",
    amountKrw: 0,
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

function rowsToLedgerPayload(expenses: MoneyRow[], incomes: MoneyRow[]) {
  const lines: Array<{
    category: "OTHER";
    flow: "EXPENSE" | "INCOME";
    amountKrw: number;
    label: string | null;
    note: null;
    entryDate: null;
  }> = [];
  for (const row of expenses) {
    lines.push({
      category: "OTHER",
      flow: "EXPENSE",
      amountKrw: row.amountKrw,
      label: row.label.trim() ? row.label.trim() : null,
      note: null,
      entryDate: null,
    });
  }
  for (const row of incomes) {
    lines.push({
      category: "OTHER",
      flow: "INCOME",
      amountKrw: row.amountKrw,
      label: row.label.trim() ? row.label.trim() : null,
      note: null,
      entryDate: null,
    });
  }
  return lines;
}

/** 서버 id와 무관하게 내용만 비교(초기 로드 직후 자동 저장 방지·dirty 판별). */
function serializeLedgerContent(expenses: MoneyRow[], incomes: MoneyRow[]) {
  return JSON.stringify({
    e: expenses.map((r) => ({ label: r.label.trim(), a: r.amountKrw })),
    i: incomes.map((r) => ({ label: r.label.trim(), a: r.amountKrw })),
  });
}

const AUTO_SAVE_DEBOUNCE_MS = 1500;

export default function ClientSettlementLedgerEditPage() {
  const params = useParams<{ tournamentId: string }>();
  const tournamentId = typeof params.tournamentId === "string" ? params.tournamentId : "";

  const [title, setTitle] = useState("");
  const [expenseRows, setExpenseRows] = useState<MoneyRow[]>([]);
  const [incomeRows, setIncomeRows] = useState<MoneyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [error, setError] = useState("");
  /** 서버 내용과 다를 때(자동/수동 저장 대상) */
  const [dirty, setDirty] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  /** [결산하기] 클릭 후에만 채움 — 초기 진입·저장 후에는 null */
  const [settlementTotals, setSettlementTotals] = useState<{ income: number; expense: number; net: number } | null>(null);

  const baselineSerializedRef = useRef<string | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expenseRowsRef = useRef<MoneyRow[]>([]);
  const incomeRowsRef = useRef<MoneyRow[]>([]);

  useEffect(() => {
    expenseRowsRef.current = expenseRows;
    incomeRowsRef.current = incomeRows;
  });

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!tournamentId) return;
      const silent = Boolean(options?.silent);
      if (!silent) {
        setLoading(true);
      }
      if (!silent) {
        setError("");
        setSettlementTotals(null);
      }
      try {
        const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/settlement/ledger`);
        const json = (await res.json()) as {
          tournament?: { title: string; id: string };
          lines?: Array<{
            flow: string;
            amountKrw: number;
            label: string | null;
            id: string;
          }>;
          error?: string;
        };
        if (!res.ok) {
          if (!silent) setError(json.error ?? "불러오지 못했습니다.");
          return;
        }
        if (json.tournament) {
          setTitle(json.tournament.title);
        }
        const ex: MoneyRow[] = [];
        const inc: MoneyRow[] = [];
        for (const L of json.lines ?? []) {
          const row: MoneyRow = {
            key: L.id,
            label: L.label ?? "",
            amountKrw: L.amountKrw,
          };
          if (L.flow === "EXPENSE") ex.push(row);
          else inc.push(row);
        }
        baselineSerializedRef.current = serializeLedgerContent(ex, inc);
        setDirty(false);
        setExpenseRows(ex);
        setIncomeRows(inc);
      } catch {
        if (!silent) setError("불러오는 중 오류가 발생했습니다.");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [tournamentId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const putLedger = useCallback(
    async (source: "manual" | "auto"): Promise<boolean> => {
      if (!tournamentId) return false;

      const ex = expenseRowsRef.current;
      const inc = incomeRowsRef.current;

      setSaving(true);
      if (source === "manual") {
        setSaveState("saving");
        setError("");
        setAutoSaveStatus("idle");
      } else {
        setAutoSaveStatus("saving");
      }
      try {
        const res = await fetch(`/api/client/tournaments/${encodeURIComponent(tournamentId)}/settlement/ledger`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lines: rowsToLedgerPayload(ex, inc),
          }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          if (source === "manual") {
            setError(json.error ?? "저장에 실패했습니다.");
            setSaveState("error");
          } else {
            setAutoSaveStatus("error");
          }
          return false;
        }
        if (source === "manual") {
          setSaveState("success");
          setSettlementTotals(null);
        } else {
          setAutoSaveStatus("saved");
        }
        setDirty(false);
        await load({ silent: true });
        return true;
      } catch {
        if (source === "manual") {
          setError("저장 중 오류가 발생했습니다.");
          setSaveState("error");
        } else {
          setAutoSaveStatus("error");
        }
        return false;
      } finally {
        setSaving(false);
      }
    },
    [tournamentId, load],
  );

  const contentSig = serializeLedgerContent(expenseRows, incomeRows);

  useEffect(() => {
    if (loading || !tournamentId) return;
    if (baselineSerializedRef.current === null) return;

    if (contentSig === baselineSerializedRef.current) {
      setDirty(false);
      return;
    }
    setDirty(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      const latest = serializeLedgerContent(expenseRowsRef.current, incomeRowsRef.current);
      if (latest === baselineSerializedRef.current) return;
      void putLedger("auto");
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [contentSig, loading, tournamentId, putLedger]);

  useEffect(() => {
    if (autoSaveStatus !== "saved") return;
    const t = setTimeout(() => setAutoSaveStatus("idle"), 2500);
    return () => clearTimeout(t);
  }, [autoSaveStatus]);

  async function save() {
    if (!tournamentId || saving) return;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    await putLedger("manual");
  }

  function runSettlement() {
    const lines = rowsToLedgerPayload(expenseRows, incomeRows).map((L) => ({
      flow: L.flow,
      amountKrw: L.amountKrw,
    }));
    setSettlementTotals(computeLedgerTotalsFromLines(lines));
  }

  function renderMoneySection(
    sectionTitle: string,
    rows: MoneyRow[],
    setRows: Dispatch<SetStateAction<MoneyRow[]>>,
    addLabel: string,
  ) {
    return (
      <section className="v3-stack" style={{ gap: "0.65rem" }} aria-label={sectionTitle}>
        <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
          {sectionTitle}
        </h2>
        <div className="v3-stack" style={{ gap: "0.5rem" }}>
          {rows.map((L) => (
            <div
              key={L.key}
              className="v3-row"
              style={{
                flexWrap: "wrap",
                gap: "0.5rem",
                alignItems: "center",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                padding: "0.5rem 0.55rem",
                background: "#fff",
              }}
            >
              <input
                value={L.label}
                onChange={(e) =>
                  setRows((prev) => prev.map((x) => (x.key === L.key ? { ...x, label: e.target.value } : x)))
                }
                disabled={saving}
                placeholder="항목명"
                style={{ flex: "1 1 8rem", minWidth: "6rem", padding: "0.35rem 0.45rem", fontSize: "0.9rem" }}
              />
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={L.amountKrw === 0 ? "" : String(L.amountKrw)}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((x) => (x.key === L.key ? { ...x, amountKrw: parseAmountDigits(e.target.value) } : x))
                  )
                }
                disabled={saving}
                placeholder="금액"
                style={{
                  width: "7.5rem",
                  padding: "0.35rem 0.45rem",
                  fontSize: "0.9rem",
                  textAlign: "right",
                }}
              />
              <button
                type="button"
                className="v3-btn"
                style={{ padding: "0.35rem 0.55rem", fontSize: "0.82rem" }}
                disabled={saving}
                onClick={() => setRows((prev) => prev.filter((x) => x.key !== L.key))}
              >
                삭제
              </button>
            </div>
          ))}
        </div>
        <div>
          <button
            type="button"
            className="v3-btn"
            disabled={saving}
            onClick={() => setRows((p) => [...p, newMoneyRow()])}
            style={{ padding: "0.45rem 0.75rem", fontWeight: 600 }}
          >
            {addLabel}
          </button>
        </div>
      </section>
    );
  }

  if (!tournamentId) {
    return (
      <main className="v3-page v3-stack">
        <p className="v3-muted">잘못된 경로입니다.</p>
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
        {!loading ? (
          <div style={{ marginTop: "0.5rem" }}>
            <h1 className="v3-h1" style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, lineHeight: 1.35 }}>
              {title || "—"}
            </h1>
            <p className="v3-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>
              비용·수입만 기록합니다. 변경 후 약 {AUTO_SAVE_DEBOUNCE_MS / 1000}초 뒤 자동 저장되며, 하단 저장으로도 바로 반영할 수 있습니다.
              {dirty ? (
                <span style={{ color: "#64748b", fontWeight: 600 }}> · 변경됨</span>
              ) : null}
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
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {renderMoneySection("비용", expenseRows, setExpenseRows, "+ 추가")}
          {renderMoneySection("수입", incomeRows, setIncomeRows, "+ 추가")}

          <div className="v3-stack" style={{ gap: "0.5rem" }}>
            <button
              type="button"
              className="v3-btn"
              disabled={saving}
              onClick={runSettlement}
              style={{ padding: "0.5rem 1rem", fontWeight: 700, alignSelf: "flex-start" }}
            >
              결산하기
            </button>
            {settlementTotals ? (
              <div
                className="v3-box"
                style={{
                  padding: "0.75rem 1rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  fontSize: "0.9rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <span>
                  총 수입 <strong>{formatWon(settlementTotals.income)}</strong>
                </span>
                <span>
                  총 비용 <strong>{formatWon(settlementTotals.expense)}</strong>
                </span>
                <span>
                  손익 <strong>{formatWon(settlementTotals.net)}</strong>
                </span>
              </div>
            ) : null}
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
            {autoSaveStatus !== "idle" ? (
              <p
                className="v3-muted"
                style={{
                  margin: "0 0 0.5rem",
                  fontSize: "0.82rem",
                  color:
                    autoSaveStatus === "saved" ? "#15803d" : autoSaveStatus === "error" ? "#b91c1c" : "#6b7280",
                }}
              >
                {autoSaveStatus === "saving"
                  ? "저장 중..."
                  : autoSaveStatus === "saved"
                    ? "자동 저장됨"
                    : "저장 실패"}
              </p>
            ) : null}
            <div className="v3-row" style={{ justifyContent: "flex-end", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
              {saveState !== "idle" ? (
                <span
                  className="v3-muted"
                  style={{
                    fontSize: "0.85rem",
                    color: saveState === "success" ? "#15803d" : saveState === "error" ? "#b91c1c" : "#6b7280",
                  }}
                >
                  {saveState === "success" ? "저장됨" : saveState === "error" ? "저장 실패" : "저장 중..."}
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
      ) : null}
    </main>
  );
}
