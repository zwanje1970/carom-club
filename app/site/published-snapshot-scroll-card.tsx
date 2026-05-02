"use client";

import Link from "next/link";
import type { PointerEvent } from "react";
import { memo } from "react";
import ps from "./published-snapshot-scroll-card.module.css";

const SITE_SCROLL_SHORTCUT = "data-site-scroll-shortcut";

export type PublishedSnapshotScrollCardProps = {
  imageUrl: string;
  href: string;
  title: string;
  alt?: string;
  external: boolean;
  selected: boolean;
  lcpHeroImage: boolean;
};

const fullHitClass = (selected: boolean) =>
  `${ps.fullHit} ${selected ? ps.fullHitActive : ps.fullHitPassive}`.trim();

/** 메인 스크롤: 대회 게시 완료 PNG 플랫 카드(오버레이 없음) 전용 렌더 */
export const PublishedSnapshotScrollCard = memo(function PublishedSnapshotScrollCard({
  imageUrl,
  href,
  title,
  alt,
  external,
  selected,
  lcpHeroImage,
}: PublishedSnapshotScrollCardProps) {
  const altText = (alt ?? title).trim() || "";

  return (
    <div className={`${ps.face} ${selected ? ps.faceSelected : ""}`.trim()}>
      <div className={ps.inner}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={altText}
          className={ps.img}
          decoding="async"
          loading={lcpHeroImage ? "eager" : "lazy"}
          {...(lcpHeroImage ? { fetchPriority: "high" as const } : {})}
        />
      </div>
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={fullHitClass(selected)}
          tabIndex={-1}
          aria-hidden
        >
          {"\u200b"}
        </a>
      ) : (
        <Link href={href} prefetch={false} className={fullHitClass(selected)} tabIndex={-1} aria-hidden>
          {"\u200b"}
        </Link>
      )}
      {external ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={ps.cta}
          {...{ [SITE_SCROLL_SHORTCUT]: "" }}
          tabIndex={selected ? 0 : -1}
          aria-hidden={!selected}
          onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => e.stopPropagation()}
        >
          자세히 보기 ▶
        </a>
      ) : (
        <Link
          href={href}
          prefetch={false}
          className={ps.cta}
          {...{ [SITE_SCROLL_SHORTCUT]: "" }}
          tabIndex={selected ? 0 : -1}
          aria-hidden={!selected}
          onPointerDown={(e: PointerEvent<HTMLAnchorElement>) => e.stopPropagation()}
        >
          자세히 보기 ▶
        </Link>
      )}
    </div>
  );
});

PublishedSnapshotScrollCard.displayName = "PublishedSnapshotScrollCard";
