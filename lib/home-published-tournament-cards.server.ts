import "server-only";

import { prisma } from "@/lib/db";
import { haversineKm } from "@/lib/distance";
import { parseTournamentCardPublishState } from "@/lib/client-card-publish";
import type {
  HomePublishedTournamentCard,
  HomeTournamentSortBy,
} from "@/lib/home-published-tournament-cards";

type Row = {
  id: string;
  startAt: Date;
  name: string;
  rule: { bracketConfig: string | null } | null;
  organization: { latitude: number | null; longitude: number | null } | null;
};

export async function getHomePublishedTournamentCards(options: {
  sortBy: HomeTournamentSortBy;
  take: number;
  lat?: number;
  lng?: number;
}): Promise<HomePublishedTournamentCard[]> {
  const { sortBy, take } = options;
  const hasCoords =
    typeof options.lat === "number" &&
    typeof options.lng === "number" &&
    Number.isFinite(options.lat) &&
    Number.isFinite(options.lng);

  const rows = await prisma.tournament.findMany({
    where: { status: { notIn: ["DRAFT", "HIDDEN"] } },
    select: {
      id: true,
      startAt: true,
      name: true,
      rule: { select: { bracketConfig: true } },
      organization: { select: { latitude: true, longitude: true } },
    },
    take: Math.max(12, take * 3),
    orderBy: { startAt: "asc" },
  });

  const published = rows
    .map((row) => toPublishedRow(row, hasCoords ? options.lat! : null, hasCoords ? options.lng! : null))
    .filter((row): row is HomePublishedTournamentCard => row != null);

  const sorted = [...published];
  if (sortBy === "latest") {
    sorted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  } else if (sortBy === "deadline") {
    sorted.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  } else if (sortBy === "distance") {
    if (hasCoords) {
      sorted.sort((a, b) => {
        const ka = a.distanceKm;
        const kb = b.distanceKm;
        if (ka == null && kb == null) return +new Date(a.startAt) - +new Date(b.startAt);
        if (ka == null) return 1;
        if (kb == null) return -1;
        if (ka !== kb) return ka - kb;
        return +new Date(a.startAt) - +new Date(b.startAt);
      });
    } else {
      sorted.sort((a, b) => {
        const ra = a.displayRegionText.trim();
        const rb = b.displayRegionText.trim();
        if (ra && rb && ra !== rb) return ra.localeCompare(rb);
        return +new Date(a.startAt) - +new Date(b.startAt);
      });
    }
  }

  return sorted.slice(0, take);
}

function toPublishedRow(
  row: Row,
  lat: number | null,
  lng: number | null
): HomePublishedTournamentCard | null {
  const state = parseTournamentCardPublishState(row.rule?.bracketConfig ?? null, row.id, row.name);
  const published = state.published;
  if (!published || published.isPublished !== true) return null;

  const distanceKm =
    lat != null && lng != null
      ? haversineKm(lat, lng, row.organization?.latitude ?? null, row.organization?.longitude ?? null)
      : null;

  return {
    id: row.id,
    name: published.cardTitle ?? "",
    venue: null,
    endAt: null,
    gameFormat: null,
    status: published.statusText ?? "",
    imageUrl: published.thumbnailUrl ?? "",
    organization: null,
    templateType: published.templateType,
    thumbnailUrl: published.thumbnailUrl ?? "",
    cardTitle: published.cardTitle ?? "",
    displayDateText: published.displayDateText ?? "",
    displayRegionText: published.displayRegionText ?? "",
    statusText: published.statusText ?? "",
    buttonText: published.buttonText ?? "",
    shortDescription: published.shortDescription ?? "",
    updatedAt: published.updatedAt,
    startAt: row.startAt.toISOString(),
    distanceKm: distanceKm ?? undefined,
  };
}
