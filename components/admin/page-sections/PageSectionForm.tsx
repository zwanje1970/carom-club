"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { PageSection, SectionButton } from "@/types/page-section";
import type { InternalPageSlug } from "@/types/page-section";
import {
  PAGE_LABELS,
  PLACEMENT_LABELS,
  INTERNAL_PAGE_LABELS,
  INTERNAL_PAGE_PATHS,
  SECTION_TYPE_LABELS,
  TEXT_ALIGN_LABELS,
  RECOMMENDED_IMAGE_SIZES,
} from "@/lib/content/constants";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { SectionPositionPreviewPanel } from "./SectionPositionPreviewPanel";
import { ColorPalette64 } from "@/components/editor/ColorPalette64";
import { SpecialCharsPicker } from "@/components/editor/SpecialCharsPicker";
import type { Editor } from "@tiptap/core";
import { HeroBlockEditor } from "@/components/admin/hero/HeroBlockEditor";
import { HeroPreview } from "@/components/admin/hero/HeroPreview";
import { FONT_FAMILIES, FONT_SIZES_PX } from "@/lib/editor-fonts";

const emptySection = (): Omit<PageSection, "createdAt" | "updatedAt"> => ({
  id: "",
  type: "text",
  title: "",
  subtitle: null,
  description: null,
  textAlign: "center",
  page: "home",
  placement: "below_main_copy",
  imageUrl: null,
  imageUrlMobile: null,
  imageHeightPc: 400,
  imageHeightMobile: 280,
  linkType: "none",
  internalPage: null,
  internalPath: null,
  externalUrl: null,
  openInNewTab: false,
  buttons: [],
  isVisible: true,
  sortOrder: 0,
  startAt: null,
  endAt: null,
  backgroundColor: null,
  titleIconType: "none",
  titleIconName: null,
  titleIconImageUrl: null,
  titleIconSize: null,
});

type Props = {
  initial?: PageSection | null;
  /** 같은 페이지의 다른 섹션 목록 (미니맵·충돌 경고용). 없으면 빈 배열 사용 */
  sections?: PageSection[];
  onSubmit: (data: Omit<PageSection, "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
};

const HERO_COPY_KEYS = {
  titleHtml: "site.hero.titleHtml",
  titleLineHeight: "site.hero.titleLineHeight",
  titleFont: "site.hero.titleFont",
  titleSize: "site.hero.titleSize",
  titleColor: "site.hero.titleColor",
  titleBold: "site.hero.titleBold",
  titleItalic: "site.hero.titleItalic",
  titleUnderline: "site.hero.titleUnderline",
  titleAlign: "site.hero.titleAlign",
  btnTournaments: "site.hero.btnTournaments",
  btnApply: "site.hero.btnApply",
  btnPosition: "site.hero.btnPosition",
  btn1Size: "site.hero.btn1Size",
  btn2Size: "site.hero.btn2Size",
  btn1InternalPage: "site.hero.btn1InternalPage",
  btn2InternalPage: "site.hero.btn2InternalPage",
} as const;

const HERO_BTN_POSITION_OPTIONS = [
  { value: "below", label: "텍스트 아래" },
  { value: "above", label: "텍스트 위" },
] as const;

const HERO_BTN_SIZE_OPTIONS = [
  { value: "sm", label: "작게" },
  { value: "md", label: "보통" },
  { value: "lg", label: "크게" },
] as const;

const HERO_ALIGN_OPTIONS = [
  { value: "", label: "기본" },
  { value: "left", label: "왼쪽" },
  { value: "center", label: "가운데" },
  { value: "right", label: "오른쪽" },
] as const;


export function PageSectionForm({ initial, sections = [], onSubmit, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [heroExtra, setHeroExtra] = useState<{
    heroTitleHtml: string;
    titleLineHeight: string;
    titleFont: string;
    titleSize: string;
    titleColor: string;
    titleBold: string;
    titleItalic: string;
    titleUnderline: string;
    titleAlign: string;
    btnTournaments: string;
    btnApply: string;
    btnPosition: string;
    btn1Size: string;
    btn2Size: string;
    btn1InternalPage: string;
    btn2InternalPage: string;
  } | null>(null);

  const HERO_LINE_HEIGHT_OPTIONS = [
    { value: "", label: "기본" },
    { value: "1", label: "1" },
    { value: "1.25", label: "1.25" },
    { value: "1.5", label: "1.5" },
    { value: "1.75", label: "1.75" },
    { value: "2", label: "2" },
  ] as const;

  const [heroSpecialCharsOpen, setHeroSpecialCharsOpen] = useState(false);
  const heroEditorRef = useRef<Editor | null>(null);
  const heroSpecialCharsRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState(() => {
    if (initial) {
      return {
        ...initial,
        startAt: initial.startAt ? initial.startAt.slice(0, 16) : null,
        endAt: initial.endAt ? initial.endAt.slice(0, 16) : null,
      };
    }
    const e = emptySection();
    return {
      ...e,
      id: `ps-${Date.now()}`,
      startAt: null as string | null,
      endAt: null as string | null,
    };
  });

  const isHeroSection = form.placement === "main_visual_bg" && form.type === "image";
  useEffect(() => {
    if (!isHeroSection) {
      setHeroExtra(null);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetch("/api/site-settings").then((r) => r.json()),
      fetch("/api/admin/copy").then((r) => r.json()),
    ])
      .then(([settings, copy]) => {
        if (cancelled) return;
        const c = copy ?? {};
        const titleHtmlRaw = (c["site.hero.titleHtml"] ?? "").trim();
        const fallbackHtml =
          titleHtmlRaw ||
          [c["site.hero.tagline"], c["site.hero.titleText"] || settings?.siteName || "CAROM.CLUB", c["site.hero.subtitleText"] || settings?.siteDescription || "당구 대회와 커뮤니티를 한곳에서."]
            .filter(Boolean)
            .map((t) => `<p>${(t ?? "").trim()}</p>`)
            .join("");
        setHeroExtra({
          heroTitleHtml: titleHtmlRaw || fallbackHtml,
          titleLineHeight: c[HERO_COPY_KEYS.titleLineHeight] ?? "",
          titleFont: c[HERO_COPY_KEYS.titleFont] ?? "",
          titleSize: c[HERO_COPY_KEYS.titleSize] ?? "",
          titleColor: c[HERO_COPY_KEYS.titleColor] ?? "",
          titleBold: c[HERO_COPY_KEYS.titleBold] ?? "",
          titleItalic: c[HERO_COPY_KEYS.titleItalic] ?? "",
          titleUnderline: c[HERO_COPY_KEYS.titleUnderline] ?? "",
          titleAlign: c[HERO_COPY_KEYS.titleAlign] ?? "",
          btnTournaments: c[HERO_COPY_KEYS.btnTournaments] ?? "진행중 대회 보기",
          btnApply: c[HERO_COPY_KEYS.btnApply] ?? "대회 참가 신청",
          btnPosition: c[HERO_COPY_KEYS.btnPosition] ?? "below",
          btn1Size: c[HERO_COPY_KEYS.btn1Size] ?? "md",
          btn2Size: c[HERO_COPY_KEYS.btn2Size] ?? "md",
          btn1InternalPage: c[HERO_COPY_KEYS.btn1InternalPage] ?? "tournaments",
          btn2InternalPage: c[HERO_COPY_KEYS.btn2InternalPage] ?? "tournaments",
        });
      })
      .catch(() => {
        if (!cancelled) setHeroExtra(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isHeroSection]);

  useEffect(() => {
    if (!heroSpecialCharsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (heroSpecialCharsRef.current && !heroSpecialCharsRef.current.contains(e.target as Node)) {
        setHeroSpecialCharsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [heroSpecialCharsOpen]);

  const onHeroParagraphLineHeight = useCallback((lh: string | null) => {
    setHeroExtra((h) => {
      if (!h) return h;
      const next = lh ?? "";
      if (h.titleLineHeight === next) return h;
      return { ...h, titleLineHeight: next };
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.title.trim() && !isHeroSection) {
      setError("섹션 제목을 입력해 주세요.");
      return;
    }
    if (form.type === "image") {
      const hasImage = !!(form.imageUrl?.trim());
      if (!hasImage) {
        setError("이미지를 업로드하거나 URL을 입력해 주세요.");
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
      };
      if (isHeroSection && heroExtra) {
        payload.title = "Hero";
        payload.subtitle = null;
        payload.description = null;
        const path1 = INTERNAL_PAGE_PATHS[heroExtra.btn1InternalPage as InternalPageSlug] ?? (heroExtra.btn1InternalPage || "/tournaments");
        const path2 = INTERNAL_PAGE_PATHS[heroExtra.btn2InternalPage as InternalPageSlug] ?? (heroExtra.btn2InternalPage || "/tournaments");
        payload.buttons = [
          {
            id: form.buttons[0]?.id ?? `btn-${Date.now()}-1`,
            name: heroExtra.btnTournaments.trim() || "진행중 대회 보기",
            linkType: "internal",
            href: path1,
            openInNewTab: false,
            isPrimary: true,
            size: (heroExtra.btn1Size === "sm" || heroExtra.btn1Size === "lg" ? heroExtra.btn1Size : "md") as SectionButton["size"],
          },
          {
            id: form.buttons[1]?.id ?? `btn-${Date.now()}-2`,
            name: heroExtra.btnApply.trim() || "대회 참가 신청",
            linkType: "internal",
            href: path2,
            openInNewTab: false,
            isPrimary: false,
            size: (heroExtra.btn2Size === "sm" || heroExtra.btn2Size === "lg" ? heroExtra.btn2Size : "md") as SectionButton["size"],
          },
        ];
      }
      await onSubmit(payload);
      if (isHeroSection && heroExtra) {
        const copyRes = await fetch("/api/admin/copy", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            copy: {
              [HERO_COPY_KEYS.titleHtml]: heroExtra.heroTitleHtml.trim(),
              [HERO_COPY_KEYS.titleLineHeight]: heroExtra.titleLineHeight.trim(),
              [HERO_COPY_KEYS.titleFont]: heroExtra.titleFont.trim(),
              [HERO_COPY_KEYS.titleSize]: heroExtra.titleSize.trim(),
              [HERO_COPY_KEYS.titleColor]: heroExtra.titleColor.trim(),
              [HERO_COPY_KEYS.titleBold]: heroExtra.titleBold.trim(),
              [HERO_COPY_KEYS.titleItalic]: heroExtra.titleItalic.trim(),
              [HERO_COPY_KEYS.titleUnderline]: heroExtra.titleUnderline.trim(),
              [HERO_COPY_KEYS.titleAlign]: heroExtra.titleAlign.trim(),
              [HERO_COPY_KEYS.btnTournaments]: heroExtra.btnTournaments.trim() || "진행중 대회 보기",
              [HERO_COPY_KEYS.btnApply]: heroExtra.btnApply.trim() || "대회 참가 신청",
              [HERO_COPY_KEYS.btnPosition]: heroExtra.btnPosition || "below",
              [HERO_COPY_KEYS.btn1Size]: heroExtra.btn1Size || "md",
              [HERO_COPY_KEYS.btn2Size]: heroExtra.btn2Size || "md",
              [HERO_COPY_KEYS.btn1InternalPage]: heroExtra.btn1InternalPage || "tournaments",
              [HERO_COPY_KEYS.btn2InternalPage]: heroExtra.btn2InternalPage || "tournaments",
            },
          }),
        });
        if (!copyRes.ok) {
          const d = await copyRes.json().catch(() => ({}));
          throw new Error(d.error ?? "Hero 문구 저장에 실패했습니다.");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const addButton = () => {
    if (form.buttons.length >= 3) return;
    setForm((f) => ({
      ...f,
      buttons: [
        ...f.buttons,
        {
          id: `btn-${Date.now()}`,
          name: "",
          linkType: "internal" as const,
          href: "/",
          openInNewTab: false,
          isPrimary: f.buttons.length === 0,
        },
      ],
    }));
  };

  const updateButton = (index: number, patch: Partial<SectionButton>) => {
    setForm((f) => ({
      ...f,
      buttons: f.buttons.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  const removeButton = (index: number) => {
    setForm((f) => ({
      ...f,
      buttons: f.buttons.filter((_, i) => i !== index),
    }));
  };

  const internalPathFromPage = form.internalPage ? INTERNAL_PAGE_PATHS[form.internalPage] : form.internalPath ?? "";
  const sectionsForPage = sections.filter((s) => s.page === form.page);

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <NotificationBar color="danger">{error}</NotificationBar>}

      {isHeroSection && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">메인 페이지 상단 히어로 영역</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300/90">
            히어로 제목(본문)을 하나의 에디터로 자유롭게 편집하고, 버튼 크기·위치·링크 페이지를 설정하세요.
          </p>
        </div>
      )}

      {isHeroSection && heroExtra && (
        <section className="rounded-lg border border-site-border bg-gray-50/50 dark:bg-slate-800/30 p-4 space-y-4">
          <h3 className="text-base font-semibold text-site-text">히어로 제목</h3>
          <p className="text-xs text-gray-600 dark:text-slate-400">
            내용은 편집자가 자유롭게 넣을 수 있습니다. 텍스트 선택 후 오른쪽 툴에서 글꼴·크기·색상 등을 적용하세요.
          </p>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <div className="flex-1 space-y-3 min-w-0">
              <div className="rounded-lg border-2 border-site-border bg-white dark:bg-slate-800/50 p-4 min-h-[120px]">
                <HeroBlockEditor
                  value={heroExtra.heroTitleHtml}
                  onChange={(v) => setHeroExtra((h) => (h ? { ...h, heroTitleHtml: v } : h))}
                  placeholder="예: CAROM.CLUB, 태그라인, 부제목 등 원하는 내용을 입력하세요."
                  onEditorReady={(ed) => { heroEditorRef.current = ed; }}
                  lineHeight={heroExtra.titleLineHeight}
                  onParagraphLineHeight={onHeroParagraphLineHeight}
                  plainView
                  minHeight="120px"
                />
              </div>
              <div className="rounded-lg border border-site-border bg-gray-100 dark:bg-slate-800 p-4 overflow-visible">
                <span className="block text-xs font-medium text-gray-500 mb-2">미리보기 (배경·위치·서식 반영)</span>
                <HeroPreview
                  heroTitleHtml={heroExtra.heroTitleHtml}
                  titleAlign={heroExtra.titleAlign}
                  btnPosition={heroExtra.btnPosition}
                  btn1Label={heroExtra.btnTournaments}
                  btn2Label={heroExtra.btnApply}
                  btn1Size={heroExtra.btn1Size}
                  btn2Size={heroExtra.btn2Size}
                  backgroundImageUrl={form.imageUrl}
                />
              </div>
            </div>

            <div className="lg:w-56 shrink-0 rounded-lg border border-site-border bg-white dark:bg-slate-700/80 p-4 shadow-sm">
              <p className="text-sm font-medium text-site-text mb-3">글자 편집 툴</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">글꼴</label>
                  <select
                    value={heroExtra.titleFont}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHeroExtra((h) => (h ? { ...h, titleFont: v } : h));
                      heroEditorRef.current?.chain().focus().setFontFamily(v).run();
                    }}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {FONT_FAMILIES.map((o) => (
                      <option key={o.value || "default"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">글자 크기</label>
                  <select
                    value={heroExtra.titleSize}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHeroExtra((h) => (h ? { ...h, titleSize: v } : h));
                      if (v) heroEditorRef.current?.chain().focus().setFontSize(v).run();
                    }}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    <option value="">글자 크기</option>
                    {FONT_SIZES_PX.map((px) => (
                      <option key={px} value={px}>{px}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">색상</label>
                  <ColorPalette64
                    applyMode="text"
                    selectedHex={heroExtra.titleColor || undefined}
                    onSelect={(hex) => {
                      setHeroExtra((h) => (h ? { ...h, titleColor: hex } : h));
                      heroEditorRef.current?.chain().focus().setColor(hex).run();
                    }}
                    cellSize={18}
                  />
                </div>
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-xs text-gray-500 w-full">볼드 / 이탤릭 / 밑줄</span>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroExtra((h) => (h ? { ...h, titleBold: h.titleBold ? "" : "1" } : h));
                      heroEditorRef.current?.chain().focus().toggleBold().run();
                    }}
                    className={`px-2 py-1 rounded border text-sm font-bold ${heroExtra.titleBold ? "bg-site-primary/20 border-site-primary" : "border-site-border bg-white"}`}
                    title="굵게"
                  >B</button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroExtra((h) => (h ? { ...h, titleItalic: h.titleItalic ? "" : "1" } : h));
                      heroEditorRef.current?.chain().focus().toggleItalic().run();
                    }}
                    className={`px-2 py-1 rounded border text-sm italic ${heroExtra.titleItalic ? "bg-site-primary/20 border-site-primary" : "border-site-border bg-white"}`}
                    title="기울임"
                  >I</button>
                  <button
                    type="button"
                    onClick={() => {
                      setHeroExtra((h) => (h ? { ...h, titleUnderline: h.titleUnderline ? "" : "1" } : h));
                      heroEditorRef.current?.chain().focus().toggleUnderline().run();
                    }}
                    className={`px-2 py-1 rounded border text-sm underline ${heroExtra.titleUnderline ? "bg-site-primary/20 border-site-primary" : "border-site-border bg-white"}`}
                    title="밑줄"
                  >U</button>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">정렬</label>
                  <select
                    value={heroExtra.titleAlign}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, titleAlign: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {HERO_ALIGN_OPTIONS.map((o) => (
                      <option key={o.value || "default"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">줄간격 (커서 둔 단락만)</label>
                  <select
                    value={heroExtra.titleLineHeight}
                    onChange={(e) => {
                      const v = e.target.value;
                      setHeroExtra((h) => (h ? { ...h, titleLineHeight: v } : h));
                      (heroEditorRef.current?.chain().focus() as unknown as { setParagraphLineHeight: (lh: string | null) => { run: () => void }; run: () => void })?.setParagraphLineHeight(v || null).run();
                    }}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {HERO_LINE_HEIGHT_OPTIONS.map((o) => (
                      <option key={o.value || "default"} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div className="relative" ref={heroSpecialCharsRef}>
                  <button
                    type="button"
                    onClick={() => setHeroSpecialCharsOpen((o) => !o)}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700 hover:bg-gray-50"
                  >
                    Ω 특수문자
                  </button>
                  {heroSpecialCharsOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 min-w-[280px] rounded-lg border border-site-border bg-white p-3 shadow-lg">
                      <SpecialCharsPicker
                        onInsert={(char) => heroEditorRef.current?.chain().focus().insertContent(char).run()}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-site-border pt-4 space-y-4">
            <h4 className="text-sm font-semibold text-site-text">히어로 버튼</h4>
            <div>
              <label className="block text-xs text-gray-500 mb-1">버튼 위치</label>
              <select
                value={heroExtra.btnPosition}
                onChange={(e) => setHeroExtra((h) => (h ? { ...h, btnPosition: e.target.value } : h))}
                className="w-full max-w-xs rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
              >
                {HERO_BTN_POSITION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-site-border bg-white dark:bg-slate-800/50 p-4 space-y-3">
                <span className="block text-sm font-medium text-site-text">첫 번째 버튼</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">문구</label>
                  <input
                    type="text"
                    value={heroExtra.btnTournaments}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btnTournaments: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
                    placeholder="진행중 대회 보기"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">크기</label>
                  <select
                    value={heroExtra.btn1Size}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btn1Size: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {HERO_BTN_SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">링크 페이지</label>
                  <select
                    value={heroExtra.btn1InternalPage}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btn1InternalPage: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {(Object.entries(INTERNAL_PAGE_LABELS) as [InternalPageSlug, string][]).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="rounded-lg border border-site-border bg-white dark:bg-slate-800/50 p-4 space-y-3">
                <span className="block text-sm font-medium text-site-text">두 번째 버튼</span>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">문구</label>
                  <input
                    type="text"
                    value={heroExtra.btnApply}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btnApply: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm dark:bg-slate-700"
                    placeholder="대회 참가 신청"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">크기</label>
                  <select
                    value={heroExtra.btn2Size}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btn2Size: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {HERO_BTN_SIZE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">링크 페이지</label>
                  <select
                    value={heroExtra.btn2InternalPage}
                    onChange={(e) => setHeroExtra((h) => (h ? { ...h, btn2InternalPage: e.target.value } : h))}
                    className="w-full rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                  >
                    {(Object.entries(INTERNAL_PAGE_LABELS) as [InternalPageSlug, string][]).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-semibold">기본 정보</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">섹션 배경색</label>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="text"
                value={form.backgroundColor ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, backgroundColor: e.target.value || null }))}
                className="w-28 rounded border border-site-border bg-white px-2 py-1.5 text-sm dark:bg-slate-700"
                placeholder="#ffffff"
              />
              <ColorPalette64
                applyMode="background"
                selectedHex={form.backgroundColor ?? undefined}
                onSelect={(hex) => setForm((f) => ({ ...f, backgroundColor: hex }))}
                cellSize={20}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">비우면 기존 스타일 유지</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">제목 아이콘 유형</label>
            <select
              value={form.titleIconType ?? "none"}
              onChange={(e) => setForm((f) => ({ ...f, titleIconType: e.target.value as "none" | "icon" | "image" }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              <option value="none">없음</option>
              <option value="icon">아이콘(문자/이모지)</option>
              <option value="image">이미지</option>
            </select>
          </div>
          {(form.titleIconType === "icon" || form.titleIconType === "image") && (
            <>
              {form.titleIconType === "icon" && (
                <div>
                  <label className="block text-sm font-medium mb-1">아이콘 문자/이모지</label>
                  <input
                    type="text"
                    value={form.titleIconName ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, titleIconName: e.target.value || null }))}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                    placeholder="예: 🏆 또는 ●"
                  />
                </div>
              )}
              {form.titleIconType === "image" && (
                <AdminImageField
                  label="제목 아이콘 이미지 URL"
                  value={form.titleIconImageUrl}
                  onChange={(url) => setForm((f) => ({ ...f, titleIconImageUrl: url }))}
                  policy="section"
                />
              )}
              <div>
                <label className="block text-sm font-medium mb-1">아이콘 크기</label>
                <select
                  value={form.titleIconSize ?? "small"}
                  onChange={(e) => setForm((f) => ({ ...f, titleIconSize: e.target.value as "small" | "medium" }))}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                >
                  <option value="small">작게 (16~18px)</option>
                  <option value="medium">보통 (20~24px)</option>
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">섹션 유형 (필수)</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PageSection["type"] }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              {(Object.entries(SECTION_TYPE_LABELS) as [keyof typeof SECTION_TYPE_LABELS, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              {isHeroSection ? "섹션 제목 (히어로는 자동)" : "섹션 제목 (필수)"}
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => !isHeroSection && setForm((f) => ({ ...f, title: e.target.value }))}
              readOnly={isHeroSection}
              className={`w-full rounded border border-site-border px-3 py-2 dark:bg-slate-700 ${isHeroSection ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400" : "bg-white"}`}
              placeholder={isHeroSection ? "Hero" : undefined}
              required={!isHeroSection}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">부제목</label>
            <input
              type="text"
              value={form.subtitle ?? ""}
              onChange={(e) => !isHeroSection && setForm((f) => ({ ...f, subtitle: e.target.value || null }))}
              readOnly={isHeroSection}
              className={`w-full rounded border border-site-border px-3 py-2 dark:bg-slate-700 ${isHeroSection ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400" : "bg-white"}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">설명 텍스트</label>
            <textarea
              value={form.description ?? ""}
              onChange={(e) => !isHeroSection && setForm((f) => ({ ...f, description: e.target.value || null }))}
              readOnly={isHeroSection}
              rows={3}
              className={`w-full rounded border border-site-border px-3 py-2 dark:bg-slate-700 ${isHeroSection ? "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-slate-400" : "bg-white"}`}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">텍스트 정렬</label>
            <select
              value={form.textAlign}
              onChange={(e) => setForm((f) => ({ ...f, textAlign: e.target.value as PageSection["textAlign"] }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              {(Object.entries(TEXT_ALIGN_LABELS) as [keyof typeof TEXT_ALIGN_LABELS, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 text-lg font-semibold">페이지 위치 설정</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium mb-1">노출 페이지</label>
            <select
              value={form.page}
              onChange={(e) => setForm((f) => ({ ...f, page: e.target.value as PageSection["page"] }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              {(Object.entries(PAGE_LABELS) as [keyof typeof PAGE_LABELS, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">노출 위치</label>
            <select
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as PageSection["placement"] }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              {(Object.entries(PLACEMENT_LABELS) as [keyof typeof PLACEMENT_LABELS, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {form.type === "image" && (
        <section>
          <h3 className="mb-4 text-lg font-semibold">
            {isHeroSection ? "배경 이미지 (히어로)" : "이미지 설정"}
          </h3>
          <div className="space-y-4">
            <AdminImageField
              label={isHeroSection ? "배경 이미지 (업로드 또는 URL, 필수)" : "대표 이미지 (업로드 또는 URL 중 하나 필수)"}
              value={form.imageUrl}
              onChange={(url) => setForm((f) => ({ ...f, imageUrl: url }))}
              policy="section"
              recommendedSize={
                RECOMMENDED_IMAGE_SIZES[form.placement]
                  ? `PC ${RECOMMENDED_IMAGE_SIZES[form.placement].desktop} / 모바일 ${RECOMMENDED_IMAGE_SIZES[form.placement].mobile}`
                  : undefined
              }
              required={false}
            />
            <AdminImageField
              label="모바일 이미지 (선택)"
              value={form.imageUrlMobile}
              onChange={(url) => setForm((f) => ({ ...f, imageUrlMobile: url }))}
              policy="section"
              recommendedSize={RECOMMENDED_IMAGE_SIZES[form.placement]?.mobile}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1">PC 높이(px)</label>
                <input
                  type="number"
                  min={100}
                  value={form.imageHeightPc ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, imageHeightPc: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">모바일 높이(px)</label>
                <input
                  type="number"
                  min={100}
                  value={form.imageHeightMobile ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, imageHeightMobile: e.target.value ? parseInt(e.target.value, 10) : null }))}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-semibold">
          {isHeroSection ? "첫 번째 버튼 링크 (진행중 대회 보기)" : "링크 설정"}
        </h3>
        {isHeroSection && (
          <p className="mb-3 text-sm text-gray-600 dark:text-slate-400">
            히어로에서 &quot;진행중 대회 보기&quot; 버튼 클릭 시 이동할 주소를 설정합니다.
          </p>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">링크 사용 여부</label>
            <select
              value={form.linkType}
              onChange={(e) => setForm((f) => ({ ...f, linkType: e.target.value as PageSection["linkType"] }))}
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              <option value="none">사용 안 함</option>
              <option value="internal">내부 페이지 이동</option>
              <option value="external">외부 사이트 링크</option>
            </select>
          </div>
          {form.linkType === "internal" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">페이지 선택</label>
                <select
                  value={form.internalPage ?? ""}
                  onChange={(e) => {
                    const v = e.target.value as PageSection["internalPage"];
                    setForm((f) => ({
                      ...f,
                      internalPage: v || null,
                      internalPath: v ? INTERNAL_PAGE_PATHS[v] : null,
                    }));
                  }}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                >
                  <option value="">선택</option>
                  {(Object.entries(INTERNAL_PAGE_LABELS) as [keyof typeof INTERNAL_PAGE_LABELS, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">또는 직접 경로 입력</label>
                <input
                  type="text"
                  value={internalPathFromPage}
                  onChange={(e) => setForm((f) => ({ ...f, internalPath: e.target.value || null, internalPage: null }))}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                  placeholder="/ 또는 /tournaments"
                />
              </div>
            </>
          )}
          {form.linkType === "external" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">사이트 주소</label>
                <input
                  type="url"
                  value={form.externalUrl ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value || null }))}
                  className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                  placeholder="https://example.com"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.openInNewTab}
                  onChange={(e) => setForm((f) => ({ ...f, openInNewTab: e.target.checked }))}
                />
                <span className="text-sm">새 창에서 열기</span>
              </label>
            </>
          )}
        </div>
      </section>

      {(form.type === "text" || form.type === "cta") && (
        <section>
          <h3 className="mb-4 text-lg font-semibold">버튼 설정 (최대 3개)</h3>
          {form.buttons.map((btn, i) => (
            <div key={btn.id} className="mb-4 rounded border border-site-border bg-gray-50 p-4 dark:bg-slate-800">
              <div className="flex flex-wrap gap-4">
                <input
                  type="text"
                  placeholder="버튼 이름"
                  value={btn.name}
                  onChange={(e) => updateButton(i, { name: e.target.value })}
                  className="flex-1 min-w-[120px] rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                />
                <select
                  value={btn.linkType}
                  onChange={(e) => updateButton(i, { linkType: e.target.value as "internal" | "external" })}
                  className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                >
                  <option value="internal">내부 페이지 이동</option>
                  <option value="external">외부 사이트 링크</option>
                </select>
                <input
                  type="text"
                  placeholder="이동 주소"
                  value={btn.href}
                  onChange={(e) => updateButton(i, { href: e.target.value })}
                  className="flex-1 min-w-[120px] rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                />
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={btn.openInNewTab}
                    onChange={(e) => updateButton(i, { openInNewTab: e.target.checked })}
                  />
                  <span className="text-sm">새 창</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={btn.isPrimary}
                    onChange={(e) => updateButton(i, { isPrimary: e.target.checked })}
                  />
                  <span className="text-sm">대표 버튼</span>
                </label>
                <button type="button" onClick={() => removeButton(i)} className="text-red-600 text-sm">삭제</button>
              </div>
            </div>
          ))}
          {form.buttons.length < 3 && (
            <button type="button" onClick={addButton} className="rounded border border-dashed border-site-border px-4 py-2 text-sm text-gray-600">
              + 버튼 추가
            </button>
          )}
        </section>
      )}

      <section>
        <h3 className="mb-4 text-lg font-semibold">표시 설정</h3>
        <div className="flex flex-wrap gap-6">
          <div>
            <label className="block text-sm font-medium mb-1">노출 여부</label>
            <select
              value={form.isVisible ? "visible" : "hidden"}
              onChange={(e) => setForm((f) => ({ ...f, isVisible: e.target.value === "visible" }))}
              className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              <option value="visible">표시</option>
              <option value="hidden">숨김</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">정렬 순서 (낮을수록 먼저)</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
              className="w-24 rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">노출 시작일</label>
            <input
              type="datetime-local"
              value={form.startAt ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value || null }))}
              className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">노출 종료일</label>
            <input
              type="datetime-local"
              value={form.endAt ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value || null }))}
              className="rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            />
          </div>
        </div>
      </section>

      <div className="flex gap-3">
        <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
        <Button type="button" label="취소" color="contrast" outline onClick={onCancel} />
      </div>
        </div>

        <SectionPositionPreviewPanel
          placement={form.placement}
          page={form.page}
          sortOrder={form.sortOrder}
          currentSectionId={form.id}
          sections={sectionsForPage}
          onPlacementChange={(p) => setForm((f) => ({ ...f, placement: p }))}
        />
      </div>
    </form>
  );
}
