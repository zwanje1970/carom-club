"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import FilterDropdown from "../components/FilterDropdown";
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

function rowMatchesRegion(rowRegion: string, province: string): boolean {
  if (province === "all") return true;
  const r = rowRegion.trim();
  return r.startsWith(province);
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

const REGION_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "지역 전체" },
  { value: "서울", label: "서울" },
  { value: "경기", label: "경기" },
  { value: "인천", label: "인천" },
  { value: "부산", label: "부산" },
  { value: "대구", label: "대구" },
  { value: "광주", label: "광주" },
  { value: "대전", label: "대전" },
  { value: "울산", label: "울산" },
  { value: "세종", label: "세종" },
  { value: "강원", label: "강원" },
  { value: "충북", label: "충북" },
  { value: "충남", label: "충남" },
  { value: "전북", label: "전북" },
  { value: "전남", label: "전남" },
  { value: "경북", label: "경북" },
  { value: "경남", label: "경남" },
  { value: "제주", label: "제주" },
];

type Props = {
  initialRows: SiteVenueBoardRow[];
  distanceSort: { lat: number; lng: number } | null;
};

export default function SiteVenuesBoard({ initialRows, distanceSort }: Props) {
  const [venueType, setVenueType] = useState<VenueTypeFilter>("all");
  const [feeType, setFeeType] = useState<FeeTypeFilter>("all");
  const [region, setRegion] = useState<string>("all");

  const filtered = useMemo(() => {
    if (venueType === "all" && feeType === "all" && region === "all") {
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
      if (region !== "all") {
        if (!rowMatchesRegion(row.region, region)) return false;
      }
      return true;
    });
  }, [initialRows, venueType, feeType, region]);

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

  const auxiliary = (
    <div className={filterStyles.filterGrid3}>
      <div className={filterStyles.filterGridCell}>
        <FilterDropdown
          id="site-venues-filter-venue-type"
          value={venueType}
          onChange={(e) => setVenueType(e.target.value as VenueTypeFilter)}
          fullWidth
          aria-label="구장유형"
        >
          {VENUE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterDropdown>
      </div>
      <div className={filterStyles.filterGridCell}>
        <FilterDropdown
          id="site-venues-filter-fee-type"
          value={feeType}
          onChange={(e) => setFeeType(e.target.value as FeeTypeFilter)}
          fullWidth
          aria-label="요금유형"
        >
          {FEE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterDropdown>
      </div>
      <div className={filterStyles.filterGridCell}>
        <FilterDropdown
          id="site-venues-filter-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          fullWidth
          aria-label="지역"
        >
          {REGION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterDropdown>
      </div>
    </div>
  );

  return (
    <SiteShellFrame brandTitle="당구장안내" auxiliary={auxiliary} auxiliaryCompact>
      <section className="site-site-gray-main v3-stack">
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
