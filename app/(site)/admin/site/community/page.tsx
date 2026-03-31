"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { mdiForum } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import NotificationBar from "@/components/admin/_components/NotificationBar";

async function readJson<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  if (!text) return {} as T & { error?: string };
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return {} as T & { error?: string };
  }
}

export default function AdminSiteCommunitySettingsPage() {
  const [minLevel, setMinLevel] = useState(1);
  const [input, setInput] = useState("1");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch("/api/admin/site-settings/community-level")
      .then((res) => readJson<{ minSolutionLevelForUser?: number; error?: string }>(res))
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          return;
        }
        const level = Math.min(15, Math.max(1, Math.floor(Number(data.minSolutionLevelForUser)) || 1));
        setMinLevel(level);
        setInput(String(level));
      })
      .catch(() => {
        if (!cancelled) setError("설정을 불러올 수 없습니다.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const save = useCallback(async () => {
    const next = Math.min(15, Math.max(1, Math.floor(Number(input)) || 1));
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/admin/site-settings/community-level", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minSolutionLevelForUser: next }),
      });
      const data = await readJson<{ minSolutionLevelForUser?: number; error?: string }>(res);
      if (!res.ok) {
        setError(data.error ?? "저장에 실패했습니다.");
        return;
      }
      const saved = Math.min(15, Math.max(1, Math.floor(Number(data.minSolutionLevelForUser)) || 1));
      setMinLevel(saved);
      setInput(String(saved));
      setMessage(`저장되었습니다. 일반회원은 LEVEL ${saved} 이상부터 난구해결사 해법을 등록할 수 있습니다.`);
    } finally {
      setSaving(false);
    }
  }, [input]);

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site" className="text-site-primary hover:underline">
          ← 사이트관리 홈
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiForum} title="커뮤니티 설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        커뮤니티·난구해결사 관련 <strong>운영 정책</strong>만 다룹니다. 회원 목록·권한은「회원·권한 관리」에서,
        콘텐츠(섹션·팝업)는「콘텐츠 관리」에서 수정합니다. 저장 후 반영까지 최대 1분 캐시 지연이 있을 수 있습니다.
      </p>

      <CardBox className="max-w-xl">
        <h2 className="text-base font-semibold text-site-text mb-2">해법 제시 최소 레벨</h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 mb-4">
          일반회원(USER)이 난구해결사 게시판에서 해법을 등록할 수 있는 최소 커뮤니티 LEVEL입니다. 이 값은{" "}
          <code className="text-xs bg-gray-100 dark:bg-slate-700 px-1 rounded">SiteSetting.minSolutionLevelForUser</code>
          에 저장됩니다.
        </p>
        {loading ? (
          <p className="text-sm text-gray-500">불러오는 중…</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-site-text-muted">LEVEL (1–15)</span>
              <input
                type="number"
                min={1}
                max={15}
                value={input}
                onChange={(e) => setInput(e.target.value)}
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
        <p className="mt-3 text-xs text-gray-500">현재 적용 값: LEVEL {minLevel}</p>
        {error && (
          <div className="mt-3">
            <NotificationBar color="danger">{error}</NotificationBar>
          </div>
        )}
        {message && (
          <div className="mt-3">
            <NotificationBar color="success">{message}</NotificationBar>
          </div>
        )}
      </CardBox>

      <p className="mt-8 text-xs text-gray-500 dark:text-slate-400 max-w-2xl">
        해법 제시 정책의 추가 항목·안내 문구는 추후 이 화면에 확장할 수 있습니다. API 쓰기는{" "}
        <code className="bg-gray-100 dark:bg-slate-700 px-1 rounded text-[11px]">PATCH /api/admin/site-settings/community-level</code>{" "}
        단일 진입점을 사용합니다.
      </p>
    </SectionMain>
  );
}
