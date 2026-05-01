"use client";

import type { CSSProperties } from "react";
import "./tournament-post-card-status-badges.css";

export type TournamentPostStatus = "모집중" | "마감임박" | "대기자모집" | "마감" | "종료";

const STATUS_CLASS: Record<TournamentPostStatus, string> = {
  모집중: "tournament-post-card__badge--recruiting",
  마감임박: "tournament-post-card__badge--closing",
  대기자모집: "tournament-post-card__badge--waitlist",
  마감: "tournament-post-card__badge--full",
  종료: "tournament-post-card__badge--ended",
};

/** carom-postcard-template-test: TournamentPostCard.tsx TournamentStatusBadge + v3 대기자모집 */
export function TournamentStatusBadge({
  status,
  hideLabel,
}: {
  status: TournamentPostStatus;
  /** true: 글자만 숨김(배지 박스·배경 유지) — PNG 캡처용 */
  hideLabel?: boolean;
}) {
  const labelWrapStyle = hideLabel ? ({ visibility: "hidden" as const } satisfies CSSProperties) : undefined;
  return (
    <span className={`tournament-post-card__badge ${STATUS_CLASS[status]}`}>
      <span style={labelWrapStyle} aria-hidden={hideLabel ? true : undefined}>
        {status === "마감임박" ? (
          <>
            <span className="tournament-post-card__badge-line">마감</span>
            <span className="tournament-post-card__badge-line">임박</span>
          </>
        ) : (
          status
        )}
      </span>
    </span>
  );
}
