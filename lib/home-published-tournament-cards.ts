import type { PlatformCardTemplateType } from "@/lib/platform-card-templates";

export type HomeTournamentSortBy = "latest" | "deadline" | "distance";

export type HomePublishedTournamentCard = {
  id: string;
  name: string;
  venue: string | null;
  endAt: string | null;
  gameFormat: string | null;
  status: string;
  imageUrl: string | null;
  organization: { name: string } | null;
  templateType: PlatformCardTemplateType;
  thumbnailUrl: string;
  cardTitle: string;
  displayDateText: string;
  displayRegionText: string;
  statusText: string;
  buttonText: string;
  shortDescription: string;
  updatedAt: string;
  startAt: string;
  distanceKm?: number | null;
};

export function normalizeHomeTournamentSortBy(value: unknown): HomeTournamentSortBy {
  if (value === "deadline" || value === "distance") return value;
  return "latest";
}
