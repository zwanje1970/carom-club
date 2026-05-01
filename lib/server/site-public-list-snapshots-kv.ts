import { isFirestoreUsersBackendConfigured } from "./firestore-users";
import {
  PLATFORM_KV_KEYS,
  readPlatformKvJson,
  upsertPlatformKvJson,
  type PlatformKvSettingKey,
} from "./platform-kv-firestore";
import type { SiteTournamentListSnapshot, SiteVenueListSnapshot } from "../types/site-public-list-snapshots";
import { buildRegionLabelForSiteListSnapshot } from "../site-list-region-label";
import { formatTournamentScheduleLabel } from "../tournament-schedule";
import type { Tournament } from "../types/entities";
import type { SiteVenueBoardRow } from "./platform-backing-store";
import {
  normalizeRepresentativeImageUrls,
  parseTypeSpecific,
  resolveVenuePricingType,
} from "../client-organization-setup-parse";
import type { VenuePricingType, VenueSpecific } from "../client-organization-setup-types";
import { resolveSiteImageListThumbnailUrl } from "../site-poster-urls";
import { isEntityLifecycleVisibleForList } from "./entity-lifecycle";
import type { TournamentStatusBadge } from "./platform-backing-store";

const KV_TOURNAMENTS: PlatformKvSettingKey = PLATFORM_KV_KEYS.sitePublicTournamentListSnapshots;
const KV_VENUES: PlatformKvSettingKey = PLATFORM_KV_KEYS.sitePublicVenueListSnapshots;

function tournamentDeadlineSortValue(t: Pick<Tournament, "date" | "eventDates">): string {
  const dates =
    t.eventDates && t.eventDates.length > 0
      ? [...t.eventDates]
      : t.date
        ? [t.date]
        : [];
  const sorted = dates.map((x) => String(x).trim()).filter(Boolean).sort();
  const v = sorted[0] ?? "";
  return v || "9999-12-31";
}

function tournamentDateLabelForList(t: Pick<Tournament, "date" | "eventDates">): string {
  const label = formatTournamentScheduleLabel(t);
  if (!label) return "";
  return label.replace(/\d{4}-\d{2}-\d{2}/g, (seg) => {
    const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(seg);
    return p ? `${p[1]}.${p[2]}.${p[3]}` : seg;
  });
}

function tournamentPlayScaleLabel(t: Pick<Tournament, "maxParticipants">): string {
  const n = t.maxParticipants;
  if (!Number.isFinite(n) || n <= 0) return "";
  return `${Math.floor(n)}강`;
}

/** Tournament `location` 값에서 주최장소명만 — `app/client/tournaments/.../card-publish-v2`의 venueNameOnly와 동일 */
function tournamentVenueDisplayNameFromLocation(raw: string | null | undefined): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.split(/\r?\n/)[0]?.trim() ?? "";
  const slashPart = s.split(/\s*\/\s*/)[0]?.trim() ?? "";
  if (slashPart) s = slashPart;
  const comma = s.indexOf(",");
  if (comma > 0) {
    s = s.slice(0, comma).trim();
  }
  return s;
}

function buildTournamentSnapshot(t: Tournament, rebuiltAt: string): SiteTournamentListSnapshot {
  const regionSource = typeof t.location === "string" ? t.location.trim() : "";
  return {
    tournamentId: t.id,
    title: t.title?.trim() || "이름 없음",
    statusBadge: t.statusBadge,
    playScaleLabel: tournamentPlayScaleLabel(t),
    dateLabel: tournamentDateLabelForList(t),
    regionLabel: buildRegionLabelForSiteListSnapshot(regionSource),
    venueName: tournamentVenueDisplayNameFromLocation(regionSource),
    thumbnail160Url: resolveSiteImageListThumbnailUrl(t.posterImageUrl),
    detailUrl: `/site/tournaments/${t.id}`,
    sortDate: tournamentDeadlineSortValue(t),
    createdAt: t.createdAt,
    isVisibleOnSite: isEntityLifecycleVisibleForList(t.status),
    updatedAt: rebuiltAt,
  };
}

function isTournamentStatusBadge(v: unknown): v is TournamentStatusBadge {
  return (
    v === "모집중" ||
    v === "마감임박" ||
    v === "마감" ||
    v === "예정" ||
    v === "종료" ||
    v === "초안"
  );
}

function parseTournamentSnapshots(raw: unknown): SiteTournamentListSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SiteTournamentListSnapshot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const tournamentId = typeof o.tournamentId === "string" ? o.tournamentId.trim() : "";
    const title = typeof o.title === "string" ? o.title : "";
    if (!tournamentId || !title) return null;
    let statusBadge: TournamentStatusBadge;
    if (o.statusBadge === "대기자모집") {
      statusBadge = "모집중";
    } else if (!isTournamentStatusBadge(o.statusBadge)) {
      return null;
    } else {
      statusBadge = o.statusBadge;
    }
    const playScaleLabel = typeof o.playScaleLabel === "string" ? o.playScaleLabel : "";
    const dateLabel = typeof o.dateLabel === "string" ? o.dateLabel : "";
    const regionLabel = typeof o.regionLabel === "string" ? o.regionLabel : "";
    if (!("venueName" in o)) return null;
    const venueName = typeof o.venueName === "string" ? o.venueName : "";
    const thumbnail160Url =
      o.thumbnail160Url === null || typeof o.thumbnail160Url === "string" ? o.thumbnail160Url : null;
    const detailUrl = typeof o.detailUrl === "string" ? o.detailUrl : "";
    const sortDate = typeof o.sortDate === "string" ? o.sortDate : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
    const isVisibleOnSite = o.isVisibleOnSite === true;
    if (!detailUrl || !sortDate || !createdAt || !updatedAt) return null;
    out.push({
      tournamentId,
      title,
      statusBadge,
      playScaleLabel,
      dateLabel,
      regionLabel,
      venueName,
      thumbnail160Url,
      detailUrl,
      sortDate,
      createdAt,
      isVisibleOnSite,
      updatedAt,
    });
  }
  return out;
}

function isVenuePricingType(v: unknown): v is VenuePricingType {
  return v === "GENERAL" || v === "FLAT" || v === "MIXED";
}

function parseVenueSnapshots(raw: unknown): SiteVenueListSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SiteVenueListSnapshot[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") return null;
    const o = row as Record<string, unknown>;
    const venueId = typeof o.venueId === "string" ? o.venueId.trim() : "";
    const name = typeof o.name === "string" ? o.name : "";
    if (!venueId || !name) return null;
    const regionLabel = typeof o.regionLabel === "string" ? o.regionLabel : "";
    const thumbnail160Url =
      o.thumbnail160Url === null || typeof o.thumbnail160Url === "string" ? o.thumbnail160Url : null;
    const detailUrl = typeof o.detailUrl === "string" ? o.detailUrl : "";
    const lat = o.lat === null ? null : typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null;
    const lng = o.lng === null ? null : typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null;
    const venueCategory = o.venueCategory === "mixed" ? "mixed" : o.venueCategory === "daedae_only" ? "daedae_only" : null;
    if (!venueCategory) return null;
    if (!isVenuePricingType(o.pricingType)) return null;
    const catalogTypeLabel = typeof o.catalogTypeLabel === "string" ? o.catalogTypeLabel : "당구장";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
    const isVisibleOnSite = o.isVisibleOnSite === true;
    if (!detailUrl || !updatedAt) return null;
    out.push({
      venueId,
      name,
      regionLabel,
      thumbnail160Url,
      detailUrl,
      lat,
      lng,
      venueCategory,
      pricingType: o.pricingType,
      catalogTypeLabel: catalogTypeLabel || "당구장",
      isVisibleOnSite,
      updatedAt,
    });
  }
  return out;
}

export async function rebuildSitePublicTournamentListSnapshots(): Promise<void> {
  if (!isFirestoreUsersBackendConfigured()) return;
  const { listAllTournamentsFirestore } = await import("./firestore-tournaments");
  const list = await listAllTournamentsFirestore();
  const now = new Date().toISOString();
  const snapshots: SiteTournamentListSnapshot[] = list
    .map((t) => buildTournamentSnapshot(t, now))
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  await upsertPlatformKvJson(KV_TOURNAMENTS, snapshots);
}

export async function rebuildSitePublicVenueListSnapshots(): Promise<void> {
  if (!isFirestoreUsersBackendConfigured()) return;
  const { listApprovedClientOrganizationsFirestore } = await import("./firestore-client-applications");
  const orgs = await listApprovedClientOrganizationsFirestore({ status: "ACTIVE", clientType: "all" });
  const now = new Date().toISOString();
  const snapshots: SiteVenueListSnapshot[] = orgs
    .filter((org) => org.type === "VENUE")
    .filter((org) => org.approvalStatus === "APPROVED")
    .filter((org) => org.status === "ACTIVE")
    .filter((org) => org.isPublished)
    .filter((org) => org.setupCompleted)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((org) => {
      const ts = parseTypeSpecific("VENUE", org.typeSpecificJson ?? null);
      const vs = ts as VenueSpecific;
      const reps = normalizeRepresentativeImageUrls(vs.representativeImageUrls);
      const cover = org.coverImageUrl?.trim() ?? "";
      const venueCategory: "daedae_only" | "mixed" = vs.venueCategory === "mixed" ? "mixed" : "daedae_only";
      const pricingType = resolveVenuePricingType(vs);
      const road = org.address?.trim() ?? "";
      return {
        venueId: org.slug?.trim() || org.id,
        name: org.name?.trim() || "이름 없음",
        regionLabel: buildRegionLabelForSiteListSnapshot(road),
        thumbnail160Url: resolveSiteImageListThumbnailUrl(reps[0] || cover || "") ?? null,
        detailUrl: `/site/venues/${org.slug?.trim() || org.id}`,
        lat: org.latitude,
        lng: org.longitude,
        venueCategory,
        pricingType,
        catalogTypeLabel: "당구장",
        isVisibleOnSite: true,
        updatedAt: now,
      };
    });
  await upsertPlatformKvJson(KV_VENUES, snapshots);
}

export async function getSitePublicTournamentListSnapshotsWithLazyRebuild(): Promise<SiteTournamentListSnapshot[]> {
  if (!isFirestoreUsersBackendConfigured()) {
    return [];
  }
  const raw = await readPlatformKvJson(KV_TOURNAMENTS);
  if (raw != null) {
    const parsed = parseTournamentSnapshots(raw);
    if (parsed !== null) return parsed;
  }
  await rebuildSitePublicTournamentListSnapshots();
  const raw2 = await readPlatformKvJson(KV_TOURNAMENTS);
  const parsed2 = parseTournamentSnapshots(raw2);
  return parsed2 ?? [];
}

export async function getSitePublicVenueListSnapshotsWithLazyRebuild(): Promise<SiteVenueListSnapshot[]> {
  if (!isFirestoreUsersBackendConfigured()) {
    return [];
  }
  const raw = await readPlatformKvJson(KV_VENUES);
  if (raw != null) {
    const parsed = parseVenueSnapshots(raw);
    if (parsed !== null) return parsed;
  }
  await rebuildSitePublicVenueListSnapshots();
  const raw2 = await readPlatformKvJson(KV_VENUES);
  const parsed2 = parseVenueSnapshots(raw2);
  return parsed2 ?? [];
}

export function venueSnapshotsToBoardRows(snaps: SiteVenueListSnapshot[]): SiteVenueBoardRow[] {
  return snaps
    .filter((s) => s.isVisibleOnSite)
    .map((s) => {
      let feeCategory: "normal" | "flat" | null = null;
      if (s.pricingType === "GENERAL") feeCategory = "normal";
      else if (s.pricingType === "FLAT") feeCategory = "flat";
      else feeCategory = null;
      return {
        venueId: s.venueId,
        name: s.name,
        region: s.regionLabel,
        catalogTypeLabel: s.catalogTypeLabel || "당구장",
        venueCategory: s.venueCategory,
        feeCategory,
        pricingType: s.pricingType,
        introLine: null,
        thumbnailUrl: s.thumbnail160Url,
        address: null,
        phone: null,
        website: null,
        lat: s.lat,
        lng: s.lng,
      };
    });
}
