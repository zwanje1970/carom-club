"use client";

import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import { resolvePageSectionLinkHref } from "@/lib/page-section-slot-href";
import type { PageSection } from "@/types/page-section";
import type { PageSlotRenderContext } from "@/types/page-slot-render-context";
import { CommunityNanguPromoCard } from "@/components/community/CommunityNanguPromoCard";
import { CommunityPostListSection } from "@/components/community/CommunityPostListSection";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeNoticeCommunity } from "@/components/home/HomeNoticeCommunity";
import { HomeTournamentIntroSlot } from "@/components/home/HomeTournamentIntroSlot";
import { HomeVenueIntroSlot } from "@/components/home/HomeVenueIntroSlot";
import { PageContentContainer } from "@/components/layout/PageContentContainer";
import { TournamentsListWithFilters } from "@/components/tournaments/TournamentsListWithFilters";
import { TournamentsPageChromeTitles } from "@/components/tournaments/TournamentsPageChromeTitles";
import { resolveHeroSettingsForSlot } from "@/lib/hero-settings-defaults";
import { resolveHomeStructureSlotFrame } from "@/lib/home-structure-slot-resolve";
import { cardStyleWithResolvedLayout } from "@/lib/slot-block-layout-motion";
import { parseSlotBlockItemsBundle } from "@/lib/slot-block-items";
import { HomeVenueLinkSlot } from "@/components/home/HomeVenueLinkSlot";

export type PageSlotSurface = "public" | "adminPreview";

function slotPreviewCopy(ctx: PageSlotRenderContext | null | undefined): Record<string, string> {
  if (!ctx) return {};
  if (ctx.home?.copy) return ctx.home.copy;
  if (ctx.community?.copy) return ctx.community.copy;
  if (ctx.tournaments?.copy) return ctx.tournaments.copy as Record<string, string>;
  return {};
}

function SlotFallback({ label, copy }: { label: string; copy?: Record<string, string> }) {
  const c = (copy ?? {}) as Record<AdminCopyKey, string>;
  const text = getCopyValue(c, "site.pageBuilder.slotFallback.template").replace(/\{label\}/g, label);
  return (
    <div className="border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
      {text}
    </div>
  );
}

function maybePlaceholder(
  label: string,
  surface: PageSlotSurface,
  ctx?: PageSlotRenderContext | null
) {
  if (surface === "public") return null;
  return <SlotFallback label={label} copy={slotPreviewCopy(ctx)} />;
}

/**
 * `PageRenderer`용 slotType → UI.
 * - `surface="public"`: 퀵메뉴·캐러셀·미정의 슬롯은 출력 없음(운영 점선 박스 방지).
 * - `surface="adminPreview"`: 미리보기에서만 SlotFallback 안내.
 */
export function PageSlotBlock({
  block,
  ctx,
  surface = "public",
}: {
  block: PageSection;
  ctx: PageSlotRenderContext | null | undefined;
  surface?: PageSlotSurface;
}) {
  if (!block.slotType) return null;
  const st = block.slotType;

  switch (st) {
    case "hero": {
      const hs = resolveHeroSettingsForSlot(ctx?.heroSettings);
      return <HomeHero heroSettings={hs} />;
    }
    case "tournamentIntro": {
      const h = ctx?.home;
      if (!h && surface === "public") return null;
      if (!h) return maybePlaceholder("대회 안내", surface, ctx);
      const frame = resolveHomeStructureSlotFrame(block);
      if (!frame) return maybePlaceholder("대회 안내", surface, ctx);
      const slotItems = parseSlotBlockItemsBundle(block.sectionStyleJson, "tournamentIntro");
      return (
        <HomeTournamentIntroSlot
          initialTournaments={h.initialTournaments}
          copy={h.copy}
          cardStyle={frame.cardStyle}
          ctaConfig={frame.ctaConfig}
          slotLayout={frame.layout}
          slotMotion={frame.motion}
          blockBackgroundColor={frame.blockBackgroundColor}
          homeCarouselFlowSpeed={h.siteSettings.homeCarouselFlowSpeed}
          slotItems={slotItems}
          sectionTitle={block.title}
          sectionSubtitle={block.subtitle}
        />
      );
    }
    case "venueIntro": {
      const h = ctx?.home;
      if (!h && surface === "public") return null;
      if (!h) return maybePlaceholder("당구장 소개", surface, ctx);
      const frame = resolveHomeStructureSlotFrame(block);
      if (!frame) return maybePlaceholder("당구장 소개", surface, ctx);
      const slotItems = parseSlotBlockItemsBundle(block.sectionStyleJson, "venueIntro");
      return (
        <HomeVenueIntroSlot
          venues={h.carouselVenues}
          copy={h.copy}
          homeCarouselFlowSpeed={h.siteSettings.homeCarouselFlowSpeed}
          cardStyle={frame.cardStyle}
          ctaConfig={frame.ctaConfig}
          slotLayout={frame.layout}
          slotMotion={frame.motion}
          blockBackgroundColor={frame.blockBackgroundColor}
          slotItems={slotItems}
          sectionTitle={block.title}
        />
      );
    }
    case "venueLink": {
      const h = ctx?.home;
      if (!h && surface === "public") return null;
      if (!h) return maybePlaceholder("당구장 목록 링크", surface, ctx);
      const frame = resolveHomeStructureSlotFrame(block);
      if (!frame) return maybePlaceholder("당구장 목록 링크", surface, ctx);
      const slotItems = parseSlotBlockItemsBundle(block.sectionStyleJson, "venueLink");
      return (
        <HomeVenueLinkSlot
          copy={h.copy}
          cardStyle={frame.cardStyle}
          ctaConfig={frame.ctaConfig}
          slotLayout={frame.layout}
          slotMotion={frame.motion}
          blockBackgroundColor={frame.blockBackgroundColor}
          slotItems={slotItems}
          homeCarouselFlowSpeed={h.siteSettings.homeCarouselFlowSpeed}
        />
      );
    }
    case "nanguEntry": {
      const h = ctx?.home;
      if (!h && surface === "public") return null;
      if (!h) return maybePlaceholder("난구노트·난구해결사", surface, ctx);
      const frame = resolveHomeStructureSlotFrame(block);
      if (!frame) return maybePlaceholder("난구노트·난구해결사", surface, ctx);
      const slotItems = parseSlotBlockItemsBundle(block.sectionStyleJson, "nanguEntry");
      return (
        <HomeNoticeCommunity
          copy={h.copy}
          showNoteEntry={h.showNoteEntry}
          showSolverEntry={h.showSolverEntry}
          cardStyle={cardStyleWithResolvedLayout(frame.cardStyle, frame.layout)}
          ctaConfig={frame.ctaConfig}
          blockBackgroundColor={frame.blockBackgroundColor}
          slotItems={slotItems}
        />
      );
    }
    case "postList": {
      const c = ctx?.community;
      if (!c) return maybePlaceholder("게시글 목록", surface, ctx);
      return (
        <PageContentContainer className="py-6">
          <CommunityPostListSection
            latest={c.latest}
            initialCategory={c.initialCategory}
            canManageReports={c.canManageReports}
            showSolverEntry={c.showSolverEntry}
          />
        </PageContentContainer>
      );
    }
    case "nanguList": {
      const c = slotPreviewCopy(ctx) as Record<AdminCopyKey, string>;
      const href =
        resolvePageSectionLinkHref(block) ?? getCopyValue(c, "site.community.nanguPromo.href");
      return (
        <PageContentContainer className="py-6">
          <CommunityNanguPromoCard copy={c} href={href} />
        </PageContentContainer>
      );
    }
    case "tournamentList": {
      const t = ctx?.tournaments;
      if (!t) return maybePlaceholder("대회 목록", surface, ctx);
      return (
        <PageContentContainer maxWidthClass="max-w-5xl" className="pb-12">
          <div className="py-6">
            <TournamentsPageChromeTitles copy={t.copy as Record<string, string>} wrapContainer={false} />
          </div>
          <TournamentsListWithFilters
            copy={t.copy}
            initialList={t.initialList}
            initialHasMore={t.initialHasMore}
            initialQuery={t.initialQuery}
          />
        </PageContentContainer>
      );
    }
    case "noticeOverlay": {
      const c = slotPreviewCopy(ctx) as Record<AdminCopyKey, string>;
      return (
        <p className="mx-auto max-w-3xl border border-dashed border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
          {getCopyValue(c, "site.pageBuilder.noticeOverlay.hint")}
        </p>
      );
    }
    /** 순서 마커: 실제 CMS 행은 같은 `blocks` 배열의 `slotType` 없는 행으로 렌더됨 */
    case "cmsPageSections":
      return null;
    case "quickMenu": {
      const c = slotPreviewCopy(ctx) as Record<AdminCopyKey, string>;
      return maybePlaceholder(getCopyValue(c, "site.pageBuilder.placeholder.quickMenu"), surface, ctx);
    }
    case "homeCarousels": {
      const c = slotPreviewCopy(ctx) as Record<AdminCopyKey, string>;
      return maybePlaceholder(getCopyValue(c, "site.pageBuilder.placeholder.homeCarousels"), surface, ctx);
    }
    default:
      return maybePlaceholder(String(st), surface, ctx);
  }
}
