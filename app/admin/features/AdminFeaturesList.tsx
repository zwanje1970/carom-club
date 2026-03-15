"use client";

import { useCallback, useEffect, useState } from "react";

type Feature = { id: string; code: string; name: string; description: string | null; isActive: boolean };

export function AdminFeaturesList() {
  const [list, setList] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/admin/features");
    if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    fetchList().catch(() => setError("목록을 불러오는 중 오류가 발생했습니다.")).finally(() => setLoading(false));
  }, [fetchList]);

  async function toggleActive(f: Feature) {
    setEditing(f.id);
    try {
      const res = await fetch(`/api/admin/features/${f.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !f.isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "저장 실패");
        return;
      }
      await fetchList();
    } finally {
      setEditing(null);
    }
  }

  if (loading) return <p className="text-gray-500">불러오는 중...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (list.length === 0) return <p className="text-gray-500">등록된 기능이 없습니다. API로 추가하거나 시드 데이터를 넣어 주세요.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
            <th className="p-3 text-left font-medium">코드</th>
            <th className="p-3 text-left font-medium">이름</th>
            <th className="p-3 text-left font-medium">설명</th>
            <th className="p-3 text-left font-medium">활성</th>
            <th className="p-3 text-right font-medium">동작</th>
          </tr>
        </thead>
        <tbody>
          {list.map((f) => (
            <tr key={f.id} className="border-b border-site-border last:border-0">
              <td className="p-3 font-mono text-xs">{f.code}</td>
              <td className="p-3">{f.name}</td>
              <td className="p-3 text-gray-500 max-w-[200px] truncate">{f.description ?? "—"}</td>
              <td className="p-3">{f.isActive ? "예" : "아니오"}</td>
              <td className="p-3 text-right">
                <button
                  type="button"
                  disabled={!!editing}
                  onClick={() => toggleActive(f)}
                  className="rounded bg-site-primary px-2 py-1 text-xs text-white hover:opacity-90 disabled:opacity-50"
                >
                  {editing === f.id ? "..." : f.isActive ? "비활성" : "활성"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
