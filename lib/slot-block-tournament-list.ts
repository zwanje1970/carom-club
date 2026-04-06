import { parseSectionStyleJson, type SectionStyleJson } from "@/lib/section-style";
import type { HomeTournamentSortBy } from "@/lib/home-published-tournament-cards";

export type SlotBlockTournamentListSettings = {
  sortBy: HomeTournamentSortBy;
  displayCount: number;
  slideEnabled: boolean;
  showMoreButton: boolean;
};

export const DEFAULT_SLOT_BLOCK_TOURNAMENT_LIST_SETTINGS: SlotBlockTournamentListSettings = {
  sortBy: "latest",
  displayCount: 6,
  slideEnabled: true,
  showMoreButton: true,
};

function normalizeSortBy(value: unknown): HomeTournamentSortBy {
  if (value === "deadline" || value === "distance") return value;
  return "latest";
}

function normalizeDisplayCount(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_SLOT_BLOCK_TOURNAMENT_LIST_SETTINGS.displayCount;
  return Math.max(1, Math.min(24, n));
}

export function coerceSlotBlockTournamentListSettings(raw: unknown): SlotBlockTournamentListSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SLOT_BLOCK_TOURNAMENT_LIST_SETTINGS };
  const o = raw as Record<string, unknown>;
  return {
    sortBy: normalizeSortBy(o.sortBy),
    displayCount: normalizeDisplayCount(o.displayCount),
    slideEnabled:
      typeof o.slideEnabled === "boolean"
        ? o.slideEnabled
        : DEFAULT_SLOT_BLOCK_TOURNAMENT_LIST_SETTINGS.slideEnabled,
    showMoreButton:
      typeof o.showMoreButton === "boolean"
        ? o.showMoreButton
        : DEFAULT_SLOT_BLOCK_TOURNAMENT_LIST_SETTINGS.showMoreButton,
  };
}

export function resolveSlotBlockTournamentListSettings(
  sectionStyleJson: string | null | undefined
): SlotBlockTournamentListSettings {
  const parsed = parseSectionStyleJson(sectionStyleJson);
  return coerceSlotBlockTournamentListSettings(parsed.slotBlockTournamentList);
}

export function mergeSlotBlockTournamentListIntoSectionStyleJson(
  existingRaw: string | null | undefined,
  settings: SlotBlockTournamentListSettings
): string {
  const parsed = parseSectionStyleJson(existingRaw);
  const next: SectionStyleJson = {
    ...parsed,
    slotBlockTournamentList: { ...settings } as unknown as Record<string, unknown>,
  };
  return JSON.stringify(next);
}
