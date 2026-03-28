"use client";

import { useState, useEffect } from "react";
import type { HeroSettings, HeroButtonItem } from "@/lib/hero-settings";
import { DEFAULT_HERO_SETTINGS } from "@/lib/hero-settings";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import HeroPreviewBlock from "./HeroPreviewBlock";

const TEXT_ALIGN_OPTIONS = [
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
] as const;

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "위" },
  { value: "center", label: "가운데" },
  { value: "bottom", label: "아래" },
] as const;

const BUTTONS_POSITION_OPTIONS = [
  { value: "belowTitle", label: "제목 아래" },
  { value: "belowSubtitle", label: "부제목 아래" },
  { value: "bottom", label: "영역 하단" },
] as const;

const SIZE_OPTIONS = [
  { value: "small", label: "작게" },
  { value: "medium", label: "보통" },
  { value: "large", label: "크게" },
] as const;

const VARIANT_OPTIONS = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "outline", label: "Outline" },
] as const;

function mergeSettings(loaded: Partial<HeroSettings> | null): HeroSettings {
  if (!loaded) return { ...DEFAULT_HERO_SETTINGS };
  const buttons = (loaded.heroButtons ?? DEFAULT_HERO_SETTINGS.heroButtons).slice(0, 3) as HeroSettings["heroButtons"];
  return {
    ...DEFAULT_HERO_SETTINGS,
    ...loaded,
    heroButtons: [
      { ...DEFAULT_HERO_SETTINGS.heroButtons[0], ...buttons[0] },
      { ...DEFAULT_HERO_SETTINGS.heroButtons[1], ...buttons[1] },
      { ...DEFAULT_HERO_SETTINGS.heroButtons[2], ...buttons[2] },
    ],
  };
}

export default function HeroSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState<HeroSettings>(() => ({ ...DEFAULT_HERO_SETTINGS }));

  useEffect(() => {
    fetch("/api/admin/site-settings/hero", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setForm(mergeSettings(data)))
      .catch(() => setForm({ ...DEFAULT_HERO_SETTINGS }))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/site-settings/hero", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "저장 실패");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof HeroSettings>(key: K, value: HeroSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateButton = (index: 0 | 1 | 2, patch: Partial<HeroButtonItem>) => {
    setForm((prev) => ({
      ...prev,
      heroButtons: prev.heroButtons.map((b, i) =>
        i === index ? { ...b, ...patch } : b
      ) as HeroSettings["heroButtons"],
    }));
  };

  if (loading) {
    return <p className="py-8 text-center text-gray-500">불러오는 중...</p>;
  }

  return (
    <form onSubmit={handleSave} className="space-y-8">
      {/* 미리보기 */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">미리보기</h3>
        <div className="rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
          <HeroPreviewBlock settings={form} />
        </div>
      </section>

      {/* 기본 설정 */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">기본 설정</h3>
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.heroEnabled}
              onChange={(e) => update("heroEnabled", e.target.checked)}
            />
            <span>히어로 사용</span>
          </label>
          <AdminImageField
            label="배경 이미지"
            value={form.heroBackgroundImageUrl ?? null}
            onChange={(url) => update("heroBackgroundImageUrl", url)}
            policy="banner"
            recommendedSize="가로 1920px 전후 권장"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            URL 직접 입력은 사용하지 않습니다. 파일을 업로드하면 저장 경로가 자동으로 들어갑니다. 업로드 실패 시 기존 이미지가 유지됩니다.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">PC 높이</label>
              <input
                type="text"
                value={form.heroHeightDesktop}
                onChange={(e) => update("heroHeightDesktop", e.target.value)}
                placeholder="380px"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">모바일 높이</label>
              <input
                type="text"
                value={form.heroHeightMobile}
                onChange={(e) => update("heroHeightMobile", e.target.value)}
                placeholder="280px"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">오버레이 밝기 (0~1)</label>
              <input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={form.heroOverlayOpacity}
                onChange={(e) => update("heroOverlayOpacity", Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">배경 흐림 (px)</label>
              <input
                type="number"
                min={0}
                value={form.heroBlurAmount}
                onChange={(e) => update("heroBlurAmount", Number(e.target.value))}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 텍스트 설정 */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">텍스트 설정</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">상단 소제목</label>
            <input
              type="text"
              value={form.heroEyebrowText}
              onChange={(e) => update("heroEyebrowText", e.target.value)}
              placeholder="당구대회 통합"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">메인 제목</label>
            <input
              type="text"
              value={form.heroTitle}
              onChange={(e) => update("heroTitle", e.target.value)}
              placeholder="CAROM.CLUB"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">부제목</label>
            <input
              type="text"
              value={form.heroSubtitle}
              onChange={(e) => update("heroSubtitle", e.target.value)}
              placeholder="당구대회 통합 플랫폼"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">제목 크기</label>
              <input
                type="text"
                value={form.heroTitleSize}
                onChange={(e) => update("heroTitleSize", e.target.value)}
                placeholder="2.5rem"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">부제목 크기</label>
              <input
                type="text"
                value={form.heroSubtitleSize}
                onChange={(e) => update("heroSubtitleSize", e.target.value)}
                placeholder="1.125rem"
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">텍스트 정렬</label>
              <select
                value={form.heroTextAlign}
                onChange={(e) => update("heroTextAlign", e.target.value as HeroSettings["heroTextAlign"])}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {TEXT_ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">세로 위치</label>
              <select
                value={form.heroContentVerticalAlign}
                onChange={(e) => update("heroContentVerticalAlign", e.target.value as HeroSettings["heroContentVerticalAlign"])}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {VERTICAL_ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">텍스트 최대 너비</label>
            <input
              type="text"
              value={form.heroTextMaxWidth}
              onChange={(e) => update("heroTextMaxWidth", e.target.value)}
              placeholder="42rem"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
        </div>
      </section>

      {/* 버튼 설정 */}
      <section>
        <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">버튼 설정</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">버튼 위치</label>
              <select
                value={form.heroButtonsPosition}
                onChange={(e) => update("heroButtonsPosition", e.target.value as HeroSettings["heroButtonsPosition"])}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {BUTTONS_POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">버튼 정렬</label>
              <select
                value={form.heroButtonsAlign}
                onChange={(e) => update("heroButtonsAlign", e.target.value as HeroSettings["heroButtonsAlign"])}
                className="mt-1 w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                {TEXT_ALIGN_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          {([0, 1, 2] as const).map((i) => (
            <div key={i} className="rounded border border-gray-200 p-3 dark:border-slate-600">
              <p className="mb-2 font-medium text-gray-800 dark:text-slate-200">버튼 {i + 1}</p>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.heroButtons[i].enabled}
                    onChange={(e) => updateButton(i, { enabled: e.target.checked })}
                  />
                  사용
                </label>
                <input
                  type="text"
                  value={form.heroButtons[i].label}
                  onChange={(e) => updateButton(i, { label: e.target.value })}
                  placeholder="문구"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <input
                  type="text"
                  value={form.heroButtons[i].href}
                  onChange={(e) => updateButton(i, { href: e.target.value })}
                  placeholder="링크 (예: /tournaments)"
                  className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <div className="flex flex-wrap gap-3">
                  <select
                    value={form.heroButtons[i].size}
                    onChange={(e) => updateButton(i, { size: e.target.value as HeroButtonItem["size"] })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <select
                    value={form.heroButtons[i].variant}
                    onChange={(e) => updateButton(i, { variant: e.target.value as HeroButtonItem["variant"] })}
                    className="rounded border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  >
                    {VARIANT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.heroButtons[i].openInNewTab}
                      onChange={(e) => updateButton(i, { openInNewTab: e.target.checked })}
                    />
                    새 탭
                  </label>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-site-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "저장"}
        </button>
        {error && <NotificationBar color="danger">{error}</NotificationBar>}
        {success && <NotificationBar color="success">저장되었습니다. 메인페이지에서 확인하세요.</NotificationBar>}
      </div>
    </form>
  );
}
