"use client";

import Link from "next/link";
import type { MouseEventHandler } from "react";
import type { SlotBlockCtaLayer } from "@/lib/slot-block-cta";
import { resolveCtaNavigation } from "@/lib/slot-block-cta";
import type { SlotBlockCtaContext } from "@/lib/slot-block-cta";

type Props = {
  layer: SlotBlockCtaLayer | undefined;
  ctx: SlotBlockCtaContext;
  className?: string;
  tabIndex?: number;
  "aria-label"?: string;
  "aria-hidden"?: boolean | "true" | "false";
  /** Runs before navigation (e.g. carousel drag → preventDefault). */
  onClick?: MouseEventHandler<HTMLElement>;
  children: React.ReactNode;
};

export function SlotBlockCtaLink({
  layer,
  ctx,
  className,
  tabIndex,
  "aria-label": ariaLabel,
  "aria-hidden": ariaHidden,
  onClick,
  children,
}: Props) {
  const nav = resolveCtaNavigation(layer, ctx);

  if (nav.kind === "action" && nav.actionKey === "scroll_top") {
    return (
      <button
        type="button"
        className={className}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden === true || ariaHidden === "true" ? true : undefined}
        onClick={(e) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      >
        {children}
      </button>
    );
  }

  if (nav.kind === "href") {
    if (nav.external) {
      return (
        <a
          href={nav.href}
          className={className}
          tabIndex={tabIndex}
          aria-label={ariaLabel}
          aria-hidden={ariaHidden === true || ariaHidden === "true" ? true : undefined}
          target={nav.newTab ? "_blank" : undefined}
          rel={nav.newTab ? "noopener noreferrer" : undefined}
          onClick={onClick}
        >
          {children}
        </a>
      );
    }
    return (
      <Link
        href={nav.href}
        className={className}
        tabIndex={tabIndex}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden === true || ariaHidden === "true" ? true : undefined}
        onClick={onClick}
      >
        {children}
      </Link>
    );
  }

  return (
    <span
      className={className}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      aria-hidden={ariaHidden === true || ariaHidden === "true" ? true : undefined}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
