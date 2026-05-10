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

/**
 * 440×180 고정 아트보드로 카드를 렌더한 뒤 PNG 업로드 → w640/w320 공개 URL.
 * 메인에서는 호출하지 않는다.
 */
export async function captureAndUploadTournamentCardSnapshots(item: SlideDeckItem): Promise<{
  publishedCardImageUrl: string;
  publishedCardImage320Url: string;
}> {
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
    }),
  );

  try {
    if (typeof document.fonts?.ready?.then === "function") {
      await document.fonts.ready;
    }
    await waitForImages(host);
    await doubleRaf();

    const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);
    const canvas = await html2canvas(host, {
      scale: 2,
      backgroundColor: null,
      useCORS: true,
      logging: false,
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
    };
  } finally {
    reactRoot.unmount();
    host.remove();
  }
}
