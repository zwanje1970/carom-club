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
import FooterSettingsForm from "@/app/(site)/admin/settings/footer/FooterSettingsForm";
import { SITE_NAME } from "@/lib/site-settings";

type SiteSettings = {
  siteName: string;
  siteDescription: string | null;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  homeCarouselFlowSpeed: number;
  headerBgColor: string | null;
  headerTextColor: string | null;
  headerActiveColor: string | null;
  introSettings: {
    enabled: boolean;
    title: string;
    description: string;
    mediaType: "image" | "video";
    mediaUrl: string;
    linkUrl: string | null;
    displaySeconds: number;
    showSkipButton: boolean;
  };
};

const DEFAULT_SETTINGS: SiteSettings = {
  siteName: SITE_NAME,
  siteDescription: null,
  logoUrl: null,
  primaryColor: "#d97706",
  secondaryColor: "#b91c1c",
  homeCarouselFlowSpeed: 50,
  headerBgColor: null,
  headerTextColor: null,
  headerActiveColor: null,
  introSettings: {
    enabled: false,
    title: SITE_NAME,
    description: "",
    mediaType: "image",
    mediaUrl: "",
    linkUrl: null,
    displaySeconds: 4,
    showSkipButton: true,
  },
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
          homeCarouselFlowSpeed:
            typeof data.homeCarouselFlowSpeed === "number"
              ? data.homeCarouselFlowSpeed
              : DEFAULT_SETTINGS.homeCarouselFlowSpeed,
          headerBgColor: data.headerBgColor ?? null,
          headerTextColor: data.headerTextColor ?? null,
          headerActiveColor: data.headerActiveColor ?? null,
          introSettings: {
            enabled: Boolean(data.introSettings?.enabled),
            title: String(data.introSettings?.title ?? SITE_NAME),
            description: String(data.introSettings?.description ?? ""),
            mediaType: data.introSettings?.mediaType === "video" ? "video" : "image",
            mediaUrl: String(data.introSettings?.mediaUrl ?? ""),
            linkUrl: typeof data.introSettings?.linkUrl === "string" ? data.introSettings.linkUrl : null,
            displaySeconds: Math.max(1, Math.min(30, Number(data.introSettings?.displaySeconds) || 4)),
            showSkipButton: data.introSettings?.showSkipButton !== false,
          },
        });
      })
      .catch(() => setForm(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    if (form.introSettings.enabled && !form.introSettings.mediaUrl.trim()) {
      setError("인트로 사용 시 미디어 첨부(이미지 또는 영상 URL)는 필수입니다.");
      return;
    }
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
          homeCarouselFlowSpeed: Math.max(1, Math.min(100, Math.floor(Number(form.homeCarouselFlowSpeed)) || 50)),
          headerBgColor: form.headerBgColor?.trim() || null,
          headerTextColor: form.headerTextColor?.trim() || null,
          headerActiveColor: form.headerActiveColor?.trim() || null,
          introSettings: {
            enabled: Boolean(form.introSettings.enabled),
            title: form.introSettings.title.trim() || SITE_NAME,
            description: form.introSettings.description.trim(),
            mediaType: form.introSettings.mediaType,
            mediaUrl: form.introSettings.mediaUrl.trim(),
            linkUrl: form.introSettings.linkUrl?.trim() || null,
            displaySeconds: Math.max(1, Math.min(30, Math.floor(Number(form.introSettings.displaySeconds)) || 4)),
            showSkipButton: Boolean(form.introSettings.showSkipButton),
          },
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
          <Link href="/admin" className="text-site-primary hover:underline">
            ← 관리자 홈
          </Link>
        </p>
        <SectionTitleLineWithButton icon={mdiPalette} title="헤더 / 푸터 / 인트로 관리" />
        <CardBox>
          <p className="text-gray-500 dark:text-slate-400">불러오는 중...</p>
        </CardBox>
      </SectionMain>
    );
  }

  return (
    <SectionMain>
      <p className="mb-4 text-sm">
        <Link href="/admin" className="text-site-primary hover:underline">
          ← 관리자 홈
        </Link>
      </p>
      <SectionTitleLineWithButton icon={mdiPalette} title="헤더 / 푸터 / 인트로 관리" />
      <p className="mb-6 text-sm text-gray-600 dark:text-slate-400 max-w-3xl">
        헤더(로고/메뉴 색상), 푸터(회사 정보/링크/SNS), 인트로(ON/OFF/첨부 미디어)를 이 화면에서 관리합니다.{" "}
        <strong>검증된 색 조합(프리셋)</strong>은{" "}
        <Link href="/admin/site/color-theme" className="font-medium text-site-primary hover:underline">
          색상 / 테마
        </Link>
        에서 선택하세요. 저장 후 공개 사이트 반영에는 최대 약 60초 캐시 지연이 있을 수 있습니다.
      </p>
      <CardBox className="max-w-3xl">
        <form onSubmit={handleSubmit} className="space-y-10">
          <section className="space-y-4">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">헤더</h2>
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

          <section className="space-y-4">
            <h2 className="text-base font-semibold text-site-text border-b border-site-border pb-2">인트로</h2>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.introSettings.enabled}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    introSettings: { ...f.introSettings, enabled: e.target.checked },
                  }))
                }
              />
              인트로 사용 여부
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-site-text">제목</span>
                <input
                  type="text"
                  value={form.introSettings.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, introSettings: { ...f.introSettings, title: e.target.value } }))
                  }
                  className="rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-site-text">표시 시간(초)</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={form.introSettings.displaySeconds}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      introSettings: {
                        ...f.introSettings,
                        displaySeconds: Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 4)),
                      },
                    }))
                  }
                  className="w-28 rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-site-text">설명</span>
              <textarea
                rows={2}
                value={form.introSettings.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, introSettings: { ...f.introSettings, description: e.target.value } }))
                }
                className="rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-site-text">미디어 유형</span>
              <select
                value={form.introSettings.mediaType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    introSettings: { ...f.introSettings, mediaType: e.target.value as "image" | "video" },
                  }))
                }
                className="max-w-[220px] rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
              >
                <option value="image">이미지</option>
                <option value="video">영상</option>
              </select>
            </label>
            {form.introSettings.mediaType === "image" ? (
              <div>
                <AdminImageField
                  label="미디어 첨부 (이미지 필수)"
                  value={form.introSettings.mediaUrl || null}
                  onChange={(url) =>
                    setForm((f) => ({ ...f, introSettings: { ...f.introSettings, mediaUrl: url ?? "" } }))
                  }
                  policy="banner"
                  recommendedSize="1920x1080"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                  업로드 기반 사용(권장) / 자동 리사이즈·압축 / 권장 비율 16:9
                </p>
              </div>
            ) : (
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-site-text">영상 URL (필수)</span>
                <input
                  type="url"
                  value={form.introSettings.mediaUrl}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, introSettings: { ...f.introSettings, mediaUrl: e.target.value } }))
                  }
                  className="rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
                  placeholder="https://..."
                />
              </label>
            )}
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-site-text">링크 (선택)</span>
              <input
                type="url"
                value={form.introSettings.linkUrl ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, introSettings: { ...f.introSettings, linkUrl: e.target.value || null } }))
                }
                className="rounded-lg border border-site-border bg-white px-3 py-2 text-site-text"
                placeholder="https://..."
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.introSettings.showSkipButton}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    introSettings: { ...f.introSettings, showSkipButton: e.target.checked },
                  }))
                }
              />
              스킵 버튼 표시
            </label>
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

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button type="submit" label={saving ? "저장중" : "저장"} color="info" disabled={saving} />
            <Button href="/admin" label="취소" color="contrast" outline />
            {error && <NotificationBar color="danger">{error}</NotificationBar>}
            {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}
          </div>
        </form>
      </CardBox>
      <CardBox className="mt-6 max-w-4xl">
        <h2 className="mb-4 text-base font-semibold text-site-text">푸터</h2>
        <FooterSettingsForm />
      </CardBox>
    </SectionMain>
  );
}
