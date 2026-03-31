"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/admin/_components/Button";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import type { PageSection, SectionButton } from "@/types/page-section";

type Props = {
  section: PageSection;
  setBusy: (id: string | null) => void;
  onSaved: (updated: PageSection) => void;
  onClose: () => void;
  onDraftChange?: (draft: PageSection) => void;
};

function trimToNull(v: string): string | null {
  const t = v.trim();
  return t ? t : null;
}

function toError(err: unknown, fallback: string): Error {
  if (err instanceof Error) return err;
  if (typeof err === "string" && err.trim()) return new Error(err);
  if (err && typeof err === "object" && "type" in err) {
    const eventType = String((err as { type?: unknown }).type ?? "unknown");
    return new Error(`${fallback} (event: ${eventType})`);
  }
  return new Error(fallback);
}

function nextButtonsFromDraft(
  section: PageSection,
  ctaNameRaw: string,
  ctaHrefRaw: string,
  ctaNewTab: boolean
): SectionButton[] {
  const existing = Array.isArray(section.buttons) ? section.buttons : [];
  const ctaName = ctaNameRaw.trim();
  const ctaHref = ctaHrefRaw.trim();
  const rest = existing.slice(1);
  if (!ctaName && !ctaHref) {
    return rest;
  }
  const prev = existing[0];
  const first: SectionButton = {
    id: prev?.id ?? `btn-${section.id}`,
    name: ctaName,
    href: ctaHref,
    linkType: "external",
    openInNewTab: ctaNewTab,
    isPrimary: prev?.isPrimary ?? true,
    size: prev?.size,
  };
  return [first, ...rest];
}

/**
 * 메인(home) CMS 블록 전용 최소 편집기.
 * 텍스트/이미지/대표 CTA만 빠르게 수정하고 draft로 저장한다.
 */
export function HomeContentQuickEditor({ section, setBusy, onSaved, onClose, onDraftChange }: Props) {
  const [title, setTitle] = useState(section.title ?? "");
  const [description, setDescription] = useState(section.description ?? "");
  const [imageUrl, setImageUrl] = useState(section.imageUrl ?? "");
  const [ctaName, setCtaName] = useState(() =>
    Array.isArray(section.buttons) ? section.buttons[0]?.name ?? "" : ""
  );
  const [ctaHref, setCtaHref] = useState(() =>
    Array.isArray(section.buttons) ? section.buttons[0]?.href ?? "" : ""
  );
  const [ctaNewTab, setCtaNewTab] = useState(() =>
    Array.isArray(section.buttons) ? section.buttons[0]?.openInNewTab ?? false : false
  );
  const [saveHint, setSaveHint] = useState<string>("편집 중…");
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    const btns = Array.isArray(section.buttons) ? section.buttons : [];
    setTitle(section.title ?? "");
    setDescription(section.description ?? "");
    setImageUrl(section.imageUrl ?? "");
    setCtaName(btns[0]?.name ?? "");
    setCtaHref(btns[0]?.href ?? "");
    setCtaNewTab(btns[0]?.openInNewTab ?? false);
  }, [section.id]);

  const canSave = useMemo(() => !section.deletedAt, [section.deletedAt]);

  useEffect(() => {
    if (!onDraftChange) return;
    const { createdAt: _c, updatedAt: _u, ...base } = section;
    onDraftChange({
      ...base,
      title: title.trim(),
      description: trimToNull(description),
      imageUrl: trimToNull(imageUrl),
      buttons: nextButtonsFromDraft(section, ctaName, ctaHref, ctaNewTab),
    } as PageSection);
  }, [section.id, title, description, imageUrl, ctaName, ctaHref, ctaNewTab, onDraftChange]);

  useEffect(() => {
    if (!canSave) return;
    const { createdAt: _c, updatedAt: _u, ...base } = section;
    const payload: Omit<PageSection, "createdAt" | "updatedAt"> = {
      ...base,
      title: title.trim(),
      description: trimToNull(description),
      imageUrl: trimToNull(imageUrl),
      buttons: nextButtonsFromDraft(section, ctaName, ctaHref, ctaNewTab),
    };
    const signature = JSON.stringify(payload);
    if (signature === lastSentRef.current) return;

    setSaveHint("초안 반영 중…");
    const timer = window.setTimeout(async () => {
      setBusy(section.id);
      try {
        const res = await fetch("/api/admin/content/page-sections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          console.error("[HomeContentQuickEditor] autosave API failed", {
            sectionId: section.id,
            status: res.status,
            statusText: res.statusText,
            response: data,
            payload,
          });
          setSaveHint(typeof data?.error === "string" ? data.error : "초안 반영 실패");
          return;
        }
        lastSentRef.current = signature;
        setSaveHint("초안 반영 완료");
        onSaved(data as PageSection);
      } catch (err) {
        const error = toError(err, "내용 반영 중 오류가 발생했습니다.");
        console.error("[HomeContentQuickEditor] autosave failed", {
          sectionId: section.id,
          error,
          original: err,
        });
        setSaveHint(error.message);
      } finally {
        setBusy(null);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [section.id, section, title, description, imageUrl, ctaName, ctaHref, ctaNewTab, canSave, setBusy, onSaved]);

  return (
    <div className="space-y-3 rounded-md bg-gray-50 p-3 text-sm dark:bg-slate-800/80">
      <div className="font-medium text-gray-800 dark:text-slate-200">내용 편집 (메인)</div>
      <p className="text-xs text-gray-600 dark:text-slate-400">
        제목, 설명, 대표 이미지 URL, 대표 버튼 링크를 수정합니다. 저장 내용은 초안에만 반영됩니다.
      </p>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600 dark:text-slate-400">제목</span>
        <input
          className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="블록 제목"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600 dark:text-slate-400">설명</span>
        <textarea
          className="min-h-24 rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 텍스트"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600 dark:text-slate-400">이미지 첨부 (권장)</span>
        <AdminImageField
          label="대표 이미지"
          value={imageUrl}
          onChange={(url) => setImageUrl(url ?? "")}
          policy="section"
          recommendedSize="1200x675"
        />
        <p className="text-xs text-gray-500 dark:text-slate-500">
          권장 크기 1200x675 · 최대 용량 2MB · JPG/PNG/WEBP · 비율이 다르면 잘릴 수 있습니다.
        </p>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-gray-600 dark:text-slate-400">이미지 URL (보조 입력)</span>
        <input
          className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-gray-600 dark:text-slate-400">버튼 문구</span>
          <input
            className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
            value={ctaName}
            onChange={(e) => setCtaName(e.target.value)}
            placeholder="예: 자세히 보기"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-gray-600 dark:text-slate-400">버튼 링크(URL)</span>
          <input
            className="rounded border border-gray-300 bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-900"
            value={ctaHref}
            onChange={(e) => setCtaHref(e.target.value)}
            placeholder="https://..."
          />
        </label>
      </div>
      <label className="inline-flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
        <input type="checkbox" checked={ctaNewTab} onChange={(e) => setCtaNewTab(e.target.checked)} />
        버튼 링크 새 탭 열기
      </label>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-500 dark:text-slate-400">{saveHint}</p>
        <Button label="닫기" color="contrast" small onClick={onClose} />
      </div>
    </div>
  );
}
