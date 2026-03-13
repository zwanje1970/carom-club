"use client";

import { RichEditor } from "@/components/RichEditor";

export type EntrySettings = {
  entryFee: number | "";
  operatingFee: number | "";
  maxEntries: number | "";
  useWaiting: boolean;
  entryConditions: string;
};

const defaultEntry: EntrySettings = {
  entryFee: "",
  operatingFee: "",
  maxEntries: "",
  useWaiting: false,
  entryConditions: "",
};

export function EntrySettingsSection({
  value = defaultEntry,
  onChange,
}: {
  value?: Partial<EntrySettings>;
  onChange: (v: EntrySettings) => void;
}) {
  const v = { ...defaultEntry, ...value };

  function update(part: Partial<EntrySettings>) {
    onChange({ ...v, ...part });
  }

  return (
    <section className="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-800 border-b pb-2">
        참가 설정
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            참가비 (원)
          </label>
          <input
            type="number"
            min={0}
            value={v.entryFee === "" ? "" : v.entryFee}
            onChange={(e) =>
              update({
                entryFee: e.target.value === "" ? "" : Number(e.target.value),
              })
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
            value={v.operatingFee === "" ? "" : v.operatingFee}
            onChange={(e) =>
              update({
                operatingFee:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            최대 참가 인원
          </label>
          <input
            type="number"
            min={1}
            value={v.maxEntries === "" ? "" : v.maxEntries}
            onChange={(e) =>
              update({
                maxEntries:
                  e.target.value === "" ? "" : Number(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded px-3 py-2"
          />
        </div>
        <div className="flex items-center gap-2 sm:col-span-2">
          <input
            type="checkbox"
            id="useWaiting"
            checked={v.useWaiting}
            onChange={(e) => update({ useWaiting: e.target.checked })}
            className="rounded border-gray-300"
          />
          <label htmlFor="useWaiting" className="text-sm font-medium text-gray-700">
            웨이팅(대기) 사용
          </label>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          참가 조건
        </label>
        <RichEditor
          value={v.entryConditions}
          onChange={(entryConditions) => update({ entryConditions })}
          placeholder="참가 조건을 입력하세요 (예: AVG 제출 필수, 핸디 제한 등)"
          minHeight="120px"
        />
      </div>
    </section>
  );
}
