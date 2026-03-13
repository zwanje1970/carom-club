"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TOURNAMENT_STATUSES } from "@/types/tournament";
import NotificationBar from "../_components/NotificationBar";
import Button from "../_components/Button";
import Buttons from "../_components/Buttons";
import { EntrySettingsSection, type EntrySettings } from "./EntrySettingsSection";
import { BracketSettingsSection, type BracketSettings } from "./BracketSettingsSection";
import { PrizeSettingsSection, type PrizeSettings } from "./PrizeSettingsSection";
import { FinanceSummaryBox } from "./FinanceSummaryBox";

type BasicInfo = {
  name: string;
  startAt: string;
  venue: string;
  status: string;
  gameFormat: string;
};

export function TournamentEditForm({
  tournamentId,
  initialBasic,
  initialEntry,
  initialBracket,
  initialPrize,
  financeSummary,
}: {
  tournamentId: string;
  initialBasic: BasicInfo;
  initialEntry: Partial<EntrySettings>;
  initialBracket: Partial<BracketSettings>;
  initialPrize: Partial<PrizeSettings>;
  financeSummary: { totalEntryFee: number; totalPrize: number; operatingFee: number; confirmedCount: number };
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [basic, setBasic] = useState(initialBasic);
  const [entry, setEntry] = useState<EntrySettings>({
    entryFee: "",
    operatingFee: "",
    maxEntries: "",
    useWaiting: false,
    entryConditions: "",
    ...initialEntry,
  });
  const [bracket, setBracket] = useState<BracketSettings>({
    gameFormatMain: "",
    tableCount: "",
    maxPerGroup: "",
    finalistCount: "",
    noRematch: false,
    detailFormat: "",
    ...initialBracket,
  });
  const [prize, setPrize] = useState<PrizeSettings>({
    prizeType: "",
    fixed: { ranks: [] },
    ratio: { entryFee: 0, operatingFee: 0, ranks: [] },
    score: {},
    ...initialPrize,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);
    try {
      const [basicRes, ruleRes] = await Promise.all([
        fetch(`/api/admin/tournaments/${tournamentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: basic.name,
            startAt: basic.startAt,
            venue: basic.venue || undefined,
            status: basic.status,
            gameFormat: basic.gameFormat || undefined,
          }),
        }),
        fetch(`/api/admin/tournaments/${tournamentId}/rule`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryFee: entry.entryFee === "" ? null : entry.entryFee,
            operatingFee: entry.operatingFee === "" ? null : entry.operatingFee,
            maxEntries: entry.maxEntries === "" ? null : entry.maxEntries,
            useWaiting: entry.useWaiting,
            entryConditions: entry.entryConditions || null,
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
          }),
        }),
      ]);
      if (!basicRes.ok || !ruleRes.ok) {
        const err = await basicRes.json().catch(() => ({}));
        const err2 = await ruleRes.json().catch(() => ({}));
        setError((err.error || err2.error) || "저장에 실패했습니다.");
        return;
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <NotificationBar color="danger">{error}</NotificationBar>}
      {success && <NotificationBar color="success">저장되었습니다.</NotificationBar>}

      <section className="rounded-lg border border-gray-200 p-6 dark:border-slate-700">
        <h2 className="text-lg font-semibold text-gray-800 border-b pb-2 mb-4">
          기본 정보
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">대회명</label>
            <input
              type="text"
              value={basic.name}
              onChange={(e) => setBasic((b) => ({ ...b, name: e.target.value }))}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">일시</label>
              <input
                type="datetime-local"
                value={basic.startAt}
                onChange={(e) => setBasic((b) => ({ ...b, startAt: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">장소</label>
              <input
                type="text"
                value={basic.venue}
                onChange={(e) => setBasic((b) => ({ ...b, venue: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">상태</label>
              <select
                value={basic.status}
                onChange={(e) => setBasic((b) => ({ ...b, status: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                {TOURNAMENT_STATUSES.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">경기방식</label>
              <input
                type="text"
                value={basic.gameFormat}
                onChange={(e) => setBasic((b) => ({ ...b, gameFormat: e.target.value }))}
                className="w-full border border-gray-300 rounded px-3 py-2"
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
      <FinanceSummaryBox data={financeSummary} />

      <Buttons>
        <Button
          type="submit"
          label={loading ? "저장중" : "저장"}
          color="info"
          disabled={loading}
        />
        <Button href={`/admin/tournaments/${tournamentId}`} label="취소" color="contrast" outline />
      </Buttons>
    </form>
  );
}
