"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { SITE_NAME } from "@/lib/site-settings";

type HeroSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
};

const DEFAULT_HERO: HeroSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
};

export default function AdminSiteHeroPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<HeroSettings>(DEFAULT_HERO);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data) =>
        setForm({
          siteName: data?.siteName ?? SITE_NAME,
          siteDescription: data?.siteDescription ?? null,
          logoUrl: data?.logoUrl ?? null,
        })
      )
      .catch(() => setForm(DEFAULT_HERO))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(""), 2200);
    return () => clearTimeout(t);
  }, [success]);

  const save = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: form.siteName.trim() || SITE_NAME,
          siteDescription: form.siteDescription?.trim() || null,
          logoUrl: form.logoUrl,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setSuccess("저장 완료");
    } catch (e) {
      setError(e instanceof Error ? "저장 실패" : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">히어로 편집</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          상단 대표 영역의 사이트명, 소개 문구, 로고를 설정합니다.
        </p>
      </CardBox>
      <CardBox className="space-y-4">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">불러오는 중...</p>
        ) : (
          <>
            <div>
              <label className="mb-1 block text-sm font-medium text-site-text">사이트명</label>
              <input
                type="text"
                value={form.siteName}
                onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
                className="w-full max-w-lg rounded border border-site-border bg-white px-3 py-2 text-site-text dark:bg-slate-900"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-site-text">소개 문구</label>
              <textarea
                rows={3}
                value={form.siteDescription ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, siteDescription: e.target.value || null }))}
                className="w-full max-w-2xl rounded border border-site-border bg-white px-3 py-2 text-site-text dark:bg-slate-900"
              />
            </div>
            <AdminImageField
              label="히어로 로고"
              value={form.logoUrl}
              onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              policy="logo"
              recommendedSize="가로 320px 내외"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button label={saving ? "저장 중..." : "저장"} color="info" disabled={saving} onClick={() => void save()} />
              {saving ? <span className="text-xs text-gray-600 dark:text-slate-400">저장 중...</span> : null}
              {!saving && success ? <span className="text-xs text-green-700 dark:text-green-300">{success}</span> : null}
              {!saving && error ? <span className="text-xs text-red-600 dark:text-red-300">{error}</span> : null}
              <Button href="/admin/site" label="취소" color="contrast" outline />
            </div>
          </>
        )}
      </CardBox>
    </div>
  );
}
