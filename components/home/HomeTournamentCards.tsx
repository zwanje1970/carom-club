import Link from "next/link";
import Image from "next/image";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { formatDistanceKm } from "@/lib/distance";

type Tournament = {
  id: string;
  name: string;
  venue: string | null;
  startAt: Date;
  endAt: Date | null;
  gameFormat: string | null;
  status: string;
  imageUrl: string | null;
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
      return "초안";
    case "HIDDEN":
      return "숨김";
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
        </div>
        <div
          className="mt-6 -mx-4 sm:-mx-6 overflow-x-auto overflow-y-hidden"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <ul className="flex gap-4 px-4 pb-2 sm:px-6">
            {tournaments.map((t) => (
              <li
                key={t.id}
                className="flex-shrink-0 w-[85%] min-w-[260px] sm:w-[48%] sm:min-w-[280px] lg:w-[calc((100%-2rem)/3.2)] lg:max-w-[320px]"
              >
                <Link
                  href={`/tournaments/${t.id}`}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm transition hover:border-site-primary/30 hover:shadow-md h-full"
                >
                  <div className="relative aspect-[16/10] w-full bg-gray-100">
                    {t.imageUrl ? (
                      <Image
                        src={t.imageUrl}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 85vw, (max-width: 1024px) 48vw, 320px"
                      />
                    ) : (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-4xl text-gray-300"
                        aria-hidden
                      >
                        ●
                      </div>
                    )}
                    <span
                      className={`absolute right-2 top-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(t.status)}`}
                    >
                      {statusLabel(t.status)}
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <h3 className="font-semibold text-site-text group-hover:text-site-primary">
                      {t.name}
                    </h3>
                    {t.organization && (
                      <p className="mt-0.5 text-sm text-gray-500">{t.organization.name}</p>
                    )}
                    {t.distanceKm != null && (
                      <p className="mt-0.5 text-sm text-gray-500">{formatDistanceKm(t.distanceKm)}</p>
                    )}
                    <p className="mt-1 text-sm text-gray-600">
                      {formatDate(t.startAt)}
                      {t.venue && ` · ${t.venue}`}
                    </p>
                    <span className="mt-3 inline-flex min-h-[40px] w-full items-center justify-center rounded-xl bg-site-primary text-sm font-medium text-white transition group-hover:opacity-90">
                      {getCopyValue(c, "site.home.tournaments.btnJoin")}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/tournaments"
            className="inline-flex items-center justify-center rounded-xl border-2 border-site-primary bg-site-primary px-6 py-2.5 text-sm font-medium text-white hover:opacity-90 transition"
          >
            전체 대회 보기
          </Link>
        </div>
      </div>
    </section>
  );
}
