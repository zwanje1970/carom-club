"use client";

import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

/** `/client/tournaments/new|edit|card-publish-v2` 전용 — 공개 사이트 번들에서 import 금지 */

function isKeyboardAdjustableField(el: HTMLElement): boolean {
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (el as HTMLInputElement).type?.toLowerCase() ?? "text";
  const excluded = new Set(["hidden", "button", "submit", "reset", "checkbox", "radio", "file", "image"]);
  return !excluded.has(type);
}

function visualViewportBottomPx(): number {
  const vv = window.visualViewport;
  if (!vv) return window.innerHeight;
  return vv.offsetTop + vv.height;
}

function isKeyboardScrollContainer(el: HTMLElement): boolean {
  if (el.classList.contains("app-client-mobile-main-scroll")) return true;
  const st = getComputedStyle(el);
  if (st.overflowY !== "auto" && st.overflowY !== "scroll") return false;
  return el.scrollHeight > el.clientHeight + 2;
}

function buildScrollChain(el: HTMLElement, pageRoot: HTMLElement): HTMLElement[] {
  const chain: HTMLElement[] = [];
  let p: HTMLElement | null = el.parentElement;
  while (p && pageRoot.contains(p)) {
    if (isKeyboardScrollContainer(p)) chain.push(p);
    p = p.parentElement;
  }
  const main = document.querySelector(".app-client-mobile-main-scroll");
  if (main instanceof HTMLElement && pageRoot.contains(main) && chain[chain.length - 1] !== main) {
    chain.push(main);
  }
  return chain;
}

function scrollFieldAboveKeyboard(field: HTMLElement, pageRoot: HTMLElement, behavior: ScrollBehavior) {
  const chain = buildScrollChain(field, pageRoot);
  if (chain.length === 0) return;

  const edgePad = 10;
  let nextBehavior: ScrollBehavior = behavior;

  for (let iter = 0; iter < 12; iter++) {
    const rect = field.getBoundingClientRect();
    const visibleBottom = visualViewportBottomPx() - edgePad;
    if (rect.bottom <= visibleBottom) return;

    const delta = rect.bottom - visibleBottom;
    let progressed = false;

    for (const sc of chain) {
      const max = sc.scrollHeight - sc.clientHeight;
      const roomDown = max - sc.scrollTop;
      if (roomDown < 1) continue;
      const apply = Math.min(delta, roomDown);
      if (apply < 1) continue;
      sc.scrollBy({ top: apply, behavior: nextBehavior });
      progressed = true;
      break;
    }

    if (!progressed) return;
    nextBehavior = "auto";
  }
}

export function useClientTournamentFormKeyboardScroll(pageRootRef: RefObject<HTMLElement | null>): void {
  const focusedRef = useRef<HTMLElement | null>(null);
  const rafAdjustRef = useRef<number | null>(null);
  const textareaResizeObserverRef = useRef<ResizeObserver | null>(null);

  const scheduleAdjust = useCallback(
    (behavior: ScrollBehavior) => {
      if (typeof window === "undefined") return;
      if (rafAdjustRef.current !== null) cancelAnimationFrame(rafAdjustRef.current);
      rafAdjustRef.current = requestAnimationFrame(() => {
        rafAdjustRef.current = null;
        requestAnimationFrame(() => {
          const field = focusedRef.current;
          const root = pageRootRef.current;
          if (!field || !root || !root.contains(field)) return;
          scrollFieldAboveKeyboard(field, root, behavior);
        });
      });
    },
    [pageRootRef],
  );

  useLayoutEffect(() => {
    const root = pageRootRef.current;
    if (!root) return;

    const detachTextareaResizeObserver = () => {
      textareaResizeObserverRef.current?.disconnect();
      textareaResizeObserverRef.current = null;
    };

    const onFocusIn = (e: FocusEvent) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!root.contains(t)) return;
      if (!isKeyboardAdjustableField(t)) return;
      focusedRef.current = t;
      detachTextareaResizeObserver();
      if (t.tagName === "TEXTAREA" && typeof ResizeObserver !== "undefined") {
        const ro = new ResizeObserver(() => scheduleAdjust("auto"));
        ro.observe(t);
        textareaResizeObserverRef.current = ro;
      }
      scheduleAdjust("smooth");
    };

    const onFocusOut = (e: FocusEvent) => {
      const rt = e.relatedTarget;
      if (rt instanceof Node && root.contains(rt)) return;
      focusedRef.current = null;
      detachTextareaResizeObserver();
    };

    const onInput = (e: Event) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!root.contains(t)) return;
      if (t.tagName !== "TEXTAREA") return;
      scheduleAdjust("auto");
    };

    root.addEventListener("focusin", onFocusIn);
    root.addEventListener("focusout", onFocusOut);
    root.addEventListener("input", onInput, true);

    const vv = window.visualViewport;
    const onVv = () => scheduleAdjust("auto");
    vv?.addEventListener("resize", onVv);
    vv?.addEventListener("scroll", onVv);

    return () => {
      detachTextareaResizeObserver();
      root.removeEventListener("focusin", onFocusIn);
      root.removeEventListener("focusout", onFocusOut);
      root.removeEventListener("input", onInput, true);
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
      if (rafAdjustRef.current !== null) cancelAnimationFrame(rafAdjustRef.current);
    };
  }, [pageRootRef, scheduleAdjust]);
}
