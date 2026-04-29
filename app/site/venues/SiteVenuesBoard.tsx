"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import FilterButton from "../components/FilterButton";
import FilterDropdown from "../components/FilterDropdown";
import SiteShellFrame from "../components/SiteShellFrame";
import filterStyles from "../components/filter-controls.module.css";
import {
  confirmSiteGeolocationPrecursor,
  fetchViewerCoordinatesOnce,
  SITE_GEO_DENIED_USER_MESSAGE,
} from "../lib/site-geolocation-flow";
import { buildVenuesListHref } from "./venues-list-url";

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

function feeTypeLabel(pt: SiteVenueBoardRow["pricingType"]): string {
  if (pt === "MIXED") return "혼용요금";
  if (pt === "FLAT") return "정액제";
  return "일반요금";
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
      className={`${filterStyles.filterRow} ${filterStyles.filterRowSingle} ${filterStyles.filterRowSingleDouble} ${filterStyles.filterRowFilterPack}`}
    >
      <div className={filterStyles.filterField}>
        <span className={filterStyles.filterFieldLabel} id="site-venues-filter-venue-type-label">
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
        <span className={filterStyles.filterFieldLabel} id="site-venues-filter-fee-type-label">
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
      <section className="site-site-gray-main v3-stack">
        {showDeniedHint ? (
          <p
            role="status"
            className="v3-muted"
            style={{
              margin: "0 0 1rem",
              padding: "0.65rem 0.75rem",
              borderRadius: "8px",
              background: "var(--v3-surface-2, #eef0f3)",
              fontSize: "0.9rem",
              lineHeight: 1.45,
            }}
          >
            {SITE_GEO_DENIED_USER_MESSAGE}
          </p>
        ) : null}
        <ul className="site-board-card-list" style={{ margin: 0 }}>
          {ordered.map((row) => (
            <li key={row.venueId} className="site-board-card">
              <Link href={`/site/venues/${row.venueId}`}>
                <div className="site-venue-card-main">
                  <span className="site-venue-card-title">{row.name}</span>
                  {String(row.address ?? "").trim() ? (
                    <span className="site-venue-address">{String(row.address).trim()}</span>
                  ) : null}
                  {(() => {
                    const cat = categoryLabel(row.venueCategory);
                    const fee = feeTypeLabel(row.pricingType);
                    if (!cat && !fee) return null;
                    return (
                      <div className="site-venue-chips">
                        {cat ? (
                          <span className={`site-list-chip site-venue-chip--cat-${row.venueCategory}`}>{cat}</span>
                        ) : null}
                        {fee ? (
                          <span
                            className={`site-list-chip site-venue-chip--fee-${row.pricingType === "FLAT" ? "flat" : row.pricingType === "MIXED" ? "mixed" : "general"}`}
                          >
                            {fee}
                          </span>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
                <div className="site-venue-list-thumb">
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      width={88}
                      height={56}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="site-venue-list-thumb-placeholder">이미지 없음</div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {ordered.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            {initialRows.length === 0 ? "등록된 클럽이 없습니다." : "조건에 맞는 당구장이 없습니다."}
          </p>
        ) : null}
      </section>
    </SiteShellFrame>
  );
}
