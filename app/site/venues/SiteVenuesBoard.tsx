"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import FilterButton from "../components/FilterButton";
import FilterDropdown from "../components/FilterDropdown";
import {
  performGeolocationThenNavigate,
  VENUES_GEO_STORAGE_LAT,
  VENUES_GEO_STORAGE_LNG,
} from "../lib/site-geolocation-flow";
import SiteShellFrame from "../components/SiteShellFrame";
import filterStyles from "../components/filter-controls.module.css";

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
  distanceSort: { lat: number; lng: number } | null;
  locationDenied?: boolean;
  distanceButtonHref: string;
  hasViewerCoordinate: boolean;
};

export default function SiteVenuesBoard({
  initialRows,
  distanceSort,
  locationDenied,
  distanceButtonHref,
  hasViewerCoordinate,
}: Props) {
  const router = useRouter();
  const [venueType, setVenueType] = useState<VenueTypeFilter>("all");
  const [feeType, setFeeType] = useState<FeeTypeFilter>("all");

  useEffect(() => {
    if (!distanceSort) return;
    try {
      sessionStorage.setItem(VENUES_GEO_STORAGE_LAT, String(distanceSort.lat));
      sessionStorage.setItem(VENUES_GEO_STORAGE_LNG, String(distanceSort.lng));
    } catch {
      /* ignore */
    }
  }, [distanceSort]);

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

    if (distanceSort) {
      const withDistance = list.map((row, index) => {
        const d =
          row.lat != null && row.lng != null
            ? distanceMeters(distanceSort, { lat: row.lat, lng: row.lng })
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
  }, [filtered, distanceSort]);

  const distanceSortActive = distanceSort != null;

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
        className={distanceSortActive ? filterStyles.buttonDistanceActive : undefined}
        href={distanceButtonHref}
        useNextLink={hasViewerCoordinate}
        onClick={
          hasViewerCoordinate
            ? undefined
            : (e) => {
                e.preventDefault();
                performGeolocationThenNavigate(distanceButtonHref, (path) => router.push(path));
              }
        }
      >
        거리순
      </FilterButton>
    </div>
  );

  return (
    <SiteShellFrame brandTitle="당구장안내" auxiliary={auxiliary}>
      <section className="site-site-gray-main v3-stack">
        {locationDenied ? (
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
            위치 권한을 허용해야 주변 당구장을 거리순으로 볼 수 있습니다. 브라우저 설정에서 위치를 허용한 뒤「거리순」을 다시 눌러 주세요.
          </p>
        ) : null}
        <ul className="site-board-card-list" style={{ margin: 0 }}>
          {ordered.map((row) => (
            <li key={row.venueId} className="site-board-card">
              <Link
                href={`/site/venues/${row.venueId}`}
                style={{
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: "1rem",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: "1.05rem", display: "block", marginBottom: "0.4rem" }}>
                    {row.name}
                  </span>
                  {String(row.address ?? "").trim() ? (
                    <span
                      className="v3-muted"
                      style={{ fontSize: "0.92rem", lineHeight: 1.5, display: "block", marginBottom: "0.25rem" }}
                    >
                      {String(row.address).trim()}
                    </span>
                  ) : null}
                  {(() => {
                    const cat = categoryLabel(row.venueCategory);
                    const fee = feeTypeLabel(row.pricingType);
                    const parts = [cat, fee].filter(Boolean);
                    if (parts.length === 0) return null;
                    return (
                      <span className="v3-muted" style={{ fontSize: "0.92rem", lineHeight: 1.5, display: "block" }}>
                        {parts.join(" · ")}
                      </span>
                    );
                  })()}
                </div>
                <div
                  style={{
                    flex: "0 0 auto",
                    width: "88px",
                    height: "56px",
                    borderRadius: "4px",
                    overflow: "hidden",
                    background: "var(--v3-surface-2, #eef0f3)",
                    flexShrink: 0,
                  }}
                >
                  {row.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.thumbnailUrl}
                      alt=""
                      width={88}
                      height={56}
                      loading="lazy"
                      decoding="async"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div
                      className="v3-muted"
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.65rem",
                        textAlign: "center",
                        padding: "0.25rem",
                      }}
                    >
                      이미지 없음
                    </div>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {ordered.length === 0 ? (
          <p className="v3-muted" style={{ margin: 0 }}>
            조건에 맞는 당구장이 없습니다.
          </p>
        ) : null}
      </section>
    </SiteShellFrame>
  );
}
