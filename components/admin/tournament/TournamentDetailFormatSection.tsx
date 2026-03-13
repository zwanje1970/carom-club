"use client";

import { TOURNAMENT_DETAIL_FORMATS } from "@/types/tournament";

export function TournamentDetailFormatSection({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        토너먼트 세부 방식
      </label>
      <div className="flex flex-wrap gap-3">
        {TOURNAMENT_DETAIL_FORMATS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="detailFormat"
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="border-gray-300"
            />
            <span className="text-sm">{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
