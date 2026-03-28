"use client";

import { useCallback, useEffect, useState } from "react";
import { ColorPalette64 } from "@/components/editor/ColorPalette64";

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

function normalizeHex(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  const withHash = t.startsWith("#") ? t : `#${t}`;
  if (!HEX_RE.test(withHash)) return null;
  return `#${withHash.slice(1).toUpperCase()}`;
}

type Props = {
  label: string;
  value: string | null | undefined;
  onChange: (hex: string | null) => void;
  /** 비우면 null 전달(기본 테마 적용 등) */
  nullable?: boolean;
  helperText?: string;
  disabled?: boolean;
};

/**
 * 관리자 공통 색상 입력: HEX 텍스트 + 64 프리셋.
 * 브라우저 기본 color input 단독 사용 없음.
 */
export function AdminColorField({
  label,
  value,
  onChange,
  nullable = true,
  helperText,
  disabled = false,
}: Props) {
  const [text, setText] = useState(() => (value?.trim() ? value.trim() : ""));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value?.trim() ? value.trim() : "");
  }, [value]);

  const commit = useCallback(
    (raw: string) => {
      const t = raw.trim();
      if (!t) {
        if (nullable) {
          onChange(null);
          setInvalid(false);
          setText("");
        } else {
          setInvalid(true);
        }
        return;
      }
      const n = normalizeHex(t);
      if (!n) {
        setInvalid(true);
        return;
      }
      setInvalid(false);
      setText(n);
      onChange(n);
    },
    [nullable, onChange]
  );

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-site-text">{label}</label>
      {helperText && <p className="text-xs text-gray-500 dark:text-slate-400">{helperText}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setInvalid(false);
          }}
          onBlur={() => commit(text)}
          disabled={disabled}
          placeholder="#0A0A0A"
          className={`w-36 rounded-lg border bg-white px-3 py-2 font-mono text-sm text-site-text dark:bg-slate-700 ${
            invalid ? "border-red-500" : "border-site-border"
          }`}
          autoComplete="off"
        />
        <ColorPalette64
          applyMode="background"
          selectedHex={normalizeHex(text || "") ?? undefined}
          onSelect={(hex) => {
            setText(hex);
            setInvalid(false);
            onChange(hex);
          }}
          cellSize={18}
        />
        {nullable && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setText("");
              setInvalid(false);
              onChange(null);
            }}
            className="text-xs text-gray-500 underline hover:text-site-primary disabled:opacity-50"
          >
            비우기(기본값)
          </button>
        )}
      </div>
      {invalid && <p className="text-xs text-red-600">올바른 HEX(#RRGGBB)를 입력하세요.</p>}
    </div>
  );
}
