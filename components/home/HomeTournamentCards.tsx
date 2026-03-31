import { PAGE_CONTENT_PAD_X } from "@/components/layout/pageContentStyles";
import { cn } from "@/lib/utils";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { HomeTournamentListAutoScroll } from "@/components/home/HomeTournamentListAutoScroll";
import { HomeTournamentCarouselRows } from "@/components/home/HomeTournamentCarouselRows";
import type { HomeTournamentCarouselInput } from "@/components/home/HomeTournamentCarouselRows";
import { SlotBlockCtaLink } from "@/components/home/SlotBlockCtaLink";
import type { SlotBlockCtaConfig } from "@/lib/slot-block-cta";
import type { SlotBlockCardStyle } from "@/lib/slot-block-card-style";
import { tournamentCardLinkClasses } from "@/lib/slot-block-card-style";
import type { SlotBlockLayout, SlotBlockMotion } from "@/lib/slot-block-layout-motion";
import { slotMotionEffectiveFlowSpeed } from "@/lib/slot-block-layout-motion";

export function HomeTournamentCards({
  tournaments,
  copy,
  nearbyFind,
  cardStyle,
  ctaConfig,
  slotLayout,
  slotMotion,
  blockBackgroundColor,
  homeCarouselFlowSpeed,
}: {
  tournaments: HomeTournamentCarouselInput[];
  copy: Record<string, string>;
  /** 클릭 시에만 위치 권한 요청 */
  nearbyFind?: { onClick: () => void; loading: boolean; error: string | null };
  cardStyle?: SlotBlockCardStyle;
  ctaConfig: SlotBlockCtaConfig;
  slotLayout: SlotBlockLayout;
  slotMotion: SlotBlockMotion;
  blockBackgroundColor?: string;
  /** 사이트 전역 흐름 속도(1~100) — 블록 `speed` 배율의 기준 */
  homeCarouselFlowSpeed: number;
}) {
  const c = copy as Record<AdminCopyKey, string>;
  const cta = ctaConfig;
  const sectionSurface = blockBackgroundColor ? { backgroundColor: blockBackgroundColor } : undefined;
  const flowOneToHundred = slotMotionEffectiveFlowSpeed(homeCarouselFlowSpeed, slotMotion);
  const isCarousel = slotLayout.type === "carousel";

  if (tournaments.length === 0) {
    return (
      <section
        style={sectionSurface}
        className={cn(PAGE_CONTENT_PAD_X, "py-10 sm:py-12 min-h-[320px]")}
      >
        <div className="mx-auto max-w-5xl">
          <SlotBlockCtaLink layer={cta.block} ctx={{}} className="block text-left">
            <h2 className="text-xl font-bold text-site-text sm:text-2xl">
              {getCopyValue(c, "site.home.tournaments.title")}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {getCopyValue(c, "site.home.tournaments.subtitleEmpty")}
            </p>
          </SlotBlockCtaLink>
          {nearbyFind?.error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
              {nearbyFind.error}
            </p>
          )}
          <div
            className={cn(
              "mt-6 p-8 text-center",
              cardStyle ? tournamentCardLinkClasses(cardStyle) : "rounded-2xl border border-site-border bg-site-card"
            )}
          >
            <p className="text-gray-500">{getCopyValue(c, "site.home.tournaments.empty")}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              {nearbyFind && (
                <button
                  type="button"
                  onClick={nearbyFind.onClick}
                  disabled={nearbyFind.loading}
                  className="rounded-xl border border-site-border bg-site-bg px-5 py-2.5 text-sm font-medium text-site-text hover:border-site-primary/50 disabled:opacity-60"
                >
                  {nearbyFind.loading ? "위치 확인 중…" : "내 주변 대회 찾기"}
                </button>
              )}
              <SlotBlockCtaLink
                layer={cta.button}
                ctx={{}}
                className="inline-block rounded-xl bg-site-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
              >
                {getCopyValue(c, "site.home.tournaments.btnList")}
              </SlotBlockCtaLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      style={sectionSurface}
      className={cn(PAGE_CONTENT_PAD_X, "py-10 sm:py-12 min-h-[380px]")}
    >
      <div className="mx-auto max-w-5xl min-h-[inherit]">
        <div className="flex flex-wrap items-end justify-between gap-2 gap-y-3">
          <SlotBlockCtaLink
            layer={cta.block}
            ctx={{}}
            className="min-h-[4.5rem] min-w-0 flex-1 block text-left"
          >
            <div className="min-h-[4.5rem] min-w-0 flex-1">
              <h2 className="text-xl font-bold text-site-text sm:text-2xl min-h-[1.75rem]">
                {getCopyValue(c, "site.home.tournaments.title")}
              </h2>
              <p className="mt-1 min-h-[2.5rem] text-sm text-gray-600 line-clamp-2">
                {getCopyValue(c, "site.home.tournaments.subtitle")}
              </p>
            </div>
          </SlotBlockCtaLink>
          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0 min-h-[44px]">
            {nearbyFind && (
              <button
                type="button"
                onClick={nearbyFind.onClick}
                disabled={nearbyFind.loading}
                className="rounded-lg border border-site-border bg-site-card px-3 py-2 text-sm font-medium text-site-text hover:border-site-primary/50 disabled:opacity-60"
              >
                {nearbyFind.loading ? "위치 확인 중…" : "내 주변 대회 찾기"}
              </button>
            )}
            <SlotBlockCtaLink
              layer={cta.button}
              ctx={{}}
              className="inline-flex items-center text-sm font-medium text-site-primary hover:underline py-2"
            >
              전체보기 →
            </SlotBlockCtaLink>
          </div>
        </div>
        {nearbyFind?.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400" role="alert">
            {nearbyFind.error}
          </p>
        )}
        {!isCarousel ? (
          <HomeTournamentCarouselRows
            tournaments={tournaments}
            cardStyle={cardStyle}
            cardCta={cta.card}
            listLayout={slotLayout}
          />
        ) : slotMotion.autoPlay ? (
          <HomeTournamentListAutoScroll
            flowSpeed={flowOneToHundred}
            pauseOnHover={slotMotion.pauseOnHover}
          >
            <HomeTournamentCarouselRows
              tournaments={tournaments}
              cardStyle={cardStyle}
              cardCta={cta.card}
              listLayout={slotLayout}
            />
          </HomeTournamentListAutoScroll>
        ) : (
          <div className="mt-6 -mx-4 sm:-mx-6 flex min-h-[292px] flex-nowrap gap-4 overflow-x-auto overflow-y-hidden touch-pan-x pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <HomeTournamentCarouselRows
              tournaments={tournaments}
              cardStyle={cardStyle}
              cardCta={cta.card}
              listLayout={slotLayout}
            />
          </div>
        )}
      </div>
    </section>
  );
}
