"use client";

import { useState, useEffect } from "react";
import { mdiStar } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type Item = { id: string; type: string; targetId: string; title: string; sortOrder: number; createdAt: string };

const TYPE_LABELS: Record<string, string> = { tournament: "대회", venue: "당구장", post: "게시글" };

export default function AdminSettingsFeaturedContentPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [addType, setAddType] = useState<"tournament" | "venue" | "post">("tournament");
  const [addTargetId, setAddTargetId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/admin/featured-content")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const add = async () => {
    if (!addTargetId.trim()) {
      setError("대상 ID를 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/featured-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: addType, targetId: addTargetId.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "추가 실패");
        return;
      }
      setSuccess("추가되었습니다.");
      setAddTargetId("");
      load();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("추가 실패");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("추천에서 제거할까요?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/featured-content/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("제거 실패");
        return;
      }
      setSuccess("제거되었습니다.");
      load();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("제거 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiStar} title="추천 콘텐츠 관리" />

      <CardBox className="mb-6">
        <h3 className="font-semibold mb-2">추천 추가</h3>
        <p className="text-sm text-gray-500 mb-2">대회/당구장/게시글 ID를 입력하세요. (목록에서 확인 후 ID 복사)</p>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={addType}
            onChange={(e) => setAddType(e.target.value as "tournament" | "venue" | "post")}
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
          >
            <option value="tournament">대회</option>
            <option value="venue">당구장</option>
            <option value="post">게시글</option>
          </select>
          <input
            type="text"
            value={addTargetId}
            onChange={(e) => setAddTargetId(e.target.value)}
            placeholder="대상 ID (cuid)"
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 w-64"
          />
          <Button label="추가" color="info" onClick={add} disabled={saving} />
          {error && <NotificationBar color="danger">{error}</NotificationBar>}
          {success && <NotificationBar color="success">{success}</NotificationBar>}
        </div>
      </CardBox>

      <CardBox>
        {loading ? (
          <p className="text-gray-500">불러오는 중…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-site-border">
                  <th className="text-left p-2">타입</th>
                  <th className="text-left p-2">제목</th>
                  <th className="text-left p-2">ID</th>
                  <th className="p-2">동작</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-site-border/50">
                    <td className="p-2">{TYPE_LABELS[item.type] ?? item.type}</td>
                    <td className="p-2">{item.title}</td>
                    <td className="p-2 font-mono text-xs">{item.targetId}</td>
                    <td className="p-2">
                      <button type="button" onClick={() => remove(item.id)} className="text-red-600 hover:underline">제거</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-4 text-gray-500">추천 콘텐츠가 없습니다.</p>}
          </div>
        )}
      </CardBox>
    </SectionMain>
  );
}
