"use client";

import { cn } from "@/lib/utils";
import type {
  SlotBlockCtaConfig,
  SlotBlockCtaLayer,
  SlotBlockCtaLayerRole,
  SlotBlockCtaType,
  SlotBlockInternalTarget,
} from "@/lib/slot-block-cta";
import { INTERNAL_TARGET_OPTIONS } from "@/lib/slot-block-cta";
import { decorateChoiceWrapClass } from "./decorateChoice";

const TYPE_CHOICES: { value: SlotBlockCtaType; label: string; hint: string }[] = [
  { value: "none", label: "없음", hint: "클릭해도 이동하지 않음" },
  { value: "internal", label: "사이트 안 페이지", hint: "내부 화면으로 이동" },
  { value: "external", label: "외부 링크", hint: "다른 사이트 URL" },
  { value: "action", label: "동작", hint: "스크롤 등 고정 동작" },
];

const ACTION_OPTS = [{ value: "scroll_top", label: "맨 위로 스크롤" }] as const;

/** 운영자용 질문형 제목 (역할 키는 UI에 노출하지 않음) */
export function decorateClickHeading(role: SlotBlockCtaLayerRole): string {
  switch (role) {
    case "block":
      return "이 영역 전체를 눌렀을 때";
    case "card":
      return "카드를 눌렀을 때";
    case "button":
      return "버튼·보조 링크를 눌렀을 때";
    case "nanguNotes":
      return "난구노트 카드를 눌렀을 때";
    case "nanguSolver":
      return "난구해결사 카드를 눌렀을 때";
    default:
      return "클릭 시";
  }
}

export function emptyCtaLayer(): SlotBlockCtaLayer {
  return {
    enabled: true,
    type: "internal",
    mapping: "fixed",
    internalTarget: "home",
    fixedPath: null,
    externalUrl: null,
    openInNewTab: false,
    actionKey: "none",
  };
}

function LayerEditor({
  role,
  layer,
  onChange,
}: {
  role: SlotBlockCtaLayerRole;
  layer: SlotBlockCtaLayer;
  onChange: (next: SlotBlockCtaLayer) => void;
}) {
  const isCardOnly = role === "card";
  const canAuto =
    isCardOnly &&
    layer.type === "internal" &&
    (layer.internalTarget === "tournament_detail" || layer.internalTarget === "venue_detail");

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-600 dark:bg-slate-900/60">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            onChange({
              ...layer,
              enabled: true,
              type: layer.type === "none" ? "internal" : layer.type,
            })
          }
          className={cn(
            decorateChoiceWrapClass(layer.enabled),
            "min-h-[2.5rem] flex-1 items-center justify-center px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
          )}
        >
          이동·동작 사용
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...layer, enabled: false, type: "none" })}
          className={cn(
            decorateChoiceWrapClass(!layer.enabled),
            "min-h-[2.5rem] flex-1 items-center justify-center px-2 py-2 text-xs font-semibold text-gray-900 dark:text-slate-100"
          )}
        >
          사용 안 함
        </button>
      </div>

      {layer.enabled ? (
        <>
          <div>
            <div className="mb-2 text-[11px] font-semibold text-gray-600 dark:text-slate-400">어떻게 연결할까요?</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {TYPE_CHOICES.map(({ value, label, hint }) => {
                const sel = layer.type === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange({ ...layer, type: value })}
                    className={cn(decorateChoiceWrapClass(sel), "p-2")}
                  >
                    <div className="text-xs font-semibold text-gray-900 dark:text-slate-100">{label}</div>
                    <div className="mt-0.5 text-[10px] leading-tight text-gray-500 dark:text-slate-400">{hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {layer.type === "internal" ? (
            <>
              <div>
                <div className="mb-2 text-[11px] font-semibold text-gray-600 dark:text-slate-400">페이지 연결 방식</div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onChange({ ...layer, mapping: "fixed" })}
                    className={cn(
                      decorateChoiceWrapClass(layer.mapping === "fixed"),
                      "min-h-[2.5rem] flex-1 px-3 py-2 text-xs font-medium text-gray-800 dark:text-slate-200"
                    )}
                  >
                    고정 페이지
                  </button>
                  <button
                    type="button"
                    disabled={!isCardOnly}
                    title={!isCardOnly ? "카드 클릭에서만 자동 연결을 쓸 수 있습니다." : undefined}
                    onClick={() => onChange({ ...layer, mapping: "auto" })}
                    className={cn(
                      decorateChoiceWrapClass(layer.mapping === "auto"),
                      "min-h-[2.5rem] flex-1 px-3 py-2 text-xs font-medium text-gray-800 dark:text-slate-200",
                      !isCardOnly && "cursor-not-allowed opacity-45"
                    )}
                  >
                    카드 데이터에 맞춤
                  </button>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold text-gray-600 dark:text-slate-400">이동할 화면</div>
                <div className="flex max-h-[220px] flex-wrap gap-1.5 overflow-y-auto pr-0.5">
                  {INTERNAL_TARGET_OPTIONS.map((o) => {
                    const sel = (layer.internalTarget ?? "home") === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => onChange({ ...layer, internalTarget: o.value })}
                        className={cn(
                          decorateChoiceWrapClass(sel),
                          "px-2 py-1.5 text-left text-[11px] font-medium text-gray-800 dark:text-slate-200"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {layer.internalTarget === "custom" ? (
                <label className="flex flex-col gap-0.5">
                  <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-400">경로 (/ 로 시작)</span>
                  <input
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                    value={layer.fixedPath ?? ""}
                    onChange={(e) => onChange({ ...layer, fixedPath: e.target.value || null })}
                    placeholder="/example"
                  />
                </label>
              ) : null}
              {canAuto && layer.mapping === "auto" ? (
                <p className="text-[11px] leading-snug text-sky-800 dark:text-sky-200">
                  각 카드의 대회·당구장 정보에 맞춰 상세 페이지로 연결됩니다.
                </p>
              ) : null}
            </>
          ) : null}

          {layer.type === "external" ? (
            <>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-gray-600 dark:text-slate-400">URL</span>
                <input
                  className="rounded border border-gray-300 px-2 py-1.5 text-xs dark:border-slate-600 dark:bg-slate-900"
                  value={layer.externalUrl ?? ""}
                  onChange={(e) => onChange({ ...layer, externalUrl: e.target.value || null })}
                  placeholder="https://"
                />
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={layer.openInNewTab ?? false}
                  onChange={(e) => onChange({ ...layer, openInNewTab: e.target.checked })}
                />
                새 탭에서 열기
              </label>
            </>
          ) : null}

          {layer.type === "action" ? (
            <div>
              <div className="mb-2 text-[11px] font-semibold text-gray-600 dark:text-slate-400">실행할 동작</div>
              <div className="flex flex-wrap gap-2">
                {ACTION_OPTS.map((o) => {
                  const sel = (layer.actionKey ?? "none") === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => onChange({ ...layer, actionKey: o.value })}
                      className={cn(
                        decorateChoiceWrapClass(sel),
                        "min-h-[2.5rem] flex-1 px-3 py-2 text-xs font-medium text-gray-800 dark:text-slate-200"
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function SlotBlockDecorateCtaPanel({
  roles,
  cfg,
  onLayerChange,
}: {
  roles: SlotBlockCtaLayerRole[];
  cfg: SlotBlockCtaConfig;
  onLayerChange: (role: SlotBlockCtaLayerRole, layer: SlotBlockCtaLayer) => void;
}) {
  return (
    <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
      {roles.map((role) => {
        const layer = cfg[role] ?? emptyCtaLayer();
        return (
          <div key={role}>
            <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
              {decorateClickHeading(role)}
            </div>
            <LayerEditor role={role} layer={layer} onChange={(L) => onLayerChange(role, L)} />
          </div>
        );
      })}
    </div>
  );
}
