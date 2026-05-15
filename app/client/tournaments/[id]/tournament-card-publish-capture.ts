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

/** 최종 PNG 가로 약 1280px — 440 아트보드 × 배율 */
export const TOURNAMENT_CARD_PUBLISH_BROWSER_CAPTURE_SCALE = 1280 / TOURNAMENT_CARD_ARTBOARD_WIDTH_PX;

export function isBrowserCaptureDiagEnabled(): boolean {
  return process.env.NEXT_PUBLIC_TOURNAMENT_CARD_BROWSER_CAPTURE_DIAG === "1";
}

function logBrowserCapture(msg: string, extra?: Record<string, unknown>) {
  if (!isBrowserCaptureDiagEnabled()) return;
  if (extra) console.info("[tournament-card-browser-capture]", msg, extra);
  else console.info("[tournament-card-browser-capture]", msg);
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/** html2canvas 캔버스 바닥 — 불투명 사각 비트맵(모서리 알파에 의존하지 않음). 사진 배경은 흰색으로 투명 구멍만 메움. */
function resolvePublishedCardHtml2CanvasBackground(item: SlideDeckItem): string {
  const hasPhoto = item.backgroundType === "image" && Boolean((item.image320Url ?? "").trim());
  if (hasPhoto) {
    return "#ffffff";
  }
  if (item.backgroundType === "theme") {
    const t = item.themeType ?? "dark";
    if (t === "light") return "#e0f2fe";
    if (t === "natural") return "#166534";
    return "#0f2747";
  }
  const cssBg = (item.mediaBackground ?? "").trim();
  if (/^#[0-9a-f]{3,8}$/i.test(cssBg)) return cssBg;
  if (/^rgba?\(/i.test(cssBg)) return cssBg;
  return "#0f2747";
}

function waitForImageElementStrict(img: HTMLImageElement): Promise<void> {
  if (img.complete) {
    const src = (img.currentSrc || img.src || "").trim();
    if (img.naturalWidth === 0 && src) {
      return Promise.reject(new Error(`이미지가 로드되지 않았거나 크기가 0입니다: ${src}`));
    }
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onLoad = () => {
      img.removeEventListener("error", onError);
      const src = (img.currentSrc || img.src || "").trim();
      if (img.naturalWidth === 0 && src) {
        reject(new Error(`이미지 디코드 후 크기가 0입니다: ${src}`));
      } else {
        resolve();
      }
    };
    const onError = () => {
      img.removeEventListener("load", onLoad);
      const src = (img.currentSrc || img.src || "").trim();
      reject(new Error(`이미지 로드 실패: ${src || "(src 없음)"}`));
    };
    img.addEventListener("load", onLoad, { once: true });
    img.addEventListener("error", onError, { once: true });
  });
}

async function waitForAllImagesStrict(root: HTMLElement): Promise<void> {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => waitForImageElementStrict(img)));
}

function assertBackgroundHeroDecoded(article: HTMLElement, expectedImage320Url: string): void {
  const exp = expectedImage320Url.trim();
  if (!exp) return;
  const imgs = [...article.querySelectorAll<HTMLImageElement>("img")];
  const decoded = imgs.filter((i) => i.naturalWidth >= 2 && i.naturalHeight >= 2);
  if (decoded.length === 0) {
    throw new Error("게시 카드 미리보기에서 디코드된 배경 이미지를 찾을 수 없습니다.");
  }
  let expHref = "";
  try {
    expHref = new URL(exp, window.location.origin).href;
  } catch {
    /* ignore */
  }
  const expTail = exp.split("/").pop()?.split("?")[0] ?? exp;
  const matched = decoded.some((img) => {
    const src = (img.currentSrc || img.src || "").trim();
    if (!src) return false;
    if (expHref && src === expHref) return true;
    try {
      if (new URL(src, window.location.origin).href === expHref) return true;
    } catch {
      /* ignore */
    }
    return expTail.length > 1 && src.includes(expTail);
  });
  if (!matched) {
    console.error("[tournament-card-browser-capture] 배경 URL 불일치", {
      expected: exp,
      observed: decoded.map((i) => i.currentSrc || i.src),
    });
    throw new Error("게시 카드 배경 이미지가 미리보기에 로드된 URL과 일치하지 않습니다.");
  }
}

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

/**
 * 미리보기 열의 `transform: scale(...)`는 html2canvas가 배경·레이어를 누락하는 원인이 될 수 있어,
 * 캡처 구간에서만 일시적으로 제거한다.
 */
async function withPreviewScaleTransformSuspended<T>(previewCaptureRoot: HTMLElement, run: () => Promise<T>): Promise<T> {
  const scaleEl = previewCaptureRoot.closest(
    '[data-card-publish-scale-inner="1"]',
  ) as HTMLElement | null;
  if (!scaleEl) {
    return run();
  }
  const prev = scaleEl.style.transform;
  scaleEl.style.transform = "none";
  try {
    await doubleRaf();
    return await run();
  } finally {
    scaleEl.style.transform = prev;
  }
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
    "left:-99999px",
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
 * 게시 발행: 편집 화면의 게시카드 미리보기 루트(`CardPublishPreview` ref, `data-card-publish-artboard`)를
 * html2canvas로 PNG로 캡처한 뒤 `POST /api/client/tournament-card-image`(multipart)로 업로드한다.
 * html2canvas는 이 모듈에서만 동적 import.
 */
export async function captureAndUploadTournamentPublishedCardFullPngInBrowser(args: {
  tournamentId: string;
  item: SlideDeckItem;
  /** `CardPublishPreview` 아트보드 루트(ref) — 폼·페이지 배경 제외, 미리보기 블록만 캡처 */
  previewCaptureRoot: HTMLElement;
  signal?: AbortSignal;
}): Promise<{
  imageId: string;
  publishedCardImageUrl: string;
  publishedCardImage320Url: string;
  publishedCardImage480Url: string;
}> {
  const { tournamentId, item, previewCaptureRoot, signal } = args;
  logBrowserCapture("full-png capture start (preview DOM)", { tournamentId });

  const articleEl = previewCaptureRoot.querySelector("article");
  if (!(articleEl instanceof HTMLElement)) {
    const msg = "게시카드 미리보기에서 카드 article 요소를 찾을 수 없습니다.";
    console.error("[tournament-card-browser-capture]", msg);
    throw new Error(msg);
  }

  try {
    if (typeof document.fonts?.ready?.then === "function") {
      await document.fonts.ready;
    }
    throwIfAborted(signal);
    await waitForAllImagesStrict(previewCaptureRoot);
    throwIfAborted(signal);
    await doubleRaf();
    throwIfAborted(signal);

    const expectsImageBg = item.backgroundType === "image" && Boolean((item.image320Url ?? "").trim());
    if (expectsImageBg) {
      assertBackgroundHeroDecoded(articleEl, item.image320Url!.trim());
    }

    await doubleRaf();
    throwIfAborted(signal);

    const [{ default: html2canvas }] = await Promise.all([import("html2canvas")]);
    const canvasBg = resolvePublishedCardHtml2CanvasBackground(item);
    const canvas = await withPreviewScaleTransformSuspended(previewCaptureRoot, () =>
      html2canvas(previewCaptureRoot, {
        scale: TOURNAMENT_CARD_PUBLISH_BROWSER_CAPTURE_SCALE,
        backgroundColor: canvasBg,
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: TOURNAMENT_CARD_ARTBOARD_WIDTH_PX,
        height: TOURNAMENT_CARD_ARTBOARD_HEIGHT_PX,
      }),
    );

    const blob = await canvasToBlob(canvas);
    logBrowserCapture("full-png canvas ok", {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      blobBytes: blob.size,
    });

    const formData = new FormData();
    formData.append("tournamentId", tournamentId);
    formData.append("file", blob, "tournament-published-card.png");

    const res = await fetch("/api/client/tournament-card-image", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      signal,
    });
    const json = (await res.json()) as {
      error?: string;
      imageId?: string;
      publishedCardImageUrl?: string;
      publishedCardImage320Url?: string;
      publishedCardImage480Url?: string;
      w640Url?: string;
      w480Url?: string;
      w320Url?: string;
    };
    const publishedCardImageUrl = (json.publishedCardImageUrl ?? json.w640Url ?? "").trim();
    const publishedCardImage320Url = (json.publishedCardImage320Url ?? json.w320Url ?? "").trim();
    const publishedCardImage480Url = (json.publishedCardImage480Url ?? json.w480Url ?? "").trim();
    const imageId = (json.imageId ?? "").trim();
    if (!res.ok || !publishedCardImageUrl || !publishedCardImage320Url || !imageId) {
      logBrowserCapture("multipart upload failed", { status: res.status, error: json.error });
      throw new Error(json.error ?? "게시 카드 이미지 업로드에 실패했습니다.");
    }
    logBrowserCapture("full-png upload ok", { imageId, publishedCardImageUrl });
    return {
      imageId,
      publishedCardImageUrl,
      publishedCardImage320Url,
      publishedCardImage480Url: publishedCardImage480Url || publishedCardImage320Url,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[tournament-card-browser-capture] full-png capture failed", msg, e);
    throw e;
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
      backgroundColor: resolvePublishedCardHtml2CanvasBackground(item),
      useCORS: true,
      allowTaint: false,
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
