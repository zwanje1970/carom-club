"use client";

import { getAvgProofStatus, type AvgProofStatusType } from "@/lib/avg-proof";

export type { AvgProofStatusType };
export { getAvgProofStatus };

export function AvgProofStatusBadge({
  status,
}: {
  status: AvgProofStatusType;
}) {
  const config = {
    valid: { label: "유효", className: "bg-green-100 text-green-800" },
    expiring_soon: {
      label: "만료 예정",
      className: "bg-site-secondary/20 text-site-text",
    },
    expired: { label: "만료", className: "bg-red-100 text-red-800" },
    none: { label: "미등록", className: "bg-gray-100 text-gray-600" },
  }[status];

  return (
    <span
      className={`inline-block px-2 py-1 rounded text-sm font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
