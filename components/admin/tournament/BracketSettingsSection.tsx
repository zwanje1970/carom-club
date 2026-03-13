"use client";

import { GAME_FORMAT_MAIN } from "@/types/tournament";
import { TournamentDetailFormatSection } from "./TournamentDetailFormatSection";

export type BracketSettings = {
  gameFormatMain: string;
  tableCount: number | "";
  maxPerGroup: number | "";
  finalistCount: number | "";
  noRematch: boolean;
  detailFormat: string;
};

const defaultBracket: BracketSettings = {
  gameFormatMain: "",
  tableCount: "",
  maxPerGroup: "",
  finalistCount: "",
  noRematch: false,
  detailFormat: "",
};

export function BracketSettingsSection({
  value = defaultBracket,
  onChange,
}: {
  value?: Partial<BracketSettings>;
  onChange: (v: BracketSettings) => void;
}) {
  const v = { ...defaultBracket, ...value };

  function update(part: Partial<BracketSettings>) {
    onChange({ ...v, ...part });
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
        대진표 설정
      </h2>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          경기 방식
        </label>
        <select
          value={v.gameFormatMain}
          onChange={(e) => update({ gameFormatMain: e.target.value })}
          className="w-full border border-gray-300 rounded px-3 py-2"
        >
          <option value="">선택</option>
          {GAME_FORMAT_MAIN.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            사용 가능 테이블 수
          </label>
          <input
            type="number"
            min={1}
            value={v.tableCount === "" ? "" : v.tableCount}
            onChange={(e) =>
              update({
                tableCount: e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            조당 최대 인원
          </label>
          <input
            type="number"
            min={1}
            value={v.maxPerGroup === "" ? "" : v.maxPerGroup}
            onChange={(e) =>
              update({
                maxPerGroup:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            결승 인원
          </label>
          <input
            type="number"
            min={1}
            value={v.finalistCount === "" ? "" : v.finalistCount}
            onChange={(e) =>
              update({
                finalistCount:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="noRematch"
            checked={v.noRematch}
            onChange={(e) => update({ noRematch: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="noRematch" className="text-sm font-medium text-gray-700">
            재대결 방지
          </label>
        </div>
      </div>
      <TournamentDetailFormatSection
        value={v.detailFormat}
        onChange={(detailFormat) => update({ detailFormat })}
      />
    </section>
  );
}
