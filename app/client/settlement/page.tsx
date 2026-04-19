"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = { tournamentId: string; title: string; income: number; expense: number; net: number };

type LedgerOverviewOk = {
  ok: true;
  rows: Row[];
  grand: { income: number; expense: number; net: number };
};

function formatWon(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}

export default function ClientSettlementHubPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<LedgerOverviewOk | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/client/settlements/ledger-overview", { credentials: "same-origin" });
      const json = (await res.json()) as LedgerOverviewOk | { error?: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        setData(null);
        setError((json as { error?: string }).error ?? "조회에 실패했습니다.");
        return;
      }
      setData(json);
    } catch {
      setData(null);
      setError("조회 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "1rem" }}>
      <header
        className="v3-row ui-client-dashboard-header"
        style={{
          justifyContent: "space-between",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.75rem",
          position: "sticky",
          top: 0,
          zIndex: 2,
          background: "#f8fafc",
          paddingBottom: "0.5rem",
          marginBottom: "-0.25rem",
        }}
      >
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client" style={{ padding: "0.5rem 0.9rem" }}>
            ← 대시보드
          </Link>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            정산
          </h1>
        </div>
      </header>

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
