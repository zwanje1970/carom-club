"use client";

import { useEffect, useMemo, useState } from "react";
import { mdiCardText } from "@mdi/js";
import SectionMain from "@/components/admin/_components/Section/Main";
import SectionTitleLineWithButton from "@/components/admin/_components/Section/TitleLineWithButton";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import { BasicCard, HighlightCard } from "@/components/cards/TournamentPublishedCard";
import {
  DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES,
  PLATFORM_CARD_TEMPLATE_ACTIVE_COPY_KEYS,
  PLATFORM_CARD_TEMPLATE_DEFAULT_COPY_KEYS,
  PLATFORM_CARD_TEMPLATE_DETAIL_BUTTON_COPY_KEYS,
  PLATFORM_CARD_TEMPLATE_FIELD_LABELS,
  PLATFORM_CARD_TEMPLATE_POLICIES,
  PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS,
  resolvePlatformCardTemplatePolicies,
  resolvePlatformCardTemplateStylePolicy,
  toPlatformCardTemplateStyleRaw,
  type PlatformCardRatioPreset,
  type PlatformCardTemplatePolicy,
  type PlatformCardTemplateStylePolicy,
  type PlatformCardTemplateType,
} from "@/lib/platform-card-templates";

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(value || 0)));
}

function ratioToImageHeight(cardHeight: number, ratio: PlatformCardRatioPreset): number {
  const [a, b] = ratio.split(":").map((v) => Number(v));
  const total = a + b;
  if (!total) return Math.floor(cardHeight / 2);
  return Math.floor((cardHeight * a) / total);
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-gray-600 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            const n = Number(draft);
            if (!Number.isFinite(n)) {
              setDraft(String(value));
              return;
            }
            onChange(clampInt(n, min, max));
          }}
          className="w-full rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900"
        />
        <button type="button" tabIndex={-1} className="rounded border border-site-border px-2 py-1 text-xs" onClick={() => onChange(clampInt(value - step, min, max))}>-</button>
        <button type="button" tabIndex={-1} className="rounded border border-site-border px-2 py-1 text-xs" onClick={() => onChange(clampInt(value + step, min, max))}>+</button>
      </div>
    </label>
  );
}

export default function AdminPlatformCardTemplatesPage() {
  const templates = [...PLATFORM_CARD_TEMPLATE_POLICIES].sort((a, b) => a.sortOrder - b.sortOrder);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [policies, setPolicies] = useState<PlatformCardTemplatePolicy[]>(templates);
  const [styles, setStyles] = useState<Record<PlatformCardTemplateType, PlatformCardTemplateStylePolicy>>({
    basic: { ...DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES.basic },
    highlight: { ...DEFAULT_PLATFORM_CARD_TEMPLATE_STYLES.highlight },
  });

  useEffect(() => {
    fetch("/api/admin/copy", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch"))))
      .then((copy) => {
        setPolicies(resolvePlatformCardTemplatePolicies(copy));
        setStyles({
          basic: resolvePlatformCardTemplateStylePolicy(
            copy?.[PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.basic] ?? null,
            "basic"
          ),
          highlight: resolvePlatformCardTemplateStylePolicy(
            copy?.[PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.highlight] ?? null,
            "highlight"
          ),
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setOk(""), 2200);
    return () => clearTimeout(t);
  }, [ok]);

  const save = async () => {
    setSaving(true);
    setError("");
    setOk("");
    try {
      const res = await fetch("/api/admin/copy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          copy: {
            [PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.basic]: toPlatformCardTemplateStyleRaw(styles.basic),
            [PLATFORM_CARD_TEMPLATE_STYLE_COPY_KEYS.highlight]: toPlatformCardTemplateStyleRaw(styles.highlight),
            [PLATFORM_CARD_TEMPLATE_ACTIVE_COPY_KEYS.basic]: String(
              policies.find((item) => item.templateType === "basic")?.isActive ?? true
            ),
            [PLATFORM_CARD_TEMPLATE_ACTIVE_COPY_KEYS.highlight]: String(
              policies.find((item) => item.templateType === "highlight")?.isActive ?? true
            ),
            [PLATFORM_CARD_TEMPLATE_DEFAULT_COPY_KEYS.basic]: String(
              policies.find((item) => item.templateType === "basic")?.isDefault ?? true
            ),
            [PLATFORM_CARD_TEMPLATE_DEFAULT_COPY_KEYS.highlight]: String(
              policies.find((item) => item.templateType === "highlight")?.isDefault ?? false
            ),
            [PLATFORM_CARD_TEMPLATE_DETAIL_BUTTON_COPY_KEYS.basic]: String(
              policies.find((item) => item.templateType === "basic")?.showDetailButton ?? false
            ),
            [PLATFORM_CARD_TEMPLATE_DETAIL_BUTTON_COPY_KEYS.highlight]: String(
              policies.find((item) => item.templateType === "highlight")?.showDetailButton ?? true
            ),
          },
        }),
      });
      if (!res.ok) {
        setError("저장 실패");
        return;
      }
      setOk("저장 완료");
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const previewData = useMemo(
    () => ({
      basic: {
        templateType: "basic" as const,
        thumbnailUrl: "",
        cardTitle: "대회명 샘플",
        displayDateText: "2026-04-05",
        displayRegionText: "서울",
        statusText: "모집중",
        buttonText: "자세히 보기",
      },
      highlight: {
        templateType: "highlight" as const,
        thumbnailUrl: "",
        cardTitle: "강조형 대회명 샘플",
        displayDateText: "2026-04-05",
        displayRegionText: "서울",
        statusText: "마감임박",
        buttonText: "자세히 보기",
        shortDescription: "짧은 설명 샘플 텍스트",
      },
    }),
    []
  );

  const patchStyle = (
    templateType: PlatformCardTemplateType,
    patch: Partial<PlatformCardTemplateStylePolicy>
  ) => {
    setStyles((prev) => ({
      ...prev,
      [templateType]: { ...prev[templateType], ...patch },
    }));
  };

  const patchPolicy = (
    templateType: PlatformCardTemplateType,
    patch: Partial<Pick<PlatformCardTemplatePolicy, "isActive" | "isDefault" | "showDetailButton">>
  ) => {
    setPolicies((prev) => {
      const next = prev.map((item) =>
        item.templateType === templateType ? { ...item, ...patch } : { ...item }
      );
      if (patch.isDefault === true) {
        return next.map((item) => ({
          ...item,
          isDefault: item.templateType === templateType ? true : false,
        }));
      }
      const active = next.filter((item) => item.isActive);
      if (active.length === 0) {
        return next.map((item) => ({
          ...item,
          isActive: item.templateType === "basic",
          isDefault: item.templateType === "basic",
        }));
      }
      if (!active.some((item) => item.isDefault)) {
        const fallback = active.find((item) => item.templateType === "basic") ?? active[0];
        return next.map((item) => ({
          ...item,
          isDefault: item.templateType === fallback.templateType,
        }));
      }
      return next;
    });
  };

  return (
    <SectionMain>
      <SectionTitleLineWithButton icon={mdiCardText} title="카드 템플릿" main />

      <CardBox className="mb-5">
        <p className="text-sm text-gray-600 dark:text-slate-400">
          템플릿은 basic / highlight 2종 고정입니다. 템플릿 구조는 유지하고 카드 스타일만 조정합니다.
        </p>
      </CardBox>

      <div className="space-y-4">
        {policies.map((template) => (
          <CardBox key={template.templateType}>
            {(() => {
              const style = styles[template.templateType];
              if (!style) return null;
              return (
                <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-base font-semibold text-site-text">{template.label}</p>
              <p className="text-xs text-gray-500 dark:text-slate-400">표시 순서: {template.sortOrder}</p>
            </div>

            <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">{template.description}</p>

            <div className="mt-3">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">포함 항목</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-site-text">
                {template.fields.map((field) => (
                  <li key={`${template.templateType}-${field}`}>{PLATFORM_CARD_TEMPLATE_FIELD_LABELS[field]}</li>
                ))}
                {template.supportsWholeCardClick ? <li>카드 전체 클릭</li> : null}
              </ul>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 rounded border border-site-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={template.isActive}
                  onChange={(e) =>
                    patchPolicy(template.templateType, {
                      isActive: e.target.checked,
                    })
                  }
                />
                사용 여부
              </label>
              <label className="flex items-center gap-2 rounded border border-site-border px-3 py-2 text-sm">
                <input
                  type="radio"
                  name="platform-card-template-default"
                  checked={template.isDefault}
                  onChange={() =>
                    patchPolicy(template.templateType, {
                      isDefault: true,
                    })
                  }
                />
                기본 템플릿
              </label>
            </div>
            <div className="mt-2 rounded border border-site-border px-3 py-2">
              <p className="text-xs font-medium text-gray-600 dark:text-slate-400">자세히보기 버튼 표시</p>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={`show-detail-button-${template.templateType}`}
                    checked={template.showDetailButton}
                    onChange={() =>
                      patchPolicy(template.templateType, {
                        showDetailButton: true,
                      })
                    }
                  />
                  사용
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="radio"
                    name={`show-detail-button-${template.templateType}`}
                    checked={!template.showDetailButton}
                    onChange={() =>
                      patchPolicy(template.templateType, {
                        showDetailButton: false,
                      })
                    }
                  />
                  사용 안 함
                </label>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <NumberField label="카드 너비" value={style.cardWidth} min={180} max={800} onChange={(v) => patchStyle(template.templateType, { cardWidth: v })} />
              <NumberField label="카드 높이" value={style.cardHeight} min={180} max={1000} onChange={(v) => patchStyle(template.templateType, { cardHeight: v })} />
              <NumberField label="바깥 여백" value={style.outerMargin} min={0} max={80} onChange={(v) => patchStyle(template.templateType, { outerMargin: v })} />
              <NumberField label="내용 여백(전체)" value={style.textAreaPadding} min={0} max={80} onChange={(v) => patchStyle(template.templateType, { textAreaPadding: v, paddingTop: v, paddingBottom: v, paddingLeft: v, paddingRight: v })} />
            </div>

            <div className="mt-3 space-y-2">
              <NumberField label="이미지 높이" value={style.imageAreaHeight} min={60} max={700} onChange={(v) => patchStyle(template.templateType, { imageAreaHeight: v })} />
              <p className="mb-1 text-xs font-medium text-gray-600 dark:text-slate-400">이미지 비율</p>
              <div className="flex flex-wrap gap-1">
                {([
                  { value: "1:1", label: "정사각형 (1:1)" },
                  { value: "2:3", label: "세로형 (2:3)" },
                  { value: "1:2", label: "긴 세로형 (1:2)" },
                  { value: "3:5", label: "넓은형 (3:5)" },
                ] as const).map((ratio) => (
                  <button
                    key={`${template.templateType}-${ratio.value}`}
                    type="button"
                    onClick={() =>
                      patchStyle(template.templateType, {
                        ratioPreset: ratio.value,
                        imageAreaHeight: clampInt(ratioToImageHeight(style.cardHeight, ratio.value), 60, 700),
                      })
                    }
                    className={`rounded border px-2 py-1 text-xs ${style.ratioPreset === ratio.value ? "border-site-primary bg-site-primary text-white" : "border-site-border"}`}
                  >
                    {ratio.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <NumberField label="제목 글자 크기" value={style.titleFontSize} min={10} max={48} onChange={(v) => patchStyle(template.templateType, { titleFontSize: v })} />
              <NumberField label="내용 글자 크기" value={style.shortDescriptionFontSize} min={10} max={40} onChange={(v) => patchStyle(template.templateType, { shortDescriptionFontSize: v })} />
              <NumberField label="상태 글자 크기" value={style.statusFontSize} min={10} max={28} onChange={(v) => patchStyle(template.templateType, { statusFontSize: v })} />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">글자 색상</span>
                <input type="color" value={style.textColor} className="h-9 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" onChange={(e) => patchStyle(template.templateType, { textColor: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">배경 색상</span>
                <input type="color" value={style.backgroundColor} className="h-9 w-full rounded border border-site-border bg-white px-1 dark:bg-slate-900" onChange={(e) => patchStyle(template.templateType, { backgroundColor: e.target.value })} />
              </label>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">제목 위치</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.titlePosition} onChange={(e) => patchStyle(template.templateType, { titlePosition: e.target.value as PlatformCardTemplateStylePolicy["titlePosition"] })}>
                  <option value="top">위쪽</option><option value="center">가운데</option><option value="bottom">아래쪽</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">제목 정렬</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.titleAlign} onChange={(e) => patchStyle(template.templateType, { titleAlign: e.target.value as PlatformCardTemplateStylePolicy["titleAlign"] })}>
                  <option value="left">왼쪽 정렬</option><option value="center">가운데 정렬</option><option value="right">오른쪽 정렬</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">내용 위치</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.shortDescriptionPosition} onChange={(e) => patchStyle(template.templateType, { shortDescriptionPosition: e.target.value as PlatformCardTemplateStylePolicy["shortDescriptionPosition"] })}>
                  <option value="title-below">제목 아래</option><option value="center">가운데</option><option value="bottom">아래쪽</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">내용 정렬</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.shortDescriptionAlign} onChange={(e) => patchStyle(template.templateType, { shortDescriptionAlign: e.target.value as PlatformCardTemplateStylePolicy["shortDescriptionAlign"] })}>
                  <option value="left">왼쪽 정렬</option><option value="center">가운데 정렬</option><option value="right">오른쪽 정렬</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">상태 위치</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.statusPosition} onChange={(e) => patchStyle(template.templateType, { statusPosition: e.target.value as PlatformCardTemplateStylePolicy["statusPosition"] })}>
                  <option value="top-left">왼쪽 위</option>
                  <option value="top-right">오른쪽 위</option>
                  <option value="title-above">제목 위</option>
                  <option value="title-below">제목 아래</option>
                  <option value="bottom-right">오른쪽 아래</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">상태 정렬</span>
                <select className="rounded border border-site-border bg-white px-2 py-1.5 dark:bg-slate-900" value={style.statusAlign} onChange={(e) => patchStyle(template.templateType, { statusAlign: e.target.value as PlatformCardTemplateStylePolicy["statusAlign"] })}>
                  <option value="left">왼쪽 정렬</option><option value="center">가운데 정렬</option><option value="right">오른쪽 정렬</option>
                </select>
              </label>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <NumberField label="위쪽 여백" value={style.paddingTop} min={0} max={120} onChange={(v) => patchStyle(template.templateType, { paddingTop: v })} />
              <NumberField label="아래쪽 여백" value={style.paddingBottom} min={0} max={120} onChange={(v) => patchStyle(template.templateType, { paddingBottom: v })} />
              <NumberField label="왼쪽 여백" value={style.paddingLeft} min={0} max={120} onChange={(v) => patchStyle(template.templateType, { paddingLeft: v })} />
              <NumberField label="오른쪽 여백" value={style.paddingRight} min={0} max={120} onChange={(v) => patchStyle(template.templateType, { paddingRight: v })} />
              <NumberField label="요소 간 간격" value={style.gapBetweenElements} min={0} max={48} onChange={(v) => patchStyle(template.templateType, { gapBetweenElements: v })} />
              <NumberField label="제목-내용 간격" value={style.titleContentGap} min={0} max={48} onChange={(v) => patchStyle(template.templateType, { titleContentGap: v })} />
            </div>

            <div className="mt-4 rounded border border-site-border bg-gray-50 p-3 dark:bg-slate-900/40">
              {template.templateType === "highlight" ? (
                <HighlightCard
                  data={previewData.highlight}
                  stylePolicy={style}
                  showDetailButton={template.showDetailButton}
                />
              ) : (
                <BasicCard
                  data={previewData.basic}
                  stylePolicy={style}
                  showDetailButton={template.showDetailButton}
                />
              )}
            </div>
                </>
              );
            })()}
          </CardBox>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button label={loading ? "불러오는 중..." : saving ? "저장 중..." : "카드 스타일 저장"} color="info" disabled={loading || saving} onClick={() => void save()} />
        {saving ? <span className="text-xs text-gray-600 dark:text-slate-400">저장 중...</span> : null}
        {!saving && ok ? <span className="text-xs text-green-700 dark:text-green-300">{ok}</span> : null}
        {!saving && error ? <span className="text-xs text-red-600 dark:text-red-300">{error}</span> : null}
      </div>
    </SectionMain>
  );
}
