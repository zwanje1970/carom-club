"use client";

import { PRIZE_TYPES } from "@/types/tournament";
import { PrizeFixedForm } from "./PrizeFixedForm";
import { PrizeRatioForm } from "./PrizeRatioForm";
import { PrizeScoreForm } from "./PrizeScoreForm";

export type PrizeFixed = { ranks: { rank: number; amount: number }[] };
export type PrizeRatio = {
  entryFee: number;
  operatingFee: number;
  ranks: { rank: number; percent: number }[];
};
export type PrizeScore = Record<string, unknown>;

export type PrizeSettings = {
  prizeType: string;
  fixed: PrizeFixed;
  ratio: PrizeRatio;
  score: PrizeScore;
};

const defaultFixed: PrizeFixed = { ranks: [{ rank: 1, amount: 0 }, { rank: 2, amount: 0 }, { rank: 3, amount: 0 }] };
const defaultRatio: PrizeRatio = {
  entryFee: 0,
  operatingFee: 0,
  ranks: [{ rank: 1, percent: 50 }, { rank: 2, percent: 30 }, { rank: 3, percent: 20 }],
};

const defaultPrize: PrizeSettings = {
  prizeType: "",
  fixed: defaultFixed,
  ratio: defaultRatio,
  score: {},
};

export function PrizeSettingsSection({
  value = defaultPrize,
  onChange,
  gameFormatMain,
}: {
  value?: Partial<PrizeSettings>;
  onChange: (v: PrizeSettings) => void;
  gameFormatMain: string;
}) {
  const v = { ...defaultPrize, ...value };

  function update(part: Partial<PrizeSettings>) {
    onChange({ ...v, ...part });
  }

  const showScoreProportional = gameFormatMain === "carom" || gameFormatMain === "jukbang";

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
        상금 설정
      </h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          상금 방식
        </label>
        <select
          value={v.prizeType}
          onChange={(e) => update({ prizeType: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="">선택</option>
          {PRIZE_TYPES.filter(
            (p) => p.value !== "score_proportional" || showScoreProportional
          ).map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {v.prizeType === "fixed" && (
        <PrizeFixedForm
          value={v.fixed}
          onChange={(fixed) => update({ fixed })}
        />
      )}
      {v.prizeType === "ratio" && (
        <PrizeRatioForm
          value={v.ratio}
          onChange={(ratio) => update({ ratio })}
        />
      )}
      {v.prizeType === "score_proportional" && showScoreProportional && (
        <PrizeScoreForm
          value={v.score}
          onChange={(score) => update({ score })}
        />
      )}
    </section>
  );
}
