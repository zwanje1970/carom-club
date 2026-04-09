"use client";

import { useEffect, useState } from "react";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { SITE_NAME } from "@/lib/site-settings";
import { DEFAULT_HERO_SETTINGS, type HeroSettings as HeroFullSettings } from "@/lib/hero-settings";

type HeroSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  heroEnabled: boolean;
  heroDesktopEnabled: boolean;
  heroMobileEnabled: boolean;
};

const DEFAULT_HERO: HeroSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
  heroEnabled: false,
  heroDesktopEnabled: false,
  heroMobileEnabled: false,
};

export default function AdminSiteHeroPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState<HeroSettings>(DEFAULT_HERO);
  const [heroFullSettings, setHeroFullSettings] = useState<HeroFullSettings>(DEFAULT_HERO_SETTINGS);

  useEffect(() => {
    Promise.all([
      fetch("/api/site-settings").then((res) => res.json()),
      fetch("/api/admin/site-settings/hero", { credentials: "include" }).then((res) =>
        res.ok ? res.json() : Promise.resolve(DEFAULT_HERO_SETTINGS)
      ),
    ])
      .then(([siteData, heroData]) => {
        const loadedHero: HeroFullSettings =
          heroData && typeof heroData === "object"
            ? ({ ...DEFAULT_HERO_SETTINGS, ...heroData } as HeroFullSettings)
            : DEFAULT_HERO_SETTINGS;
        setHeroFullSettings(loadedHero);
        setForm({
          siteName: siteData?.siteName ?? SITE_NAME,
          siteDescription: siteData?.siteDescription ?? null,
          logoUrl: siteData?.logoUrl ?? null,
          heroEnabled: loadedHero.heroEnabled ?? false,
          heroDesktopEnabled: loadedHero.heroDesktopEnabled ?? false,
          heroMobileEnabled: loadedHero.heroMobileEnabled ?? false,
        });
      })
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
      const heroRes = await fetch("/api/admin/site-settings/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...heroFullSettings,
          heroEnabled: form.heroEnabled,
          heroDesktopEnabled: form.heroDesktopEnabled,
          heroMobileEnabled: form.heroMobileEnabled,
        }),
      });
      const heroData = await heroRes.json().catch(() => ({}));
      if (!heroRes.ok) throw new Error(heroData.error || "저장 실패");
      setHeroFullSettings((prev) => ({
        ...prev,
        heroEnabled: form.heroEnabled,
        heroDesktopEnabled: form.heroDesktopEnabled,
        heroMobileEnabled: form.heroMobileEnabled,
      }));
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
              <h3 className="text-base font-semibold text-site-text">히어로 사용</h3>
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.heroEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, heroEnabled: e.target.checked }))}
                  className="rounded border-site-border"
                />
                <span className="text-sm text-site-text">히어로 영역 표시 (체크 시 상단 히어로가 노출됩니다)</span>
              </label>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.heroDesktopEnabled}
                    onChange={(e) => setForm((f) => ({ ...f, heroDesktopEnabled: e.target.checked }))}
                    className="rounded border-site-border"
                  />
                  <span className="text-sm text-site-text">데스크톱에서 사용</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.heroMobileEnabled}
                    onChange={(e) => setForm((f) => ({ ...f, heroMobileEnabled: e.target.checked }))}
                    className="rounded border-site-border"
                  />
                  <span className="text-sm text-site-text">모바일에서 사용</span>
                </label>
              </div>
            </div>
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
