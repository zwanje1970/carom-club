/**
 * 홈 구조 슬롯 `sectionStyleJson.slotBlockItems` — 자동 연결 vs 직접 구성 카드.
 */
import { parseSectionStyleJson, type SectionStyleJson } from "@/lib/section-style";
import type { HomeStructureSlotType } from "@/lib/home-structure-slots";
import type { VenueCarouselItem } from "@/components/home/VenueCarousel";

export type SlotBlockManualEntryRole = "nanguNotes" | "nanguSolver";

export type SlotBlockManualItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string | null;
  /** 비우면 카드 클릭 동작(CTA)만 따름 */
  linkUrl?: string;
  /** 카드 안 보조 문구(링크 블록 등) */
  buttonLabel?: string;
  /** 난구 진입 슬롯: 두 카드 구분 */
  entryRole?: SlotBlockManualEntryRole;
};

export type SlotBlockItemsBundle = {
  mode: "auto" | "manual";
  items: SlotBlockManualItem[];
};

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function defaultLinkForSlot(slotType: HomeStructureSlotType): string {
  switch (slotType) {
    case "tournamentIntro":
      return "/tournaments";
    case "venueIntro":
    case "venueLink":
      return "/venues";
    case "nanguEntry":
      return "/";
    default:
      return "/";
  }
}

export function emptyManualItem(slotType: HomeStructureSlotType): SlotBlockManualItem {
  return {
    id: newId(),
    title: "새 카드",
    description: "",
    imageUrl: null,
    linkUrl: defaultLinkForSlot(slotType),
    buttonLabel: "",
  };
}

export function defaultNanguManualPair(): SlotBlockManualItem[] {
  return [
    {
      id: "nangu-notes",
      entryRole: "nanguNotes",
      title: "난구노트",
      description: "나만의 당구 노트를 남겨 보세요.",
      imageUrl: null,
      linkUrl: "/mypage/notes",
      buttonLabel: "",
    },
    {
      id: "nangu-solver",
      entryRole: "nanguSolver",
      title: "난구해결사",
      description: "난구를 올리고 해법을 나눠 보세요.",
      imageUrl: null,
      linkUrl: "/community/nangu",
      buttonLabel: "",
    },
  ];
}

function coerceItem(raw: unknown): SlotBlockManualItem | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : newId();
  const title = typeof o.title === "string" ? o.title : "";
  const description = typeof o.description === "string" ? o.description : "";
  const imageUrl = o.imageUrl != null ? String(o.imageUrl) : null;
  const linkUrl = typeof o.linkUrl === "string" ? o.linkUrl : "";
  const buttonLabel = typeof o.buttonLabel === "string" ? o.buttonLabel : "";
  const er = o.entryRole;
  const entryRole =
    er === "nanguNotes" || er === "nanguSolver" ? (er as SlotBlockManualEntryRole) : undefined;
  return { id, title, description, imageUrl, linkUrl, buttonLabel, entryRole };
}

export function parseSlotBlockItemsBundle(
  sectionStyleJson: string | null | undefined,
  slotType: HomeStructureSlotType
): SlotBlockItemsBundle {
  const j = parseSectionStyleJson(sectionStyleJson);
  const raw = j.slotBlockItems;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { mode: "auto", items: [] };
  }
  const o = raw as Record<string, unknown>;
  const mode = o.mode === "manual" ? "manual" : "auto";
  const itemsRaw = o.items;
  const items: SlotBlockManualItem[] = [];
  if (Array.isArray(itemsRaw)) {
    for (const x of itemsRaw) {
      const it = coerceItem(x);
      if (it) items.push(it);
    }
  }
  if (slotType === "nanguEntry" && mode === "manual") {
    return { mode, items: normalizeNanguManualItems(items) };
  }
  return { mode, items };
}

function normalizeNanguManualItems(items: SlotBlockManualItem[]): SlotBlockManualItem[] {
  const byRole = (r: SlotBlockManualEntryRole) =>
    items.find((i) => i.entryRole === r) ?? defaultNanguManualPair().find((d) => d.entryRole === r)!;
  return [byRole("nanguNotes"), byRole("nanguSolver")];
}

export function mergeSlotBlockItemsIntoSectionStyleJson(
  existingRaw: string | null | undefined,
  bundle: SlotBlockItemsBundle
): string {
  const parsed = parseSectionStyleJson(existingRaw);
  const next: SectionStyleJson = { ...parsed };
  if (bundle.mode === "auto") {
    delete next.slotBlockItems;
    return JSON.stringify(next);
  }
  next.slotBlockItems = {
    mode: "manual",
    items: bundle.items.map((i) => ({
      id: i.id,
      title: i.title,
      description: i.description ?? "",
      imageUrl: i.imageUrl ?? null,
      linkUrl: i.linkUrl ?? "",
      buttonLabel: i.buttonLabel ?? "",
      ...(i.entryRole ? { entryRole: i.entryRole } : {}),
    })),
  };
  return JSON.stringify(next);
}

/** 대회 카드용 합성 데이터 */
export function manualItemsToTournamentCarouselInput(
  items: SlotBlockManualItem[]
): import("@/components/home/HomeTournamentCarouselRows").HomeTournamentCarouselInput[] {
  return items.map((it) => ({
    id: it.id,
    name: it.title || "제목 없음",
    venue: null,
    startAt: new Date(),
    endAt: null,
    gameFormat: null,
    status: "OPEN",
    imageUrl: it.imageUrl?.trim() || null,
    posterImageUrl: it.imageUrl?.trim() || null,
    summary: it.description?.trim() || null,
    maxParticipants: null,
    confirmedCount: 0,
    organization: null,
    manualSimple: true,
    directCardHref: it.linkUrl?.trim() || null,
  }));
}

/** 당구장 캐러셀용 */
export function manualItemsToVenueCarouselItems(items: SlotBlockManualItem[]): VenueCarouselItem[] {
  return items.map((it) => ({
    id: it.id,
    name: it.title || "제목 없음",
    slug: it.id,
    logoImageUrl: null,
    coverImageUrl: it.imageUrl?.trim() || null,
    venueCategory: null,
    manualDescription: it.description?.trim() || null,
    manualLinkUrl: it.linkUrl?.trim() || null,
  }));
}
