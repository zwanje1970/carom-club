import Link from "next/link";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { formatDistanceKm } from "@/lib/distance";
import { IMAGE_PLACEHOLDER_SRC, sanitizeImageSrc } from "@/lib/image-src";

type Tournament = {
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

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(d);
}

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

export function HomeTournamentCards({
  tournaments,
  copy,
}: {
  tournaments: Tournament[];
  copy: Record<string, string>;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  if (tournaments.length === 0) {
    return (
      <section className="px-4 py-10 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-xl font-bold text-site-text sm:text-2xl">
            {getCopyValue(c, "site.home.tournaments.title")}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {getCopyValue(c, "site.home.tournaments.subtitleEmpty")}
          </p>
          <div className="mt-6 rounded-2xl border border-site-border bg-site-card p-8 text-center">
            <p className="text-gray-500">{getCopyValue(c, "site.home.tournaments.empty")}</p>
            <Link
              href="/tournaments"
              className="mt-4 inline-block rounded-xl bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
            >
              {getCopyValue(c, "site.home.tournaments.btnList")}
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 py-10 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-site-text sm:text-2xl">
              {getCopyValue(c, "site.home.tournaments.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {getCopyValue(c, "site.home.tournaments.subtitle")}
            </p>
          </div>
          <Link
            href="/tournaments"
            className="shrink-0 text-sm font-medium text-site-primary hover:underline"
          >
            전체보기 →
          </Link>
        </div>
        <div
          className="mt-6 -mx-4 sm:-mx-6 flex gap-4 overflow-x-auto overflow-y-hidden snap-x snap-mandatory touch-pan-x pb-4 md:overflow-visible md:flex-wrap md:pb-0"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <ul className="flex gap-4 px-4 sm:px-6 min-w-0 md:flex-wrap md:w-full">
            {tournaments.map((t) => (
              <li
                key={t.id}
                className="flex-shrink-0 w-[260px] min-w-[260px] snap-start md:w-[48%] md:min-w-[280px] lg:w-[calc((100%-2rem)/3.2)] lg:max-w-[320px]"
              >
                <Link
                  href={`/tournaments/${t.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm transition hover:border-site-primary/30 hover:shadow-md h-full min-h-[200px] md:min-h-0"
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
                            badge === "마감임박" || badge.startsWith("마지막") ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-site-bg/90 text-site-text-muted"
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
                      {formatDate(t.startAt)}
                      {t.venue && ` · ${t.venue}`}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
