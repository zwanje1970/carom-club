"use client";

import { useEffect, useMemo, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type BoardRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: string;
  sortOrder: number;
  isActive: boolean;
  postCount: number;
};

type NewBoardForm = {
  name: string;
  slug: string;
  description: string;
  type: string;
  isActive: boolean;
};

const EMPTY_FORM: NewBoardForm = {
  name: "",
  slug: "",
  description: "",
  type: "free",
  isActive: true,
};

function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-_]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function AdminSiteCommunityPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState<NewBoardForm>(EMPTY_FORM);

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => a.sortOrder - b.sortOrder),
    [rows]
  );

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/community/boards", { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data)) {
        setError(typeof data?.error === "string" ? data.error : "게시판 목록을 불러오지 못했습니다.");
        return;
      }
      setRows(data as BoardRow[]);
    } catch {
      setError("게시판 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveReorder = async (nextIds: string[]) => {
    const res = await fetch("/api/admin/community/boards", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reorder", orderedIds: nextIds }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(typeof data?.error === "string" ? data.error : "순서 저장에 실패했습니다.");
    }
  };

  const moveRow = async (id: string, dir: -1 | 1) => {
    const idx = orderedRows.findIndex((r) => r.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= orderedRows.length) return;
    const next = [...orderedRows];
    const t = next[idx];
    next[idx] = next[j];
    next[j] = t;
    setRows(next.map((r, i) => ({ ...r, sortOrder: i })));
    setSaving(true);
    setError("");
    try {
      await saveReorder(next.map((r) => r.id));
      setOk("게시판 순서가 저장되었습니다.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "순서 저장에 실패했습니다.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  const createBoard = async () => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/community/boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          slug: toSlug(form.slug || form.name),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "게시판 생성에 실패했습니다.");
        return;
      }
      setForm(EMPTY_FORM);
      setOk("게시판이 생성되었습니다.");
      await load();
    } catch {
      setError("게시판 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const updateBoard = async (row: BoardRow) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/community/boards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          id: row.id,
          slug: toSlug(row.slug),
          name: row.name,
          description: row.description,
          type: row.type,
          isActive: row.isActive,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "게시판 수정에 실패했습니다.");
        return;
      }
      setOk("게시판이 수정되었습니다.");
      await load();
    } catch {
      setError("게시판 수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBoard = async (row: BoardRow) => {
    if (!confirm(`"${row.name}" 게시판을 삭제할까요?`)) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/community/boards?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "게시판 삭제에 실패했습니다.");
        return;
      }
      setOk("게시판이 삭제되었습니다.");
      await load();
    } catch {
      setError("게시판 삭제에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">커뮤니티 관리</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          게시판 생성, 수정, 삭제, 순서, 노출을 관리합니다.
        </p>
      </CardBox>

      {error ? <NotificationBar color="danger">{error}</NotificationBar> : null}
      {ok ? <NotificationBar color="success">{ok}</NotificationBar> : null}

      <CardBox className="space-y-3">
        <h2 className="text-sm font-semibold text-site-text">게시판 생성</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input
            className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            placeholder="게시판 이름"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <input
            className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            placeholder="슬러그 (예: free)"
            value={form.slug}
            onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
          />
          <input
            className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            placeholder="유형 (예: free, qna)"
            value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
          />
          <label className="flex items-center gap-2 rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            생성 시 노출
          </label>
        </div>
        <textarea
          className="min-h-20 w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
          placeholder="설명 (선택)"
          value={form.description}
          onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
        />
        <Button
          label={saving ? "처리 중..." : "게시판 생성"}
          color="info"
          disabled={saving || !form.name.trim()}
          onClick={() => void createBoard()}
        />
      </CardBox>

      <CardBox className="space-y-3">
        <h2 className="text-sm font-semibold text-site-text">게시판 목록</h2>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : orderedRows.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">등록된 게시판이 없습니다.</p>
        ) : (
          <div className="space-y-2">
            {orderedRows.map((row, i) => (
              <div key={row.id} className="rounded border border-site-border p-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded border border-site-border bg-white px-2.5 py-2 text-sm text-site-text dark:bg-slate-900"
                    value={row.name}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r))
                      )
                    }
                  />
                  <input
                    className="rounded border border-site-border bg-white px-2.5 py-2 text-sm text-site-text dark:bg-slate-900"
                    value={row.slug}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, slug: e.target.value } : r))
                      )
                    }
                  />
                  <input
                    className="rounded border border-site-border bg-white px-2.5 py-2 text-sm text-site-text dark:bg-slate-900"
                    value={row.type}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((r) => (r.id === row.id ? { ...r, type: e.target.value } : r))
                      )
                    }
                  />
                  <label className="flex items-center gap-2 rounded border border-site-border bg-white px-2.5 py-2 text-sm text-site-text dark:bg-slate-900">
                    <input
                      type="checkbox"
                      checked={row.isActive}
                      onChange={(e) =>
                        setRows((prev) =>
                          prev.map((r) => (r.id === row.id ? { ...r, isActive: e.target.checked } : r))
                        )
                      }
                    />
                    노출
                  </label>
                </div>
                <textarea
                  className="mt-2 min-h-16 w-full rounded border border-site-border bg-white px-2.5 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={row.description ?? ""}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((r) => (r.id === row.id ? { ...r, description: e.target.value } : r))
                    )
                  }
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    label="수정 저장"
                    color="info"
                    small
                    disabled={saving}
                    onClick={() => void updateBoard(row)}
                  />
                  <Button
                    label="삭제"
                    color="danger"
                    small
                    outline
                    disabled={saving}
                    onClick={() => void deleteBoard(row)}
                  />
                  <Button
                    label="위로"
                    color="contrast"
                    small
                    outline
                    disabled={saving || i === 0}
                    onClick={() => void moveRow(row.id, -1)}
                  />
                  <Button
                    label="아래로"
                    color="contrast"
                    small
                    outline
                    disabled={saving || i === orderedRows.length - 1}
                    onClick={() => void moveRow(row.id, 1)}
                  />
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    게시글 {row.postCount}개
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBox>
    </div>
  );
}
