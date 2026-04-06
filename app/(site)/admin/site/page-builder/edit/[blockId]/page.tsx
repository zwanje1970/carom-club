"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import CardBox from "@/components/admin/_components/CardBox";
import Button from "@/components/admin/_components/Button";
import NotificationBar from "@/components/admin/_components/NotificationBar";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import type { PageSection, SectionButton, TextAlign } from "@/types/page-section";
import type { PageBuilderKey } from "@/lib/content/page-section-page-rules";
import { DEFAULT_SITE_CARD_STYLE, type SiteCardStyle } from "@/lib/site-card-style";

const BUILDER_PAGES: PageBuilderKey[] = ["home", "community", "tournaments"];

function parseStyleMap(json: string | null | undefined): Record<string, unknown> {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function toStyleJson(map: Record<string, unknown>): string {
  return JSON.stringify(map);
}

function getStyleValue<T>(section: PageSection | null, key: string, fallback: T): T {
  if (!section) return fallback;
  const map = parseStyleMap(section.sectionStyleJson);
  return (map[key] as T) ?? fallback;
}

function pageFromParam(value: string | null): PageBuilderKey {
  return value && BUILDER_PAGES.includes(value as PageBuilderKey) ? (value as PageBuilderKey) : "home";
}

function withRequiredText(value: string | null | undefined, fallback: string): string {
  const text = (value ?? "").trim();
  return text.length > 0 ? text : fallback;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export default function AdminSitePageBuilderEditPage() {
  const params = useParams<{ blockId: string }>();
  const searchParams = useSearchParams();
  const blockId = String(params?.blockId ?? "").trim();
  const requestedPage = pageFromParam(searchParams.get("page"));
  const builderBaseRaw = String(searchParams.get("builderBase") ?? "").trim();
  const builderBase =
    builderBaseRaw.startsWith("/admin/site/page-builder")
      ? builderBaseRaw.replace(/\/+$/, "")
      : "/admin/site/page-builder";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [page, setPage] = useState<PageBuilderKey>(requestedPage);
  const [draft, setDraft] = useState<PageSection | null>(null);
  const [defaultCardStyle, setDefaultCardStyle] = useState<SiteCardStyle>(DEFAULT_SITE_CARD_STYLE);

  const loadBlock = useCallback(async () => {
    if (!blockId) {
      setError("블록 정보가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const pagesToTry = [requestedPage, ...BUILDER_PAGES.filter((p) => p !== requestedPage)];
    try {
      for (const p of pagesToTry) {
        const res = await fetch(`/api/admin/content/page-layout?page=${encodeURIComponent(p)}`, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok || !Array.isArray(data)) continue;
        const found = data.find((row: PageSection) => row.id === blockId) as PageSection | undefined;
        if (!found) continue;
        setPage(p);
        setDraft({
          ...found,
          title: withRequiredText(found.title, "제목"),
          description: withRequiredText(found.description, "내용"),
          buttons: Array.isArray(found.buttons) ? found.buttons : [],
        });
        setLoading(false);
        return;
      }
      setError("해당 블록을 찾을 수 없습니다.");
    } catch {
      setError("블록 정보를 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, [blockId, requestedPage]);

  useEffect(() => {
    void loadBlock();
  }, [loadBlock]);

  useEffect(() => {
    fetch("/api/admin/site-card-style", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (!data || typeof data !== "object") return;
        setDefaultCardStyle({
          shape: data.shape === "circle" ? "circle" : "square",
          width: Number(data.width) || DEFAULT_SITE_CARD_STYLE.width,
          height: Number(data.height) || DEFAULT_SITE_CARD_STYLE.height,
          style: data.style === "flat" || data.style === "shadow" ? data.style : "border",
          thumbFit: data.thumbFit === "contain" ? "contain" : "cover",
          linkMode: data.linkMode === "button" ? "button" : "block",
          radius: Number(data.radius) || DEFAULT_SITE_CARD_STYLE.radius,
        });
      })
      .catch(() => {});
  }, []);

  const styleMap = useMemo(() => parseStyleMap(draft?.sectionStyleJson), [draft?.sectionStyleJson]);
  const cardUseDefault = Boolean(styleMap.cardUseDefault);
  const cardEnabled = Boolean(styleMap.cardEnabled);
  const cardShape = cardUseDefault
    ? defaultCardStyle.shape
    : String(styleMap.cardShape ?? "square") === "circle"
      ? "circle"
      : "square";
  const cardRadius = cardUseDefault
    ? defaultCardStyle.radius
    : clampNumber(Number(styleMap.cardRadius ?? 16), 0, 999, 16);
  const cardWidth = cardUseDefault
    ? defaultCardStyle.width
    : clampNumber(Number(styleMap.cardWidth ?? 320), 120, 1200, 320);
  const cardHeight = cardUseDefault
    ? defaultCardStyle.height
    : clampNumber(Number(styleMap.cardHeight ?? 180), 80, 1200, 180);
  const cardThumbFit = cardUseDefault
    ? defaultCardStyle.thumbFit
    : String(styleMap.cardThumbFit ?? "cover") === "contain"
      ? "contain"
      : "cover";
  const cardLinkMode = cardUseDefault
    ? defaultCardStyle.linkMode
    : String(styleMap.cardLinkMode ?? "block") === "button"
      ? "button"
      : "block";
  const cardStyle = cardUseDefault
    ? defaultCardStyle.style
    : String(styleMap.cardStyle ?? "border") === "flat" || String(styleMap.cardStyle ?? "border") === "shadow"
      ? (String(styleMap.cardStyle ?? "border") as "flat" | "shadow")
      : "border";

  const patchDraft = (patch: Partial<PageSection>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const patchStyle = (patch: Record<string, unknown>) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...parseStyleMap(prev.sectionStyleJson), ...patch };
      return { ...prev, sectionStyleJson: toStyleJson(next) };
    });
  };

  const ensureButton = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      if (prev.buttons.length > 0) return prev;
      const nextButton: SectionButton = {
        id: `btn-${prev.id}`,
        name: "버튼",
        linkType: "external",
        href: "https://",
        openInNewTab: false,
        isPrimary: true,
      };
      return { ...prev, buttons: [nextButton] };
    });
  };

  const save = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    const description = (draft.description ?? "").trim();
    if (!title) {
      setError("제목은 비워둘 수 없습니다.");
      return;
    }
    if (!description) {
      setError("내용은 비워둘 수 없습니다.");
      return;
    }
    const firstButton = draft.buttons[0];
    if (firstButton) {
      if (!firstButton.name.trim() || !firstButton.href.trim()) {
        setError("CTA 문구와 링크는 비워둘 수 없습니다.");
        return;
      }
    }
    if (draft.linkType === "external" && !(draft.externalUrl ?? "").trim()) {
      setError("외부 링크 URL은 비워둘 수 없습니다.");
      return;
    }

    setSaving(true);
    setError(null);
    setOk(null);
    try {
      const { createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = draft;
      const payload: Omit<PageSection, "createdAt" | "updatedAt"> = {
        ...rest,
        title,
        description,
        externalUrl: draft.linkType === "external" ? (draft.externalUrl ?? "").trim() : draft.externalUrl,
      };

      const res = await fetch("/api/admin/content/page-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError(typeof data?.error === "string" ? data.error : "저장에 실패했습니다.");
        return;
      }
      const saved = data as PageSection;
      setDraft({
        ...saved,
        title: withRequiredText(saved.title, "제목"),
        description: withRequiredText(saved.description, "내용"),
        buttons: Array.isArray(saved.buttons) ? saved.buttons : [],
      });
      setOk("저장되었습니다.");
    } catch {
      setError("저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const backHref = `${builderBase}/${encodeURIComponent(page)}`;

  if (loading) {
    return (
      <CardBox>
        <p className="text-sm text-gray-600 dark:text-slate-400">블록을 불러오는 중입니다...</p>
      </CardBox>
    );
  }

  if (!draft) {
    return (
      <CardBox>
        <p className="text-sm text-red-600 dark:text-red-400">{error ?? "편집할 블록이 없습니다."}</p>
        <div className="mt-3">
          <Link href={backHref} className="text-sm text-site-primary hover:underline">
            페이지빌더로 돌아가기
          </Link>
        </div>
      </CardBox>
    );
  }

  return (
    <div className="space-y-3">
      <CardBox>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-semibold text-site-text">기본 편집</h1>
          <Link href={backHref} className="rounded border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800">
            미리보기로 돌아가기
          </Link>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          기존 블록 값을 그대로 불러와 편집합니다. 저장하지 않으면 기존 값이 유지됩니다.
        </p>
      </CardBox>

      {error ? <NotificationBar color="danger">{error}</NotificationBar> : null}
      {ok ? <NotificationBar color="success">{ok}</NotificationBar> : null}

      <CardBox className="space-y-4">
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">블록 형태</h2>
          <select
            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={String(styleMap.layoutMode ?? "boxed")}
            onChange={(e) => patchStyle({ layoutMode: e.target.value })}
          >
            <option value="full">전체형</option>
            <option value="boxed">박스형</option>
          </select>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">제목</h2>
          <input
            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={draft.title}
            onChange={(e) => patchDraft({ title: e.target.value })}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">폰트 / 색상 / 정렬</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
              value={draft.textAlign}
              onChange={(e) => patchDraft({ textAlign: e.target.value as TextAlign })}
            >
              <option value="left">왼쪽 정렬</option>
              <option value="center">가운데 정렬</option>
              <option value="right">오른쪽 정렬</option>
            </select>
            <select
              className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
              value={String(styleMap.fontWeight ?? "regular")}
              onChange={(e) => patchStyle({ fontWeight: e.target.value })}
            >
              <option value="regular">보통</option>
              <option value="medium">중간</option>
              <option value="bold">굵게</option>
            </select>
            <select
              className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
              value={String(styleMap.textSize ?? "md")}
              onChange={(e) => patchStyle({ textSize: e.target.value })}
            >
              <option value="sm">글자 작게</option>
              <option value="md">글자 보통</option>
              <option value="lg">글자 크게</option>
            </select>
            <input
              type="color"
              className="h-10 rounded border border-site-border bg-white px-1 dark:bg-slate-900"
              value={String(getStyleValue(draft, "textColor", "#111827"))}
              onChange={(e) => patchStyle({ textColor: e.target.value })}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">카드 스타일</h2>
          <div className="space-y-3 rounded border border-site-border p-3">
            <label className="flex items-center gap-2 text-sm text-site-text">
              <input
                type="checkbox"
                checked={cardEnabled}
                onChange={(e) => patchStyle({ cardEnabled: e.target.checked })}
              />
              카드 사용
            </label>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-sm text-site-text">
                <input
                  type="radio"
                  name="cardPresetMode"
                  checked={cardUseDefault}
                  onChange={() => patchStyle({ cardUseDefault: true })}
                />
                기본 카드 사용
              </label>
              <label className="flex items-center gap-2 text-sm text-site-text">
                <input
                  type="radio"
                  name="cardPresetMode"
                  checked={!cardUseDefault}
                  onChange={() => patchStyle({ cardUseDefault: false })}
                />
                개별 설정
              </label>
            </div>
            {cardUseDefault ? (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                공통 기본 카드 설정이 적용됩니다. 변경은 카드 스타일 관리 메뉴에서 할 수 있습니다.
              </p>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">카드 모양</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardShape}
                  disabled={cardUseDefault}
                  onChange={(e) => patchStyle({ cardShape: e.target.value === "circle" ? "circle" : "square" })}
                >
                  <option value="circle">원형</option>
                  <option value="square">사각형</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">카드 스타일</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardStyle}
                  disabled={cardUseDefault}
                  onChange={(e) =>
                    patchStyle({
                      cardStyle: e.target.value === "flat" || e.target.value === "shadow" ? e.target.value : "border",
                    })
                  }
                >
                  <option value="flat">플랫</option>
                  <option value="border">테두리</option>
                  <option value="shadow">그림자</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">모서리</span>
                <input
                  type="number"
                  min={0}
                  max={999}
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardRadius}
                  disabled={cardUseDefault}
                  onChange={(e) =>
                    patchStyle({ cardRadius: clampNumber(Number(e.target.value), 0, 999, cardRadius) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">가로(width)</span>
                <input
                  type="number"
                  min={120}
                  max={1200}
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardWidth}
                  disabled={cardUseDefault}
                  onChange={(e) =>
                    patchStyle({ cardWidth: clampNumber(Number(e.target.value), 120, 1200, cardWidth) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">세로(height)</span>
                <input
                  type="number"
                  min={80}
                  max={1200}
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardHeight}
                  disabled={cardUseDefault}
                  onChange={(e) =>
                    patchStyle({ cardHeight: clampNumber(Number(e.target.value), 80, 1200, cardHeight) })
                  }
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">썸네일</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardThumbFit}
                  disabled={cardUseDefault}
                  onChange={(e) => patchStyle({ cardThumbFit: e.target.value === "contain" ? "contain" : "cover" })}
                >
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-600 dark:text-slate-400">링크 방식</span>
                <select
                  className="rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
                  value={cardLinkMode}
                  disabled={cardUseDefault}
                  onChange={(e) => patchStyle({ cardLinkMode: e.target.value === "button" ? "button" : "block" })}
                >
                  <option value="block">카드 전체 링크</option>
                  <option value="button">버튼 링크</option>
                </select>
              </label>
            </div>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">스타일 미리보기</h2>
          <div className="overflow-x-auto rounded border border-site-border bg-gray-50 p-3 dark:bg-slate-900/40">
            <div
              className="overflow-hidden border border-site-border bg-white shadow-sm dark:bg-slate-900"
              style={{
                width: `${cardWidth}px`,
                maxWidth: "100%",
                borderRadius: cardShape === "circle" ? "9999px" : `${cardRadius}px`,
                boxShadow: cardStyle === "shadow" ? "0 8px 20px rgba(0,0,0,0.16)" : cardStyle === "flat" ? "none" : undefined,
                borderWidth: cardStyle === "flat" ? 0 : 1,
              }}
            >
              <div
                className="w-full bg-gray-200"
                style={{
                  height: `${cardHeight}px`,
                  backgroundImage: draft.imageUrl ? `url(${draft.imageUrl})` : undefined,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: cardThumbFit,
                }}
              />
              <div className="space-y-2 p-3">
                <p className="text-sm font-semibold text-site-text">{draft.title || "제목"}</p>
                <p className="text-xs text-gray-600 dark:text-slate-400">{draft.description || "내용"}</p>
                {cardLinkMode === "button" ? (
                  <button type="button" className="rounded bg-site-primary px-3 py-1.5 text-xs text-white">
                    링크 버튼
                  </button>
                ) : (
                  <p className="text-xs font-medium text-site-primary">카드 전체 링크</p>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              저장 시 현재 카드 설정과 동일한 값으로 반영됩니다.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">내용 (CMS / CTA)</h2>
          <textarea
            className="min-h-24 w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={draft.description ?? ""}
            onChange={(e) => patchDraft({ description: e.target.value })}
          />
          <input
            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={draft.buttons[0]?.name ?? ""}
            onChange={(e) => {
              const next = [...draft.buttons];
              if (!next[0]) {
                next[0] = {
                  id: `btn-${draft.id}`,
                  name: "",
                  linkType: "external",
                  href: "",
                  openInNewTab: false,
                  isPrimary: true,
                };
              }
              next[0] = { ...next[0], name: e.target.value };
              patchDraft({ buttons: next });
            }}
            placeholder="CTA 문구"
          />
          <input
            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={draft.buttons[0]?.href ?? ""}
            onChange={(e) => {
              const next = [...draft.buttons];
              if (!next[0]) {
                next[0] = {
                  id: `btn-${draft.id}`,
                  name: "",
                  linkType: "external",
                  href: "",
                  openInNewTab: false,
                  isPrimary: true,
                };
              }
              next[0] = { ...next[0], href: e.target.value };
              patchDraft({ buttons: next });
            }}
            placeholder="CTA 링크"
          />
          <div>
            <Button label="내용 추가" color="contrast" small outline onClick={ensureButton} />
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">이미지</h2>
          <AdminImageField
            label="이미지"
            value={draft.imageUrl}
            onChange={(url) => patchDraft({ imageUrl: url ?? null })}
            policy="section"
            recommendedSize="1200x675"
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-site-text">링크</h2>
          <select
            className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
            value={draft.linkType}
            onChange={(e) => patchDraft({ linkType: e.target.value as PageSection["linkType"] })}
          >
            <option value="none">링크 없음</option>
            <option value="external">외부 링크</option>
            <option value="internal">내부 링크</option>
          </select>
          {draft.linkType === "external" ? (
            <input
              className="w-full rounded border border-site-border bg-white px-3 py-2 text-sm text-site-text dark:bg-slate-900"
              value={draft.externalUrl ?? ""}
              onChange={(e) => patchDraft({ externalUrl: e.target.value })}
              placeholder="https://"
            />
          ) : null}
        </section>

        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button label={saving ? "저장 중..." : "저장"} color="info" disabled={saving} onClick={() => void save()} />
          <Link href={backHref} className="rounded border border-site-border px-3 py-2 text-sm text-site-text hover:bg-gray-50 dark:hover:bg-slate-800">
            취소
          </Link>
        </div>
      </CardBox>
    </div>
  );
}
