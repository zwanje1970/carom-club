"use client";

import styles from "./main-scene-slide-deck.module.css";

export type TournamentPostStatus = "모집중" | "마감임박" | "대기자모집" | "마감" | "종료";

export type SlideDeckItem = {
  snapshotId: string;
  title: string;
  subtitle: string;
  image320Url?: string;
  statusBadge?: string;
  cardExtraLine1?: string | null;
  cardExtraLine2?: string | null;
  /** 게시 스냅샷 v2 */
  cardTemplate?: "A" | "B";
  backgroundType?: "image" | "theme";
  themeType?: "dark" | "light" | "natural";
};

function toStatus(value: string | undefined): TournamentPostStatus {
  const badge = (value ?? "").trim();
  if (badge.includes("마감임박")) return "마감임박";
  if (badge.includes("대기")) return "대기자모집";
  if (badge.includes("종료")) return "종료";
  if (badge.includes("마감")) return "마감";
  return "모집중";
}

function parseSubtitle(subtitle: string): { dateText: string; placeText: string } {
  const parts = subtitle
    .split("·")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (parts.length === 0) return { dateText: "-", placeText: "-" };
  if (parts.length === 1) return { dateText: parts[0], placeText: "-" };
  return { dateText: parts[0], placeText: parts.slice(1).join(" · ") };
}

function toStatusClass(status: TournamentPostStatus) {
  if (status === "모집중") return "badgeRecruiting";
  if (status === "마감임박") return "badgeClosing";
  if (status === "대기자모집") return "badgeWaitlist";
  if (status === "마감") return "badgeFull";
  return "badgeEnded";
}

export function SlideDeckCard({ item }: { item: SlideDeckItem }) {
  const status = toStatus(item.statusBadge);
  const parsed = parseSubtitle(item.subtitle);
  const lead = (item.cardExtraLine1 ?? "").trim();
  const description = (item.cardExtraLine2 ?? "").trim();
  const placeText = parsed.placeText;
  const dateText = parsed.dateText;
  const tpl = item.cardTemplate === "B" ? "B" : "A";
  const bg = item.backgroundType === "theme" ? "theme" : "image";
  const th = item.themeType === "light" ? "light" : item.themeType === "natural" ? "natural" : "dark";
  const themeClass = th === "light" ? styles.themeLight : th === "natural" ? styles.themeNatural : styles.themeDark;

  const showImage = bg === "image" && item.image320Url?.trim();

  if (tpl === "B") {
    return (
      <article className={`${styles.tournamentPostCard} ${styles.tplB} ${themeClass}`}>
        {showImage ? (
          <img
            className={styles.tournamentPostCardBg}
            src={item.image320Url}
            alt={item.title}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className={`${styles.tournamentPostCardBgFallback} ${styles.themeOnlyBg}`} aria-hidden />
        )}
        <div className={styles.tplBOverlay} aria-hidden />
        <div className={styles.tplBInner}>
          <div className={styles.tplBBadgeRow}>
            <span className={`${styles.tournamentPostCardBadge} ${styles[toStatusClass(status)]}`}>{status}</span>
          </div>
          <div className={styles.tplBCenter}>
            {lead ? <p className={styles.tournamentPostCardLead}>{lead}</p> : null}
            <h3 className={styles.tournamentPostCardTitle}>{item.title}</h3>
            {description ? <p className={styles.tournamentPostCardDesc}>{description}</p> : null}
          </div>
          <div className={styles.tplBMetaBar}>
            <p className={styles.tplBMetaLine}>
              {dateText} <span className={styles.tplMetaDot}>·</span> {placeText}
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`${styles.tournamentPostCard} ${styles.tplA} ${themeClass}`}>
      {showImage ? (
        <img
          className={styles.tournamentPostCardBg}
          src={item.image320Url}
          alt={item.title}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div className={`${styles.tournamentPostCardBgFallback} ${styles.themeOnlyBg}`} aria-hidden />
      )}
      <div className={styles.tournamentPostCardOverlay} aria-hidden />
      <div className={styles.tournamentPostCardInner}>
        <div className={styles.tournamentPostCardTop}>
          <div className={styles.tournamentPostCardMain}>
            {lead ? <p className={styles.tournamentPostCardLead}>{lead}</p> : null}
            <h3 className={styles.tournamentPostCardTitle}>{item.title}</h3>
            {description ? <p className={styles.tournamentPostCardDesc}>{description}</p> : null}
          </div>
          <span className={`${styles.tournamentPostCardBadge} ${styles[toStatusClass(status)]}`}>{status}</span>
        </div>
        <div className={styles.tournamentPostCardMeta}>
          <p className={styles.tournamentPostCardDate}>{dateText}</p>
          <p className={styles.tournamentPostCardPlace}>{placeText}</p>
        </div>
      </div>
    </article>
  );
}
