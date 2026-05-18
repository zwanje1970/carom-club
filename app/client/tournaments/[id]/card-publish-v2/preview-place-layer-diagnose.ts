"use client";

/** 게시카드 미리보기·캡처 시 장소 텍스트 / 분할영역 레이어 진단(기능·스타일 변경 없음) */
const ENABLE_PLACE_LAYER_DIAGNOSE_LOG = process.env.NODE_ENV !== "production";

export type PlaceLayerDiagnosePhase = "preview" | "capture-before-path" | "capture-before-run";

function describeElement(el: Element | null): string {
  if (!el) return "(none)";
  const node = el as HTMLElement;
  const parts: string[] = [node.tagName.toLowerCase()];
  const cls = typeof node.className === "string" ? node.className.trim() : "";
  if (cls) parts.push(`class=${cls.slice(0, 120)}`);
  const overlay = node.dataset.tournamentCardOverlay;
  if (overlay) parts.push(`overlay=${overlay}`);
  if (node.dataset.cardOutlinePathLayer === "1") parts.push("pathLayer=1");
  return parts.join(" ");
}

function readComputedLayer(el: HTMLElement) {
  const style = window.getComputedStyle(el);
  return {
    position: style.position,
    zIndex: style.zIndex,
    opacity: style.opacity,
    transform: style.transform === "none" ? "" : style.transform,
    filter: style.filter === "none" ? "" : style.filter,
    mixBlend: style.mixBlendMode === "normal" ? "" : style.mixBlendMode,
  };
}

function formatRect(rect: DOMRect): string {
  return `x=${Math.round(rect.x)},y=${Math.round(rect.y)},w=${Math.round(rect.width)},h=${Math.round(rect.height)}`;
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

function findSplitBackgroundEl(place: HTMLElement): HTMLElement | null {
  const footer = place.closest("footer");
  if (footer) {
    const first = footer.firstElementChild;
    if (first instanceof HTMLElement) return first;
  }
  const captureRoot = place.closest('[data-tournament-card-capture-root="1"]');
  if (captureRoot) {
    const bg = captureRoot.querySelector("footer > div:first-child");
    if (bg instanceof HTMLElement) return bg;
  }
  return null;
}

function collectAncestorLayerInfluences(el: HTMLElement, stopAt: HTMLElement | null) {
  const opacityChain: string[] = [];
  const filterChain: string[] = [];
  const mixBlendChain: string[] = [];
  let cur: HTMLElement | null = el.parentElement;
  while (cur && cur !== stopAt?.parentElement) {
    const style = window.getComputedStyle(cur);
    const opacity = Number.parseFloat(style.opacity || "1");
    if (opacity < 0.999) {
      opacityChain.push(`${describeElement(cur)} opacity=${style.opacity}`);
    }
    if (style.filter && style.filter !== "none") {
      filterChain.push(`${describeElement(cur)} filter=${style.filter}`);
    }
    if (style.mixBlendMode && style.mixBlendMode !== "normal") {
      mixBlendChain.push(`${describeElement(cur)} mixBlend=${style.mixBlendMode}`);
    }
    if (cur === stopAt) break;
    cur = cur.parentElement;
  }
  return { opacityChain, filterChain, mixBlendChain };
}

function stackIndexForTarget(stack: Element[], target: Element): number {
  return stack.findIndex((el) => el === target || el.contains(target));
}

export function logPlaceLayerDiagnosis(cardRoot: HTMLElement, phase: PlaceLayerDiagnosePhase): void {
  if (!ENABLE_PLACE_LAYER_DIAGNOSE_LOG) return;

  const place = cardRoot.querySelector<HTMLElement>('[data-tournament-card-overlay="place"]');
  if (!(place instanceof HTMLElement)) {
    console.info("[place-layer-diagnose]", { phase, error: "place-element-missing" });
    return;
  }

  const split = findSplitBackgroundEl(place);
  const placeLayer = readComputedLayer(place);
  const parent = place.parentElement;

  console.info("[place-layer]", {
    phase,
    tag: place.tagName.toLowerCase(),
    class: typeof place.className === "string" ? place.className : "",
    parent: parent ? describeElement(parent) : "",
    parentClass: parent && typeof parent.className === "string" ? parent.className : "",
    position: placeLayer.position,
    zIndex: placeLayer.zIndex,
    opacity: placeLayer.opacity,
    transform: placeLayer.transform,
    filter: placeLayer.filter,
    mixBlend: placeLayer.mixBlend,
    color: window.getComputedStyle(place).color,
    visibility: window.getComputedStyle(place).visibility,
  });

  const parentEl = place.parentElement;
  const childIndex = parentEl ? Array.prototype.indexOf.call(parentEl.children, place) : -1;
  const prev = place.previousElementSibling;
  const next = place.nextElementSibling;

  console.info("[place-dom-order]", {
    phase,
    childIndex,
    prev: describeElement(prev),
    next: describeElement(next),
    footerChildIndex:
      place.closest("footer") && parentEl?.parentElement === place.closest("footer")
        ? Array.prototype.indexOf.call(place.closest("footer")!.children, parentEl)
        : parentEl
          ? Array.prototype.indexOf.call(place.closest("footer")?.children ?? [], parentEl)
          : -1,
    footerChildren: place.closest("footer")
      ? Array.from(place.closest("footer")!.children).map((c) => describeElement(c))
      : [],
  });

  if (split instanceof HTMLElement) {
    const splitLayer = readComputedLayer(split);
    console.info("[split-layer]", {
      phase,
      class: typeof split.className === "string" ? split.className : "",
      position: splitLayer.position,
      zIndex: splitLayer.zIndex,
      opacity: splitLayer.opacity,
      filter: splitLayer.filter,
      mixBlend: splitLayer.mixBlend,
      backgroundColor: window.getComputedStyle(split).backgroundColor,
    });
  } else {
    console.info("[split-layer]", { phase, error: "split-background-missing" });
  }

  const placeRect = place.getBoundingClientRect();
  const splitRect = split?.getBoundingClientRect();
  const overlapping = splitRect ? rectsOverlap(placeRect, splitRect) : false;

  console.info("[layer-overlap]", {
    phase,
    place: formatRect(placeRect),
    split: splitRect ? formatRect(splitRect) : "(none)",
    isOverlapping: overlapping,
  });

  const centerX = placeRect.left + placeRect.width / 2;
  const centerY = placeRect.top + placeRect.height / 2;
  const stack =
    centerX >= 0 && centerY >= 0 && placeRect.width > 0 && placeRect.height > 0
      ? document.elementsFromPoint(centerX, centerY)
      : [];

  const stackLines: Record<string, string> = {};
  stack.slice(0, 12).forEach((el, i) => {
    stackLines[String(i)] = describeElement(el);
  });
  console.info("[elements-stack]", { phase, center: `x=${Math.round(centerX)},y=${Math.round(centerY)}`, ...stackLines });

  const influences = collectAncestorLayerInfluences(place, cardRoot);
  const placeStackIdx = stackIndexForTarget(stack, place);
  const splitStackIdx = split ? stackIndexForTarget(stack, split) : -1;
  const topAtCenter = stack[0] ? describeElement(stack[0]) : "(empty)";
  const placeIsTopAtCenter = placeStackIdx === 0;
  const splitAbovePlace =
    splitStackIdx >= 0 && placeStackIdx >= 0 ? splitStackIdx < placeStackIdx : splitStackIdx === 0;

  const pathSvg = cardRoot.querySelector('[data-card-outline-path-layer="1"]');
  const pathLayerAbovePlace =
    pathSvg instanceof SVGSVGElement && stackIndexForTarget(stack, pathSvg) >= 0
      ? stackIndexForTarget(stack, pathSvg) < placeStackIdx
      : false;

  let domPlaceAboveSplitBg = false;
  const footer = place.closest("footer");
  if (footer && split) {
    const placeAncestor =
      place.parentElement && footer.contains(place.parentElement) ? place.parentElement : place;
    domPlaceAboveSplitBg =
      Array.prototype.indexOf.call(footer.children, placeAncestor) >
      Array.prototype.indexOf.call(footer.children, split);
  }

  console.info("[place-layer-diagnose-conclusion]", {
    phase,
    domPlaceAboveSplitBg,
    placeIsTopAtCenter,
    splitAbovePlaceAtCenter: splitAbovePlace,
    pathLayerAbovePlace,
    topAtCenter,
    placeStackIdx,
    splitStackIdx,
    isOverlapping: overlapping,
    parentOpacityInfluence: influences.opacityChain,
    parentFilterInfluence: influences.filterChain,
    parentMixBlendInfluence: influences.mixBlendChain,
    verdict:
      splitAbovePlace && !placeIsTopAtCenter
        ? "place-under-split-at-center"
        : placeIsTopAtCenter
          ? pathLayerAbovePlace
            ? "place-top-but-path-layer-may-cover"
            : influences.opacityChain.length > 0 || placeLayer.opacity !== "1"
              ? "place-top-parent-opacity-may-dim"
              : placeLayer.filter || influences.filterChain.length > 0
                ? "place-top-filter-may-dim"
                : "place-top-no-split-cover"
          : domPlaceAboveSplitBg
            ? "place-above-split-in-dom-check-stack"
            : "inconclusive-check-stack",
  });
}
