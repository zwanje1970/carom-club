import type { SlideDeckItem } from "../../app/site/tournament-snapshot-card-view";
import { normalizeEntityLifecycleStatus } from "../server/entity-lifecycle";

export type MainSlideAdRotationMode = "sequential" | "random";

export type MainSlideAdConfig = {
  enabled: boolean;
  insertInterval: number;
  adsPerInsert: number;
  rotationMode: MainSlideAdRotationMode;
  maxAdsPerCycle: number;
  /** 메인 슬라이드 카드 이동(자동) 한 사이클 기준 시간(초). 관리자 범위 5~20, 없음·비정상 시 10 */
  cardMoveDurationSec: number;
};

export const DEFAULT_MAIN_SLIDE_AD_CONFIG: MainSlideAdConfig = {
  enabled: false,
  insertInterval: 10,
  adsPerInsert: 1,
  rotationMode: "sequential",
  maxAdsPerCycle: 1,
  cardMoveDurationSec: 10,
};

/** 플랫폼 관리자 등록 메인 슬라이드 광고 row (로컬 aggregate 등) */
export type MainSiteSlideAd = {
  id: string;
  /** 슬라이드 카드 표시용(레거시); 없으면 `adName` 사용 */
  title?: string;
  adName?: string;
  advertiserName?: string;
  imageUrl: string;
  externalLink: string;
  isActive: boolean;
  startAt?: string | null;
  endAt?: string | null;
  /** 노출 가중치(선택) */
  weight?: number;
  impressions?: number;
  clicks?: number;
  createdAt?: string;
  updatedAt?: string;
  /** 소프트 삭제. 미설정은 ACTIVE */
  status?: "ACTIVE" | "DELETED";
  deletedAt?: string | null;
  deletedBy?: string | null;
  deleteReason?: string | null;
};

export function normalizeMainSlideAdConfig(raw: unknown): MainSlideAdConfig {
  const base = { ...DEFAULT_MAIN_SLIDE_AD_CONFIG };
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const def = DEFAULT_MAIN_SLIDE_AD_CONFIG;
  if (typeof r.enabled === "boolean") base.enabled = r.enabled;
  const ins = Number(r.insertInterval);
  if (Number.isFinite(ins)) {
    const f = Math.floor(ins);
    base.insertInterval = f < 0 ? def.insertInterval : f;
  }
  const ap = Number(r.adsPerInsert);
  if (Number.isFinite(ap)) {
    const f = Math.floor(ap);
    base.adsPerInsert = f < 0 ? def.adsPerInsert : f;
  }
  if (r.rotationMode === "random" || r.rotationMode === "sequential") {
    base.rotationMode = r.rotationMode;
  }
  const maxC = Number(r.maxAdsPerCycle);
  if (Number.isFinite(maxC)) {
    const f = Math.floor(maxC);
    base.maxAdsPerCycle = f < 0 ? def.maxAdsPerCycle : f;
  }
  const moveSec = Number(r.cardMoveDurationSec);
  if (Number.isFinite(moveSec)) {
    const rounded = Math.round(moveSec);
    base.cardMoveDurationSec = Math.min(20, Math.max(5, rounded));
  }
  return base;
}

function parseIsoMs(value: string | null | undefined): number | null {
  if (value == null || typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/** 활성 광고 판별: isActive, imageUrl, externalLink, 기간(startAt/endAt 선택 시만 구간 검사) */
export function isMainSiteSlideAdActiveAt(ad: MainSiteSlideAd, nowMs: number): boolean {
  if (normalizeEntityLifecycleStatus(ad.status) === "DELETED") return false;
  if (!ad.isActive) return false;
  const img = typeof ad.imageUrl === "string" ? ad.imageUrl.trim() : "";
  const link = typeof ad.externalLink === "string" ? ad.externalLink.trim() : "";
  if (!img || !link) return false;
  const startMs = parseIsoMs(ad.startAt ?? undefined);
  if (startMs != null && nowMs < startMs) return false;
  const endMs = parseIsoMs(ad.endAt ?? undefined);
  if (endMs != null && nowMs > endMs) return false;
  return true;
}

export function normalizeMainSiteSlideAdRow(row: unknown): MainSiteSlideAd | null {
  if (!row || typeof row !== "object") return null;
  const r = row as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl.trim() : "";
  const externalLink = typeof r.externalLink === "string" ? r.externalLink.trim() : "";
  if (!id || !imageUrl || !externalLink) return null;
  const isActive = typeof r.isActive === "boolean" ? r.isActive : false;
  const titleRaw = typeof r.title === "string" ? r.title.trim() : "";
  const title = titleRaw ? titleRaw : undefined;
  const adNameRaw = typeof r.adName === "string" ? r.adName.trim() : "";
  const adName = adNameRaw ? adNameRaw : undefined;
  const advRaw = typeof r.advertiserName === "string" ? r.advertiserName.trim() : "";
  const advertiserName = advRaw ? advRaw : undefined;
  const startAt = typeof r.startAt === "string" ? r.startAt : r.startAt === null ? null : undefined;
  const endAt = typeof r.endAt === "string" ? r.endAt : r.endAt === null ? null : undefined;
  const impressions =
    typeof r.impressions === "number" && Number.isFinite(r.impressions) ? Math.max(0, Math.floor(r.impressions)) : 0;
  const clicks = typeof r.clicks === "number" && Number.isFinite(r.clicks) ? Math.max(0, Math.floor(r.clicks)) : 0;
  const w = Number(r.weight);
  const weight = Number.isFinite(w) ? Math.max(0, Math.floor(w)) : undefined;
  const createdAtRaw = typeof r.createdAt === "string" ? r.createdAt.trim() : "";
  const createdAt = createdAtRaw ? createdAtRaw : undefined;
  const updatedAtRaw = typeof r.updatedAt === "string" ? r.updatedAt.trim() : "";
  const updatedAt = updatedAtRaw ? updatedAtRaw : undefined;
  const status: "ACTIVE" | "DELETED" = r.status === "DELETED" ? "DELETED" : "ACTIVE";
  const deletedAt =
    typeof r.deletedAt === "string" && r.deletedAt.trim() !== "" ? r.deletedAt.trim() : undefined;
  const deletedBy =
    typeof r.deletedBy === "string" && r.deletedBy.trim() !== "" ? r.deletedBy.trim() : undefined;
  const deleteReason = typeof r.deleteReason === "string" ? r.deleteReason : undefined;
  return {
    id,
    title,
    adName,
    advertiserName,
    imageUrl,
    externalLink,
    isActive,
    startAt,
    endAt,
    status,
    ...(deletedAt ? { deletedAt } : {}),
    ...(deletedBy ? { deletedBy } : {}),
    ...(deleteReason !== undefined && deleteReason !== "" ? { deleteReason } : {}),
    ...(weight !== undefined ? { weight } : {}),
    impressions,
    clicks,
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

/**
 * 플랫폼 관리자가 보낸 광고 배열을 저장용으로 병합한다.
 * `id`·`imageUrl`·`externalLink`가 비어 있으면 해당 행은 **저장 목록에서 제외**한다.
 * `impressions` / `clicks`는 요청에 숫자가 없으면 기존 저장분을 유지한다.
 */
export function mergeMainSiteSlideAdsFromAdminPayload(
  incomingRows: unknown[],
  previousAds: MainSiteSlideAd[],
): MainSiteSlideAd[] {
  const prevById = new Map(previousAds.map((a) => [a.id, a]));
  const nowIso = new Date().toISOString();
  const out: MainSiteSlideAd[] = [];

  for (const row of incomingRows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    const imageUrl = typeof r.imageUrl === "string" ? r.imageUrl.trim() : "";
    const externalLink = typeof r.externalLink === "string" ? r.externalLink.trim() : "";
    if (!id || !imageUrl || !externalLink) continue;

    const prev = prevById.get(id);
    const impressions =
      "impressions" in r && typeof r.impressions === "number" && Number.isFinite(r.impressions)
        ? Math.max(0, Math.floor(r.impressions))
        : Math.max(0, prev?.impressions ?? 0);
    const clicks =
      "clicks" in r && typeof r.clicks === "number" && Number.isFinite(r.clicks)
        ? Math.max(0, Math.floor(r.clicks))
        : Math.max(0, prev?.clicks ?? 0);

    const isActive = typeof r.isActive === "boolean" ? r.isActive : false;
    const adNameRaw = typeof r.adName === "string" ? r.adName.trim() : "";
    const adName = adNameRaw || prev?.adName;
    const advRaw = typeof r.advertiserName === "string" ? r.advertiserName.trim() : "";
    const advertiserName = advRaw || prev?.advertiserName;
    const titleRaw = typeof r.title === "string" ? r.title.trim() : "";
    const title = titleRaw || prev?.title;
    const startAt =
      "startAt" in r
        ? typeof r.startAt === "string"
          ? r.startAt
          : r.startAt === null
            ? null
            : prev?.startAt
        : prev?.startAt;
    const endAt =
      "endAt" in r
        ? typeof r.endAt === "string"
          ? r.endAt
          : r.endAt === null
            ? null
            : prev?.endAt
        : prev?.endAt;

    const wIn = Number(r.weight);
    const weight =
      "weight" in r && Number.isFinite(wIn)
        ? Math.max(0, Math.floor(wIn))
        : prev?.weight !== undefined
          ? prev.weight
          : 0;

    const createdAt =
      typeof r.createdAt === "string" && r.createdAt.trim()
        ? r.createdAt.trim()
        : prev?.createdAt ?? nowIso;

    const status: "ACTIVE" | "DELETED" =
      "status" in r && r.status === "DELETED" ? "DELETED" : "status" in r && r.status === "ACTIVE" ? "ACTIVE" : normalizeEntityLifecycleStatus(prev?.status);
    const deletedAt =
      "deletedAt" in r
        ? typeof r.deletedAt === "string" && r.deletedAt.trim() !== ""
          ? r.deletedAt.trim()
          : undefined
        : prev?.deletedAt ?? undefined;
    const deletedBy =
      "deletedBy" in r
        ? typeof r.deletedBy === "string" && r.deletedBy.trim() !== ""
          ? r.deletedBy.trim()
          : undefined
        : prev?.deletedBy ?? undefined;
    const deleteReason =
      "deleteReason" in r && typeof r.deleteReason === "string"
        ? r.deleteReason
        : prev?.deleteReason ?? undefined;

    out.push({
      id,
      ...(title ? { title } : {}),
      ...(adName ? { adName } : {}),
      ...(advertiserName ? { advertiserName } : {}),
      imageUrl,
      externalLink,
      isActive,
      status,
      ...(deletedAt ? { deletedAt } : {}),
      ...(deletedBy ? { deletedBy } : {}),
      ...(deleteReason !== undefined && deleteReason !== "" ? { deleteReason } : {}),
      ...(startAt !== undefined ? { startAt } : {}),
      ...(endAt !== undefined ? { endAt } : {}),
      weight,
      impressions,
      clicks,
      createdAt,
      updatedAt: nowIso,
    });
  }
  return out;
}

function adToSlideDeckItem(ad: MainSiteSlideAd): SlideDeckItem {
  const title = (ad.adName ?? ad.title ?? "").trim() || "광고";
  return {
    type: "ad",
    linkType: "external",
    snapshotId: `main-slide-ad:${ad.id}`,
    mainSlideAdId: ad.id,
    title,
    subtitle: " · ",
    targetDetailUrl: ad.externalLink.trim(),
    image320Url: ad.imageUrl.trim(),
    statusBadge: "진행",
    cardExtraLine1: "",
    cardExtraLine2: null,
    cardExtraLine3: null,
    cardTemplate: "A",
    backgroundType: "image",
    themeType: "dark",
  };
}

function tournamentItemWithMeta(t: SlideDeckItem): SlideDeckItem {
  const { type: _t, linkType: _l, ...rest } = t;
  return {
    ...rest,
    type: "tournament",
    linkType: "internal",
  };
}

/** 노출 가중치: 없음·NaN·0 이하 → 1 */
function effectiveMainSlideAdWeight(ad: MainSiteSlideAd): number {
  const w = ad.weight;
  if (typeof w !== "number" || !Number.isFinite(w) || w <= 0) return 1;
  return Math.floor(w);
}

function pickWeightedRandomMainSlideAd(ads: MainSiteSlideAd[], rng: () => number): MainSiteSlideAd | null {
  if (ads.length === 0) return null;
  const weights = ads.map((a) => effectiveMainSlideAdWeight(a));
  const total = weights.reduce((s, x) => s + x, 0);
  if (total <= 0) {
    const idx = Math.floor(rng() * ads.length);
    return ads[idx]!;
  }
  let pick = Math.floor(rng() * total);
  if (pick >= total) pick = total - 1;
  let acc = 0;
  for (let i = 0; i < ads.length; i += 1) {
    acc += weights[i]!;
    if (pick < acc) return ads[i]!;
  }
  return ads[ads.length - 1]!;
}

/**
 * 대회 카드 스트림에 광고를 삽입한다.
 * enabled·간격·개수·max·활성 광고 없음이면 대회만(타입 메타만 보강) 반환.
 */
export function mergeTournamentAndAdSlideDeckItems(
  tournamentItems: SlideDeckItem[],
  activeAdsInOrder: MainSiteSlideAd[],
  config: MainSlideAdConfig,
  rng: () => number = () => Math.random(),
): SlideDeckItem[] {
  const base = tournamentItems.map(tournamentItemWithMeta);
  const {
    enabled,
    insertInterval,
    adsPerInsert,
    rotationMode,
    maxAdsPerCycle,
  } = config;

  if (
    !enabled ||
    insertInterval <= 0 ||
    adsPerInsert <= 0 ||
    maxAdsPerCycle <= 0 ||
    activeAdsInOrder.length === 0
  ) {
    return base;
  }

  const adsForPick =
    rotationMode === "sequential"
      ? [...activeAdsInOrder].sort((a, b) => {
          const dw = effectiveMainSlideAdWeight(b) - effectiveMainSlideAdWeight(a);
          if (dw !== 0) return dw;
          return 0;
        })
      : activeAdsInOrder;

  let seqCursor = 0;
  let adsInserted = 0;
  const out: SlideDeckItem[] = [];
  let sinceInsert = 0;

  const pickAd = (): MainSiteSlideAd | null => {
    if (adsForPick.length === 0) return null;
    if (rotationMode === "random") {
      return pickWeightedRandomMainSlideAd(adsForPick, rng);
    }
    const ad = adsForPick[seqCursor % adsForPick.length]!;
    seqCursor += 1;
    return ad;
  };

  for (const tItem of base) {
    out.push(tItem);
    sinceInsert += 1;
    if (adsInserted >= maxAdsPerCycle) continue;
    if (sinceInsert < insertInterval) continue;
    sinceInsert = 0;
    for (let k = 0; k < adsPerInsert; k += 1) {
      if (adsInserted >= maxAdsPerCycle) break;
      const ad = pickAd();
      if (!ad) break;
      adsInserted += 1;
      out.push(adToSlideDeckItem(ad));
    }
  }
  return out;
}
