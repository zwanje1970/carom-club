"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type TabKey = "tournaments" | "cards" | "ads" | "posts";

type Row = {
  id: string;
  title: string;
  kind: string;
  deletedAt: string;
  deletedBy: string;
  deletedByLabel: string;
  deleteReason?: string;
  extra?: string;
};

const TABS: { key: TabKey; label: string }[] = [
  { key: "tournaments", label: "대회" },
  { key: "cards", label: "게시카드" },
  { key: "ads", label: "광고" },
  { key: "posts", label: "게시글" },
];

export default function DeletedBackupClient() {
  const [tab, setTab] = useState<TabKey>("tournaments");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [confirmInputs, setConfirmInputs] = useState<Record<string, string>>({});

  const load = useCallback(async (t: TabKey) => {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch(`/api/platform/data/deleted?tab=${encodeURIComponent(t)}`, { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; rows?: Row[]; error?: string };
      if (!res.ok || !data.ok || !Array.isArray(data.rows)) {
        setMessage(data.error ?? "목록을 불러오지 못했습니다.");
        setRows([]);
        return;
      }
      setRows(data.rows);
    } catch {
      setMessage("목록 조회 중 오류가 발생했습니다.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  async function handleRestore(row: Row) {
    setMessage("");
    if (!confirm("이 항목을 복구하시겠습니까?")) return;
    let url = "";
    if (tab === "tournaments") url = `/api/platform/data/deleted/tournaments/${encodeURIComponent(row.id)}/restore`;
    if (tab === "cards") url = `/api/platform/data/deleted/cards/${encodeURIComponent(row.id)}/restore`;
    if (tab === "ads") url = `/api/platform/data/deleted/ads/${encodeURIComponent(row.id)}/restore`;
    if (tab === "posts") url = `/api/platform/data/deleted/posts/${encodeURIComponent(row.id)}/restore`;
    const res = await fetch(url, { method: "POST", cache: "no-store" });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setMessage(data.error ?? "복구에 실패했습니다.");
      return;
    }
    setMessage("복구되었습니다.");
    await load(tab);
  }

  async function handlePermanent(row: Row) {
    setMessage("");
    if (!confirm("완전삭제하면 복구할 수 없습니다. 계속하려면 DELETE를 입력하세요.")) return;
    const typed = (confirmInputs[row.id] ?? "").trim();
    if (typed !== "DELETE") {
      setMessage("입력란에 대문자 DELETE를 정확히 입력한 뒤 완전 삭제를 눌러 주세요.");
      return;
    }
    let url = "";
    if (tab === "tournaments") url = `/api/platform/data/deleted/tournaments/${encodeURIComponent(row.id)}/permanent`;
    if (tab === "cards") url = `/api/platform/data/deleted/cards/${encodeURIComponent(row.id)}/permanent`;
    if (tab === "ads") url = `/api/platform/data/deleted/ads/${encodeURIComponent(row.id)}/permanent`;
    if (tab === "posts") url = `/api/platform/data/deleted/posts/${encodeURIComponent(row.id)}/permanent`;
    const res = await fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmText: typed }),
    });
    const data = (await res.json()) as { ok?: boolean; error?: string };
    if (!res.ok || !data.ok) {
      setMessage(data.error ?? "완전 삭제에 실패했습니다.");
      return;
    }
    setConfirmInputs((prev) => {
      const next = { ...prev };
      delete next[row.id];
      return next;
    });
    setMessage("완전 삭제되었습니다. 복구할 수 없습니다.");
    await load(tab);
  }

  return (
    <div className="v3-stack" style={{ gap: "1rem" }}>
      <p className="v3-muted">
        <Link href="/platform/data">← 데이터 관리</Link>
      </p>
      <h1 className="v3-h1">삭제된 항목 (백업함)</h1>
      <p className="v3-muted">
        완전 삭제는 되돌릴 수 없습니다. 완전 삭제 버튼을 누른 뒤 안내에 따라 입력란에 대문자 DELETE를 입력해야
        실행됩니다. 전체·일괄 삭제 기능은 없습니다.
      </p>

      <div className="v3-row" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "v3-btn" : "v3-btn"}
            style={
              tab === t.key
                ? { fontWeight: 700 }
                : { opacity: 0.85, background: "#f0f0f0", color: "#333", border: "1px solid #ccc" }
            }
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message ? <p className="v3-muted">{message}</p> : null}
      {loading ? <p className="v3-muted">불러오는 중…</p> : null}

      {!loading && rows.length === 0 ? <p className="v3-muted">백업함에 항목이 없습니다.</p> : null}

      {!loading && rows.length > 0 ? (
        <div className="v3-box v3-stack" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>제목/이름</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>종류</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>삭제일</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>삭제한 관리자</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>삭제 사유</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid #ddd" }}>작업</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    {row.title}
                    {row.extra ? (
                      <span className="v3-muted" style={{ display: "block", fontSize: "0.8rem" }}>
                        {tab === "posts" ? `게시판: ${row.extra}` : `대회 ID: ${row.extra}`}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" }}>{row.kind}</td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    {row.deletedAt || "—"}
                  </td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    {row.deletedByLabel || row.deletedBy || "—"}
                  </td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top", maxWidth: "14rem" }}>
                    {row.deleteReason?.trim() ? row.deleteReason.trim() : "—"}
                  </td>
                  <td style={{ padding: "0.5rem", borderBottom: "1px solid #eee", verticalAlign: "top" }}>
                    <div className="v3-stack" style={{ gap: "0.35rem", minWidth: "200px" }}>
                      <button className="v3-btn" type="button" onClick={() => void handleRestore(row)}>
                        복구
                      </button>
                      <label className="v3-stack" style={{ fontSize: "0.8rem", gap: "0.2rem" }}>
                        <span className="v3-muted">완전 삭제 확인 (DELETE 입력)</span>
                        <input
                          type="text"
                          autoComplete="off"
                          placeholder="DELETE"
                          value={confirmInputs[row.id] ?? ""}
                          onChange={(e) =>
                            setConfirmInputs((prev) => ({ ...prev, [row.id]: e.target.value }))
                          }
                          style={{ padding: "0.35rem", border: "1px solid #ccc", borderRadius: "0.25rem" }}
                        />
                      </label>
                      <button
                        type="button"
                        className="v3-btn"
                        style={{ background: "#8b2942", color: "#fff" }}
                        onClick={() => void handlePermanent(row)}
                      >
                        완전 삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
