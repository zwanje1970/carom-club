"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEventHandler,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";
import { useRouter } from "next/navigation";
import "./slide-deck-template.css";
import styles from "./main-scene-slide-deck.module.css";
import { SlideDeckCard, type SlideDeckItem } from "./tournament-slide-card";

export type { SlideDeckItem };

/**
 * 다음 카드가 올라오며 겹치기 시작할 때부터 이전(중앙) 카드 후퇴를 시작한다.
 * CENTER_HOLD_S < INCOMING_DELAY + INCOMING_RISE 이므로 상승이 끝나기 전에 후퇴가 시작됨.
 * TIMELINE_SCALE 로 상승·후퇴·대기 구간을 같은 비율로 늘린다.
 * (carom-postcard-template-test/src/components/SlideDeck.tsx 와 동일)
 */
const TIMELINE_SCALE = 1.2;

const INCOMING_RISE_S = 4 * TIMELINE_SCALE;
const INCOMING_DELAY_S = 1 * TIMELINE_SCALE;
const RETREAT_START_AFTER_INCOMING_BEGIN_S = 1.6 * TIMELINE_SCALE - 1;
const CENTER_HOLD_S = INCOMING_DELAY_S + RETREAT_START_AFTER_INCOMING_BEGIN_S;
const RETREAT_S = 7 * TIMELINE_SCALE;
const RETREAT_OPACITY_DELAY_S = 1 * TIMELINE_SCALE;
const SCENE_S = CENTER_HOLD_S + RETREAT_S;

const FX_STRENGTH = 1.15;
const FX_EARLY_BIAS = 0.7;
const OUTGOING_SCALE_TARGET = 0.65;
const OUTGOING_OPACITY_MIN = 0.1;
const MANUAL_RESUME_DELAY_MS = Math.round(1800 * TIMELINE_SCALE);
const WHEEL_SCENE_STEP = 240 * TIMELINE_SCALE;
const DRAG_SCENE_STEP = 220 * TIMELINE_SCALE;

const SLIDE_LINK_DRAG_MIN_PX = 12;
const CARD_SELECTION_NAV_DELAY_MS = 100;
/** 자동 전환·장면 타임라인 시작 지연 — 첫 카드 정적 표시 후 Speed Index 부담 완화 */
const SLIDE_TIMELINE_DEFER_IDLE_MAX_MS = 1200;
const SLIDE_TIMELINE_DEFER_FALLBACK_MS = 1000;

type SceneRole = "idle" | "incoming" | "center" | "outgoing";

function riseFactor(r: number): number {
  const t = Math.min(1, Math.max(0, r));
  if (t <= 1 / 3) {
    const u = t * 3;
    return 1 - u * (1 / 3);
  }
  if (t <= 2 / 3) {
    const u = (t - 1 / 3) * 3;
    return 2 / 3 - u * (1 / 3);
  }
  const u = (t - 2 / 3) * 3;
  return 1 / 3 - u * (1 / 3);
}

const RETREAT_PTS: {
  p: number;
  ty: number;
  sc: number;
  op: number;
}[] = [
  { p: 0, ty: 0, sc: 1, op: 1 },
  { p: 0.1, ty: -9.2, sc: 0.966, op: 1 },
  { p: 0.2, ty: -18.4, sc: 0.932, op: 1 },
  { p: 0.3, ty: -27.6, sc: 0.898, op: 1 },
  { p: 0.4, ty: -36.8, sc: 0.864, op: 0.857 },
  { p: 0.5, ty: -46, sc: 0.83, op: 0.714 },
  { p: 0.6, ty: -55.2, sc: 0.796, op: 0.571 },
  { p: 0.7, ty: -64.4, sc: 0.762, op: 0.429 },
  { p: 0.8, ty: -73.6, sc: 0.728, op: 0.286 },
  { p: 0.9, ty: -82.8, sc: 0.694, op: 0.143 },
  { p: 1, ty: -92, sc: 0.66, op: 0 },
];

function retreatAt(progress: number) {
  const p = Math.min(1, Math.max(0, progress));
  let i = 0;
  while (i < RETREAT_PTS.length - 1 && p > RETREAT_PTS[i + 1]!.p) {
    i += 1;
  }
  const a = RETREAT_PTS[i]!;
  const b = RETREAT_PTS[i + 1]!;
  if (!b) return a;
  const t = (p - a.p) / (b.p - a.p);
  return {
    ty: a.ty + (b.ty - a.ty) * t,
    sc: a.sc + (b.sc - a.sc) * t,
    op: a.op + (b.op - a.op) * t,
  };
}

function cardStyleForRole(role: SceneRole, sceneT: number, roleProgress: number): CSSProperties {
  if (role === "idle") {
    return {
      opacity: 0,
      visibility: "hidden",
      transform: "translateY(calc(50cqh + 50%)) scale(1)",
      filter: "blur(0)",
      zIndex: 1,
    };
  }

  if (role === "incoming") {
    if (sceneT < INCOMING_DELAY_S) {
      return {
        opacity: 0,
        visibility: "hidden",
        transform: "translateY(calc(50cqh + 50%)) scale(1)",
        filter: "blur(0)",
        zIndex: 1,
      };
    }
    const factor = riseFactor(roleProgress);
    return {
      opacity: 1,
      visibility: "visible",
      transform: `translateY(calc((50cqh + 50%) * ${factor})) scale(1)`,
      filter: "blur(0)",
      zIndex: 120,
    };
  }

  if (role === "center") {
    if (sceneT < CENTER_HOLD_S) {
      return {
        opacity: 1,
        visibility: "visible",
        transform: "translateY(calc((50cqh + 50%) * 0)) scale(1)",
        filter: "blur(0)",
        zIndex: 100,
      };
    }
    const retreatT = sceneT - CENTER_HOLD_S;
    const rp = Math.min(1, retreatT / Math.max(0.001, RETREAT_S));
    const move = retreatAt(rp);
    const fxProgress = Math.min(1, Math.max(0, rp * FX_STRENGTH));
    const fxProgressBiased = Math.pow(fxProgress, FX_EARLY_BIAS);
    const outgoingScale = 1 + (OUTGOING_SCALE_TARGET - 1) * fxProgressBiased;
    let opacity = 1;
    if (retreatT >= RETREAT_OPACITY_DELAY_S) {
      const fadeT = retreatT - RETREAT_OPACITY_DELAY_S;
      const fadeSpan = Math.max(0.001, RETREAT_S - RETREAT_OPACITY_DELAY_S);
      const fadeProgress = Math.min(1, fadeT / fadeSpan);
      opacity = 1 + (OUTGOING_OPACITY_MIN - 1) * fadeProgress;
    }
    return {
      opacity,
      visibility: opacity < 0.02 ? "hidden" : "visible",
      transform: `translateY(${move.ty}%) scale(${outgoingScale})`,
      filter: "blur(0)",
      zIndex: 40,
    };
  }

  const end = retreatAt(1);
  return {
    opacity: 0,
    visibility: "hidden",
    transform: `translateY(${end.ty}%) scale(${end.sc})`,
    filter: "blur(0)",
    zIndex: 40,
  };
}

function sceneRoleForCard(cardIndex: number, n: number, sceneId: number): SceneRole {
  if (n <= 1) return cardIndex === 0 ? "center" : "idle";

  const outgoingIdx = sceneId % n;
  const centerIdx = (sceneId + 1) % n;
  const incomingIdx = (sceneId + 2) % n;

  if (cardIndex === incomingIdx) return "incoming";
  if (cardIndex === centerIdx) return "center";
  if (cardIndex === outgoingIdx) return "outgoing";
  return "idle";
}

export default function MainSceneSlideDeck({
  items,
  sectionLabel = "",
  siteNoticeText,
}: {
  items: SlideDeckItem[];
  sectionLabel?: string;
  siteNoticeText?: string | null;
}) {
  const router = useRouter();
  /** null이면 장면 시계 미시작(첫 카드·초기 장면 고정). 값 설정 후 경과 시간 기준으로 전환 */
  const animationT0Ref = useRef<number | null>(null);
  const [frameTime, setFrameTime] = useState(() => Date.now());
  const sceneOffsetRef = useRef(0);
  const pausedAtMsRef = useRef<number | null>(null);
  const pausedAccumulatedMsRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartSceneOffsetRef = useRef(0);
  const pointerStartedOnCardLinkRef = useRef(false);
  const exceededLinkDragSlopRef = useRef(false);
  const selectingRef = useRef(false);
  const selectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const n = items.length;
  /** sceneId===0 초기 장면과 동일 — 가운데 노출(visibility·opacity 유효) 카드. n>1 이면 items[0]은 숨김(outgoing/incoming)이라 LCP 후보는 이 인덱스 */
  const initialVisibleSlideIndex = n <= 1 ? 0 : (1 % n);

  useEffect(() => {
    if (n === 0) return;
    let rafId = 0;
    const loop = () => {
      setFrameTime(Date.now());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    };
  }, [n]);

  useEffect(() => {
    if (n === 0) {
      animationT0Ref.current = null;
      return;
    }
    animationT0Ref.current = null;
    const kick = () => {
      animationT0Ref.current = Date.now();
      setFrameTime(Date.now());
    };
    let idleCbId: number | undefined;
    /** DOM setTimeout id — Node 타입과 충돌하지 않게 number */
    let timeoutId: number | undefined;
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      idleCbId = window.requestIdleCallback(kick, { timeout: SLIDE_TIMELINE_DEFER_IDLE_MAX_MS });
    } else {
      timeoutId = window.setTimeout(kick, SLIDE_TIMELINE_DEFER_FALLBACK_MS);
    }
    return () => {
      if (idleCbId != null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleCbId);
      }
      if (timeoutId != null) window.clearTimeout(timeoutId);
    };
  }, [n]);

  const pauseAuto = () => {
    if (pausedAtMsRef.current == null) {
      pausedAtMsRef.current = Date.now();
    }
  };

  const resumeAuto = () => {
    if (pausedAtMsRef.current == null) return;
    pausedAccumulatedMsRef.current += Date.now() - pausedAtMsRef.current;
    pausedAtMsRef.current = null;
  };

  const scheduleAutoResume = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      if (!draggingRef.current) resumeAuto();
      resumeTimerRef.current = null;
    }, MANUAL_RESUME_DELAY_MS);
  };

  const onWheel: WheelEventHandler<HTMLDivElement> = (e) => {
    if (selectingRef.current) return;
    e.preventDefault();
    pauseAuto();
    sceneOffsetRef.current -= e.deltaY / WHEEL_SCENE_STEP;
    setFrameTime(Date.now());
    scheduleAutoResume();
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (selectingRef.current) return;
    if (e.button !== 0) return;
    exceededLinkDragSlopRef.current = false;
    pointerStartedOnCardLinkRef.current =
      e.target instanceof Element && Boolean(e.target.closest("[data-slide-deck-card] a[href]"));
    draggingRef.current = true;
    pauseAuto();
    dragStartYRef.current = e.clientY;
    dragStartSceneOffsetRef.current = sceneOffsetRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (selectingRef.current) return;
    if (!draggingRef.current) return;
    const dy = e.clientY - dragStartYRef.current;
    if (pointerStartedOnCardLinkRef.current && Math.abs(dy) > SLIDE_LINK_DRAG_MIN_PX) {
      exceededLinkDragSlopRef.current = true;
    }
    sceneOffsetRef.current = dragStartSceneOffsetRef.current - dy / DRAG_SCENE_STEP;
    setFrameTime(Date.now());
  };

  const endDragging = (pointerId: number, target: HTMLDivElement) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* noop */
    }
    scheduleAutoResume();
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    if (selectingRef.current) return;
    const deck = e.currentTarget;
    const suppress =
      pointerStartedOnCardLinkRef.current && exceededLinkDragSlopRef.current;
    pointerStartedOnCardLinkRef.current = false;
    exceededLinkDragSlopRef.current = false;
    if (suppress) {
      const killClick: EventListener = (ev) => {
        deck.removeEventListener("click", killClick, true);
        if (!(ev.target instanceof Element)) return;
        if (!deck.contains(ev.target)) return;
        const a = ev.target.closest("a[href]");
        if (a && deck.contains(a) && a.closest("[data-slide-deck-card]")) {
          ev.preventDefault();
          ev.stopPropagation();
        }
      };
      deck.addEventListener("click", killClick, true);
    }
    endDragging(e.pointerId, deck);
  };

  const onPointerCancel: PointerEventHandler<HTMLDivElement> = (e) => {
    if (selectingRef.current) return;
    pointerStartedOnCardLinkRef.current = false;
    exceededLinkDragSlopRef.current = false;
    endDragging(e.pointerId, e.currentTarget);
  };

  const autoNowMs = pausedAtMsRef.current ?? frameTime;
  const animT0 = animationT0Ref.current;
  const elapsed =
    animT0 == null
      ? Math.max(0, sceneOffsetRef.current * SCENE_S)
      : (autoNowMs - animT0 - pausedAccumulatedMsRef.current) / 1000 + sceneOffsetRef.current * SCENE_S;
  const clampedElapsed = Math.max(0, elapsed);
  const sceneId = Math.floor(clampedElapsed / SCENE_S);
  const tInScene = clampedElapsed % SCENE_S;

  const centerIdx = n <= 1 ? 0 : (sceneId + 1) % n;
  const activeDot = n > 0 ? centerIdx % 3 : -1;

  const onCardClickCapture: MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.defaultPrevented || selectingRef.current) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element)) return;
    const anchor = e.target.closest("[data-slide-deck-card] a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    const card = anchor.closest("[data-slide-card-index]");
    const rawIndex = card?.getAttribute("data-slide-card-index");
    const nextIndex =
      rawIndex != null && rawIndex !== "" && Number.isFinite(Number(rawIndex))
        ? Number(rawIndex)
        : centerIdx;

    e.preventDefault();
    e.stopPropagation();

    selectingRef.current = true;
    pauseAuto();
    setSelectedIndex(nextIndex);

    if (selectTimerRef.current) clearTimeout(selectTimerRef.current);
    selectTimerRef.current = setTimeout(() => {
      router.push(href);
    }, CARD_SELECTION_NAV_DELAY_MS);
  };

  const trimmedNotice = siteNoticeText?.trim() ?? "";
  const noticeAboveDeck =
    trimmedNotice.length > 0 ? (
      <div className={styles.slideDeckNoticeAbove}>
        <div className={styles.slideDeckNoticeWrap} aria-live="polite">
          <div className={styles.slideDeckNotice}>
            <span className={styles.slideDeckNoticeMarquee}>{trimmedNotice}</span>
          </div>
        </div>
      </div>
    ) : null;

  const cardChrome = (
    <div className={styles.slideDeckCardChrome}>
      <div className={styles.slideDeckTopChrome}>
        {sectionLabel.trim() ? (
          <p className={styles.slideDeckLabel}>{sectionLabel.trim()}</p>
        ) : null}
      </div>
      {n === 0 ? (
        <div className={styles.slideDeckEmptyState}>
          <p className={styles.slideDeckEmptyStateText}>노출 중인 대회 카드가 없습니다.</p>
        </div>
      ) : null}
    </div>
  );

  const slideIndicatorOverlay = (
    <div className={styles.slideDeckIndicatorOverlay} aria-hidden="true">
      <div className={styles.slideDeckIndicatorDots}>
        <span
          className={
            activeDot === 0 ? `${styles.slideDeckBottomDotY} ${styles.slideDeckDotActive}` : styles.slideDeckBottomDotY
          }
        >
          ●
        </span>
        <span
          className={
            activeDot === 1 ? `${styles.slideDeckBottomDotR} ${styles.slideDeckDotActive}` : styles.slideDeckBottomDotR
          }
        >
          ●
        </span>
        <span
          className={
            activeDot === 2 ? `${styles.slideDeckBottomDotW} ${styles.slideDeckDotActive}` : styles.slideDeckBottomDotW
          }
        >
          ●
        </span>
      </div>
    </div>
  );

  const innerDeck =
    n === 0 ? (
      <div className="slide-deck" aria-label="진행 대회 슬라이드">
        {cardChrome}
      </div>
    ) : (
      <div
        className="slide-deck"
        aria-label="진행 대회 슬라이드"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onClickCapture={onCardClickCapture}
      >
        {items.map((item, i) => {
          const role = sceneRoleForCard(i, n, sceneId);
          const style = cardStyleForRole(
            role,
            tInScene,
            role === "incoming"
              ? Math.min(
                  1,
                  Math.max(0, (tInScene - INCOMING_DELAY_S) / Math.max(0.001, INCOMING_RISE_S)),
                )
              : 0,
          );
          return (
            <div key={item.snapshotId} className="slide-deck__layer">
              <div
                className="slide-deck__card"
                data-slide-deck-card
                data-slide-card-index={i}
                style={style}
              >
                <div
                  className="slide-deck__card-interaction"
                  style={
                    selectedIndex == null
                      ? undefined
                      : i === selectedIndex
                        ? { transform: "scale(1.04)", opacity: 1, pointerEvents: "auto" }
                        : { opacity: 0.4, pointerEvents: "none" }
                  }
                >
                  <SlideDeckCard item={item} repImageHighPriority={i === initialVisibleSlideIndex} />
                </div>
              </div>
            </div>
          );
        })}
        {cardChrome}
      </div>
    );

  return (
    <div className={styles.slideDeckShell}>
      <div className={`slide-deck-wrap ${styles.slideDeckWrapWithNoticeGap}`}>
        {noticeAboveDeck}
        <div className={styles.slideDeckFrame}>
          {innerDeck}
          {slideIndicatorOverlay}
        </div>
      </div>
    </div>
  );
}
