"use client";

import { useRouter } from "next/navigation";
import { TournamentFormSimple } from "@/components/client/TournamentFormSimple";
import { RichEditorLazy } from "@/components/RichEditorLazy";
import { useState } from "react";

export default function ClientTournamentsNewPage() {
  const router = useRouter();
  const [promoContent, setPromoContent] = useState("");

  async function handleSubmit(
    values: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[0],
    bracketConfig: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[1],
    venues: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[2]
  ) {
    const startAt = new Date(values.startAt);
    const endAt = values.endAt ? new Date(values.endAt) : null;
    const res = await fetch("/api/admin/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: values.name.trim(),
        startAt: startAt.toISOString(),
        endAt: endAt ? endAt.toISOString() : null,
        venue: values.venue.trim() || null,
        status: values.status,
        gameFormat: values.gameFormat,
        summary: values.summary.trim() || null,
        posterImageUrl: values.posterImageUrl.trim() || null,
        entryFee: values.entryFee === "" || values.entryFee === null ? null : Number(values.entryFee),
        maxParticipants: values.maxParticipants === "" || values.maxParticipants === null ? null : Number(values.maxParticipants),
        entryCondition: values.entryCondition.trim() || null,
        prizeInfo: values.prizeInfo.trim() || null,
        rules: values.rules.trim() || null,
        promoContent: promoContent.trim() || null,
        rule: {
          bracketConfig: {
            ...bracketConfig,
          },
        },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");
    setTimeout(() => {
      router.push(data.id ? `/client/tournaments/${data.id}` : "/client/tournaments");
      router.refresh();
    }, 800);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-site-text mb-6">대회 등록</h1>
      <p className="text-sm text-site-text-muted mb-6">
        필수 항목만 입력하면 빠르게 대회를 홍보하고 참가자를 모집할 수 있습니다.
      </p>
      <TournamentFormSimple
        mode="create"
        onSubmit={handleSubmit}
        onCancelHref="/client/tournaments"
        submitLabel="등록"
      >
        <div>
          <label className="block text-sm font-medium text-site-text mb-1">대회 홍보 내용 (선택)</label>
          <RichEditorLazy
            value={promoContent}
            onChange={setPromoContent}
            placeholder="상세 홍보 문구를 입력하세요"
            minHeight="200px"
          />
        </div>
      </TournamentFormSimple>
    </div>
  );
}
