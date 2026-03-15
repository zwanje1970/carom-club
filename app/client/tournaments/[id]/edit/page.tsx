"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { TournamentFormSimple } from "@/components/client/TournamentFormSimple";
import { RichEditorLazy } from "@/components/RichEditorLazy";

function parseBracketConfig(config: unknown): Record<string, unknown> | null {
  if (config == null) return null;
  if (typeof config === "object") return config as Record<string, unknown>;
  if (typeof config === "string") {
    try {
      return JSON.parse(config) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

export default function ClientTournamentEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [promoContent, setPromoContent] = useState("");
  const [initialData, setInitialData] = useState<Parameters<typeof TournamentFormSimple>[0]["initialData"]>(undefined);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${id}`);
        if (!res.ok) {
          setInitialData(undefined);
          setLoading(false);
          return;
        }
        const t = await res.json();
        const startAt = t.startAt ? new Date(t.startAt) : null;
        const endAt = t.endAt ? new Date(t.endAt) : null;
        const bc = parseBracketConfig(t.rule?.bracketConfig);
        setInitialData({
          name: t.name ?? "",
          posterImageUrl: t.posterImageUrl ?? "",
          summary: t.summary ?? "",
          status: t.status ?? "OPEN",
          entryFee: t.entryFee != null ? t.entryFee : "",
          prizeInfo: t.prizeInfo ?? "",
          gameFormat: (bc?.gameFormatType as string) ?? t.gameFormat ?? "TOURNAMENT",
          entryCondition: t.entryCondition ?? "",
          maxParticipants: t.maxParticipants != null ? t.maxParticipants : "",
          scope: (bc?.scope as "REGIONAL" | "NATIONAL") ?? "REGIONAL",
          durationType: (bc?.durationType as "1_DAY" | "2_DAYS" | "3_PLUS") ?? "1_DAY",
          allowMultipleSlots: (bc?.allowMultipleSlots as boolean) ?? false,
          participantsListPublic: (bc?.participantsListPublic as boolean) ?? true,
          startAt: startAt ? `${startAt.toISOString().slice(0, 16)}` : "",
          endAt: endAt ? `${endAt.toISOString().slice(0, 16)}` : "",
          venue: t.venue ?? "",
          rules: t.rules ?? "",
          promoContent: t.promoContent ?? "",
          matchVenues: Array.isArray(t.matchVenues) ? t.matchVenues : undefined,
          rule: { bracketConfig: bc ?? undefined },
        });
        setPromoContent(t.promoContent ?? "");
      } catch {
        setInitialData(undefined);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function handleSubmit(
    values: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[0],
    bracketConfig: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[1],
    venues: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[2]
  ) {
    const res = await fetch(`/api/admin/tournaments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
        name: values.name.trim(),
        startAt: new Date(values.startAt).toISOString(),
        endAt: values.endAt ? new Date(values.endAt).toISOString() : null,
        venue:
          venues.length > 0
            ? [venues[0].venueName, venues[0].address].filter(Boolean).join(" ").trim() || undefined
            : values.venue.trim() || undefined,
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
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "저장에 실패했습니다.");

    await fetch(`/api/admin/tournaments/${id}/rule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketConfig }),
    });

    const venuePayload = venues.map((v) => ({
      venueNumber: v.venueNumber,
      displayLabel: v.displayLabel || `${v.venueNumber}경기장`,
      venueName: v.venueName.trim() || undefined,
      address: v.address.trim() || undefined,
      phone: v.phone.trim() || undefined,
    }));
    const venRes = await fetch(`/api/admin/tournaments/${id}/match-venues`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venues: venuePayload }),
    });
    if (!venRes.ok) {
      const venData = await venRes.json().catch(() => ({}));
      throw new Error(venData.error || "경기장 저장에 실패했습니다.");
    }

    setTimeout(() => {
      router.push(`/client/tournaments/${id}`);
      router.refresh();
    }, 800);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-site-text-muted">
        불러오는 중...
      </div>
    );
  }

  if (!initialData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-red-600">
        대회 정보를 불러올 수 없습니다.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-bold text-site-text mb-6">대회 수정</h1>
      <p className="text-sm text-site-text-muted mb-6">
        필요한 항목만 수정해 저장하면 됩니다.
      </p>
      <TournamentFormSimple
        mode="edit"
        tournamentId={id}
        initialData={initialData}
        onSubmit={handleSubmit}
        onCancelHref={`/client/tournaments/${id}`}
        submitLabel="저장"
      >
        <div>
          <RichEditorLazy
            value={promoContent}
            onChange={setPromoContent}
            placeholder="경기 요강을 입력하세요"
            minHeight="200px"
          />
        </div>
      </TournamentFormSimple>
    </div>
  );
}
