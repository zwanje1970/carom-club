"use client";

import { useCallback, useEffect, useState } from "react";
import { formatPrice, formatPostingMonths } from "@/lib/feature-access";

type Product = {
  id: string;
  code: string;
  name: string;
  postingMonths: number;
  price: number;
  currency: string;
  isActive: boolean;
  appliesToGeneralOnly: boolean;
};

const CODE_LABEL: Record<string, string> = {
  VENUE_PROMOTION: "당구장 홍보 등록",
  TOURNAMENT_POSTING: "대회 등록",
  LESSON_POSTING: "레슨 등록",
  CLUB_POSTING: "동호회 등록",
};

export function AdminListingProductsList() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ postingMonths: number; price: number; isActive: boolean } | null>(null);

  const fetchList = useCallback(async () => {
    const res = await fetch("/api/admin/listing-products");
    if (!res.ok) throw new Error("목록을 불러올 수 없습니다.");
    const data = await res.json();
    setList(data);
  }, []);

  useEffect(() => {
    fetchList().catch(() => setError("목록을 불러오는 중 오류가 발생했습니다.")).finally(() => setLoading(false));
  }, [fetchList]);

  function startEdit(p: Product) {
    setEditing(p.id);
    setEditForm({ postingMonths: p.postingMonths, price: p.price, isActive: p.isActive });
  }

  async function saveEdit(id: string) {
    if (!editForm) return;
    const res = await fetch(`/api/admin/listing-products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || "저장 실패");
      return;
    }
    setEditing(null);
    setEditForm(null);
    fetchList();
  }

  if (loading) return <p className="text-gray-500">불러오는 중...</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (list.length === 0) return <p className="text-gray-500">등록상품이 없습니다. API로 4종(VENUE_PROMOTION, TOURNAMENT_POSTING, LESSON_POSTING, CLUB_POSTING)을 추가해 주세요.</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-site-border bg-site-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-site-border bg-gray-50 dark:bg-slate-800/50">
            <th className="p-3 text-left font-medium">상품</th>
            <th className="p-3 text-left font-medium">게시기간</th>
            <th className="p-3 text-left font-medium">금액</th>
            <th className="p-3 text-left font-medium">활성</th>
            <th className="p-3 text-right font-medium">동작</th>
          </tr>
        </thead>
        <tbody>
          {list.map((p) => (
            <tr key={p.id} className="border-b border-site-border last:border-0">
              <td className="p-3">{CODE_LABEL[p.code] ?? p.name}</td>
              <td className="p-3">
                {editing === p.id && editForm ? (
                  <input
                    type="number"
                    min={1}
                    value={editForm.postingMonths}
                    onChange={(e) => setEditForm((f) => f && { ...f, postingMonths: Number(e.target.value) || 1 })}
                    className="w-20 rounded border border-site-border px-2 py-1"
                  />
                ) : (
                  formatPostingMonths(p.postingMonths)
                )}
              </td>
              <td className="p-3">
                {editing === p.id && editForm ? (
                  <input
                    type="number"
                    min={0}
                    value={editForm.price}
                    onChange={(e) => setEditForm((f) => f && { ...f, price: Number(e.target.value) || 0 })}
                    className="w-24 rounded border border-site-border px-2 py-1"
                  />
                ) : (
                  formatPrice(p.price, p.currency)
                )}
              </td>
              <td className="p-3">
                {editing === p.id && editForm ? (
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={editForm.isActive}
                      onChange={(e) => setEditForm((f) => f && { ...f, isActive: e.target.checked })}
                    />
                    {editForm.isActive ? "예" : "아니오"}
                  </label>
                ) : (
                  (p.isActive ? "예" : "아니오")
                )}
              </td>
              <td className="p-3 text-right">
                {editing === p.id ? (
                  <>
                    <button type="button" onClick={() => saveEdit(p.id)} className="rounded bg-site-primary px-2 py-1 text-xs text-white hover:opacity-90">저장</button>
                    <button type="button" onClick={() => { setEditing(null); setEditForm(null); }} className="ml-1 rounded bg-gray-200 px-2 py-1 text-xs hover:bg-gray-300">취소</button>
                  </>
                ) : (
                  <button type="button" onClick={() => startEdit(p)} className="rounded bg-site-primary px-2 py-1 text-xs text-white hover:opacity-90">수정</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
