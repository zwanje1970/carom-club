/** 메인 4메뉴 — 이모지 대신 동일 스타일 라인 아이콘 */
const stroke = "#2563eb";

const svgProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke,
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

export function SiteMainNavIcon({ variant }: { variant: "tournament" | "venue" | "community" | "user" }) {
  switch (variant) {
    case "tournament":
      return (
        <svg {...svgProps}>
          <path d="M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z" />
        </svg>
      );
    case "venue":
      return (
        <svg {...svgProps}>
          <path d="M3 21h18M5 21V10.5l7-5 7 5V21M9 21v-6h6v6" />
        </svg>
      );
    case "community":
      return (
        <svg {...svgProps}>
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8.5z" />
        </svg>
      );
    case "user":
      return (
        <svg {...svgProps}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    default:
      return null;
  }
}
