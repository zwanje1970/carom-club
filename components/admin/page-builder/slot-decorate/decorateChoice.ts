import { cn } from "@/lib/utils";

export function decorateChoiceWrapClass(selected: boolean) {
  return cn(
    "flex flex-col items-stretch rounded-lg border text-left transition-colors",
    selected
      ? "border-site-primary bg-site-primary/10 ring-2 ring-site-primary/25 dark:ring-site-primary/35"
      : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:hover:border-slate-500 dark:hover:bg-slate-800/80"
  );
}
