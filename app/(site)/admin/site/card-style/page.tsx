"use client";

import { useEffect, useState } from "react";
import Button from "@/components/admin/_components/Button";
import CardBox from "@/components/admin/_components/CardBox";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import type { SiteCardStyle } from "@/lib/site-card-style";

const DEFAULT_STYLE: SiteCardStyle = {
  shape: "square",
  width: 320,
  height: 180,
  style: "border",
  thumbFit: "cover",
  linkMode: "block",
  radius: 16,
};

export default function AdminSiteCardStylePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [form, setForm] = useState<SiteCardStyle>(DEFAULT_STYLE);

  useEffect(() => {
    fetch("/api/admin/site-card-style", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data !== "object") return;
        setForm({
          shape: data.shape === "circle" ? "circle" : "square",
          width: Number(data.width) || 320,
          height: Number(data.height) || 180,
          style: data.style === "flat" || data.style === "shadow" ? data.style : "border",
          thumbFit: data.thumbFit === "contain" ? "contain" : "cover",
          linkMode: data.linkMode === "button" ? "button" : "block",
          radius: Number(data.radius) || 16,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/site-card-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      setOk("기본 카드 설정이 저장되었습니다.");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">카드 스타일 관리</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          페이지빌더에서 &quot;기본 카드 사용&quot;을 선택한 블록에 공통으로 적용됩니다.
        </p>
      </CardBox>

      {error ? <NotificationBar color="danger">{error}</NotificationBar> : null}
      {ok ? <NotificationBar color="success">{ok}</NotificationBar> : null}

      <CardBox className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">모양</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.shape}
                  onChange={(e) => setForm((p) => ({ ...p, shape: e.target.value === "circle" ? "circle" : "square" }))}
                >
                  <option value="circle">원형</option>
                  <option value="square">사각형</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">스타일</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.style}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      style: e.target.value === "flat" || e.target.value === "shadow" ? e.target.value : "border",
                    }))
                  }
                >
                  <option value="flat">플랫</option>
                  <option value="border">테두리</option>
                  <option value="shadow">그림자</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">가로</span>
                <input
                  type="number"
                  min={120}
                  max={1200}
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.width}
                  onChange={(e) => setForm((p) => ({ ...p, width: Math.min(1200, Math.max(120, Number(e.target.value) || 320)) }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">세로</span>
                <input
                  type="number"
                  min={80}
                  max={1200}
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.height}
                  onChange={(e) => setForm((p) => ({ ...p, height: Math.min(1200, Math.max(80, Number(e.target.value) || 180)) }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">모서리</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.radius}
                  onChange={(e) => setForm((p) => ({ ...p, radius: Math.min(999, Math.max(0, Number(e.target.value) || 16)) }))}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">썸네일</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.thumbFit}
                  onChange={(e) => setForm((p) => ({ ...p, thumbFit: e.target.value === "contain" ? "contain" : "cover" }))}
                >
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                <span className="text-gray-600 dark:text-slate-400">링크 방식</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-900"
                  value={form.linkMode}
                  onChange={(e) => setForm((p) => ({ ...p, linkMode: e.target.value === "button" ? "button" : "block" }))}
                >
                  <option value="block">카드 전체 링크</option>
                  <option value="button">버튼 링크</option>
                </select>
              </label>
            </div>

            <div className="overflow-x-auto rounded border border-site-border bg-gray-50 p-3 dark:bg-slate-900/40">
              <div
                className={`overflow-hidden border ${form.style === "flat" ? "shadow-none" : form.style === "shadow" ? "shadow-md" : "shadow-sm"} bg-white dark:bg-slate-900`}
                style={{
                  width: `${form.width}px`,
                  maxWidth: "100%",
                  borderRadius: form.shape === "circle" ? "9999px" : `${form.radius}px`,
                }}
              >
                <div className="h-24 bg-gray-200" style={{ backgroundSize: form.thumbFit }} />
                <div className="space-y-2 p-3 text-sm">
                  <p className="font-semibold text-site-text">기본 카드 미리보기</p>
                  {form.linkMode === "button" ? (
                    <button type="button" className="rounded bg-site-primary px-3 py-1.5 text-xs text-white">
                      링크 버튼
                    </button>
                  ) : (
                    <p className="text-xs font-medium text-site-primary">카드 전체 링크</p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        <div className="pt-1">
          <Button label={saving ? "저장 중..." : "기본 카드 저장"} color="info" disabled={saving || loading} onClick={() => void save()} />
        </div>
      </CardBox>
    </div>
  );
}
