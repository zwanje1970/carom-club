"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type CopyItemType = "HARDCODE" | "DATA" | "CONFIG";

type CopyItem = {
  text: string;
  file: string;
  path: string;
  type: CopyItemType;
};

function getGuideByType(type: CopyItemType): string {
  if (type === "DATA") return "데이터 수정 필요";
  if (type === "CONFIG") return "설정에서 수정 가능";
  return "코드 수정 필요";
}

export default function PlatformSiteCopyPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CopyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const countLabel = useMemo(() => `${items.length}건`, [items.length]);

  async function handleSearch() {
    if (loading) return;
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch(`/api/platform/site-copy?q=${encodeURIComponent(query.trim())}`);
      const result = (await response.json()) as { items?: CopyItem[]; error?: string };
      if (!response.ok || !Array.isArray(result.items)) {
        setMessage(result.error ?? "검색에 실패했습니다.");
        return;
      }
      setItems(result.items);
      if (result.items.length === 0) {
        setMessage("검색 결과가 없습니다.");
      }
    } catch {
      setMessage("검색 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="v3-page v3-stack">
      <h1 className="v3-h1">문구/카피</h1>
      <p className="v3-muted">사이트 문구를 검색하고 위치를 추적합니다.</p>

      <section className="v3-box v3-stack">
        <label className="v3-stack">
          <span>검색어</span>
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="예: 대회, 마이페이지"
            style={{ padding: "0.55rem", border: "1px solid #bbb", borderRadius: "0.4rem" }}
          />
        </label>
        <div className="v3-row">
          <button type="button" className="v3-btn" onClick={handleSearch} disabled={loading}>
            {loading ? "검색 중..." : "검색"}
          </button>
          <span className="v3-muted">결과: {countLabel}</span>
        </div>
      </section>

      {message ? <p className="v3-muted">{message}</p> : null}

      {items.length > 0 ? (
        <ul className="v3-list">
          {items.map((item, index) => (
            <li key={`${item.file}-${item.text}-${index}`}>
              <p>
                <strong>문구:</strong> {item.text}
              </p>
              <p className="v3-muted">
                <strong>파일:</strong> {item.file}
              </p>
              <p className="v3-muted">
                <strong>페이지 경로:</strong> {item.path}
              </p>
              <p className="v3-muted">
                <strong>유형:</strong> {item.type}
              </p>
              <p className="v3-muted">
                <strong>수정 안내:</strong> {getGuideByType(item.type)}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      <Link className="v3-btn" href="/platform/site">
        사이트 관리로
      </Link>
    </main>
  );
}
