"use client";

import {
  useEffect,
  useLayoutEffect,
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
import {
  SLIDE_DECK_SOLID_BACKDROPS,
  SlideDeckCard,
  reportMainSlideAdMetric,
  type SlideDeckItem,
} from "./tournament-slide-card";

export type { SlideDeckItem };

/**
 * 타이밍(초): 출발 대기 → 상승, 가운데 정지, 후퇴가 같은 장면 시계에서 겹쳐 진행.
 * CENTER_HOLD_S < INCOMING_DELAY + INCOMING_RISE 이면 상승이 끝나기 전에 후퇴가 시작됨.
 */
const TIMELINE_SCALE = 1.2;

/** 출발 0 / 상승 8 / 정지 6 / 후퇴 4 (초) — 출발 0이면 첫 페인트에서 상승이 중간부터 보일 수 있음 */
const INCOMING_DELAY_S = 0;
/** 아래에서 중앙까지 상승에 걸리는 시간 */
const INCOMING_RISE_S = 8;
/** 장면 시작부터 중앙 카드가 후퇴를 시작하기까지(정지 구간) */
const CENTER_HOLD_S = 6;
/** 후퇴(이동·페이드)에 걸리는 시간 */
const RETREAT_S = 4;
const RETREAT_OPACITY_DELAY_S = 1 * TIMELINE_SCALE;
/** 한 장면 = max(상승 끝+여유, 정지+후퇴) */
const SCENE_S = Math.max(
  INCOMING_DELAY_S + INCOMING_RISE_S + 0.2,
  CENTER_HOLD_S + RETREAT_S,
);

const FX_STRENGTH = 1.15;
const FX_EARLY_BIAS = 0.7;
const OUTGOING_SCALE_TARGET = 0.65;
const OUTGOING_OPACITY_MIN = 0;
const MANUAL_RESUME_DELAY_MS = Math.round(1800 * TIMELINE_SCALE);
const WHEEL_SCENE_STEP = 240 * TIMELINE_SCALE;
const DRAG_SCENE_STEP = 220 * TIMELINE_SCALE;

const SLIDE_LINK_DRAG_MIN_PX = 12;
const CARD_SELECTION_NAV_DELAY_MS = 100;

type SceneRole = "idle" | "incoming" | "center" | "outgoing";

function layerZIndexForRole(role: SceneRole): number {
  if (role === "incoming") return 300;
  if (role === "center") return 200;
  if (role === "outgoing") return 120;
  return 1;
}

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

/**
 * incoming 시작 세로 오프셋(translateY 양수 = 아래에서 등장).
 * 모바일 메인: max(50cqh+50%, 하단식) 에서 긴 슬라이드에 cqh 가 커져 하단식이 지는 문제 → cqh 제거, 하단식과 dvh 하한만 max.
 */
function incomingTranslateY(factor: number, fromBottomUi: boolean): string {
  const base = fromBottomUi
    ? "max(calc(100% + 120px + 9rem + var(--site-home-mobile-bottom-nav-slide-extra, 76px) + max(5.5rem, 16dvh) + env(safe-area-inset-bottom, 0px)), calc(34dvh + 50%))"
    : "calc(52dvh + 58%)";
  return `translateY(calc((${base}) * ${factor})) scale(1)`;
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

function cardStyleForRole(
  role: SceneRole,
  sceneT: number,
  roleProgress: number,
  incomingFromBottomUi: boolean,
): CSSProperties {
  if (role === "idle") {
    return {
      opacity: 0,
      visibility: "hidden",
      transform: incomingTranslateY(1, incomingFromBottomUi),
      filter: "blur(0)",
      zIndex: 1,
    };
  }

  if (role === "incoming") {
    const riseElapsed = sceneT - INCOMING_DELAY_S;
    const bottomTransform = incomingTranslateY(1, incomingFromBottomUi);
    if (riseElapsed < 0) {
      return {
        opacity: 0,
        visibility: "hidden",
        transform: bottomTransform,
        filter: "blur(0)",
        zIndex: 120,
      };
    }
    const factor = riseFactor(roleProgress);
    return {
      opacity: 1,
      visibility: "visible",
      transform: incomingTranslateY(factor, incomingFromBottomUi),
      filter: "blur(0)",
      zIndex: 120,
    };
  }

  if (role === "center") {
    if (sceneT < CENTER_HOLD_S) {
      return {
        opacity: 1,
        visibility: "visible",
        transform: "translateY(0) scale(1)",
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
  incomingFromBottomUi = false,
}: {
  items: SlideDeckItem[];
  sectionLabel?: string;
  siteNoticeText?: string | null;
  /** 모바일 메인(UA)만: incoming 시작을 카드 높이+하단 고정 UI 아래로 — 짧은 슬라이드에서 중간 등장 완화 */
  incomingFromBottomUi?: boolean;
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
  const mainSlideAdImpressionSentRef = useRef<Set<string>>(new Set());

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

  /** 첫 페인트 전에 t0 설정 — rAF/rIC 이후면 sceneT=0 이 한두 프레임 이상 고정되는 문제 방지 */
  useLayoutEffect(() => {
    if (n === 0) {
      animationT0Ref.current = null;
      return;
    }
    animationT0Ref.current = null;
    const t0 = Date.now();
    animationT0Ref.current = t0;
    setFrameTime(t0);
    return () => {
      animationT0Ref.current = null;
    };
  }, [n]);

  useLayoutEffect(() => {
    if (n === 0) return;
    const autoNowMs = pausedAtMsRef.current ?? frameTime;
    const animT0 = animationT0Ref.current;
    const elapsed =
      animT0 == null
        ? Math.max(0, sceneOffsetRef.current * SCENE_S)
        : (autoNowMs - animT0 - pausedAccumulatedMsRef.current) / 1000 + sceneOffsetRef.current * SCENE_S;
    const clampedElapsed = Math.max(0, elapsed);
    const sceneId = Math.floor(clampedElapsed / SCENE_S);
    const cycleOffset = n > 0 ? Math.floor(sceneId / n) : 0;
    const effectiveSceneId = sceneId + cycleOffset;
    const centerIdx = n <= 1 ? 0 : (effectiveSceneId + 1) % n;
    const centerItem = items[centerIdx];
    if (centerItem?.type !== "ad" || !centerItem.mainSlideAdId?.trim()) return;
    const key = `${effectiveSceneId}-${centerItem.mainSlideAdId.trim()}`;
    if (mainSlideAdImpressionSentRef.current.has(key)) return;
    mainSlideAdImpressionSentRef.current.add(key);
    reportMainSlideAdMetric(centerItem.mainSlideAdId.trim(), "impressions");
  }, [n, frameTime, items]);

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
        if (
          a &&
          deck.contains(a) &&
          a.closest("[data-slide-deck-card]") &&
          !(a instanceof HTMLAnchorElement && a.dataset.mainSlideExternal === "1")
        ) {
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
  /**
   * 공정성 보정: 한 바퀴(n개)가 끝날 때마다 시작 오프셋을 1씩 민다.
   * 예) n=5일 때 1번 카드는 다음 사이클에서 6번째 순번처럼 뒤로 밀린다.
   */
  const cycleOffset = n > 0 ? Math.floor(sceneId / n) : 0;
  const effectiveSceneId = sceneId + cycleOffset;

  const centerIdx = n <= 1 ? 0 : (effectiveSceneId + 1) % n;

  const onCardClickCapture: MouseEventHandler<HTMLDivElement> = (e) => {
    if (e.defaultPrevented || selectingRef.current) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (!(e.target instanceof Element)) return;
    const anchor = e.target.closest("[data-slide-deck-card] a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;

    const href = anchor.getAttribute("href");
    if (!href) return;
    if (anchor.dataset.mainSlideExternal === "1") {
      return;
    }

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
    <div
      className={[styles.slideDeckCardChrome, n > 0 ? styles.slideDeckCardChromeDocked : ""].filter(Boolean).join(" ")}
    >
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

  const innerDeck =
    n === 0 ? (
      <div className="slide-deck" aria-label="진행 대회 슬라이드">
        {noticeAboveDeck}
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
          const role = sceneRoleForCard(i, n, effectiveSceneId);
          /** 같은 snapshot이라도 슬라이드가 한 바퀴 돌아 다시 incoming일 때 key가 바뀌어 진입 애니메이션이 다시 적용됨 */
          let activeIndex = 0;
          if (n > 1) {
            const firstIncomingScene = ((i - 2) % n + n) % n;
            if (effectiveSceneId >= firstIncomingScene) {
              activeIndex = Math.floor((effectiveSceneId - firstIncomingScene) / n) + 1;
            }
          }
          const style = cardStyleForRole(
            role,
            tInScene,
            role === "incoming"
              ? Math.min(
                  1,
                  Math.max(0, (tInScene - INCOMING_DELAY_S) / Math.max(0.001, INCOMING_RISE_S)),
                )
              : 0,
            incomingFromBottomUi,
          );
          return (
            <div key={`${item.snapshotId}-${activeIndex}`} className="slide-deck__layer" style={{ zIndex: layerZIndexForRole(role) }}>
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
                  <SlideDeckCard
                    item={item}
                    repImageHighPriority={i === initialVisibleSlideIndex}
                    slideDeckSolidBackdrop={
                      SLIDE_DECK_SOLID_BACKDROPS[i % SLIDE_DECK_SOLID_BACKDROPS.length]
                    }
                  />
                </div>
              </div>
            </div>
          );
        })}
        {noticeAboveDeck}
        {cardChrome}
      </div>
    );

  return (
    <div className={styles.slideDeckShell}>
      <div className={`slide-deck-wrap ${styles.slideDeckWrapWithNoticeGap}`}>
        <div className={styles.slideDeckFrame}>
          {innerDeck}
        </div>
      </div>
    </div>
  );
}
