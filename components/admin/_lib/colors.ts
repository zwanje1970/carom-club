/**
 * Admin One 버튼/메뉴 색상 클래스
 */

import type { ColorButtonKey, ColorKey } from "../_interfaces";

type ButtonColorValue =
  | { default: string; outline: string; active: string }
  | string;

const colorButtonMap: Record<ColorButtonKey, ButtonColorValue> = {
  white: {
    default: "bg-white text-black border-gray-200 dark:bg-slate-900 dark:text-white dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800",
    outline: "border-gray-200 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800",
    active: "bg-gray-100 text-gray-900 dark:bg-slate-800 dark:text-slate-100 border-gray-200 dark:border-slate-700",
  },
  whiteDark:
    "bg-white text-black border-gray-200 hover:bg-gray-50 dark:bg-slate-900 dark:border-slate-700 dark:text-white dark:hover:bg-slate-800",
  lightDark:
    "bg-gray-50 text-gray-900 border-gray-200 hover:bg-gray-100 dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:hover:bg-slate-700",
  contrast:
    "bg-gray-900 text-white border-gray-900 hover:bg-gray-800 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100 dark:hover:bg-slate-200",
  info: "bg-blue-500 border-blue-500 text-white hover:bg-blue-600",
  success: "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600",
  warning: "bg-amber-500 border-amber-500 text-white hover:bg-amber-600",
  danger: "bg-red-500 border-red-500 text-white hover:bg-red-600",
  void: "bg-transparent border-gray-200 text-gray-700 dark:border-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800",
};

const colorMenuMap: Record<ColorKey, string> = {
  info: "aside-menu-item text-blue-600 dark:text-blue-400",
  success: "aside-menu-item text-emerald-600 dark:text-emerald-400",
  warning: "aside-menu-item text-amber-600 dark:text-amber-400",
  danger: "aside-menu-item text-red-600 dark:text-red-400",
  contrast: "aside-menu-item text-gray-800 dark:text-slate-100",
  light: "aside-menu-item text-gray-600 dark:text-slate-400",
  dark: "aside-menu-item text-gray-800 dark:text-slate-100",
};

export const colorsText: Record<ColorKey, string> = {
  info: "text-blue-500 dark:text-blue-400",
  success: "text-emerald-500 dark:text-emerald-400",
  warning: "text-amber-500 dark:text-amber-400",
  danger: "text-red-500 dark:text-red-400",
  contrast: "text-gray-800 dark:text-slate-100",
  light: "text-gray-500 dark:text-slate-400",
  dark: "text-gray-800 dark:text-slate-100",
};

export const colorsBgLight: Record<ColorKey, string> = {
  info: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  success: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  warning: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  danger: "bg-red-500/20 text-red-600 dark:text-red-400",
  contrast: "bg-gray-500/20 text-gray-800 dark:text-slate-100",
  light: "bg-gray-500/10 text-gray-600 dark:text-slate-400",
  dark: "bg-gray-500/20 text-gray-800 dark:text-slate-100",
};

export const colorsOutline: Record<ColorKey, string> = {
  info: "border border-blue-500/50 text-blue-600 dark:text-blue-400",
  success: "border border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
  warning: "border border-amber-500/50 text-amber-600 dark:text-amber-400",
  danger: "border border-red-500/50 text-red-600 dark:text-red-400",
  contrast: "border border-gray-500/50 text-gray-800 dark:text-slate-100",
  light: "border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-400",
  dark: "border border-gray-500/50 text-gray-800 dark:text-slate-100",
};

export const gradientBgPinkRed = "bg-gradient-to-r from-pink-500 to-red-500";
export const gradientBgPurplePink = "bg-gradient-to-r from-purple-500 to-pink-500";
export const gradientBgDark = "bg-gradient-to-br from-slate-800 to-slate-900";

export function getButtonColor(
  color: ColorButtonKey | ColorKey,
  outline?: boolean,
  active?: boolean,
  isActive?: boolean
): string {
  const key = color as ColorButtonKey;
  const map = colorButtonMap[key];
  if (!map) return colorMenuMap[color as ColorKey] ?? "";
  const def = typeof map === "string" ? map : map.default;
  const out = typeof map === "string" ? map : map.outline;
  const act = typeof map === "string" ? map : map.active;
  if (active && isActive) return `border-2 ${act}`;
  if (outline) return `border-2 ${out}`;
  return `border-2 ${def}`;
}
