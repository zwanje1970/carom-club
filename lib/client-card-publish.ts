import { type PlatformCardTemplateType } from "@/lib/platform-card-templates";

export type TournamentCardPublishData = {
  tournamentId: string;
  templateType: PlatformCardTemplateType;
  thumbnailUrl: string;
  cardTitle: string;
  displayDateText: string;
  displayRegionText: string;
  statusText: string;
  buttonText: string;
  shortDescription?: string;
  isPublished: boolean;
  updatedAt: string;
};

export type TournamentCardPublishState = {
  draft: TournamentCardPublishData | null;
  published: TournamentCardPublishData | null;
};

const CARD_PUBLISH_DRAFT_KEY = "cardPublishDraftV1";
const CARD_PUBLISH_PUBLISHED_KEY = "cardPublishPublishedV1";

function toRecord(input: unknown): Record<string, unknown> {
  if (!input) return {};
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input) as unknown;
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return typeof input === "object" ? (input as Record<string, unknown>) : {};
}

function getDefaultTemplateType(): PlatformCardTemplateType {
  return "basic";
}

function normalizeCardData(
  raw: unknown,
  tournamentId: string,
  fallbackTitle: string
): TournamentCardPublishData | null {
  const record = toRecord(raw);
  if (!record.tournamentId || String(record.tournamentId) !== tournamentId) return null;

  const templateType =
    record.templateType === "highlight" || record.templateType === "basic"
      ? (record.templateType as PlatformCardTemplateType)
      : getDefaultTemplateType();

  return {
    tournamentId,
    templateType,
    thumbnailUrl: String(record.thumbnailUrl ?? ""),
    cardTitle: String(record.cardTitle ?? fallbackTitle),
    displayDateText: String(record.displayDateText ?? ""),
    displayRegionText: String(record.displayRegionText ?? ""),
    statusText: String(record.statusText ?? ""),
    buttonText: String(record.buttonText ?? "자세히 보기"),
    shortDescription: String(record.shortDescription ?? ""),
    isPublished: Boolean(record.isPublished),
    updatedAt: String(record.updatedAt ?? new Date(0).toISOString()),
  };
}

export function buildDefaultTournamentCardPublishData(
  tournamentId: string,
  fallbackTitle: string
): TournamentCardPublishData {
  return {
    tournamentId,
    templateType: getDefaultTemplateType(),
    thumbnailUrl: "",
    cardTitle: fallbackTitle,
    displayDateText: "",
    displayRegionText: "",
    statusText: "",
    buttonText: "자세히 보기",
    shortDescription: "",
    isPublished: false,
    updatedAt: new Date().toISOString(),
  };
}

export function parseTournamentCardPublishState(
  bracketConfig: string | null | undefined,
  tournamentId: string,
  fallbackTitle: string
): TournamentCardPublishState {
  const config = toRecord(bracketConfig);
  const draft = normalizeCardData(config[CARD_PUBLISH_DRAFT_KEY], tournamentId, fallbackTitle);
  const published = normalizeCardData(config[CARD_PUBLISH_PUBLISHED_KEY], tournamentId, fallbackTitle);
  return { draft, published };
}

export function upsertTournamentCardPublishState(
  bracketConfig: string | null | undefined,
  next: TournamentCardPublishState
): string {
  const config = toRecord(bracketConfig);
  config[CARD_PUBLISH_DRAFT_KEY] = next.draft;
  config[CARD_PUBLISH_PUBLISHED_KEY] = next.published;
  return JSON.stringify(config);
}
