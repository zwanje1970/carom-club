"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { mdiPalette } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminColorField } from "@/components/admin/_components/AdminColorField";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { SITE_NAME } from "@/lib/site-settings";

type SiteSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  withdrawRejoinDays: number;
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
  const [success, setSuccess] = useState(false);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#header-menu-colors") {
      requestAnimationFrame(() => {
        document.getElementById("header-menu-colors")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, []);

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
          withdrawRejoinDays:
            typeof data.withdrawRejoinDays === "number" ? data.withdrawRejoinDays : DEFAULT_SETTINGS.withdrawRejoinDays,
          homeCarouselFlowSpeed:
            typeof data.homeCarouselFlowSpeed === "number"
              ? data.homeCarouselFlowSpeed
              : DEFAULT_SETTINGS.homeCarouselFlowSpeed,
          headerBgColor: data.headerBgColor ?? null,
          headerTextColor: data.headerTextColor ?? null,
          headerActiveColor: data.headerActiveColor ?? null,
        });
      })
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/site-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          siteName: form.siteName.trim() || DEFAULT_SETTINGS.siteName,
          siteDescription: form.siteDescription?.trim() || null,
          logoUrl: form.logoUrl,
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
          <Link href="/admin/site" className="text-site-primary hover:underline">
            ← 사이트관리 홈
          </Link>
        </p>
        <SectionTitleLineWithButton icon={mdiPalette} title="디자인/브랜드 설정" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin/site" className="text-site-primary hover:underline">
          ← 사이트관리 홈
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiPalette} title="디자인/브랜드 설정" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        전역 브랜드·헤더·홈 캐러셀 속도·가입/탈퇴 정책(일수)만 설정합니다.{" "}
        <strong>히어로</strong>는「홈 화면 설정 → 히어로 설정」, <strong>커뮤니티 정책</strong>은「커뮤니티 설정」,
        <strong>문구</strong>는「문구 관리」에서 다룹니다. 저장 후 공개 사이트 레이아웃 캐시(최대 약 60초) 반영 지연이 있을 수 있습니다.
      </p>
      <CardBox className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">브랜드</h2>
            <div>
              <label className="block text-sm font-medium text-site-text mb-1">사이트명</label>
              <input
                type="text"
                value={form.siteName}
                onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
                className="w-full max-w-md rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-site-text mb-1">사이트 설명 (메타 등)</label>
              <textarea
                value={form.siteDescription ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, siteDescription: e.target.value || null }))}
                rows={2}
                className="w-full max-w-lg rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              />
            </div>
            <AdminImageField
              label="로고"
              value={form.logoUrl}
              onChange={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
              policy="logo"
              recommendedSize="가로 320px 내외"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <AdminColorField
                label="메인 색상 (Primary)"
                value={form.primaryColor}
                onChange={(hex) => hex && setForm((f) => ({ ...f, primaryColor: hex }))}
                nullable={false}
                helperText="테마 강조색입니다. HEX만 저장됩니다."
              />
              <AdminColorField
                label="보조 색상 (Secondary)"
                value={form.secondaryColor}
                onChange={(hex) => hex && setForm((f) => ({ ...f, secondaryColor: hex }))}
                nullable={false}
                helperText="보조 강조색입니다."
              />
            </div>
          </section>

          <section id="header-menu-colors" className="space-y-4 scroll-mt-24">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">
              헤더 · 상단 메뉴 색상
            </h2>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              이 화면이 <strong>유일한 편집 진입점</strong>입니다. 비우면 사이트 기본(어두운 배경·밝은 메뉴)이 적용됩니다.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <AdminColorField
                label="헤더 배경"
                value={form.headerBgColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerBgColor: hex }))}
                nullable
              />
              <AdminColorField
                label="메뉴 글자"
                value={form.headerTextColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerTextColor: hex }))}
                nullable
              />
              <AdminColorField
                label="활성 메뉴"
                value={form.headerActiveColor}
                onChange={(hex) => setForm((f) => ({ ...f, headerActiveColor: hex }))}
                nullable
              />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">홈 공통 동작</h2>
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
                className="w-24 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                숫자가 클수록 빠르게 흐릅니다. 홈「진행중 대회」「당구장 소개」 가로 스크롤에 적용됩니다.
              </p>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">가입 · 회원 (전역)</h2>
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
                className="w-24 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">0이면 즉시 재가입 가능합니다.</p>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" label={saving ? "저장중" : "저장"} color="info" disabled={saving} />
            <Button href="/admin/site" label="취소" color="contrast" outline />
            {error && <NotificationBar color="danger">{error}</NotificationBar>}
            {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
          </div>
        </form>
      </CardBox>
    </SectionMain>
  );
}
