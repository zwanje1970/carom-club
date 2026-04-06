"use client";

import { formatDistanceKm } from "@/lib/distance";
import { formatKoreanMonthDayWeekday } from "@/lib/format-date";
import { IMAGE_PLACEHOLDER_SRC, sanitizeImageSrc } from "@/lib/image-src";
import type { SlotBlockCtaLayer } from "@/lib/slot-block-cta";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { SlotBlockCtaLink } from "@/components/home/SlotBlockCtaLink";
import { BasicCard, HighlightCard } from "@/components/cards/TournamentPublishedCard";
import { cn } from "@/lib/utils";
import {
  tournamentCardBodyClasses,
  tournamentCardLinkClasses,
  tournamentGridLiClasses,
  tournamentCarouselLiClasses,
  tournamentPosterShellClasses,
  tournamentTitleClasses,
  slotBlockLineClampClass,
} from "@/lib/slot-block-card-style";

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
  thumbnailUrl?: string | null;
  summary?: string | null;
  maxParticipants?: number | null;
  confirmedCount?: number;
  organization: { name: string } | null;
  distanceKm?: number | null;
  /** 직접 구성: 이미지·제목·설명 위주 */
  manualSimple?: boolean;
  /** 카드에 직접 넣은 링크(있으면 CTA 자동 연결보다 우선) */
  directCardHref?: string | null;
  /** 발행본 카드 데이터 기반 렌더링 여부 */
  isPublishedData?: boolean;
  templateType?: "basic" | "highlight";
  cardTitle?: string | null;
  displayDateText?: string | null;
  displayRegionText?: string | null;
  statusText?: string | null;
  buttonText?: string | null;
  shortDescription?: string | null;
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
  index,
  duplicate,
  cardStyle,
  cardCta,
  layout = "carousel",
  showDetailButtonByTemplate,
}: {
  t: HomeTournamentCardModel;
  index?: number;
  duplicate?: boolean;
  /** 없으면 기존 하드코딩과 동일한 기본(빌더 미연동 경로) */
  cardStyle?: SlotBlockCardStyle;
  cardCta?: SlotBlockCtaLayer;
  layout?: "carousel" | "grid";
  showDetailButtonByTemplate?: {
    basic: boolean;
    highlight: boolean;
  };
}) {
  const liClass =
    layout === "grid"
      ? tournamentGridLiClasses()
      : cardStyle
        ? tournamentCarouselLiClasses(cardStyle)
        : "flex h-full min-h-[200px] w-[260px] min-w-[260px] shrink-0 sm:min-h-0 sm:w-[280px] sm:min-w-[280px]";
  const linkClass = cardStyle
    ? tournamentCardLinkClasses(cardStyle)
    : "group flex h-full min-h-[200px] flex-col overflow-hidden rounded-2xl border border-site-border bg-site-card shadow-sm transition hover:border-site-primary/30 hover:shadow-md sm:min-h-0";
  const posterClass = cardStyle
    ? tournamentPosterShellClasses(cardStyle)
    : "relative w-full aspect-[5/2] min-h-[7rem] shrink-0 overflow-hidden bg-gray-100 md:aspect-[7/4] md:min-h-[10rem]";
  const bodyClass = cardStyle ? tournamentCardBodyClasses(cardStyle) : "flex flex-1 flex-col p-3 gap-2 min-h-[7.5rem]";
  const titleClass = cardStyle
    ? tournamentTitleClasses(cardStyle)
    : "font-semibold text-site-text group-hover:text-site-primary text-sm md:text-base line-clamp-2 min-h-[2.5rem]";

  const simple = Boolean(t.manualSimple);
  const direct = t.directCardHref?.trim() || "";
  const published = t.isPublishedData === true;
  const isFirstSlide = (index ?? -1) === 0 && !duplicate;
  const displayTitle = published ? (t.cardTitle || "") : t.name;
  const displayStatus = published ? (t.statusText || "") : statusLabel(t.status);
  const displayDateRegion = published
    ? [t.displayDateText ?? "", t.displayRegionText ?? ""].filter(Boolean).join(" · ")
    : `${formatKoreanMonthDayWeekday(t.startAt)}${t.venue ? ` · ${t.venue}` : ""}`;
  const displayButtonText = published ? (t.buttonText || "") : "";
  const displayDescription = published ? (t.shortDescription || "") : "";
  const cardHref = published ? `/tournaments/${t.id}` : direct;
  const showDetailButton =
    t.templateType === "highlight"
      ? (showDetailButtonByTemplate?.highlight ?? true)
      : (showDetailButtonByTemplate?.basic ?? false);

  if (published) {
    const publishedData = {
      templateType: t.templateType === "highlight" ? "highlight" : "basic",
      thumbnailUrl: t.thumbnailUrl ?? t.posterImageUrl ?? t.imageUrl ?? "",
      cardTitle: displayTitle,
      displayDateText: t.displayDateText ?? "",
      displayRegionText: t.displayRegionText ?? "",
      statusText: displayStatus,
      buttonText: displayButtonText,
      shortDescription: displayDescription,
    } as const;
    return (
      <li aria-hidden={duplicate} className={liClass}>
        <SlotBlockCtaLink
          layer={cardCta}
          ctx={{
            itemDirectHref: cardHref || undefined,
          }}
          tabIndex={duplicate ? -1 : undefined}
          aria-hidden={duplicate ? true : undefined}
          className="block"
        >
          {publishedData.templateType === "highlight" ? (
            <HighlightCard data={publishedData} compact showDetailButton={showDetailButton} />
          ) : (
            <BasicCard data={publishedData} compact showDetailButton={showDetailButton} />
          )}
        </SlotBlockCtaLink>
      </li>
    );
  }

  return (
    <li aria-hidden={duplicate} className={liClass}>
      <SlotBlockCtaLink
        layer={cardCta}
        ctx={{
          tournamentId: t.manualSimple || published ? undefined : t.id,
          itemDirectHref: cardHref || undefined,
        }}
        tabIndex={duplicate ? -1 : undefined}
        aria-hidden={duplicate ? true : undefined}
        className={linkClass}
      >
        <div className={posterClass}>
          {(() => {
            const imageUrl = t.thumbnailUrl ?? t.posterImageUrl ?? t.imageUrl;
            const src = sanitizeImageSrc(imageUrl ?? "");
            if (!src) {
              return (
                // eslint-disable-next-line @next/next/no-img-element -- 메인 카드는 Next 이미지 최적화 없이 원본 URL 로드
                <img
                  src={IMAGE_PLACEHOLDER_SRC}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  loading={isFirstSlide ? "eager" : "lazy"}
                  fetchPriority={isFirstSlide ? "high" : undefined}
                />
              );
            }
            return (
              // eslint-disable-next-line @next/next/no-img-element -- 메인 카드는 Next 이미지 최적화 없이 원본 URL 로드
              <img
                src={src}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading={isFirstSlide ? "eager" : "lazy"}
                fetchPriority={isFirstSlide ? "high" : undefined}
                data-debug-src={src}
              />
            );
          })()}
          {!simple ? (
            <>
              <span
                className={`absolute right-2 top-2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${statusColor(t.status)}`}
              >
                {displayStatus}
              </span>
              {!published
                ? (() => {
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
                })()
                : null}
            </>
          ) : null}
        </div>
        <div className={bodyClass}>
          <h3 className={titleClass}>
            {displayTitle}
          </h3>
          {!simple && !published && t.organization && (
            <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{t.organization.name}</p>
          )}
          {!simple && !published && t.distanceKm != null && (
            <p className="mt-0.5 text-xs text-gray-500 md:text-sm">{formatDistanceKm(t.distanceKm)}</p>
          )}
          {!simple && !published && typeof t.maxParticipants === "number" && t.maxParticipants > 0 && (
            <p className="text-xs font-medium text-site-text md:text-sm">
              참가 현황 <span className="text-site-primary">{t.confirmedCount ?? 0}명</span> / {t.maxParticipants}명
            </p>
          )}
          {published && t.templateType === "highlight" && displayDescription ? (
            <p
              className={cn(
                "mt-1 text-xs text-gray-600 md:text-sm",
                cardStyle ? slotBlockLineClampClass(cardStyle) : "line-clamp-3"
              )}
            >
              {displayDescription}
            </p>
          ) : null}
          {simple && t.summary?.trim() ? (
            <p
              className={cn(
                "mt-1 text-xs text-gray-600 md:text-sm",
                cardStyle ? slotBlockLineClampClass(cardStyle) : "line-clamp-4"
              )}
            >
              {t.summary}
            </p>
          ) : null}
          {!simple ? (
            <p className="mt-1 text-xs text-gray-600 md:text-sm">
              {displayDateRegion}
            </p>
          ) : null}
          {published ? (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-lg border border-site-border bg-site-bg px-2.5 py-1 text-xs font-medium text-site-text">
                {displayButtonText}
              </span>
            </div>
          ) : null}
        </div>
      </SlotBlockCtaLink>
    </li>
  );
}
