"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Row = {
  id: string;
  title: string;
  createdAt: string;
  senderName: string;
  organizationDisplay: string;
};

export default function PlatformClientInquiriesList() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/platform/client-inquiries", { credentials: "same-origin" });
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

  function senderLine(r: Row) {
    const org = r.organizationDisplay?.trim() || "소속 없음";
    return `${r.senderName} (${org})`;
  }

  return (
    <>
      {err ? (
        <p style={{ color: "#b91c1c", margin: "0 0 0.75rem" }}>{err}</p>
      ) : null}

      {loading ? (
        <p className="v3-muted">불러오는 중…</p>
      ) : items.length === 0 ? (
        <p className="v3-muted">문의가 없습니다.</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fafafa" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
            <thead>
              <tr style={{ background: "#e2e8f0", borderBottom: "1px solid #cbd5e1", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.65rem", minWidth: "14rem" }}>보낸 사람(소속)</th>
                <th style={{ padding: "0.5rem 0.65rem" }}>제목</th>
                <th style={{ padding: "0.5rem 0.65rem", whiteSpace: "nowrap" }}>작성 시각</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid #e2e8f0", background: "#fff" }}>
                  <td style={{ padding: "0.5rem 0.65rem", verticalAlign: "top", color: "#0f172a" }}>{senderLine(r)}</td>
                  <td style={{ padding: "0.5rem 0.65rem", verticalAlign: "top" }}>
                    <Link href={`/platform/operations/support/${r.id}`} prefetch={false} style={{ color: "#1e40af", fontWeight: 600 }}>
                      {r.title}
                    </Link>
                  </td>
                  <td style={{ padding: "0.5rem 0.65rem", verticalAlign: "top", color: "#475569", whiteSpace: "nowrap" }}>
                    {new Date(r.createdAt).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
