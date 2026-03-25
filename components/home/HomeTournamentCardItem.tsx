import Link from "next/link";
import { formatDistanceKm } from "@/lib/distance";
import { formatKoreanMonthDayWeekday } from "@/lib/format-date";
import { IMAGE_PLACEHOLDER_SRC, sanitizeImageSrc } from "@/lib/image-src";

export type HomeTournamentCardModel = {
  id: string;
  name: string;
  venue: string | null;
  startAt: Date;
  endAt: Date | null;
  gameFormat: string | null;
  status: string;
  imageUrl: string | null;
  posterImageUrl?: string | null;
  summary?: string | null;
  maxParticipants?: number | null;
  confirmedCount?: number;
  organization: { name: string } | null;
  distanceKm?: number | null;
};

function statusLabel(status: string) {
  switch (status) {
    case "OPEN":
      return "모집중";
    case "CLOSED":
      return "마감";
    case "FINISHED":
      return "종료";
    case "DRAFT":
      return "예정";
    case "HIDDEN":
      return "숨김";
    case "BRACKET_GENERATED":
      return "진행중";
    default:
      return "대회";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-site-primary text-white";
    case "CLOSED":
      return "bg-site-secondary text-site-text";
    case "FINISHED":
      return "bg-gray-200 text-gray-600";
    case "DRAFT":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200";
    case "BRACKET_GENERATED":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
    case "HIDDEN":
    default:
      return "bg-gray-100 text-gray-600";
  }
}

export function HomeTournamentCardItem({
  t,
  duplicate,
}: {
  t: HomeTournamentCardModel;
  duplicate?: boolean;
}) {
  return (
    <li
      aria-hidden={duplicate}
      className="flex h-full min-h-[200px] w-[260px] min-w-[260px] shrink-0 sm:min-h-0 sm:w-[280px] sm:min-w-[280px]"
    >
      <Link
        href={`/tournaments/${t.id}`}
        tabIndex={duplicate ? -1 : undefined}
        aria-hidden={duplicate}
        className="group flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm transition hover:border-site-primary/30 hover:shadow-md sm:min-h-0"
      >
        <div className="relative w-full h-28 md:h-40 bg-gray-100 shrink-0">
          {(() => {
            const src = sanitizeImageSrc((t.posterImageUrl || t.imageUrl) ?? "");
            if (!src) {
              return (
                <img src={IMAGE_PLACEHOLDER_SRC} alt="" className="absolute inset-0 w-full h-full object-cover" />
              );
            }
            return (
              <img
                src={src}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                data-debug-src={src}
              />
            );
          })()}
          <span
            className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${statusColor(t.status)}`}
          >
            {statusLabel(t.status)}
          </span>
          {(() => {
            const max = t.maxParticipants ?? 0;
            const confirmed = t.confirmedCount ?? 0;
            const ratio = max > 0 ? confirmed / max : 0;
            const nearlyFull = max > 0 && ratio >= 0.8;
            const remaining = max > 0 ? Math.max(0, max - confirmed) : null;
            const isFull = remaining !== null && remaining <= 0;
            const almostFull = remaining != null && remaining > 0 && remaining <= 3;
            const badge = isFull ? "정원 마감" : almostFull ? `마지막 ${remaining}자리` : nearlyFull ? "마감임박" : null;
            return badge ? (
              <span
                className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                  badge === "마감임박" || badge.startsWith("마지막")
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                    : "bg-site-bg/90 text-site-text-muted"
                }`}
              >
                {badge}
              </span>
            ) : null;
          })()}
        </div>
        <div className="flex flex-1 flex-col p-3 gap-2">
          <h3 className="font-semibold text-site-text group-hover:text-site-primary text-sm md:text-base">
            {t.name}
          </h3>
          {t.organization && (
            <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{t.organization.name}</p>
          )}
          {t.distanceKm != null && (
            <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{formatDistanceKm(t.distanceKm)}</p>
          )}
          {typeof t.maxParticipants === "number" && t.maxParticipants > 0 && (
            <p className="text-xs font-medium text-site-text md:text-sm">
              참가 현황 <span className="text-site-primary">{t.confirmedCount ?? 0}명</span> / {t.maxParticipants}명
            </p>
          )}
          <p className="mt-1 text-xs text-gray-600 md:text-sm">
            {formatKoreanMonthDayWeekday(t.startAt)}
            {t.venue && ` · ${t.venue}`}
          </p>
        </div>
      </Link>
    </li>
  );
}
