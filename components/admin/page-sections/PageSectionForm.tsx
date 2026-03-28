"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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
import { AdminColorField } from "@/components/admin/_components/AdminColorField";
import { SectionPositionPreviewPanel } from "./SectionPositionPreviewPanel";
import type { SectionAnimationPreset } from "@/lib/section-style";
import { resolveSectionStyle, serializeSectionStyleJson } from "@/lib/section-style";

type PageSectionFormState = Omit<PageSection, "createdAt" | "updatedAt"> & {
  title: string;
  subtitle: string | null;
  description: string | null;
  imageUrl: string | null;
  imageUrlMobile: string | null;
  internalPage: PageSection["internalPage"];
  internalPath: string | null;
  externalUrl: string | null;
  backgroundColor: string | null;
  titleIconType: "none" | "icon" | "image";
  titleIconName: string | null;
  titleIconImageUrl: string | null;
  titleIconSize: "small" | "medium" | null;
  startAt: string | null;
  endAt: string | null;
  animationPreset: SectionAnimationPreset;
  dividerEnabled: boolean;
  dividerStyle: "solid" | "dashed";
  dividerWidthPx: number;
  dividerColor: string;
};

const emptySection = (): PageSectionFormState => ({
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
  sectionStyleJson: null,
  animationPreset: "static",
  dividerEnabled: false,
  dividerStyle: "solid",
  dividerWidthPx: 1,
  dividerColor: "#e5e7eb",
});

/** 서버/initial 데이터를 폼 상태로 정규화. undefined 제거 → 문자열 '', nullable은 null */
function normalizeSectionForForm(s: PageSection): PageSectionFormState {
  const resolved = resolveSectionStyle(s);
  const divStyle = resolved.divider.style === "dashed" ? "dashed" : "solid";
  return {
    ...s,
    title: s.title ?? "",
    subtitle: s.subtitle ?? null,
    description: s.description ?? null,
    imageUrl: s.imageUrl ?? null,
    imageUrlMobile: s.imageUrlMobile ?? null,
    internalPage: s.internalPage ?? null,
    internalPath: s.internalPath ?? null,
    externalUrl: s.externalUrl ?? null,
    backgroundColor: s.backgroundColor ?? null,
    sectionStyleJson: s.sectionStyleJson ?? null,
    titleIconType: (s.titleIconType === "icon" || s.titleIconType === "image" ? s.titleIconType : "none") as PageSectionFormState["titleIconType"],
    titleIconName: s.titleIconName ?? null,
    titleIconImageUrl: s.titleIconImageUrl ?? null,
    titleIconSize: s.titleIconSize === "medium" ? "medium" : s.titleIconSize === "small" ? "small" : null,
    startAt: s.startAt ? s.startAt.slice(0, 16) : null,
    endAt: s.endAt ? s.endAt.slice(0, 16) : null,
    animationPreset: resolved.animationPreset,
    dividerEnabled: resolved.divider.enabled,
    dividerStyle: divStyle,
    dividerWidthPx: resolved.divider.widthPx,
    dividerColor: resolved.divider.color,
  };
}

type Props = {
  initial?: PageSection | null;
  /** 같은 페이지의 다른 섹션 목록 (미니맵·충돌 경고용). 없으면 빈 배열 사용 */
  sections?: PageSection[];
  onSubmit: (data: Omit<PageSection, "createdAt" | "updatedAt">) => Promise<void>;
  onCancel: () => void;
};

export function PageSectionForm({ initial, sections = [], onSubmit, onCancel }: Props) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PageSectionFormState>(() => {
    if (initial) {
      return { ...normalizeSectionForForm(initial), id: initial.id };
    }
    return { ...emptySection(), id: `ps-${Date.now()}` };
  });

  const isHeroSection = form.placement === "main_visual_bg" && form.type === "image";

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
        setError("이미지 첨부파일을 업로드해 주세요.");
        return;
      }
    }
    setSaving(true);
    try {
      const sectionStyleJson = serializeSectionStyleJson({
        animationPreset: form.animationPreset,
        divider: {
          enabled: form.dividerEnabled,
          style: form.dividerEnabled ? form.dividerStyle : "solid",
          widthPx: form.dividerWidthPx,
          color: form.dividerColor,
        },
      });
      const {
        animationPreset: _anim,
        dividerEnabled: _de,
        dividerStyle: _ds,
        dividerWidthPx: _dw,
        dividerColor: _dc,
        ...pageFields
      } = form;
      const payload: Omit<PageSection, "createdAt" | "updatedAt"> = {
        ...pageFields,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        sectionStyleJson,
      };
      if (isHeroSection) {
        payload.title = "Hero";
        payload.subtitle = null;
        payload.description = null;
      }
      await onSubmit(payload);
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
      {isHeroSection && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
          <p className="font-medium">메인 비주얼 이미지 섹션</p>
          <p className="mt-1 text-blue-900/90 dark:text-blue-200/90">
            상단 히어로 <strong>제목·버튼·오버레이</strong>는{" "}
            <Link href="/admin/site/hero" className="font-medium text-site-primary underline">
              사이트관리 → 홈 화면 설정 → 히어로 설정
            </Link>
            의 JSON에서만 편집합니다. 여기서는 본 이미지 섹션(배너·링크·섹션 스타일)만 설정합니다.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-8">
      <section>
        <h3 className="mb-4 text-lg font-semibold">기본 정보</h3>
        <div className="space-y-4">
          <AdminColorField
            label="섹션 배경색"
            value={form.backgroundColor}
            onChange={(hex) => setForm((f) => ({ ...f, backgroundColor: hex }))}
            nullable
            helperText="비우면 기존 스타일 유지"
          />
          <div>
            <label className="block text-sm font-medium mb-1">섹션 등장 애니메이션</label>
            <select
              value={form.animationPreset}
              onChange={(e) =>
                setForm((f) => ({ ...f, animationPreset: e.target.value as SectionAnimationPreset }))
              }
              className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
            >
              <option value="static">없음 (static)</option>
              <option value="fade">페이드 (fade)</option>
              <option value="snap">스냅 (snap)</option>
              <option value="flow">플로우 (flow)</option>
            </select>
          </div>
          <div className="rounded-lg border border-site-border p-4 space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.dividerEnabled}
                onChange={(e) => setForm((f) => ({ ...f, dividerEnabled: e.target.checked }))}
              />
              하단 구분선 표시
            </label>
            {form.dividerEnabled && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">구분선 스타일</label>
                  <select
                    value={form.dividerStyle}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dividerStyle: e.target.value as "solid" | "dashed" }))
                    }
                    className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                  >
                    <option value="solid">실선</option>
                    <option value="dashed">파선</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">두께 (px)</label>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={form.dividerWidthPx}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        dividerWidthPx: Math.min(16, Math.max(1, parseInt(e.target.value, 10) || 1)),
                      }))
                    }
                    className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                  />
                </div>
                <AdminColorField
                  label="구분선 색"
                  value={form.dividerColor}
                  onChange={(hex) => setForm((f) => ({ ...f, dividerColor: hex ?? "#e5e7eb" }))}
                  nullable={false}
                />
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">제목 아이콘 유형</label>
            <select
              value={form.titleIconType}
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
                    onChange={(e) => setForm((f) => ({ ...f, titleIconName: e.target.value.trim() || null }))}
                    className="w-full rounded border border-site-border bg-white px-3 py-2 dark:bg-slate-700"
                    placeholder="예: 🏆 또는 ●"
                  />
                </div>
              )}
              {form.titleIconType === "image" && (
                <AdminImageField
                  label="제목 아이콘 이미지 (첨부파일)"
                  value={form.titleIconImageUrl ?? null}
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
              value={form.title ?? ""}
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
              label={isHeroSection ? "배경 이미지 (첨부파일, 필수)" : "대표 이미지 (첨부파일, 필수)"}
              value={form.imageUrl ?? null}
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
              value={form.imageUrlMobile ?? null}
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
                  value={internalPathFromPage ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, internalPath: e.target.value.trim() || null, internalPage: null }))}
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
                  onChange={(e) => setForm((f) => ({ ...f, externalUrl: e.target.value.trim() || null }))}
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

      {(form.type === "text" || form.type === "cta" || (isHeroSection && form.type === "image")) && (
        <section>
          <h3 className="mb-4 text-lg font-semibold">
            {isHeroSection && form.type === "image"
              ? "버튼 설정 (레거시 폴백, 최대 3개)"
              : "버튼 설정 (최대 3개)"}
          </h3>
          {isHeroSection && form.type === "image" && (
            <p className="mb-3 text-sm text-gray-600 dark:text-slate-400">
              신규 히어로(JSON)가 꺼져 있을 때만 이 버튼이 메인에 쓰입니다. 우선은 히어로 설정 화면을 사용하세요.
            </p>
          )}
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

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" label={saving ? "저장 중…" : "저장"} color="info" disabled={saving} />
        <Button type="button" label="취소" color="contrast" outline onClick={onCancel} />
        {error && <NotificationBar color="danger">{error}</NotificationBar>}
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
