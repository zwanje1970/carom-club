"use client";

import { useState, useEffect } from "react";
import { mdiBullhorn } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type NoticeItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  linkUrl: string | null;
  startAt: string | null;
  endAt: string | null;
  isActive: boolean;
  showOnce: boolean;
  showMobile: boolean;
  showDesktop: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

const TYPE_LABELS: Record<string, string> = { bar: "공지바", popup: "팝업", emergency: "긴급 공지" };

export default function AdminSettingsNoticesPage() {
  const [items, setItems] = useState<NoticeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [modal, setModal] = useState<"create" | "edit" | null>(null);
  const [form, setForm] = useState({
    type: "bar",
    title: "",
    content: "",
    linkUrl: "",
    startAt: "",
    endAt: "",
    isActive: true,
    showOnce: false,
    showMobile: true,
    showDesktop: true,
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    const params = typeFilter ? `?type=${typeFilter}` : "";
    fetch(`/api/admin/notices${params}`)
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [typeFilter]);

  const openCreate = () => {
    setForm({
      type: "bar",
      title: "",
      content: "",
      linkUrl: "",
      startAt: "",
      endAt: "",
      isActive: true,
      showOnce: false,
      showMobile: true,
      showDesktop: true,
    });
    setEditId(null);
    setModal("create");
  };

  const openEdit = (n: NoticeItem) => {
    setForm({
      type: n.type,
      title: n.title,
      content: n.content,
      linkUrl: n.linkUrl ?? "",
      startAt: n.startAt ? n.startAt.slice(0, 16) : "",
      endAt: n.endAt ? n.endAt.slice(0, 16) : "",
      isActive: n.isActive,
      showOnce: n.showOnce,
      showMobile: n.showMobile,
      showDesktop: n.showDesktop,
    });
    setEditId(n.id);
    setModal("edit");
  };

  const save = async () => {
    if (!form.title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const url = editId ? `/api/admin/notices/${editId}` : "/api/admin/notices";
      const method = editId ? "PATCH" : "POST";
      const body = editId
        ? { ...form, startAt: form.startAt || null, endAt: form.endAt || null }
        : { ...form, startAt: form.startAt || null, endAt: form.endAt || null };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "저장 실패");
        return;
      }
      setSuccess(editId ? "수정되었습니다." : "등록되었습니다.");
      setModal(null);
      load();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("이 공지를 삭제할까요?")) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/notices/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "삭제 실패");
        return;
      }
      setSuccess("삭제되었습니다.");
      setModal(null);
      load();
      setTimeout(() => setSuccess(""), 2000);
    } catch {
      setError("삭제 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiBullhorn} title="공지 관리" />

      <CardBox className="mb-6">
        <div className="flex flex-wrap gap-4 items-center">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2 text-site-text"
          >
            <option value="">전체</option>
            <option value="bar">공지바</option>
            <option value="popup">팝업</option>
            <option value="emergency">긴급 공지</option>
          </select>
          <Button label="공지 추가" color="info" onClick={openCreate} />
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
                  <th className="text-left p-2">노출 기간</th>
                  <th className="text-left p-2">활성</th>
                  <th className="p-2">동작</th>
                </tr>
              </thead>
              <tbody>
                {items.map((n) => (
                  <tr key={n.id} className="border-b border-site-border/50">
                    <td className="p-2">{TYPE_LABELS[n.type] ?? n.type}</td>
                    <td className="p-2">{n.title}</td>
                    <td className="p-2">
                      {n.startAt ? new Date(n.startAt).toLocaleString("ko-KR") : "-"} ~ {n.endAt ? new Date(n.endAt).toLocaleString("ko-KR") : "-"}
                    </td>
                    <td className="p-2">{n.isActive ? "ON" : "OFF"}</td>
                    <td className="p-2">
                      <button type="button" onClick={() => openEdit(n)} className="text-site-primary hover:underline mr-2">수정</button>
                      <button type="button" onClick={() => remove(n.id)} className="text-red-600 hover:underline">삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className="p-4 text-gray-500">공지가 없습니다.</p>}
          </div>
        )}
      </CardBox>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-lg w-full mx-4 p-4 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold mb-4">{modal === "create" ? "공지 추가" : "공지 수정"}</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">타입</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                  className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                >
                  <option value="bar">공지바</option>
                  <option value="popup">팝업</option>
                  <option value="emergency">긴급 공지</option>
                </select>
              </div>
              <div>
                <label className="block text-sm mb-1">제목 *</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">내용</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm mb-1">링크 URL</label>
                <input
                  type="text"
                  value={form.linkUrl}
                  onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))}
                  className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                  placeholder="https://"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm mb-1">시작일시</label>
                  <input
                    type="datetime-local"
                    value={form.startAt}
                    onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                    className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">종료일시</label>
                  <input
                    type="datetime-local"
                    value={form.endAt}
                    onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                    className="w-full rounded-lg border border-site-border bg-white dark:bg-slate-800 px-3 py-2"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /> 활성</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.showOnce} onChange={(e) => setForm((f) => ({ ...f, showOnce: e.target.checked }))} /> 1회만 표시</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.showMobile} onChange={(e) => setForm((f) => ({ ...f, showMobile: e.target.checked }))} /> 모바일</label>
                <label className="flex items-center gap-2"><input type="checkbox" checked={form.showDesktop} onChange={(e) => setForm((f) => ({ ...f, showDesktop: e.target.checked }))} /> PC</label>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button label="저장" color="info" onClick={save} disabled={saving} />
              <Button label="취소" color="contrast" outline onClick={() => setModal(null)} />
            </div>
          </div>
        </div>
      )}
    </SectionMain>
  );
}
