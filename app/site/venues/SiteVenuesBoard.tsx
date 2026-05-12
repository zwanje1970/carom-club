"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FilterButton from "../components/FilterButton";
import FilterDropdown from "../components/FilterDropdown";
import SiteShellFrame from "../components/SiteShellFrame";
import SiteListImage160 from "../components/SiteListImage160";
import filterStyles from "../components/filter-controls.module.css";
import {
  confirmSiteGeolocationPrecursor,
  fetchViewerCoordinatesOnce,
  SITE_GEO_DENIED_USER_MESSAGE,
} from "../lib/site-geolocation-flow";
import { buildVenuesListHref } from "./venues-list-url";
import { buildVenuesListScrollSignature } from "./venues-list-scroll-signature";

export type SiteVenueBoardRow = {
  venueId: string;
  name: string;
  region: string;
  catalogTypeLabel: string;
  venueCategory: "daedae_only" | "mixed";
  feeCategory: "normal" | "flat" | null;
  pricingType: "GENERAL" | "FLAT" | "MIXED";
  introLine: string | null;
  thumbnailUrl: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
};

function distanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function categoryLabel(v: SiteVenueBoardRow["venueCategory"]): string {
  if (v === "daedae_only") return "대대전용";
  if (v === "mixed") return "복합구장";
  return "";
}

/** 스냅샷 `pricingType` 기준(시간·요일 없음). FLAT만 정액제, GENERAL·MIXED는 일반요금. */
function feeChipKeyFromPricingType(pt: SiteVenueBoardRow["pricingType"]): "general" | "flat" {
  return pt === "FLAT" ? "flat" : "general";
}

function feeLabelFromPricingType(pt: SiteVenueBoardRow["pricingType"]): string {
  return pt === "FLAT" ? "정액제" : "일반요금";
}

function formatDistanceKmFromMeters(meters: number): string {
  return `${(meters / 1000).toFixed(1)}km`;
}

type VenueTypeFilter = "all" | "daedae_only" | "mixed";
type FeeTypeFilter = "all" | "normal" | "flat";

const VENUE_TYPE_OPTIONS: { value: VenueTypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "daedae_only", label: "대대전용" },
  { value: "mixed", label: "복합구장" },
];

const FEE_TYPE_OPTIONS: { value: FeeTypeFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "normal", label: "일반요금" },
  { value: "flat", label: "정액제" },
];

const VENUES_SCROLL_STORAGE_KEY = "carom.site.venues.scrollY";

function readVenuesListScroll(signature: string): { scrollY: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(VENUES_SCROLL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { signature?: unknown; scrollY?: unknown };
    if (parsed.signature !== signature || typeof parsed.scrollY !== "number") return null;
    return { scrollY: parsed.scrollY };
  } catch {
    return null;
  }
}

function writeVenuesListScroll(signature: string, scrollY: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      VENUES_SCROLL_STORAGE_KEY,
      JSON.stringify({ signature, scrollY: Math.max(0, scrollY) }),
    );
  } catch {
    /* ignore */
  }
}

function shouldSaveScrollBeforeDetailNavigate(ev: React.MouseEvent): boolean {
  if (ev.defaultPrevented) return false;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
  if (ev.button !== 0) return false;
  return true;
}

type Props = {
  initialRows: SiteVenueBoardRow[];
};

export default function SiteVenuesBoard({ initialRows }: Props) {
  const [memoryCoords, setMemoryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showDeniedHint, setShowDeniedHint] = useState(false);
  const [geoBusy, setGeoBusy] = useState(false);
  const [venueType, setVenueType] = useState<VenueTypeFilter>("all");
  const [feeType, setFeeType] = useState<FeeTypeFilter>("all");

  useEffect(() => {
    return () => {
      setMemoryCoords(null);
      setShowDeniedHint(false);
      setGeoBusy(false);
    };
  }, []);

  const filtered = useMemo(() => {
    if (venueType === "all" && feeType === "all") {
      return initialRows;
    }
    return initialRows.filter((row) => {
      if (venueType !== "all") {
        if (row.venueCategory !== venueType) return false;
      }
      if (feeType !== "all") {
        const pt = row.pricingType;
        if (feeType === "normal") {
          if (pt !== "GENERAL" && pt !== "MIXED") return false;
        } else if (feeType === "flat") {
          if (pt !== "FLAT" && pt !== "MIXED") return false;
        }
      }
      return true;
    });
  }, [initialRows, venueType, feeType]);

  const ordered = useMemo(() => {
    let list = [...filtered];

    if (memoryCoords) {
      const withDistance = list.map((row, index) => {
        const d =
          row.lat != null && row.lng != null
            ? distanceMeters(memoryCoords, { lat: row.lat, lng: row.lng })
            : Number.POSITIVE_INFINITY;
        return { row, index, distance: d };
      });
      const hasFinite = withDistance.some((x) => Number.isFinite(x.distance));
      if (hasFinite) {
        withDistance.sort((a, b) => {
          if (a.distance === b.distance) return a.index - b.index;
          return a.distance - b.distance;
        });
        list = withDistance.map((x) => x.row);
      }
    }

    return list;
  }, [filtered, memoryCoords]);

  const listScrollSignature = useMemo(
    () =>
      buildVenuesListScrollSignature({
        venueType,
        feeType,
        distanceLat: memoryCoords?.lat ?? null,
        distanceLng: memoryCoords?.lng ?? null,
      }),
    [venueType, feeType, memoryCoords],
  );

  const didRestoreForSignatureRef = useRef<string | null>(null);

  const saveScrollBeforeDetail = useCallback(() => {
    writeVenuesListScroll(listScrollSignature, window.scrollY || window.pageYOffset || 0);
  }, [listScrollSignature]);

  useEffect(() => {
    if (ordered.length === 0) return;
    if (didRestoreForSignatureRef.current === listScrollSignature) return;
    const stored = readVenuesListScroll(listScrollSignature);
    didRestoreForSignatureRef.current = listScrollSignature;
    if (!stored) return;
    const y = stored.scrollY;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
  }, [ordered.length, listScrollSignature]);

  const distanceHref = `/site/venues${buildVenuesListHref({})}`;

  const onDistanceClick = useCallback(
    async (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (geoBusy) return;
      const isRefresh = memoryCoords != null;
      if (!isRefresh) {
        if (!confirmSiteGeolocationPrecursor()) return;
      }
      setGeoBusy(true);
      setShowDeniedHint(false);
      const c = await fetchViewerCoordinatesOnce();
      setGeoBusy(false);
      if (c) {
        setMemoryCoords(c);
        setShowDeniedHint(false);
      } else {
        setMemoryCoords(null);
        setShowDeniedHint(true);
      }
    },
    [geoBusy, memoryCoords],
  );

  const auxiliary = (
    <div
      className={`site-venues-list-filters site-list-filter-bar ${filterStyles.filterRow} ${filterStyles.filterRowSingle} ${filterStyles.filterRowSingleDouble} ${filterStyles.filterRowFilterPack}`}
    >
      <div className={filterStyles.filterField}>
        <span
          className={`${filterStyles.filterFieldLabel} site-list-filter-label`}
          id="site-venues-filter-venue-type-label"
        >
          유형
        </span>
        <FilterDropdown
          id="site-venues-filter-venue-type"
          className={filterStyles.dropdownFlex}
          value={venueType}
          onChange={(e) => setVenueType(e.target.value as VenueTypeFilter)}
          aria-labelledby="site-venues-filter-venue-type-label"
        >
          {VENUE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterDropdown>
      </div>
      <div className={filterStyles.filterField}>
        <span
          className={`${filterStyles.filterFieldLabel} site-list-filter-label`}
          id="site-venues-filter-fee-type-label"
        >
          요금제
        </span>
        <FilterDropdown
          id="site-venues-filter-fee-type"
          className={filterStyles.dropdownFlex}
          value={feeType}
          onChange={(e) => setFeeType(e.target.value as FeeTypeFilter)}
          aria-labelledby="site-venues-filter-fee-type-label"
        >
          {FEE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterDropdown>
      </div>
      <FilterButton
        className={[
          filterStyles.buttonDistance,
          memoryCoords != null ? filterStyles.buttonDistanceActive : "",
          "site-list-filter-distance-btn",
        ]
          .filter(Boolean)
          .join(" ")}
        href={distanceHref}
        useNextLink={false}
        onClick={(e) => {
          void onDistanceClick(e);
        }}
      >
        거리순
      </FilterButton>
    </div>
  );

  return (
    <SiteShellFrame brandTitle="클럽안내" auxiliaryBarClassName="site-shell-controls--site-list" auxiliary={auxiliary}>
      <section className="site-site-gray-main v3-stack site-venues-list-page">
        {showDeniedHint ? (
          <p role="status" className="v3-muted site-list-geo-hint">
            {SITE_GEO_DENIED_USER_MESSAGE}
          </p>
        ) : null}
        <ul className="site-board-card-list site-site-list--venues" style={{ margin: 0 }}>
          {ordered.map((row) => {
            const region = String(row.region ?? "").trim();
            const dm =
              memoryCoords && row.lat != null && row.lng != null
                ? distanceMeters(memoryCoords, { lat: row.lat, lng: row.lng })
                : null;
            const distStr = dm != null && Number.isFinite(dm) ? formatDistanceKmFromMeters(dm) : null;
            const distPart =
              memoryCoords && row.lat != null && row.lng != null
                ? distStr
                : memoryCoords
                  ? "—"
                  : null;
            const cat = categoryLabel(row.venueCategory);
            const fee = feeLabelFromPricingType(row.pricingType);
            const feeKey = feeChipKeyFromPricingType(row.pricingType);
            return (
              <li key={row.venueId} className="site-board-card site-board-card--venue">
                <Link
                  prefetch={false}
                  className="site-venue-list-link"
                  href={`/site/venues/${row.venueId}`}
                  onClick={(ev) => {
                    if (!shouldSaveScrollBeforeDetailNavigate(ev)) return;
                    saveScrollBeforeDetail();
                  }}
                >
                  <div className="site-venue-list-thumb">
                    {row.thumbnailUrl ? (
                      <SiteListImage160
                        src={row.thumbnailUrl}
                        alt=""
                        placeholderClassName="site-venue-list-thumb-placeholder"
                      />
                    ) : (
                      <div className="site-venue-list-thumb-placeholder" aria-hidden />
                    )}
                  </div>
                  <div className="site-venue-card-main">
                    <span className="site-venue-card-title">{row.name}</span>
                    {cat || fee ? (
                      <div className="site-venue-chips">
                        {cat ? (
                          <span className={`site-list-chip site-venue-chip--cat-${row.venueCategory}`}>{cat}</span>
                        ) : null}
                        {fee ? (
                          <span className={`site-list-chip site-venue-chip--fee-${feeKey}`}>{fee}</span>
                        ) : null}
                      </div>
                    ) : null}
                    {region ? <span className="site-venue-address">{region}</span> : null}
                    {row.phone?.trim() ? (
                      <a className="site-venue-phone" href={`tel:${row.phone.trim().replace(/\s+/g, "")}`}>
                        {row.phone.trim()}
                      </a>
                    ) : null}
                  </div>
                  <div className="site-venue-list-trail">
                    <span className="site-venue-fav-slot" aria-hidden>
                      ☆
                    </span>
                    {distPart != null ? <span className="site-venue-distance">{distPart}</span> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>

        {ordered.length === 0 ? (
          <p className="v3-muted site-list-empty-hint">
            {initialRows.length === 0 ? "등록된 클럽이 없습니다." : "조건에 맞는 당구장이 없습니다."}
          </p>
        ) : null}
      </section>
    </SiteShellFrame>
  );
}
