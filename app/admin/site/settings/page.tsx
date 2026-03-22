"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mdiCog } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { SITE_NAME } from "@/lib/site-settings";

type SiteSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  withdrawRejoinDays: number;
  /** 메인 진행중 대회·당구장 가로 흐름 속도(1~100) */
  homeCarouselFlowSpeed: number;
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
};

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
  primaryColor: "#d97706",
  secondaryColor: "#b91c1c",
  withdrawRejoinDays: 0,
  homeCarouselFlowSpeed: 50,
  headerBgColor: null,
  headerTextColor: null,
  headerActiveColor: null,
};

export default function AdminSiteSettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch("/api/site-settings")
      .then((res) => res.json())
      .then((data: SiteSettings) => {
        setForm({
          siteName: data.siteName ?? DEFAULT_SETTINGS.siteName,
          siteDescription: data.siteDescription ?? null,
          logoUrl: data.logoUrl ?? null,
          primaryColor: data.primaryColor ?? DEFAULT_SETTINGS.primaryColor,
          secondaryColor: data.secondaryColor ?? DEFAULT_SETTINGS.secondaryColor,
          withdrawRejoinDays: typeof data.withdrawRejoinDays === "number" ? data.withdrawRejoinDays : DEFAULT_SETTINGS.withdrawRejoinDays,
          homeCarouselFlowSpeed:
            typeof data.homeCarouselFlowSpeed === "number"
              ? data.homeCarouselFlowSpeed
              : DEFAULT_SETTINGS.homeCarouselFlowSpeed,
          headerBgColor: data.headerBgColor ?? null,
          headerTextColor: data.headerTextColor ?? null,
          headerActiveColor: data.headerActiveColor ?? null,
        });
        if (data.logoUrl) setLogoPreview(data.logoUrl);
      })
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      let logoUrl = form.logoUrl;
      if (logoFile) {
        const fd = new FormData();
        fd.append("file", logoFile);
        const uploadRes = await fetch("/api/admin/site-settings/logo", {
          method: "POST",
          body: fd,
        });
        if (!uploadRes.ok) {
          const d = await uploadRes.json().catch(() => ({}));
          throw new Error(d.error || "로고 업로드에 실패했습니다.");
        }
        const { url } = await uploadRes.json();
        logoUrl = url;
      }
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: form.siteName.trim() || DEFAULT_SETTINGS.siteName,
          siteDescription: form.siteDescription?.trim() || null,
          logoUrl,
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          withdrawRejoinDays: Math.max(0, Math.floor(Number(form.withdrawRejoinDays)) || 0),
          homeCarouselFlowSpeed: Math.max(1, Math.min(100, Math.floor(Number(form.homeCarouselFlowSpeed)) || 50)),
          headerBgColor: form.headerBgColor?.trim() || null,
          headerTextColor: form.headerTextColor?.trim() || null,
          headerActiveColor: form.headerActiveColor?.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "저장에 실패했습니다.");
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SectionMain>
        <p className="mb-4 text-sm">
          <Link href="/admin/site/main" className="text-site-primary hover:underline">
            ← 메인페이지 구성
          </Link>
        </p>
        <SectionTitleLineWithButton icon={mdiCog} title="사이트 설정 · 디자인/색상" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site/main" className="text-site-primary hover:underline">
          ← 메인페이지 구성
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiCog} title="사이트 설정 · 디자인/색상" />
      <p className="mb-6 text-sm text-gray-500 dark:text-slate-400">
        사이트 로고, 메인/보조 색상, 헤더·메뉴 색상, 회원탈퇴 재가입 기간을 설정합니다. Hero 문구·글자는 메인페이지 구성 → 히어로 편집 또는 페이지 섹션에서 수정하세요.
      </p>
      <CardBox className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">사이트 로고</label>
          <p className="text-xs text-gray-500 mb-2">새 이미지를 선택하면 기존 로고를 대체합니다. JPEG, PNG, WebP, SVG 지원. 로고는 선명도 우선으로 자동 최적화됩니다. (최대 2MB)</p>
          <div className="flex items-center gap-4 flex-wrap">
            {logoPreview && (
              <div className="h-14 w-32 rounded border border-site-border bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoPreview} alt="로고 미리보기" className="max-h-full max-w-full object-contain" />
              </div>
            )}
            <label className="cursor-pointer rounded-lg border border-site-border bg-white px-4 py-2.5 text-sm font-medium text-site-text hover:bg-gray-50">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="sr-only"
                onChange={onLogoChange}
              />
              {logoFile ? "다른 이미지 선택" : "이미지 선택"}
            </label>
            {form.logoUrl && !logoFile && (
              <button
                type="button"
                onClick={() => {
                  setForm((f) => ({ ...f, logoUrl: null }));
                  setLogoPreview(null);
                }}
                className="text-sm text-red-600 hover:text-red-700"
              >
                로고 제거
              </button>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-site-text mb-1">
            메인 대회·당구장 목록 흐름 속도 (1~100)
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.homeCarouselFlowSpeed}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                homeCarouselFlowSpeed: Math.max(1, Math.min(100, parseInt(e.target.value, 10) || 50)),
              }))
            }
            className="w-24 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
            숫자가 클수록 빠르게 흐릅니다. 「진행중 대회」와 「당구장 소개」 가로 목록이 연속으로 무한 스크롤됩니다.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-site-text mb-1">회원탈퇴 후 재가입 가능 기간 (일)</label>
          <input
            type="number"
            min={0}
            value={form.withdrawRejoinDays}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                withdrawRejoinDays: Math.max(0, parseInt(e.target.value, 10) || 0),
              }))
            }
            className="w-24 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">0 입력 시 즉시 재가입 가능합니다.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">메인 색상 (Primary)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="flex-1 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text font-mono text-sm focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">보조 색상 (Secondary)</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.secondaryColor}
                onChange={(e) => setForm((f) => ({ ...f, secondaryColor: e.target.value }))}
                className="flex-1 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text font-mono text-sm focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
              />
            </div>
          </div>
        </div>

        <p className="text-sm font-medium text-site-text mb-2">헤더(상단바) · 메뉴 색상</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">헤더(상단바) 배경</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.headerBgColor || "#0a0a0a"}
                onChange={(e) => setForm((f) => ({ ...f, headerBgColor: e.target.value }))}
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.headerBgColor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, headerBgColor: e.target.value || null }))}
                className="flex-1 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text font-mono text-sm focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
                placeholder="#0a0a0a"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">메뉴 글자</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.headerTextColor || "#d1d5db"}
                onChange={(e) => setForm((f) => ({ ...f, headerTextColor: e.target.value }))}
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.headerTextColor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, headerTextColor: e.target.value || null }))}
                className="flex-1 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text font-mono text-sm focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
                placeholder="#d1d5db"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-site-text mb-1">활성 메뉴</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.headerActiveColor || "#fbbf24"}
                onChange={(e) => setForm((f) => ({ ...f, headerActiveColor: e.target.value }))}
                className="h-10 w-14 rounded border border-site-border cursor-pointer"
              />
              <input
                type="text"
                value={form.headerActiveColor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, headerActiveColor: e.target.value || null }))}
                className="flex-1 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text font-mono text-sm focus:border-site-primary focus:outline-none focus:ring-1 focus:ring-site-primary"
                placeholder="#fbbf24"
              />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 -mt-2">헤더(상단바)·메뉴 색상을 비우면 기본값(검정 배경, 회색·앰버 메뉴)이 적용됩니다.</p>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            label={saving ? "저장중" : "저장"}
            color="info"
            disabled={saving}
          />
          <Button href="/admin/site/main" label="취소" color="contrast" outline />
          {error && <NotificationBar color="danger">{error}</NotificationBar>}
          {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
        </div>
      </form>
      </CardBox>
    </SectionMain>
  );
}
