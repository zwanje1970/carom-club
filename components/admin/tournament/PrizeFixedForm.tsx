"use client";

import type { PrizeFixed } from "./PrizeSettingsSection";

export function PrizeFixedForm({
  value,
  onChange,
}: {
  value: PrizeFixed;
  onChange: (v: PrizeFixed) => void;
}) {
  const ranks = value.ranks.length ? value.ranks : [{ rank: 1, amount: 0 }];

  function updateRank(index: number, amount: number) {
    const next = [...ranks];
    next[index] = { ...next[index], amount };
    onChange({ ranks: next });
  }

  function setRankCount(n: number) {
    const next = Array.from({ length: Math.max(1, n) }, (_, i) =>
      ranks[i] ?? { rank: i + 1, amount: 0 }
    );
    onChange({ ranks: next });
  }

  return (
    <div className="space-y-3 border-t pt-4">
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
              value={r.amount}
              onChange={(e) => updateRank(i, Number(e.target.value) || 0)}
              className="flex-1 border border-gray-300 rounded px-3 py-2"
            />
            <span className="text-sm text-gray-500">원</span>
          </div>
        ))}
      </div>
    </div>
  );
}
