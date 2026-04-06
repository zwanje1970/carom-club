"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { BasicCard, HighlightCard } from "@/components/cards/TournamentPublishedCard";
import type { TournamentCardPublishData } from "@/lib/client-card-publish";
import {
  PLATFORM_CARD_TEMPLATE_POLICIES,
  type PlatformCardTemplateType,
} from "@/lib/platform-card-templates";

type Props = {
  tournamentId: string;
  tournamentName: string;
  initialCardData: TournamentCardPublishData;
  initialPublished: TournamentCardPublishData | null;
  hasSavedCardData: boolean;
};

type TemplateOption = {
  templateType: PlatformCardTemplateType;
  label: string;
  isActive: boolean;
  isDefault: boolean;
  showDetailButton: boolean;
};

export function CardPublishEditorClient({
  tournamentId,
  tournamentName,
  initialCardData,
  initialPublished,
  hasSavedCardData,
}: Props) {
  const [cardData, setCardData] = useState<TournamentCardPublishData>(initialCardData);
  const [published, setPublished] = useState<TournamentCardPublishData | null>(initialPublished);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>(
    PLATFORM_CARD_TEMPLATE_POLICIES.map((item) => ({
      templateType: item.templateType,
      label: item.label,
      isActive: item.isActive,
      isDefault: item.isDefault,
      showDetailButton: item.showDetailButton,
    })).filter((item) => item.isActive)
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/platform/card-templates", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("fetch"))))
      .then((rows) => {
        if (cancelled || !Array.isArray(rows)) return;
        const parsed = rows
          .map((row) => ({
            templateType:
              row?.templateType === "highlight" || row?.templateType === "basic"
                ? row.templateType
                : "basic",
            label: typeof row?.label === "string" && row.label.trim() ? row.label.trim() : String(row?.templateType ?? "basic"),
            isActive: row?.isActive === true,
            isDefault: row?.isDefault === true,
            showDetailButton: row?.showDetailButton === true,
          }))
          .filter((row) => row.isActive) as TemplateOption[];
        if (parsed.length === 0) return;
        setTemplateOptions(parsed);
        const defaultType =
          parsed.find((item) => item.isDefault)?.templateType ??
          parsed.find((item) => item.templateType === "basic")?.templateType ??
          parsed[0].templateType;
        setCardData((prev) => {
          const hasCurrent = parsed.some((item) => item.templateType === prev.templateType);
          if (!hasCurrent || !hasSavedCardData) return { ...prev, templateType: defaultType };
          return prev;
        });
      })
      .catch(() => {
        if (cancelled) return;
        const fallback = PLATFORM_CARD_TEMPLATE_POLICIES.map((item) => ({
          templateType: item.templateType,
          label: item.label,
          isActive: item.isActive,
          isDefault: item.isDefault,
          showDetailButton: item.showDetailButton,
        })).filter((item) => item.isActive);
        setTemplateOptions(fallback);
        if (fallback.length > 0) {
          const fallbackDefault =
            fallback.find((item) => item.isDefault)?.templateType ??
            fallback.find((item) => item.templateType === "basic")?.templateType ??
            fallback[0].templateType;
          setCardData((prev) => {
            const hasCurrent = fallback.some((item) => item.templateType === prev.templateType);
            if (!hasCurrent || !hasSavedCardData) return { ...prev, templateType: fallbackDefault };
            return prev;
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [hasSavedCardData]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(t);
  }, [message]);

  const preview = useMemo(() => {
    const selectedTemplate = templateOptions.find((item) => item.templateType === cardData.templateType);
    const showDetailButton =
      selectedTemplate?.showDetailButton ?? (cardData.templateType === "highlight");
    return cardData.templateType === "highlight" ? (
      <HighlightCard data={cardData} showDetailButton={showDetailButton} />
    ) : (
      <BasicCard data={cardData} showDetailButton={showDetailButton} />
    );
  }, [cardData, templateOptions]);

  const onSave = async (action: "saveDraft" | "publish") => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/card-publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cardData }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError("저장 실패");
        return;
      }
      setCardData(data.cardData as TournamentCardPublishData);
      setPublished((data.published as TournamentCardPublishData | null) ?? null);
      setMessage("저장 완료");
    } catch {
      setError("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">카드 발행</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{tournamentName}</p>
        </div>
        <Link href={`/client/tournaments/${tournamentId}`} className="text-xs font-semibold text-indigo-800 underline dark:text-indigo-300">
          ← 대회현황
        </Link>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        현재 발행 상태: {published?.isPublished ? "발행됨" : "미발행"}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">입력</h2>
          <div className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              {templateOptions.map((item) => (
                <label key={item.templateType} className="flex items-center gap-2 rounded border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600">
                  <input
                    type="radio"
                    name="templateType"
                    checked={cardData.templateType === item.templateType}
                    onChange={() => setCardData((prev) => ({ ...prev, templateType: item.templateType }))}
                  />
                  {item.label}
                </label>
              ))}
            </div>

            <AdminImageField
              label="썸네일 이미지"
              value={cardData.thumbnailUrl || null}
              onChange={(url) => setCardData((prev) => ({ ...prev, thumbnailUrl: url ?? "" }))}
              policy="tournament"
              recommendedSize="1200x675"
            />

            <input value={cardData.cardTitle} onChange={(e) => setCardData((prev) => ({ ...prev, cardTitle: e.target.value }))} placeholder="대회명 (cardTitle)" className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input value={cardData.displayDateText} onChange={(e) => setCardData((prev) => ({ ...prev, displayDateText: e.target.value }))} placeholder="날짜 텍스트 (displayDateText)" className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input value={cardData.displayRegionText} onChange={(e) => setCardData((prev) => ({ ...prev, displayRegionText: e.target.value }))} placeholder="지역 텍스트 (displayRegionText)" className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input value={cardData.statusText} onChange={(e) => setCardData((prev) => ({ ...prev, statusText: e.target.value }))} placeholder="상태 텍스트 (statusText)" className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            <input value={cardData.buttonText} onChange={(e) => setCardData((prev) => ({ ...prev, buttonText: e.target.value }))} placeholder="버튼 텍스트 (buttonText)" className="w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            {cardData.templateType === "highlight" ? (
              <textarea value={cardData.shortDescription ?? ""} onChange={(e) => setCardData((prev) => ({ ...prev, shortDescription: e.target.value }))} placeholder="짧은 설명 (shortDescription)" className="min-h-20 w-full rounded border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900" />
            ) : null}

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave("saveDraft")}
                className="inline-flex min-h-[40px] items-center rounded-md border border-zinc-300 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                초안저장
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave("publish")}
                className="inline-flex min-h-[40px] items-center rounded-md border border-zinc-900 bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                저장후발행
              </button>
              {saving ? <span className="inline-flex items-center text-xs text-zinc-600 dark:text-zinc-400">저장 중...</span> : null}
              {!saving && message ? <span className="inline-flex items-center text-xs text-green-700 dark:text-green-300">{message}</span> : null}
              {!saving && error ? <span className="inline-flex items-center text-xs text-red-600 dark:text-red-300">{error}</span> : null}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">미리보기</h2>
          <div className="mt-3 max-w-md">{preview}</div>
        </section>
      </div>
    </div>
  );
}
