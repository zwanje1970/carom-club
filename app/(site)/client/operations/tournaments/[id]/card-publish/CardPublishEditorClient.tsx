"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AdminImageField } from "@/components/admin/_components/AdminImageField";
import { BasicCard } from "@/components/cards/TournamentPublishedCard";
import type { TournamentCardPublishData } from "@/lib/client-card-publish";

type Props = {
  tournamentId: string;
  tournamentName: string;
  initialCardData: TournamentCardPublishData;
  initialPublished: TournamentCardPublishData | null;
  hasSavedCardData: boolean;
};

export function CardPublishEditorClient({
  tournamentId,
  tournamentName,
  initialCardData,
  initialPublished,
  hasSavedCardData,
}: Props) {
  const [cardData, setCardData] = useState<TournamentCardPublishData>({
    ...initialCardData,
    templateType: "basic",
  });
  const [published, setPublished] = useState<TournamentCardPublishData | null>(initialPublished);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setCardData((prev) =>
      prev.templateType === "basic" ? prev : { ...prev, templateType: "basic" }
    );
  }, [hasSavedCardData]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 2200);
    return () => clearTimeout(t);
  }, [message]);

  const preview = useMemo(() => {
    return <BasicCard data={{ ...cardData, templateType: "basic" }} showDetailButton={false} />;
  }, [cardData]);

  const onSave = async (action: "saveDraft" | "publish") => {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch(`/api/client/tournaments/${tournamentId}/card-publish`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, cardData: { ...cardData, templateType: "basic" } }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        setError("저장 실패");
        return;
      }
      setCardData({ ...(data.cardData as TournamentCardPublishData), templateType: "basic" });
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
