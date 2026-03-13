"use client";

import type { PrizeScore } from "./PrizeSettingsSection";

export function PrizeScoreForm({
  value,
  onChange,
}: {
  value: PrizeScore;
  onChange: (v: PrizeScore) => void;
}) {
  return (
    <div className="border-t pt-4 space-y-2">
      <p className="text-sm text-gray-600">
        캐롬 방식에서만 사용 가능합니다. 점수에 비례하여 상금이 배분됩니다.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          배분 설정 (JSON 또는 추후 확장)
        </label>
        <textarea
          value={Object.keys(value).length ? JSON.stringify(value, null, 2) : ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              onChange({});
              return;
            }
            try {
              onChange(JSON.parse(raw));
            } catch {
              onChange({ _raw: raw });
            }
          }}
          className="w-full border border-gray-300 rounded px-3 py-2 font-mono text-sm min-h-[80px]"
          placeholder='{ "scale": "linear", "minScore": 0 }'
        />
      </div>
    </div>
  );
}
