export type CommonPaletteColor = {
  value: string;
  label: string;
  hex: string;
};

export const COMMON_COLOR_PALETTE_64: CommonPaletteColor[] = [
  { value: "neutral-01", label: "흰색", hex: "#ffffff" },
  { value: "neutral-02", label: "검정", hex: "#000000" },
  { value: "gray-50", label: "회색 50", hex: "#f9fafb" },
  { value: "gray-200", label: "회색 200", hex: "#e5e7eb" },
  { value: "gray-500", label: "회색 500", hex: "#6b7280" },
  { value: "gray-800", label: "회색 800", hex: "#1f2937" },

  { value: "blue-100", label: "파랑 100", hex: "#dbeafe" },
  { value: "blue-200", label: "파랑 200", hex: "#bfdbfe" },
  { value: "blue-300", label: "파랑 300", hex: "#93c5fd" },
  { value: "blue-500", label: "파랑 500", hex: "#3b82f6" },
  { value: "blue-600", label: "파랑 600", hex: "#2563eb" },
  { value: "blue-700", label: "파랑 700", hex: "#1d4ed8" },
  { value: "blue-900", label: "파랑 900", hex: "#1e3a8a" },

  { value: "sky-100", label: "하늘 100", hex: "#e0f2fe" },
  { value: "sky-200", label: "하늘 200", hex: "#bae6fd" },
  { value: "sky-300", label: "하늘 300", hex: "#7dd3fc" },
  { value: "sky-500", label: "하늘 500", hex: "#0ea5e9" },
  { value: "sky-600", label: "하늘 600", hex: "#0284c7" },
  { value: "sky-700", label: "하늘 700", hex: "#0369a1" },
  { value: "sky-900", label: "하늘 900", hex: "#0c4a6e" },

  { value: "green-100", label: "초록 100", hex: "#dcfce7" },
  { value: "green-200", label: "초록 200", hex: "#bbf7d0" },
  { value: "green-300", label: "초록 300", hex: "#86efac" },
  { value: "green-500", label: "초록 500", hex: "#22c55e" },
  { value: "green-600", label: "초록 600", hex: "#16a34a" },
  { value: "green-700", label: "초록 700", hex: "#15803d" },
  { value: "green-900", label: "초록 900", hex: "#14532d" },

  { value: "lime-100", label: "연두 100", hex: "#ecfccb" },
  { value: "lime-200", label: "연두 200", hex: "#d9f99d" },
  { value: "lime-300", label: "연두 300", hex: "#bef264" },
  { value: "lime-500", label: "연두 500", hex: "#84cc16" },
  { value: "lime-600", label: "연두 600", hex: "#65a30d" },
  { value: "lime-700", label: "연두 700", hex: "#4d7c0f" },

  { value: "yellow-100", label: "노랑 100", hex: "#fef9c3" },
  { value: "yellow-200", label: "노랑 200", hex: "#fef08a" },
  { value: "yellow-300", label: "노랑 300", hex: "#fde047" },
  { value: "yellow-500", label: "노랑 500", hex: "#eab308" },
  { value: "yellow-600", label: "노랑 600", hex: "#ca8a04" },
  { value: "yellow-700", label: "노랑 700", hex: "#a16207" },
  { value: "yellow-900", label: "노랑 900", hex: "#713f12" },

  { value: "orange-100", label: "주황 100", hex: "#ffedd5" },
  { value: "orange-200", label: "주황 200", hex: "#fed7aa" },
  { value: "orange-300", label: "주황 300", hex: "#fdba74" },
  { value: "orange-500", label: "주황 500", hex: "#f97316" },
  { value: "orange-600", label: "주황 600", hex: "#ea580c" },
  { value: "orange-700", label: "주황 700", hex: "#c2410c" },

  { value: "red-100", label: "빨강 100", hex: "#fee2e2" },
  { value: "red-200", label: "빨강 200", hex: "#fecaca" },
  { value: "red-300", label: "빨강 300", hex: "#fca5a5" },
  { value: "red-500", label: "빨강 500", hex: "#ef4444" },
  { value: "red-600", label: "빨강 600", hex: "#dc2626" },
  { value: "red-700", label: "빨강 700", hex: "#b91c1c" },

  { value: "pink-100", label: "분홍 100", hex: "#fce7f3" },
  { value: "pink-300", label: "분홍 300", hex: "#f9a8d4" },
  { value: "pink-500", label: "분홍 500", hex: "#ec4899" },
  { value: "pink-700", label: "분홍 700", hex: "#be185d" },

  { value: "purple-100", label: "보라 100", hex: "#f3e8ff" },
  { value: "purple-300", label: "보라 300", hex: "#d8b4fe" },
  { value: "purple-500", label: "보라 500", hex: "#a855f7" },
  { value: "purple-700", label: "보라 700", hex: "#7e22ce" },

  { value: "brown-100", label: "갈색 100", hex: "#efebe9" },
  { value: "brown-300", label: "갈색 300", hex: "#bcaaa4" },
  { value: "brown-500", label: "갈색 500", hex: "#8d6e63" },
  { value: "brown-700", label: "갈색 700", hex: "#5d4037" },
];

const PALETTE_MAP = new Map(COMMON_COLOR_PALETTE_64.map((item) => [item.value, item.hex]));

export function isCommonPaletteColor(value: unknown): value is string {
  return typeof value === "string" && PALETTE_MAP.has(value);
}

export function getCommonPaletteColorHex(value?: string): string | undefined {
  if (!value) return undefined;
  return PALETTE_MAP.get(value);
}
