"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import NotificationBar from "./_components/NotificationBar";
import Button from "./_components/Button";
import Buttons from "./_components/Buttons";
import { EntrySettingsSection, type EntrySettings } from "./tournament/EntrySettingsSection";
import { BracketSettingsSection, type BracketSettings } from "./tournament/BracketSettingsSection";
import { PrizeSettingsSection, type PrizeSettings } from "./tournament/PrizeSettingsSection";
import {
  LoadPreviousTournamentModal,
  type TournamentCopySource,
} from "./tournament/LoadPreviousTournamentModal";

type Org = { id: string; name: string; slug: string; type?: string; address?: string | null };

const defaultEntry: EntrySettings = {
  entryFee: "",
  operatingFee: "",
  maxEntries: "",
  useWaiting: false,
  entryConditions: "",
};

const defaultBracket: BracketSettings = {
  gameFormatMain: "",
  tableCount: "",
  maxPerGroup: "",
  finalistCount: "",
  noRematch: false,
  detailFormat: "",
};

const defaultPrize: PrizeSettings = {
  prizeType: "",
  fixed: { ranks: [{ rank: 1, amount: 0 }, { rank: 2, amount: 0 }, { rank: 3, amount: 0 }] },
  ratio: { entryFee: 0, operatingFee: 0, ranks: [{ rank: 1, percent: 50 }, { rank: 2, percent: 30 }, { rank: 3, percent: 20 }] },
  score: {},
};

function parsePrizeFromRule(rule: TournamentCopySource["rule"]): Partial<PrizeSettings> {
  if (!rule || !rule.prizeType) return {};
  let info: Record<string, unknown> = {};
  if (rule.prizeInfo) {
    try {
      info =
        typeof rule.prizeInfo === "string"
          ? (JSON.parse(rule.prizeInfo) as Record<string, unknown>)
          : (rule.prizeInfo as Record<string, unknown>);
    } catch {
      info = {};
    }
  }
  return {
    prizeType: rule.prizeType,
    fixed: info.ranks ? { ranks: info.ranks as { rank: number; amount: number }[] } : defaultPrize.fixed,
    ratio:
      info.entryFee !== undefined
        ? {
            entryFee: info.entryFee as number,
            operatingFee: info.operatingFee as number,
            ranks: (info.ranks as { rank: number; percent: number }[]) ?? defaultPrize.ratio.ranks,
          }
        : defaultPrize.ratio,
    score: rule.prizeType === "score_proportional" ? (info as PrizeSettings["score"]) : {},
  };
}

function parseBracketFromRule(rule: TournamentCopySource["rule"]): Partial<BracketSettings> {
  if (!rule) return {};
  let config: Record<string, unknown> = {};
  if (rule.bracketConfig) {
    try {
      config =
        typeof rule.bracketConfig === "string"
          ? (JSON.parse(rule.bracketConfig) as Record<string, unknown>)
          : (rule.bracketConfig as Record<string, unknown>);
    } catch {
      config = {};
    }
  }
  return {
    gameFormatMain: (rule.bracketType ?? (config.gameFormatMain as string)) ?? "",
    tableCount: (config.tableCount as number) ?? "",
    maxPerGroup: (config.maxPerGroup as number) ?? "",
    finalistCount: (config.finalistCount as number) ?? "",
    noRematch: (config.noRematch as boolean) ?? false,
    detailFormat: (config.detailFormat as string) ?? "",
  };
}

/** 대회명에서 월 숫자 치환 (예: 3월 정기대회 → 4월 정기대회) */
function suggestNameForNextMonth(name: string): string {
  const now = new Date();
  const thisMonth = now.getMonth() + 1;
  const nextMonth = now.getMonth() + 2;
  if (nextMonth > 12) return name;
  const re = new RegExp(`${thisMonth}월`, "g");
  if (re.test(name)) return name.replace(new RegExp(`${thisMonth}월`, "g"), `${nextMonth}월`);
  return name;
}

type ReadOnlyVenueInfo = { name: string; address: string };

export function TournamentNewForm({
  organizations,
  isVenueClient = false,
  readOnlyVenueInfo = null,
}: {
  organizations: Org[];
  isVenueClient?: boolean;
  readOnlyVenueInfo?: ReadOnlyVenueInfo | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const venueOrganizations = organizations.filter((o) => o.type === "VENUE");

  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [endDate, setEndDate] = useState("");
  const [venue, setVenue] = useState(readOnlyVenueInfo?.address ?? "");
  const [venueName, setVenueName] = useState(readOnlyVenueInfo?.name ?? "");
  const [region, setRegion] = useState("");
  const [status, setStatus] = useState("OPEN");
  const [gameFormat, setGameFormat] = useState("");
  const [selectedVenues, setSelectedVenues] = useState<{ id: string; name: string }[]>([]);
  const [description, setDescription] = useState("");
  const [summary, setSummary] = useState("");
  const [rules, setRules] = useState("");
  const [promoContent, setPromoContent] = useState("");
  const [outlinePublished, setOutlinePublished] = useState("");
  const [posterImageUrl, setPosterImageUrl] = useState("");
  const [entry, setEntry] = useState<EntrySettings>(defaultEntry);
  const [bracket, setBracket] = useState<BracketSettings>(defaultBracket);
  const [prize, setPrize] = useState<PrizeSettings>(defaultPrize);
  const [showExtra, setShowExtra] = useState(false);

  const statusOptions = TOURNAMENT_STATUSES as readonly { value: string; label: string }[];

  function applyCopySource(data: TournamentCopySource) {
    const t = data.tournament;
    const r = data.rule;
    setOrganizationId(t.organizationId);
    setName(suggestNameForNextMonth(t.name));
    const start = new Date(t.startAt);
    setDate(start.toISOString().slice(0, 10));
    setTime(start.toTimeString().slice(0, 5));
    setEndDate(t.endAt ? new Date(t.endAt).toISOString().slice(0, 10) : "");
    if (!isVenueClient) {
      setVenue(t.venue ?? "");
      setVenueName(t.venueName ?? "");
    } else if (readOnlyVenueInfo) {
      setVenue(readOnlyVenueInfo.address);
      setVenueName(readOnlyVenueInfo.name);
    }
    setRegion(t.region ?? "");
    setStatus(t.status);
    setGameFormat(t.gameFormat ?? "");
    setDescription(t.description ?? "");
    setSummary(t.summary ?? "");
    setRules(t.rules ?? "");
    setPromoContent(t.promoContent ?? "");
    setOutlinePublished(t.outlinePublished ?? "");
    setPosterImageUrl(t.posterImageUrl ?? "");
    setEntry({
      entryFee: t.entryFee ?? r?.entryFee ?? "",
      operatingFee: r?.operatingFee ?? "",
      maxEntries: t.maxParticipants ?? r?.maxEntries ?? "",
      useWaiting: r?.useWaiting ?? false,
      entryConditions: t.entryCondition ?? r?.entryConditions ?? "",
    });
    setBracket({
      ...defaultBracket,
      ...parseBracketFromRule(r),
    });
    setPrize({
      ...defaultPrize,
      ...parsePrizeFromRule(r),
    });
    setShowExtra(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!organizationId) {
      setError("업체를 선택해주세요. 업체가 없으면 먼저 생성해주세요.");
      return;
    }
    if (!name.trim()) {
      setError("대회명을 입력해주세요.");
      return;
    }
    if (!date) {
      setError("날짜를 선택해주세요.");
      return;
    }
    setLoading(true);
    try {
      const startAt = new Date(`${date}T${time}`);
      const body: Record<string, unknown> = {
        organizationId,
        name: name.trim(),
        startAt: startAt.toISOString(),
        venue: venue.trim() || undefined,
        venueName: venueName.trim() || undefined,
        region: region.trim() || undefined,
        status,
        gameFormat: gameFormat.trim() || undefined,
        description: description.trim() || undefined,
        summary: summary.trim() || undefined,
        rules: rules.trim() || undefined,
        promoContent: promoContent.trim() || undefined,
        outlinePublished: outlinePublished.trim() || undefined,
        posterImageUrl: posterImageUrl.trim() || undefined,
        entryFee: entry.entryFee === "" ? null : entry.entryFee,
        maxParticipants: entry.maxEntries === "" ? null : entry.maxEntries,
        entryCondition: entry.entryConditions.trim() || null,
        endAt: endDate ? new Date(`${endDate}T23:59:59`).toISOString() : undefined,
      };
      body.rule = {
        entryFee: entry.entryFee === "" ? null : entry.entryFee,
        operatingFee: entry.operatingFee === "" ? null : entry.operatingFee,
        maxEntries: entry.maxEntries === "" ? null : entry.maxEntries,
        useWaiting: entry.useWaiting,
        entryConditions: entry.entryConditions.trim() || null,
        bracketType: bracket.gameFormatMain || null,
        bracketConfig: {
          gameFormatMain: bracket.gameFormatMain,
          tableCount: bracket.tableCount === "" ? undefined : bracket.tableCount,
          maxPerGroup: bracket.maxPerGroup === "" ? undefined : bracket.maxPerGroup,
          finalistCount: bracket.finalistCount === "" ? undefined : bracket.finalistCount,
          noRematch: bracket.noRematch,
          detailFormat: bracket.detailFormat || undefined,
        },
        prizeType: prize.prizeType || null,
        prizeInfo:
          prize.prizeType === "fixed"
            ? JSON.stringify(prize.fixed)
            : prize.prizeType === "ratio"
              ? JSON.stringify(prize.ratio)
              : prize.prizeType === "score_proportional"
                ? JSON.stringify(prize.score)
                : null,
      };
      const res = await fetch("/api/admin/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "저장에 실패했습니다.");
        return;
      }
      const newId = data.id as string | undefined;
      if (newId && selectedVenues.length > 0) {
        for (const v of selectedVenues) {
          await fetch(`/api/admin/tournaments/${newId}/venues`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ organizationId: v.id }),
          });
        }
      }
      router.push("/admin/tournaments");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          label="이전 대회 불러오기"
          color="contrast"
          outline
          onClick={() => setModalOpen(true)}
        />
        <span className="text-sm text-gray-500 dark:text-slate-400">
          이전 대회를 복사해 날짜·장소 등만 수정해 새 대회로 등록할 수 있습니다.
        </span>
      </div>

      <LoadPreviousTournamentModal
        isActive={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelect={applyCopySource}
        sameOrgOnly={false}
        currentOrganizationId={organizationId}
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <NotificationBar color="danger">{error}</NotificationBar>
        )}

        <section className="rounded-lg border border-gray-200 p-6 dark:border-slate-700">
          <h2 className="mb-4 border-b pb-2 text-lg font-semibold text-gray-800 dark:text-slate-100">
            기본 정보
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                업체 <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <option value="">선택</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                대회명 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  날짜 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  시간
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                종료일 (선택)
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </div>
            {isVenueClient ? (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    당구장명 (수정 불가)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={venueName}
                    className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    주소 (수정 불가)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={venue}
                    className="w-full rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                    장소
                  </label>
                  <input
                    type="text"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                    className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    placeholder="예: OO당구장"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      장소명
                    </label>
                    <input
                      type="text"
                      value={venueName}
                      onChange={(e) => setVenueName(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      지역
                    </label>
                    <input
                      type="text"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>
                {venueOrganizations.length > 0 && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      대회 당구장 (개최 장소로 추가)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          const org = venueOrganizations.find((o) => o.id === v);
                          if (org && !selectedVenues.some((s) => s.id === org.id)) {
                            setSelectedVenues((prev) => [...prev, { id: org.id, name: org.name }]);
                          }
                          e.target.value = "";
                        }}
                        className="rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">당구장 선택 후 추가</option>
                        {venueOrganizations
                          .filter((o) => !selectedVenues.some((s) => s.id === o.id))
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    {selectedVenues.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {selectedVenues.map((v) => (
                          <li
                            key={v.id}
                            className="flex items-center justify-between rounded border border-gray-200 py-2 pl-3 pr-2 dark:border-slate-600"
                          >
                            <span className="text-sm text-gray-900 dark:text-slate-100">{v.name}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedVenues((prev) => prev.filter((x) => x.id !== v.id))}
                              className="text-sm text-red-600 hover:underline dark:text-red-400"
                            >
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  상태
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  경기방식
                </label>
                <input
                  type="text"
                  value={gameFormat}
                  onChange={(e) => setGameFormat(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="예: 3판 2선승, 싱글 엘리미네이션"
                />
              </div>
            </div>
          </div>
        </section>

        <EntrySettingsSection value={entry} onChange={setEntry} />
        <BracketSettingsSection value={bracket} onChange={setBracket} />
        <PrizeSettingsSection
          value={prize}
          onChange={setPrize}
          gameFormatMain={bracket.gameFormatMain}
        />

        <section className="rounded-lg border border-gray-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setShowExtra((s) => !s)}
            className="flex w-full items-center justify-between p-4 text-left text-sm font-medium text-gray-700 dark:text-slate-300"
          >
            설명·홍보·포스터 (선택)
            <span className="text-gray-500">{showExtra ? "접기" : "펼치기"}</span>
          </button>
          {showExtra && (
            <div className="space-y-4 border-t border-gray-200 p-4 dark:border-slate-700">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  소개/설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  요약
                </label>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  경기 요강
                </label>
                <textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  홍보 페이지 내용 (HTML)
                </label>
                <textarea
                  value={promoContent}
                  onChange={(e) => setPromoContent(e.target.value)}
                  rows={4}
                  className="w-full rounded border border-gray-300 px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  공개용 요강 (outline)
                </label>
                <textarea
                  value={outlinePublished}
                  onChange={(e) => setOutlinePublished(e.target.value)}
                  rows={3}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                  포스터/썸네일 이미지 URL
                </label>
                <input
                  type="url"
                  value={posterImageUrl}
                  onChange={(e) => setPosterImageUrl(e.target.value)}
                  className="w-full rounded border border-gray-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
        </section>

        <Buttons>
          <Button
            type="submit"
            label={loading ? "저장 중…" : "새 대회 저장"}
            color="info"
            disabled={loading}
          />
          <Button href="/admin/tournaments" label="취소" color="contrast" outline />
        </Buttons>
      </form>
    </div>
  );
}
