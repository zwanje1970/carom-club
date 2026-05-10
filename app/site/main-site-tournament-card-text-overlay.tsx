"use client";

import { memo } from "react";
import { parseTournamentSlideCardSubtitleParts } from "../../lib/tournament-slide-card-subtitle";
import previewStyles from "./tournament-slide-card-previews.module.css";
import overlayStyles from "./main-site-tournament-card-text-overlay.module.css";

export type MainSiteTournamentCardTextOverlayPayload = {
  cardTemplate: "A" | "B";
  surfaceLayout: "split" | "full";
  title: string;
  subtitle: string;
  cardExtraLine1: string | null;
  cardExtraLine2: string | null;
  cardExtraLine3: string | null;
  cardLeadTextColor?: string | null;
  cardTitleTextColor?: string | null;
  cardDescriptionTextColor?: string | null;
  cardTextShadowEnabled?: boolean;
  cardFooterDateTextColor?: string | null;
  cardFooterPlaceTextColor?: string | null;
};

function MainSiteTournamentCardTextOverlayInner({ payload }: { payload: MainSiteTournamentCardTextOverlayPayload }) {
  const { dateText, placeText } = parseTournamentSlideCardSubtitleParts(payload.subtitle);
  const surfaceFull = payload.surfaceLayout === "full";
  const classic = payload.cardTemplate !== "B";

  const rootArticleClass = [
    previewStyles.cardRoot,
    previewStyles.cardRootSlideDeck,
    previewStyles.cardRootSlideDeckAspectFill,
    previewStyles.cardRootTemplateLayout,
    previewStyles.cardRootTournamentPublishedScale,
    previewStyles.cardRootArtboardPx,
    surfaceFull ? previewStyles.cardRootSurfaceFull : "",
    payload.cardTextShadowEnabled ? previewStyles.cardTextShadowOn : "",
  ]
    .filter(Boolean)
    .join(" ");

  const lead = (payload.cardExtraLine1 ?? "").trim();
  const desc = (payload.cardExtraLine2 ?? "").trim();
  const desc2 = (payload.cardExtraLine3 ?? "").trim();

  const leadStyle = payload.cardLeadTextColor ? { color: payload.cardLeadTextColor } : undefined;
  const titleStyle = payload.cardTitleTextColor ? { color: payload.cardTitleTextColor } : undefined;
  const descStyle = payload.cardDescriptionTextColor ? { color: payload.cardDescriptionTextColor } : undefined;

  const footerDateStyle = payload.cardFooterDateTextColor ? { color: payload.cardFooterDateTextColor } : undefined;
  const footerPlaceStyle = payload.cardFooterPlaceTextColor ? { color: payload.cardFooterPlaceTextColor } : undefined;

  const splitFooterEl = (
    <footer className={previewStyles.cardFooter}>
      <p className={previewStyles.footerDate} style={footerDateStyle}>
        {dateText}
      </p>
      <p className={previewStyles.footerPlace} style={footerPlaceStyle}>
        {placeText}
      </p>
    </footer>
  );

  const fullFooterEl = (
    <div className={previewStyles.fullSurfaceFooter}>
      <p className={previewStyles.fullSurfaceFooterDate} style={footerDateStyle}>
        {dateText}
      </p>
      <p className={previewStyles.fullSurfaceFooterPlace} style={footerPlaceStyle}>
        {placeText}
      </p>
    </div>
  );

  if (classic) {
    return (
      <div className={overlayStyles.overlayHost} aria-hidden>
        <div className={overlayStyles.overlayScaleWrap}>
          <div className={overlayStyles.overlayArtboard}>
            <div className={rootArticleClass} role="presentation">
              <div className={previewStyles.media}>
                <div className={previewStyles.classicInner}>
                  <div className={previewStyles.classicTop}>
                    <div className={previewStyles.classicMain}>
                      {lead ? (
                        <p className={previewStyles.classicLead} style={leadStyle}>
                          {lead}
                        </p>
                      ) : null}
                      <h3 className={previewStyles.classicTitle} style={titleStyle}>
                        {payload.title.trim().length > 0 ? payload.title : "(제목)"}
                      </h3>
                      {desc ? (
                        <p className={previewStyles.classicDesc} style={descStyle}>
                          {desc}
                        </p>
                      ) : null}
                      {desc2 ? (
                        <p className={previewStyles.classicDescSecondary} style={descStyle}>
                          {desc2}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {surfaceFull ? fullFooterEl : null}
                </div>
              </div>
              {!surfaceFull ? splitFooterEl : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={overlayStyles.overlayHost} aria-hidden>
      <div className={overlayStyles.overlayScaleWrap}>
        <div className={overlayStyles.overlayArtboard}>
          <div className={rootArticleClass} role="presentation">
            <div className={previewStyles.media}>
              <div className={previewStyles.frameInner}>
                <div className={previewStyles.frameCenter}>
                  {lead ? (
                    <p className={previewStyles.frameLead} style={leadStyle}>
                      {lead}
                    </p>
                  ) : null}
                  <h3 className={previewStyles.frameTitle} style={titleStyle}>
                    {payload.title.trim().length > 0 ? payload.title : "(제목)"}
                  </h3>
                  {desc ? (
                    <p className={previewStyles.frameDesc} style={descStyle}>
                      {desc}
                    </p>
                  ) : null}
                  {desc2 ? (
                    <p className={previewStyles.frameDescSecondary} style={descStyle}>
                      {desc2}
                    </p>
                  ) : null}
                  {surfaceFull ? fullFooterEl : null}
                </div>
              </div>
            </div>
            {!surfaceFull ? splitFooterEl : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export const MainSiteTournamentCardTextOverlay = memo(MainSiteTournamentCardTextOverlayInner);
