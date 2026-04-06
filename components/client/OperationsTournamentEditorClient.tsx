"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TournamentFormSimple } from "@/components/client/TournamentFormSimple";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { consoleTextBody, consoleTextMuted } from "@/components/client/console/ui/tokens";
import { cx } from "@/components/client/console/ui/cx";
import { formatKoreanDateWithWeekday } from "@/lib/format-date";
import {
  buildDefaultTournamentCardPublishData,
  type TournamentCardPublishData,
} from "@/lib/client-card-publish";
import { CardPublishEditorClient } from "@/app/(site)/client/operations/tournaments/[id]/card-publish/CardPublishEditorClient";
import { ClientTournamentOutlineSection } from "@/components/client/console/ClientTournamentOutlineSection";
import type { OutlineDisplayMode } from "@/lib/client-outline-templates";

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

function extractImgFromPromo(html: string): string {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m?.[1]?.trim() ?? "";
}

function inferOutlineMode(
  t: { outlinePdfUrl?: string | null; promoContent?: string | null },
  bc: Record<string, unknown> | null
): OutlineDisplayMode {
  const m = bc?.outlineDisplayMode as string | undefined;
  if (m === "direct" || m === "load" || m === "image" || m === "pdf") return m;
  if (t.outlinePdfUrl) return "pdf";
  if (bc?.outlineImageUrl) return "image";
  return "direct";
}

type Props = {
  mode: "create" | "edit";
  tournamentId?: string;
  organizationName: string;
  organizationId: string;
  defaultVenueName?: string;
  defaultVenueAddress?: string;
  defaultVenuePhone?: string;
};

/**
 * /client/operations/tournaments — 대회 생성·수정 (조직 스코프, /api/client/tournaments 전용)
 */
export function OperationsTournamentEditorClient({
  mode,
  tournamentId,
  organizationName,
  organizationId,
  defaultVenueName,
  defaultVenueAddress,
  defaultVenuePhone,
}: Props) {
  const router = useRouter();
  const [promoContent, setPromoContent] = useState("");
  const [outlineDisplayMode, setOutlineDisplayMode] = useState<OutlineDisplayMode>("direct");
  const [outlinePdfUrl, setOutlinePdfUrl] = useState("");
  const [outlineImageUrl, setOutlineImageUrl] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [initialData, setInitialData] = useState<
    Parameters<typeof TournamentFormSimple>[0]["initialData"]
  >(undefined);
  const [createdTournament, setCreatedTournament] = useState<{
    id: string;
    name: string;
    initialCardData: TournamentCardPublishData;
  } | null>(null);

  useEffect(() => {
    if (mode !== "edit" || !tournamentId) return;
    (async () => {
      try {
        const res = await fetch(`/api/client/tournaments/${tournamentId}`);
        if (!res.ok) {
          setInitialData(undefined);
          setLoading(false);
          return;
        }
        const t = await res.json();
        const startAt = t.startAt ? new Date(t.startAt) : null;
        const endAt = t.endAt ? new Date(t.endAt) : null;
        const bc = parseBracketConfig(t.rule?.bracketConfig);
        const om = inferOutlineMode(t, bc);
        setOutlineDisplayMode(om);
        setOutlinePdfUrl(typeof t.outlinePdfUrl === "string" ? t.outlinePdfUrl : "");
        const imgFromRule = typeof bc?.outlineImageUrl === "string" ? bc.outlineImageUrl : "";
        const imgFromPromo = extractImgFromPromo(typeof t.promoContent === "string" ? t.promoContent : "");
        setOutlineImageUrl(imgFromRule || imgFromPromo);
        setDescription(typeof t.description === "string" ? t.description : "");
        setInitialData({
          name: t.name ?? "",
          posterImageUrl: t.posterImageUrl ?? "",
          summary: t.summary ?? "",
          status: t.status ?? "OPEN",
          entryFee: t.entryFee != null ? t.entryFee : "",
          prizeInfo: t.prizeInfo ?? "",
          gameFormat:
            (bc?.gameFormatType as string) ?? (t.isScotch === true ? "SCOTCH" : t.gameFormat) ?? "TOURNAMENT",
          isScotch: t.isScotch === true || (bc?.gameFormatType as string) === "SCOTCH",
          teamScoreLimit: t.teamScoreLimit != null ? t.teamScoreLimit : "",
          teamScoreRule: t.teamScoreRule ?? "LTE",
          entryCondition: t.entryCondition ?? "",
          maxParticipants: t.maxParticipants != null ? t.maxParticipants : "",
          scope: (bc?.scope as "REGIONAL" | "NATIONAL") ?? "REGIONAL",
          durationType: (bc?.durationType as "1_DAY" | "2_DAYS" | "3_PLUS") ?? "1_DAY",
          allowMultipleSlots: (bc?.allowMultipleSlots as boolean) ?? false,
          participantsListPublic: (bc?.participantsListPublic as boolean) ?? true,
          verificationMode: t.verificationMode ?? t.certificationRequestMode ?? "NONE",
          verificationReviewRequired:
            t.verificationReviewRequired !== undefined
              ? t.verificationReviewRequired !== false
              : t.manualReviewRequired !== false,
          eligibilityType: t.eligibilityType ?? (t.eligibilityLimitType === "UNDER" ? "UNDER" : "NONE"),
          eligibilityValue:
            t.eligibilityValue != null && Number.isFinite(Number(t.eligibilityValue))
              ? t.eligibilityValue
              : t.eligibilityLimitValue != null && Number.isFinite(Number(t.eligibilityLimitValue))
                ? t.eligibilityLimitValue
              : "",
          verificationGuideText: typeof t.verificationGuideText === "string" ? t.verificationGuideText : "",
          divisionEnabled: t.divisionEnabled === true,
          divisionMetricType: t.divisionMetricType ?? "AVERAGE",
          divisionRulesJson: t.divisionRulesJson ?? null,
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
  }, [mode, tournamentId]);

  async function persistVenues(id: string, venues: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[2]) {
    if (!venues.length) return;
    const venuePayload = venues.map((v) => ({
      venueNumber: v.venueNumber,
      displayLabel: v.displayLabel || `${v.venueNumber}경기장`,
      venueName: v.venueName.trim() || undefined,
      address: v.address.trim() || undefined,
      phone: v.phone.trim() || undefined,
    }));
    const venRes = await fetch(`/api/client/tournaments/${id}/match-venues`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ venues: venuePayload }),
    });
    if (!venRes.ok) {
      const venData = await venRes.json().catch(() => ({}));
      throw new Error((venData as { error?: string }).error || "경기장 저장에 실패했습니다.");
    }
  }

  async function handleSubmit(
    values: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[0],
    bracketConfig: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[1],
    venues: Parameters<Parameters<typeof TournamentFormSimple>[0]["onSubmit"]>[2]
  ) {
    const startAt = new Date(values.startAt);
    const endAt = values.endAt ? new Date(values.endAt) : null;
    const venueSummary =
      venues.length > 0
        ? [venues[0].venueName, venues[0].address].filter(Boolean).join(" ").trim() || null
        : null;

    const outlineImg =
      outlineDisplayMode === "image" ? outlineImageUrl.trim() || extractImgFromPromo(promoContent) : "";
    const mergedBracketConfig = {
      ...bracketConfig,
      outlineDisplayMode,
      outlineImageUrl: outlineDisplayMode === "image" && outlineImg ? outlineImg : null,
    };

    const baseJson = {
      name: values.name.trim(),
      startAt: startAt.toISOString(),
      endAt: endAt ? endAt.toISOString() : null,
      venue: venueSummary,
      status: values.status,
      gameFormat: values.gameFormat,
      isScotch: values.gameFormat === "SCOTCH",
      teamScoreLimit:
        values.gameFormat === "SCOTCH" && values.teamScoreLimit !== ""
          ? Number(values.teamScoreLimit)
          : null,
      teamScoreRule: values.gameFormat === "SCOTCH" ? values.teamScoreRule : null,
      summary: values.summary.trim() || null,
      description: description.trim() || null,
      posterImageUrl: values.posterImageUrl.trim() || null,
      entryFee: values.entryFee === "" || values.entryFee === null ? null : Number(values.entryFee),
      maxParticipants:
        values.maxParticipants === "" || values.maxParticipants === null ? null : Number(values.maxParticipants),
      entryCondition: values.entryQualificationType === "NONE" ? null : values.entryCondition.trim() || null,
      prizeInfo: values.prizeInfo.trim() || null,
      rules: values.rules.trim() || null,
      promoContent: promoContent.trim() || null,
      outlinePdfUrl: outlineDisplayMode === "pdf" ? outlinePdfUrl.trim() || null : null,
      verificationMode: values.verificationMode,
      verificationReviewRequired: values.verificationReviewRequired,
      eligibilityType: values.eligibilityType,
      eligibilityValue:
        values.eligibilityType === "UNDER"
          ? Number.parseFloat(String(values.eligibilityValue).replace(",", "."))
          : null,
      verificationGuideText: values.verificationGuideText.trim() || null,
      divisionEnabled: values.divisionEnabled,
      divisionMetricType: values.divisionMetricType,
      divisionRulesJson: values.divisionEnabled ? values.divisionRules : null,
    };

    if (mode === "create") {
      const res = await fetch("/api/client/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...baseJson,
          rule: {
            bracketConfig: mergedBracketConfig,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "저장에 실패했습니다.");
      const id = (data as { id?: string }).id;
      if (id) {
        await persistVenues(id, venues);
        const initialCardData = buildDefaultTournamentCardPublishData(id, values.name.trim());
        if (!initialCardData.displayDateText) {
          initialCardData.displayDateText = formatKoreanDateWithWeekday(startAt);
        }
        if (!initialCardData.displayRegionText) {
          initialCardData.displayRegionText = venueSummary ?? "";
        }
        if (!initialCardData.statusText) {
          initialCardData.statusText =
            values.status === "OPEN"
              ? "모집중"
              : values.status === "FINISHED"
                ? "종료"
                : "진행중";
        }
        setCreatedTournament({
          id,
          name: values.name.trim(),
          initialCardData,
        });
        router.refresh();
      }
      return;
    }

    if (!tournamentId) throw new Error("대회 ID가 없습니다.");

    const res = await fetch(`/api/client/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...baseJson,
        venue:
          venues.length > 0
            ? [venues[0].venueName, venues[0].address].filter(Boolean).join(" ").trim() || undefined
            : baseJson.venue ?? undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data as { error?: string }).error || "저장에 실패했습니다.");

    const ruleRes = await fetch(`/api/client/tournaments/${tournamentId}/rule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketConfig: mergedBracketConfig }),
    });
    const ruleData = await ruleRes.json().catch(() => ({}));
    if (!ruleRes.ok) {
      throw new Error((ruleData as { error?: string }).error || "규칙 저장에 실패했습니다.");
    }

    await persistVenues(tournamentId, venues);

    setTimeout(() => {
      router.push("/client/tournaments");
      router.refresh();
    }, 600);
  }

  if (loading) {
    return (
      <div className={cx(consoleTextMuted, "py-12 text-center text-sm")}>불러오는 중…</div>
    );
  }

  if (mode === "edit" && !initialData) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600 dark:text-red-400">대회 정보를 불러올 수 없거나 이 조직 소속이 아닙니다.</p>
        <Link href="/client/tournaments" className="text-sm text-zinc-700 underline dark:text-zinc-300">
          운영 · 대회 목록으로
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConsolePageHeader
        eyebrow="운영 관리"
        title={mode === "create" ? "대회 등록" : "대회 수정"}
        description="현재 선택된 조직 기준으로 저장됩니다. 공개 페이지는 상태·노출 설정에 따라 달라질 수 있습니다."
        actions={
          <Link
            href="/client/tournaments"
            className="rounded-sm border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            목록으로
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_17.5rem] lg:items-start">
        <div className="min-w-0">
          <TournamentFormSimple
            mode={mode === "create" ? "create" : "edit"}
            tournamentId={tournamentId}
            appearance="console"
            showDraftSaveButton
            initialData={initialData}
            defaultVenueInfo={{
              venueName: defaultVenueName ?? "",
              address: defaultVenueAddress ?? "",
              phone: defaultVenuePhone ?? "",
              organizerName: organizationName ?? "",
            }}
            onSubmit={handleSubmit}
            onCancelHref="/client/tournaments"
            submitLabel={mode === "create" ? "저장" : "저장"}
          >
            <ClientTournamentOutlineSection
              organizationId={organizationId}
              outlineDisplayMode={outlineDisplayMode}
              setOutlineDisplayMode={(m) => {
                setOutlineDisplayMode(m);
                if (m !== "pdf") setOutlinePdfUrl("");
                if (m !== "image") setOutlineImageUrl("");
              }}
              promoContent={promoContent}
              setPromoContent={setPromoContent}
              outlinePdfUrl={outlinePdfUrl}
              setOutlinePdfUrl={setOutlinePdfUrl}
              outlineImageUrl={outlineImageUrl}
              setOutlineImageUrl={setOutlineImageUrl}
            />
          </TournamentFormSimple>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          <ConsoleSection title="조직·소유">
            <p className={cx(consoleTextBody, "text-xs")}>
              <span className={consoleTextMuted}>조직 ID</span>
              <br />
              <code className="mt-1 block break-all text-[11px] text-zinc-700 dark:text-zinc-300">{organizationId}</code>
            </p>
            <p className={cx(consoleTextBody, "mt-2 text-xs")}>
              <span className={consoleTextMuted}>조직명</span>
              <br />
              <strong className="text-zinc-900 dark:text-zinc-100">{organizationName}</strong>
            </p>
            <p className={cx(consoleTextMuted, "mt-3 text-[11px] leading-relaxed")}>
              이 대회는 위 조직에 귀속됩니다. 다른 조직으로 옮기려면 플랫폼 관리자에게 문의하세요.
            </p>
          </ConsoleSection>

          <ConsoleSection title="설명(텍스트)">
            <label className="mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              공개용 짧은 설명 / 메모
            </label>
            <textarea
              rows={5}
              className="w-full rounded-sm border border-zinc-300 bg-white px-2 py-2 text-xs text-zinc-900 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
              placeholder="참가자에게 보이는 요약 설명 등"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </ConsoleSection>

          <ConsoleSection title="검토">
            <div className="flex flex-wrap gap-1.5">
              <ConsoleBadge tone="neutral">조직 스코프</ConsoleBadge>
              <ConsoleBadge tone="neutral">클라 API</ConsoleBadge>
            </div>
            <ul className={cx(consoleTextMuted, "mt-2 list-inside list-disc space-y-1 text-[11px]")}>
              <li>저장 시 `/api/client/tournaments` 경로만 사용합니다.</li>
              <li>임시저장은 상태를 DRAFT로 둡니다.</li>
              <li>참가비·상금은 좌측 폼과 동일 데이터로 반영됩니다.</li>
            </ul>
          </ConsoleSection>
        </aside>
      </div>
      {mode === "create" && createdTournament ? (
        <ConsoleSection
          title="카드 발행"
          description="대회 생성 후 카드 템플릿 선택/입력/미리보기/저장/발행을 같은 화면에서 이어서 진행합니다."
          flush
        >
          <div className="p-3">
            <CardPublishEditorClient
              tournamentId={createdTournament.id}
              tournamentName={createdTournament.name}
              initialCardData={createdTournament.initialCardData}
              initialPublished={null}
              hasSavedCardData={false}
            />
          </div>
        </ConsoleSection>
      ) : null}
    </div>
  );
}
