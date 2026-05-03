"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

type Row = { tournamentId: string; title: string; income: number; expense: number; net: number };

type LedgerOverviewOk = {
  ok: true;
  rows: Row[];
  grand: { income: number; expense: number; net: number };
};

function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

function parseLedgerOverviewPayload(v: unknown): LedgerOverviewOk | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.ok === false) return null;
  if (!Array.isArray(o.rows)) return null;
  if (!o.grand || typeof o.grand !== "object") return null;
  const g = o.grand as Record<string, unknown>;
  const income = g.income;
  const expense = g.expense;
  const net = g.net;
  if (typeof income !== "number" || typeof expense !== "number" || typeof net !== "number") return null;
  for (const r of o.rows) {
    if (!r || typeof r !== "object") return null;
    const row = r as Record<string, unknown>;
    if (typeof row.tournamentId !== "string" || typeof row.title !== "string") return null;
    if (typeof row.income !== "number" || typeof row.expense !== "number" || typeof row.net !== "number") return null;
  }
  /* ok: true 권장. ok 생략 시에도 rows+grand 형식이 맞으면 정상(빈 정산)으로 취급 */
  if (o.ok !== true && o.ok !== undefined) return null;
  return { ok: true, rows: o.rows as Row[], grand: { income, expense, net } };
}

function errorTextFromApiPayload(v: unknown): string | null {
  if (!v || typeof v !== "object") return null;
  const e = (v as { error?: unknown }).error;
  return typeof e === "string" && e.trim() ? e.trim() : null;
}

export default function ClientSettlementHubPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<LedgerOverviewOk | null>(null);
  const loadReqIdRef = useRef(0);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    const reqId = ++loadReqIdRef.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/settlements/ledger-overview", { credentials: "same-origin", signal });
      const text = await res.text();
      let payload: unknown;
      if (text.trim() === "") {
        payload = {};
      } else {
        try {
          payload = JSON.parse(text) as unknown;
        } catch {
          if (signal?.aborted || reqId !== loadReqIdRef.current) return;
          setData(null);
          setError("조회에 실패했습니다.");
          return;
        }
      }
      if (signal?.aborted || reqId !== loadReqIdRef.current) return;

      const okBody = parseLedgerOverviewPayload(payload);
      if (res.ok && okBody) {
        setData(okBody);
        setError("");
        return;
      }
      if (res.ok && !okBody) {
        setData(null);
        setError(errorTextFromApiPayload(payload) ?? "조회에 실패했습니다.");
        return;
      }
      setData(null);
      setError(errorTextFromApiPayload(payload) ?? "조회에 실패했습니다.");
    } catch (e) {
      if (signal?.aborted) return;
      if (e instanceof DOMException && e.name === "AbortError") return;
      if (reqId !== loadReqIdRef.current) return;
      setData(null);
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      if (reqId === loadReqIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void loadOverview(ac.signal);
    return () => {
      ac.abort();
    };
  }, [loadOverview]);

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "1rem", paddingTop: "0.35rem" }}>
      <p className="v3-muted" style={{ margin: 0, fontSize: "0.88rem" }}>
        메인에 <strong>게시 중인 대회</strong>만 아래에 표시됩니다. 대회일과 관계없이 게시 후부터 장부를 사용할 수 있습니다.
      </p>

      {error ? (
        <p className="v3-muted" style={{ color: "#b91c1c", margin: 0 }}>
          {error}
        </p>
      ) : null}

      <section className="v3-box v3-stack" aria-label="전체 합계" style={{ padding: "1.1rem 1.15rem" }}>
        <h2 className="v3-h2" style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#64748b" }}>
          합계
        </h2>
        {loading && !data ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            불러오는 중…
          </p>
        ) : data ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(9.5rem, 1fr))",
              gap: "1rem 1.25rem",
            }}
          >
            <div>
              <p className="v3-muted" style={{ margin: "0 0 0.2rem", fontSize: "0.85rem" }}>
                총 수입
              </p>
              <p style={{ margin: 0, fontSize: "clamp(1.35rem, 4vw, 1.75rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                {formatWon(data.grand.income)}
              </p>
            </div>
            <div>
              <p className="v3-muted" style={{ margin: "0 0 0.2rem", fontSize: "0.85rem" }}>
                총 지출
              </p>
              <p style={{ margin: 0, fontSize: "clamp(1.35rem, 4vw, 1.75rem)", fontWeight: 800, letterSpacing: "-0.03em" }}>
                {formatWon(data.grand.expense)}
              </p>
            </div>
            <div>
              <p className="v3-muted" style={{ margin: "0 0 0.2rem", fontSize: "0.85rem" }}>
                최종 합계 (수입 − 지출)
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: "clamp(1.35rem, 4vw, 1.75rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  color: "#0f172a",
                }}
              >
                {formatWon(data.grand.net)}
              </p>
            </div>
          </div>
        ) : (
          <p className="v3-muted" style={{ margin: 0 }}>
            데이터 없음
          </p>
        )}
      </section>

      <section className="v3-stack" aria-label="대회별" style={{ gap: "0.75rem" }}>
        <h2 className="v3-h2" style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
          대회별
        </h2>
        {loading && !data ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            불러오는 중…
          </p>
        ) : data && data.rows.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            게시된 대회가 없습니다. 대회를 메인에 게시하면 여기에서 장부로 이동할 수 있습니다.
          </p>
        ) : data && data.rows.length > 0 ? (
          <ul className="v3-stack" style={{ gap: "0.75rem", listStyle: "none", margin: 0, padding: 0 }}>
            {data.rows.map((r) => {
              const href = `/client/settlement/${r.tournamentId}`;
              return (
                <li key={r.tournamentId}>
                  <Link
                    prefetch={false}
                    href={href}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <section
                      className="v3-box"
                      style={{
                        padding: "0.9rem 1rem",
                        border: "1px solid #e5e7eb",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                        transition: "background 0.12s ease",
                      }}
                    >
                      <div
                        className="v3-row"
                        style={{
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "0.75rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <div style={{ flex: "1 1 12rem", minWidth: 0 }}>
                          <h3
                            style={{
                              margin: 0,
                              fontSize: "1.05rem",
                              fontWeight: 700,
                              lineHeight: 1.35,
                              wordBreak: "break-word",
                            }}
                          >
                            {r.title}
                          </h3>
                          <div
                            className="v3-row"
                            style={{
                              marginTop: "0.5rem",
                              flexWrap: "wrap",
                              gap: "0.65rem 1rem",
                              fontSize: "0.88rem",
                            }}
                          >
                            <span>
                              <span className="v3-muted">수입 </span>
                              <strong>{formatWon(r.income)}</strong>
                            </span>
                            <span>
                              <span className="v3-muted">지출 </span>
                              <strong>{formatWon(r.expense)}</strong>
                            </span>
                            <span>
                              <span className="v3-muted">차액 </span>
                              <strong>{formatWon(r.net)}</strong>
                            </span>
                          </div>
                        </div>
                        <span
                          className="v3-btn"
                          style={{
                            padding: "0.65rem 1rem",
                            minHeight: "2.75rem",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 600,
                            flexShrink: 0,
                          }}
                        >
                          장부
                        </span>
                      </div>
                    </section>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="v3-muted" style={{ margin: 0 }}>
            데이터 없음
          </p>
        )}
      </section>
    </main>
  );
}
