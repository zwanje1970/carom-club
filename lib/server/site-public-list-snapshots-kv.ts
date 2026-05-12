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
import {
  buildSitePublicImageUrl,
  loadProofImageAssetsList,
  type ProofImageAsset,
  type SiteVenueBoardRow,
  type TournamentStatusBadge,
} from "./platform-backing-store";
import {
  normalizeRepresentativeImageUrls,
  parseTypeSpecific,
  resolveVenuePricingType,
} from "../client-organization-setup-parse";
import type { VenuePricingType, VenueSpecific } from "../client-organization-setup-types";
import { resolveSiteListThumbnailFromPosterWithAssetMap } from "../site-image-list-thumbnail";
import { isEntityLifecycleVisibleForList } from "./entity-lifecycle";

const KV_TOURNAMENTS: PlatformKvSettingKey = PLATFORM_KV_KEYS.sitePublicTournamentListSnapshots;
const KV_VENUES: PlatformKvSettingKey = PLATFORM_KV_KEYS.sitePublicVenueListSnapshots;

const isSitePublicListDevLog = process.env.NODE_ENV === "development";

function warnSkippedTournamentSnapshotRow(reason: string, detail: unknown): void {
  if (!isSitePublicListDevLog) return;
  console.warn(`[site-public-list-snapshots-kv] 대회 목록 스냅샷 행 제외: ${reason}`, detail);
}

function warnSkippedVenueSnapshotRow(reason: string, detail: unknown): void {
  if (!isSitePublicListDevLog) return;
  console.warn(`[site-public-list-snapshots-kv] 클럽 목록 스냅샷 행 제외: ${reason}`, detail);
}

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

/** 대회 `rule`만 사용 — 목록에서 추가 조회 없음 */
function tournamentTypeLabelForSnapshot(t: Pick<Tournament, "rule">): string {
  const r = t.rule;
  if (r.isScotch === true) return "스카치";
  if (r.nationalTournament === true || r.scope === "NATIONAL") return "권역";
  return "일반";
}

/** `prizeInfo`의 `우승:` 줄 — 숫자만이면 "1등 N만" 형태(만원 단위 입력과 동일 가정) */
function tournamentFirstPrizeLabelFromPrizeInfo(prizeInfo: string | null | undefined): string {
  if (!prizeInfo?.trim()) return "";
  for (const line of String(prizeInfo).split(/\r?\n/)) {
    const t = line.trim();
    const m = /^우승\s*:\s*(.+)$/i.exec(t);
    if (!m) continue;
    const raw = (m[1] ?? "").trim();
    if (!raw) return "";
    if (/^\d+$/.test(raw)) return `1등 ${raw}만`;
    if (/만원?$/.test(raw)) return `1등 ${raw.replace(/\s*만원?\s*$/i, "").trim()}만`;
    return `1등 ${raw}`;
  }
  return "";
}

function tournamentDeadlineLabelFromGathering(gatheringTime: string | null | undefined): string {
  return typeof gatheringTime === "string" ? gatheringTime.trim() : "";
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

function buildTournamentSnapshot(
  t: Tournament,
  rebuiltAt: string,
  assetsById: ReadonlyMap<string, ProofImageAsset>,
): SiteTournamentListSnapshot {
  const regionSource = typeof t.location === "string" ? t.location.trim() : "";
  return {
    tournamentId: t.id,
    title: t.title?.trim() || "이름 없음",
    statusBadge: t.statusBadge,
    playScaleLabel: tournamentPlayScaleLabel(t),
    tournamentTypeLabel: tournamentTypeLabelForSnapshot(t),
    firstPrizeLabel: tournamentFirstPrizeLabelFromPrizeInfo(t.prizeInfo),
    deadlineLabel: tournamentDeadlineLabelFromGathering(t.gatheringTime ?? null),
    dateLabel: tournamentDateLabelForList(t),
    regionLabel: buildRegionLabelForSiteListSnapshot(regionSource),
    venueName: tournamentVenueDisplayNameFromLocation(regionSource),
    thumbnail160Url: resolveSiteListThumbnailFromPosterWithAssetMap(t.posterImageUrl, assetsById, buildSitePublicImageUrl),
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
    v === "진행중" ||
    v === "예정" ||
    v === "종료" ||
    v === "초안"
  );
}

/** KV 한 행 → 스냅샷. 실패 시 null(호출부에서 행만 제외). */
function parseOneTournamentSnapshotRow(row: unknown, index: number): SiteTournamentListSnapshot | null {
  if (!row || typeof row !== "object") {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: 객체 아님`, row);
    return null;
  }
  const o = row as Record<string, unknown>;
  const tournamentId = typeof o.tournamentId === "string" ? o.tournamentId.trim() : "";
  const title = typeof o.title === "string" ? o.title : "";
  if (!tournamentId || !title) {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: tournamentId 또는 title 없음`, {
      tournamentId: tournamentId || "(비어 있음)",
    });
    return null;
  }
  let statusBadge: TournamentStatusBadge;
  if (o.statusBadge === "대기자모집") {
    statusBadge = "모집중";
  } else if (!isTournamentStatusBadge(o.statusBadge)) {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: statusBadge 허용 범위 아님`, {
      tournamentId,
      statusBadge: o.statusBadge,
    });
    return null;
  } else {
    statusBadge = o.statusBadge;
  }
  const playScaleLabel = typeof o.playScaleLabel === "string" ? o.playScaleLabel : "";
  const tournamentTypeLabel = typeof o.tournamentTypeLabel === "string" ? o.tournamentTypeLabel : "";
  const firstPrizeLabel = typeof o.firstPrizeLabel === "string" ? o.firstPrizeLabel : "";
  const deadlineLabel = typeof o.deadlineLabel === "string" ? o.deadlineLabel : "";
  const dateLabel = typeof o.dateLabel === "string" ? o.dateLabel : "";
  const regionLabel = typeof o.regionLabel === "string" ? o.regionLabel : "";
  const venueName = typeof o.venueName === "string" ? o.venueName : "";
  if (!("venueName" in o) && isSitePublicListDevLog) {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: venueName 필드 없음(빈 문자열로 처리)`, { tournamentId });
  }
  if (!(o.thumbnail160Url === null || typeof o.thumbnail160Url === "string")) {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: thumbnail160Url 타입 오류`, { tournamentId });
    return null;
  }
  const thumbnail160Url =
    o.thumbnail160Url === null || typeof o.thumbnail160Url === "string" ? o.thumbnail160Url : null;
  const detailUrl = typeof o.detailUrl === "string" ? o.detailUrl : "";
  const sortDate = typeof o.sortDate === "string" ? o.sortDate : "";
  const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const isVisibleOnSite = o.isVisibleOnSite === true;
  if (!detailUrl || !sortDate || !createdAt || !updatedAt) {
    warnSkippedTournamentSnapshotRow(`인덱스 ${index}: detailUrl/sortDate/createdAt/updatedAt 누락`, {
      tournamentId,
      hasDetailUrl: Boolean(detailUrl),
      hasSortDate: Boolean(sortDate),
      hasCreatedAt: Boolean(createdAt),
      hasUpdatedAt: Boolean(updatedAt),
    });
    return null;
  }
  return {
    tournamentId,
    title,
    statusBadge,
    playScaleLabel,
    tournamentTypeLabel,
    firstPrizeLabel,
    deadlineLabel,
    dateLabel,
    regionLabel,
    venueName,
    thumbnail160Url,
    detailUrl,
    sortDate,
    createdAt,
    isVisibleOnSite,
    updatedAt,
  };
}

/**
 * KV 대회 목록 JSON 파싱.
 * - 최상위가 배열이 아니면 `null`(lazy rebuild로 처리).
 * - 배열이면 행 단위로 파싱하며, 깨진 행만 제외하고 나머지를 반환(전체 null 없음).
 */
function parseTournamentSnapshots(raw: unknown): SiteTournamentListSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SiteTournamentListSnapshot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const one = parseOneTournamentSnapshotRow(raw[i], i);
    if (one) out.push(one);
  }
  return out;
}

function isVenuePricingType(v: unknown): v is VenuePricingType {
  return v === "GENERAL" || v === "FLAT" || v === "MIXED";
}

function parseOneVenueSnapshotRow(row: unknown, index: number): SiteVenueListSnapshot | null {
  if (!row || typeof row !== "object") {
    warnSkippedVenueSnapshotRow(`인덱스 ${index}: 객체 아님`, row);
    return null;
  }
  const o = row as Record<string, unknown>;
  const venueId = typeof o.venueId === "string" ? o.venueId.trim() : "";
  const name = typeof o.name === "string" ? o.name : "";
  if (!venueId || !name) {
    warnSkippedVenueSnapshotRow(`인덱스 ${index}: venueId 또는 name 없음`, {
      venueId: venueId || "(비어 있음)",
    });
    return null;
  }
  const regionLabel = typeof o.regionLabel === "string" ? o.regionLabel : "";
  const thumbnail160Url =
    o.thumbnail160Url === null || typeof o.thumbnail160Url === "string" ? o.thumbnail160Url : null;
  const detailUrl = typeof o.detailUrl === "string" ? o.detailUrl : "";
  const lat = o.lat === null ? null : typeof o.lat === "number" && Number.isFinite(o.lat) ? o.lat : null;
  const lng = o.lng === null ? null : typeof o.lng === "number" && Number.isFinite(o.lng) ? o.lng : null;
  const venueCategory = o.venueCategory === "mixed" ? "mixed" : o.venueCategory === "daedae_only" ? "daedae_only" : null;
  if (!venueCategory) {
    warnSkippedVenueSnapshotRow(`인덱스 ${index}: venueCategory 허용 값 아님`, {
      venueId,
      venueCategory: o.venueCategory,
    });
    return null;
  }
  const pt = o.pricingType;
  if (!isVenuePricingType(pt)) {
    warnSkippedVenueSnapshotRow(`인덱스 ${index}: pricingType 허용 값 아님`, { venueId, pricingType: pt });
    return null;
  }
  const catalogTypeLabel = typeof o.catalogTypeLabel === "string" ? o.catalogTypeLabel : "당구장";
  const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
  const isVisibleOnSite = o.isVisibleOnSite === true;
  if (!detailUrl || !updatedAt) {
    warnSkippedVenueSnapshotRow(`인덱스 ${index}: detailUrl 또는 updatedAt 누락`, {
      venueId,
      hasDetailUrl: Boolean(detailUrl),
      hasUpdatedAt: Boolean(updatedAt),
    });
    return null;
  }
  return {
    venueId,
    name,
    regionLabel,
    thumbnail160Url,
    detailUrl,
    lat,
    lng,
    venueCategory,
    pricingType: pt,
    catalogTypeLabel: catalogTypeLabel || "당구장",
    isVisibleOnSite,
    updatedAt,
  };
}

/**
 * KV 클럽 목록 JSON 파싱.
 * - 최상위가 배열이 아니면 `null`(lazy rebuild로 처리).
 * - 배열이면 행 단위로 파싱하며, 깨진 행만 제외하고 나머지를 반환.
 */
function parseVenueSnapshots(raw: unknown): SiteVenueListSnapshot[] | null {
  if (!Array.isArray(raw)) return null;
  const out: SiteVenueListSnapshot[] = [];
  for (let i = 0; i < raw.length; i++) {
    const one = parseOneVenueSnapshotRow(raw[i], i);
    if (one) out.push(one);
  }
  return out;
}

function mapSanitizeTournamentThumbnails(
  snaps: SiteTournamentListSnapshot[],
  byId: ReadonlyMap<string, ProofImageAsset>,
): SiteTournamentListSnapshot[] {
  return snaps.map((s) => ({
    ...s,
    thumbnail160Url:
      s.thumbnail160Url == null
        ? null
        : resolveSiteListThumbnailFromPosterWithAssetMap(s.thumbnail160Url, byId, buildSitePublicImageUrl),
  }));
}

function mapSanitizeVenueThumbnails(
  snaps: SiteVenueListSnapshot[],
  byId: ReadonlyMap<string, ProofImageAsset>,
): SiteVenueListSnapshot[] {
  return snaps.map((s) => ({
    ...s,
    thumbnail160Url:
      s.thumbnail160Url == null
        ? null
        : resolveSiteListThumbnailFromPosterWithAssetMap(s.thumbnail160Url, byId, buildSitePublicImageUrl),
  }));
}

export async function rebuildSitePublicTournamentListSnapshots(
  preloadedAssetsById?: ReadonlyMap<string, ProofImageAsset>,
): Promise<void> {
  if (!isFirestoreUsersBackendConfigured()) return;
  const assetsById =
    preloadedAssetsById ?? new Map((await loadProofImageAssetsList()).map((a) => [a.id, a]));
  const { listAllTournamentsFirestore } = await import("./firestore-tournaments");
  const list = await listAllTournamentsFirestore();
  const now = new Date().toISOString();
  const snapshots: SiteTournamentListSnapshot[] = list
    .map((t) => buildTournamentSnapshot(t, now, assetsById))
    .sort((a, b) => a.sortDate.localeCompare(b.sortDate));
  await upsertPlatformKvJson(KV_TOURNAMENTS, snapshots);
}

export async function rebuildSitePublicVenueListSnapshots(
  preloadedAssetsById?: ReadonlyMap<string, ProofImageAsset>,
): Promise<void> {
  if (!isFirestoreUsersBackendConfigured()) return;
  const assetsById =
    preloadedAssetsById ?? new Map((await loadProofImageAssetsList()).map((a) => [a.id, a]));
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
        thumbnail160Url:
          resolveSiteListThumbnailFromPosterWithAssetMap(reps[0] || cover || "", assetsById, buildSitePublicImageUrl) ??
          null,
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
  const assetsById = new Map((await loadProofImageAssetsList()).map((a) => [a.id, a]));
  const raw = await readPlatformKvJson(KV_TOURNAMENTS);
  if (raw != null) {
    const parsed = parseTournamentSnapshots(raw);
    if (parsed !== null) {
      const rawArr = Array.isArray(raw) ? raw : [];
      const allRowsDropped = rawArr.length > 0 && parsed.length === 0;
      if (!allRowsDropped) {
        return mapSanitizeTournamentThumbnails(parsed, assetsById);
      }
    }
  }
  await rebuildSitePublicTournamentListSnapshots(assetsById);
  const raw2 = await readPlatformKvJson(KV_TOURNAMENTS);
  const parsed2 = parseTournamentSnapshots(raw2);
  return parsed2 !== null ? mapSanitizeTournamentThumbnails(parsed2, assetsById) : [];
}

export async function getSitePublicVenueListSnapshotsWithLazyRebuild(): Promise<SiteVenueListSnapshot[]> {
  if (!isFirestoreUsersBackendConfigured()) {
    return [];
  }
  const assetsById = new Map((await loadProofImageAssetsList()).map((a) => [a.id, a]));
  const raw = await readPlatformKvJson(KV_VENUES);
  if (raw != null) {
    const parsed = parseVenueSnapshots(raw);
    if (parsed !== null) {
      const rawArr = Array.isArray(raw) ? raw : [];
      const allRowsDropped = rawArr.length > 0 && parsed.length === 0;
      if (!allRowsDropped) {
        return mapSanitizeVenueThumbnails(parsed, assetsById);
      }
    }
  }
  await rebuildSitePublicVenueListSnapshots(assetsById);
  const raw2 = await readPlatformKvJson(KV_VENUES);
  const parsed2 = parseVenueSnapshots(raw2);
  return parsed2 !== null ? mapSanitizeVenueThumbnails(parsed2, assetsById) : [];
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
