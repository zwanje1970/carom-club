"use client";

import { memo } from "react";
import type { CSSProperties } from "react";
import type { TournamentCardOverlaySnapshot } from "../../lib/site/tournament-card-overlay-snapshot";
import overlayStyles from "./main-site-tournament-card-text-overlay.module.css";
import {
  TournamentStatusBadge,
  tournamentSlideStatusBadgeToPostStatus,
} from "./tournament-slide-card-status-badge";

function MainSiteTournamentCardOverlayFromSnapshotInner({ snapshot }: { snapshot: TournamentCardOverlaySnapshot }) {
  return (
    <div className={overlayStyles.overlayHost} aria-hidden>
      <div className={overlayStyles.overlayScaleWrap}>
        <div
          className={overlayStyles.overlayArtboard}
          style={{
            position: "relative",
            width: snapshot.cardBaseWidth,
            height: snapshot.cardBaseHeight,
          }}
        >
          {snapshot.items.map((it, idx) => {
            const base: CSSProperties = {
              position: "absolute",
              left: it.x,
              top: it.y,
              width: it.width,
              height: it.height,
              zIndex: it.zIndex,
              boxSizing: "border-box",
              pointerEvents: "none",
            };
            if (it.type === "statusBadge") {
              const raw = (it.statusBadgeRaw ?? it.text).trim();
              const post = raw ? tournamentSlideStatusBadgeToPostStatus(raw) : null;
              if (!post) return null;
              return (
                <div
                  key={idx}
                  style={{
                    ...base,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    overflow: "hidden",
                  }}
                >
                  <TournamentStatusBadge status={post} />
                </div>
              );
            }
            return (
              <div
                key={idx}
                style={{
                  ...base,
                  fontSize: it.fontSize,
                  fontWeight: it.fontWeight,
                  lineHeight: it.lineHeight,
                  color: it.color,
                  textAlign: it.textAlign as CSSProperties["textAlign"],
                  whiteSpace: it.whiteSpace as CSSProperties["whiteSpace"],
                  overflow: "hidden",
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
              >
                {it.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const MainSiteTournamentCardOverlayFromSnapshot = memo(MainSiteTournamentCardOverlayFromSnapshotInner);
