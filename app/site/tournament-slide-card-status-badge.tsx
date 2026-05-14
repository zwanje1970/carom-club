"use client";

import "./tournament-post-card-status-badges.css";

export type TournamentPostStatus = "모집중" | "마감임박" | "마감" | "진행중" | "종료";

/** 스냅샷·compact의 `statusBadge` 문자열 → 배지 컴포넌트용 상태(메인 HTML 오버레이·미리보기 공통) */
export function tournamentSlideStatusBadgeToPostStatus(raw: string | undefined | null): TournamentPostStatus {
  const badge = (raw ?? "").trim();
  if (badge === "진행중") return "진행중";
  if (badge.includes("마감임박") || (badge.includes("마감") && badge.includes("임박"))) return "마감임박";
  if (badge.includes("종료")) return "종료";
  if (badge.includes("마감")) return "마감";
  return "모집중";
}

const STATUS_CLASS: Record<TournamentPostStatus, string> = {
  모집중: "tournament-post-card__badge--recruiting",
  마감임박: "tournament-post-card__badge--closing",
  마감: "tournament-post-card__badge--full",
  진행중: "tournament-post-card__badge--live",
  종료: "tournament-post-card__badge--ended",
};

/** carom-postcard-template-test: TournamentPostCard.tsx TournamentStatusBadge */
export function TournamentStatusBadge({
  status,
  hideLabel,
}: {
  status: TournamentPostStatus;
  /** true: 글자만 숨김(배지 박스·배경 유지) — PNG 캡처용 */
  hideLabel?: boolean;
}) {
  return (
    <span className={`tournament-post-card__badge ${STATUS_CLASS[status]}`}>
      <span
        className={hideLabel ? "tournament-post-card__badge-label--image-capture-hidden" : undefined}
        aria-hidden={hideLabel ? true : undefined}
      >
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
