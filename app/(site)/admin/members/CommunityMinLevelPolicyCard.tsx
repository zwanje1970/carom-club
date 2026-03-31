"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import NotificationBar from "@/components/admin/_components/NotificationBar";

type CommunityLevelResponse = {
  minSolutionLevelForUser?: number;
  error?: string;
};

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  if (!text) return {} as T & { error?: string };
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}

export function CommunityMinLevelPolicyCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [level, setLevel] = useState(1);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetch("/api/admin/site-settings/community-level", { cache: "no-store" })
      .then((res) => readJson<CommunityLevelResponse>(res))
      .then((data) => {
        const next = Math.min(15, Math.max(1, Math.floor(Number(data.minSolutionLevelForUser)) || 1));
        setLevel(next);
      })
      .catch(() => {
        setError("해법 제시 최소 레벨을 불러오지 못했습니다.");
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const next = Math.min(15, Math.max(1, Math.floor(Number(level)) || 1));
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/admin/site-settings/community-level", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSolutionLevelForUser: next }),
      });
      const data = await readJson<CommunityLevelResponse>(res);
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      const saved = Math.min(15, Math.max(1, Math.floor(Number(data.minSolutionLevelForUser)) || next));
      setLevel(saved);
      setSuccess(`저장되었습니다. 일반회원은 LEVEL ${saved} 이상부터 해법을 등록할 수 있습니다.`);
    } catch {
      setError("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <CardBox>
      <h3 className="text-base font-semibold text-site-text">커뮤니티 정책 (전역)</h3>
      <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
        일반회원(USER)이 난구해결사 게시판에서 해법을 등록할 수 있는 최소 LEVEL을 설정합니다.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-gray-500 dark:text-slate-400">불러오는 중…</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-site-text-muted">해법 제시 최소 LEVEL (1~15)</span>
            <input
              type="number"
              min={1}
              max={15}
              value={level}
              onChange={(e) => setLevel(Math.min(15, Math.max(1, parseInt(e.target.value, 10) || 1)))}
              className="w-28 rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "저장 중…" : "저장"}
          </button>
        </div>
      )}
      {error ? (
        <div className="mt-3">
          <NotificationBar color="danger">{error}</NotificationBar>
        </div>
      ) : null}
      {success ? (
        <div className="mt-3">
          <NotificationBar color="success">{success}</NotificationBar>
        </div>
      ) : null}
    </CardBox>
  );
}
