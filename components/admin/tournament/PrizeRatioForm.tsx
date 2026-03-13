"use client";

import type { PrizeRatio } from "./PrizeSettingsSection";

export function PrizeRatioForm({
  value,
  onChange,
}: {
  value: PrizeRatio;
  onChange: (v: PrizeRatio) => void;
}) {
  const ranks = value.ranks.length ? value.ranks : [{ rank: 1, percent: 50 }];

  function updateRank(index: number, percent: number) {
    const next = [...ranks];
    next[index] = { ...next[index], percent };
    onChange({ ...value, ranks: next });
  }

  function setRankCount(n: number) {
    const next = Array.from({ length: Math.max(1, n) }, (_, i) =>
      ranks[i] ?? { rank: i + 1, percent: i === 0 ? 50 : 0 }
    );
    onChange({ ...value, ranks: next });
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            참가비 (원)
          </label>
          <input
            type="number"
            min={0}
            value={value.entryFee}
            onChange={(e) =>
              onChange({ ...value, entryFee: Number(e.target.value) || 0 })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            운영비 (원)
          </label>
          <input
            type="number"
            min={0}
            value={value.operatingFee}
            onChange={(e) =>
              onChange({ ...value, operatingFee: Number(e.target.value) || 0 })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">
          지급 순위 수
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={ranks.length}
          onChange={(e) => setRankCount(Number(e.target.value) || 1)}
          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <div className="space-y-2">
        {ranks.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-16 text-sm text-gray-600">{r.rank}등</span>
            <input
              type="number"
              min={0}
              max={100}
              value={r.percent}
              onChange={(e) => updateRank(i, Number(e.target.value) || 0)}
              className="flex-1 border border-gray-300 rounded px-3 py-2"
            />
            <span className="text-sm text-gray-500">%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
