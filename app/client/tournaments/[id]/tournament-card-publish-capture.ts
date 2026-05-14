"use client";

import { createElement } from "react";
import { createRoot } from "react-dom/client";

import {
  SLIDE_DECK_SOLID_BACKDROPS,
  TournamentSnapshotCardView,
  type SlideDeckItem,
} from "../../../site/tournament-snapshot-card-view";
import {
  TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
  TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
} from "../../../../lib/site/tournament-card-artboard";
import type {
  TournamentCardOverlaySnapshot,
  TournamentCardOverlaySnapshotItem,
} from "../../../../lib/site/tournament-card-overlay-snapshot";
import { isTournamentCardOverlaySlotType } from "../../../../lib/site/tournament-card-overlay-snapshot";

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  const pending = imgs.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return Promise.all(
    pending.map(
      (img) =>
        new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => {});
}

function doubleRaf(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}

function createCaptureHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("data-tournament-card-capture-host", "1");
  host.style.cssText = [
    "position:fixed",
    "left:-12000px",
    "top:0",
    `width:${TOURNAMENT_CARD_ARTBOARD_WIDTH_PX}px`,
    `height:${TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX}px`,
    "overflow:hidden",
    "background:transparent",
    "z-index:-1",
    "pointer-events:none",
    "box-sizing:border-box",
  ].join(";");
  return host;
}

function measureOverlayFromArticle(article: HTMLElement): TournamentCardOverlaySnapshot | null {
  const ar = article.getBoundingClientRect();
  if (!Number.isFinite(ar.width) || !Number.isFinite(ar.height) || ar.width < 10 || ar.height < 10) {
    return null;
  }
  const nodes = [...article.querySelectorAll<HTMLElement>("[data-tournament-card-overlay]")];
  const items: TournamentCardOverlaySnapshotItem[] = [];
  for (const el of nodes) {
    const kindRaw = el.getAttribute("data-tournament-card-overlay")?.trim() ?? "";
    if (!isTournamentCardOverlaySlotType(kindRaw)) continue;
    const r = el.getBoundingClientRect();
    const w = r.width;
    const h = r.height;
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 0.5 || h < 0.5) continue;
    const cs = getComputedStyle(el);
    const x = r.left - ar.left;
    const y = r.top - ar.top;
    const zRaw = cs.zIndex;
    const zParsed = zRaw === "auto" ? NaN : Number.parseInt(zRaw, 10);
    const zIndex = Number.isFinite(zParsed) ? zParsed : 0;
    if (kindRaw === "statusBadge") {
      const raw = (el.getAttribute("data-status-badge-display") ?? el.innerText ?? "").trim();
      items.push({
        type: "statusBadge",
        text: raw,
        x,
        y,
        width: w,
        height: h,
        fontSize: cs.fontSize || "12px",
        fontWeight: cs.fontWeight || "600",
        lineHeight: cs.lineHeight || "normal",
        color: cs.color || "#ffffff",
        textAlign: cs.textAlign || "center",
        zIndex,
        whiteSpace: cs.whiteSpace || "normal",
        statusBadgeRaw: raw,
      });
      continue;
    }
    const text = (el.innerText ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
    if (!text && kindRaw !== "title") continue;
    items.push({
      type: kindRaw,
      text: text || (kindRaw === "title" ? "(제목)" : ""),
      x,
      y,
      width: w,
      height: h,
      fontSize: cs.fontSize || "14px",
      fontWeight: cs.fontWeight || "400",
      lineHeight: cs.lineHeight || "normal",
      color: cs.color || "#ffffff",
      textAlign: cs.textAlign || "start",
      zIndex,
      whiteSpace: cs.whiteSpace || "normal",
    });
  }
  if (items.length === 0) return null;
  if (!items.some((i) => i.type === "title")) return null;
  return {
    v: 1,
    cardBaseWidth: TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
    cardBaseHeight: TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
    items,
  };
}

async function captureOverlaySnapshotDom(item: SlideDeckItem): Promise<TournamentCardOverlaySnapshot | null> {
  const host = createCaptureHost();
  document.body.appendChild(host);
  const reactRoot = createRoot(host);
  reactRoot.render(
    createElement(TournamentSnapshotCardView, {
      item,
      slideDeck: true,
      slideDeckAspectFill: true,
      templateCardLayout: true,
      suppressLink: true,
      artboardPx: true,
      slideDeckSolidBackdrop: SLIDE_DECK_SOLID_BACKDROPS[0],
      isImageCaptureMode: false,
    }),
  );
  try {
    if (typeof document.fonts?.ready?.then === "function") {
      await document.fonts.ready;
    }
    await waitForImages(host);
    await doubleRaf();
    const articleEl = host.querySelector("article");
    if (!(articleEl instanceof HTMLElement)) return null;
    return measureOverlayFromArticle(articleEl);
  } finally {
    reactRoot.unmount();
    host.remove();
  }
}

/**
 * 440×180 고정 아트보드로 카드를 렌더한 뒤 PNG 업로드 → w640/w320 공개 URL.
 * 글자 레이어는 별도 렌더에서 측정해 overlaySnapshot으로 반환한다.
 * 메인에서는 호출하지 않는다.
 */
export async function captureAndUploadTournamentCardSnapshots(item: SlideDeckItem): Promise<{
  publishedCardImageUrl: string;
  publishedCardImage320Url: string;
  overlaySnapshot: TournamentCardOverlaySnapshot | null;
}> {
  const overlaySnapshot = await captureOverlaySnapshotDom(item);

  const host = createCaptureHost();
  document.body.appendChild(host);
  const reactRoot = createRoot(host);
  reactRoot.render(
    createElement(TournamentSnapshotCardView, {
      item,
      slideDeck: true,
      slideDeckAspectFill: true,
      templateCardLayout: true,
      suppressLink: true,
      artboardPx: true,
      slideDeckSolidBackdrop: SLIDE_DECK_SOLID_BACKDROPS[0],
      /** 배경·띠·배지틀만 PNG — 글자는 메인 HTML */
      isImageCaptureMode: true,
    }),
  );

  try {
    if (typeof document.fonts?.ready?.then === "function") {
      await document.fonts.ready;
    }
    await waitForImages(host);
    await doubleRaf();

    const articleEl = host.querySelector("article");
    const captureRoot = articleEl instanceof HTMLElement ? articleEl : host;
    for (const img of host.querySelectorAll("img")) {
      img.crossOrigin = "anonymous";
    }
    await waitForImages(host);
    await doubleRaf();

    const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);
    const canvas = await html2canvas(captureRoot, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
      width: TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
      height: TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
    });

    const blob = await canvasToBlob(canvas);
    const formData = new FormData();
    formData.append("file", blob, "tournament-published-card.png");
    formData.append("sitePublic", "1");
    formData.append("purpose", "published-card-snapshot");

    const res = await fetch("/api/upload/image", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
    });
    const json = (await res.json()) as {
      error?: string;
      w320Url?: string;
      w640Url?: string;
    };
    if (!res.ok || !json.w640Url?.trim() || !json.w320Url?.trim()) {
      throw new Error(json.error ?? "스냅샷 이미지 업로드에 실패했습니다.");
    }
    return {
      publishedCardImageUrl: json.w640Url.trim(),
      publishedCardImage320Url: json.w320Url.trim(),
      overlaySnapshot,
    };
  } finally {
    reactRoot.unmount();
    host.remove();
  }
}
