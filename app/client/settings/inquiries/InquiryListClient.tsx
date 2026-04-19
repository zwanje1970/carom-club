"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  type: "ERROR" | "FEATURE";
  title: string;
  createdAt: string;
  updatedAt: string;
  hasAdminReply: boolean;
};

const TYPE_LABEL: Record<string, string> = { ERROR: "오류", FEATURE: "기능" };

export default function InquiryListClient() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/client/inquiries", { credentials: "same-origin" });
      const data = (await res.json()) as { error?: string; items?: Row[] };
      if (!res.ok) {
        setErr(data.error ?? "목록을 불러오지 못했습니다.");
        setItems([]);
        return;
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setErr("목록 요청 중 오류가 발생했습니다.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="v3-page v3-stack ui-client-dashboard" style={{ gap: "0.85rem" }}>
      <div className="v3-row ui-client-dashboard-header" style={{ flexWrap: "wrap", alignItems: "center", gap: "0.75rem" }}>
        <div className="v3-row" style={{ alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link className="v3-btn" href="/client/settings" style={{ padding: "0.5rem 0.9rem" }}>
            ← 부가기능
          </Link>
          <h1 className="v3-h1" style={{ marginBottom: 0, fontWeight: 800, letterSpacing: "-0.02em" }}>
            문의 내역
          </h1>
        </div>
      </div>

      <div className="v3-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
        <Link className="v3-btn" href="/client/settings/inquiries/new?type=error" style={{ padding: "0.45rem 0.85rem" }}>
          오류 제보 작성
        </Link>
        <Link className="v3-btn" href="/client/settings/inquiries/new?type=feature" style={{ padding: "0.45rem 0.85rem" }}>
          기능 제안 작성
        </Link>
      </div>

      {err ? (
        <p style={{ color: "#b91c1c", margin: 0, fontSize: "0.9rem" }}>{err}</p>
      ) : null}

      {loading ? (
        <p className="v3-muted" style={{ margin: 0 }}>
          불러오는 중…
        </p>
      ) : items.length === 0 ? (
        <p className="v3-muted" style={{ margin: 0 }}>
          등록한 문의가 없습니다.
        </p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #d1d5db", borderRadius: "6px", background: "#fff" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.86rem" }}>
            <thead>
              <tr style={{ background: "#f3f4f6", borderBottom: "1px solid #d1d5db", textAlign: "left" }}>
                <th style={{ padding: "0.45rem 0.55rem" }}>제목</th>
                <th style={{ padding: "0.45rem 0.55rem", whiteSpace: "nowrap" }}>작성일</th>
                <th style={{ padding: "0.45rem 0.55rem", whiteSpace: "nowrap" }}>상태</th>
                <th style={{ padding: "0.45rem 0.55rem" }}>유형</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "0.4rem 0.55rem" }}>
                    <Link href={`/client/settings/inquiries/${r.id}`} style={{ color: "#1d4ed8", fontWeight: 600 }}>
                      {r.title}
                    </Link>
                  </td>
                  <td style={{ padding: "0.4rem 0.55rem", color: "#525252", whiteSpace: "nowrap" }}>
                    {new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={{ padding: "0.4rem 0.55rem", whiteSpace: "nowrap" }}>
                    {r.hasAdminReply ? "답변완료" : "답변대기"}
                  </td>
                  <td style={{ padding: "0.4rem 0.55rem", whiteSpace: "nowrap" }}>{TYPE_LABEL[r.type] ?? r.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
