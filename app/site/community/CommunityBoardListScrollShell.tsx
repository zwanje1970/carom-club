"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { buildCommunityListScrollSignature } from "./community-list-scroll";

const COMMUNITY_SCROLL_STORAGE_KEY = "carom.site.community.scrollY";

function readStoredListScroll(signature: string): { scrollY: number } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(COMMUNITY_SCROLL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { signature?: unknown; scrollY?: unknown };
    if (parsed.signature !== signature || typeof parsed.scrollY !== "number") return null;
    return { scrollY: parsed.scrollY };
  } catch {
    return null;
  }
}

function writeStoredListScroll(signature: string, scrollY: number): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      COMMUNITY_SCROLL_STORAGE_KEY,
      JSON.stringify({ signature, scrollY: Math.max(0, scrollY) }),
    );
  } catch {
    /* ignore */
  }
}

function shouldSaveScrollBeforeDetailNavigate(ev: React.MouseEvent): boolean {
  if (ev.defaultPrevented) return false;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
  if (ev.button !== 0) return false;
  return true;
}

type Props = {
  boardListKey: string;
  searchParams: Record<string, string | string[] | undefined>;
  itemsCount: number;
  children: ReactNode;
};

export default function CommunityBoardListScrollShell({
  boardListKey,
  searchParams,
  itemsCount,
  children,
}: Props) {
  const listScrollSignature = useMemo(
    () => buildCommunityListScrollSignature(boardListKey, searchParams),
    [boardListKey, searchParams],
  );
  const didRestoreForSignatureRef = useRef<string | null>(null);

  const saveScrollBeforeDetail = useCallback(() => {
    writeStoredListScroll(listScrollSignature, window.scrollY || window.pageYOffset || 0);
  }, [listScrollSignature]);

  useEffect(() => {
    if (itemsCount === 0) return;
    if (didRestoreForSignatureRef.current === listScrollSignature) return;
    const stored = readStoredListScroll(listScrollSignature);
    didRestoreForSignatureRef.current = listScrollSignature;
    if (!stored) return;
    const y = stored.scrollY;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.scrollTo(0, y);
      });
    });
  }, [itemsCount, listScrollSignature]);

  function onClickCapture(ev: React.MouseEvent<HTMLDivElement>) {
    if (!shouldSaveScrollBeforeDetailNavigate(ev)) return;
    const t = ev.target as HTMLElement | null;
    const a = t?.closest?.("a.ui-community-board-row-link") as HTMLAnchorElement | null;
    if (!a) return;
    const href = typeof a.getAttribute === "function" ? (a.getAttribute("href") ?? "") : "";
    if (!href.startsWith("/site/community/")) return;
    const segments = href.split("/").filter(Boolean);
    if (segments.length < 4) return;
    if (segments[3] === "write" || segments[3] === "edit") return;
    saveScrollBeforeDetail();
  }

  return (
    <div style={{ display: "contents" }} onClickCapture={onClickCapture}>
      {children}
    </div>
  );
}
