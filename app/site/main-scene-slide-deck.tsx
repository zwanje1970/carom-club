"use client";

import { useEffect, useRef, useState, type CSSProperties, type PointerEventHandler } from "react";
import styles from "./main-scene-slide-deck.module.css";
import { SlideDeckCard, type SlideDeckItem } from "./tournament-slide-card";

export type { SlideDeckItem };

type SceneRole = "idle" | "incoming" | "center" | "outgoing";

/**
 * 장면 8초: incoming·center 동일 / outgoing 퇴장 곡선은 1초 앞당겨 시작(끝은 clamp).
 */
const RISE_S = 10;
const INCOMING_DELAY_S = 4;
const COVER_TRIGGER = 0.8;
const SCENE_S = RISE_S * COVER_TRIGGER;
const RETREAT_S = SCENE_S;
/** outgoing 퇴장(축소·이동) 곡선을 장면 기준 이 초만큼 앞당김 */
const OUTGOING_RETREAT_START_OFFSET_S = 1;
const CENTER_SETTLE_S = RISE_S * (1 - COVER_TRIGGER);
const CENTER_FADE_DELAY_S = 4;
const CENTER_OPACITY_TARGET = 0.6;
const OUTGOING_SCALE_TARGET = 0.65;
const OUTGOING_OPACITY_MIN = 0.5;
const FX_STRENGTH = 1.15;
const FX_EARLY_BIAS = 0.7;
const MANUAL_RESUME_DELAY_MS = 1800;
const WHEEL_SCENE_STEP = 240;
const DRAG_SCENE_STEP = 220;
/** 루트 탭 스와이프보다 크게 — 미세한 대각선에서 덱이 먼저 잡히지 않게 */
const DECK_AXIS_LOCK_MIN_PX = 26;
/** 세로(페이지 스크롤)와 구분: 세로 성분이 이만큼 더 커야 덱 세로 조작으로 확정 */
const DECK_VERTICAL_DOMINANCE = 1.38;
/** 카드 CTA 링크: 이보다 작은 이동은 탭(클릭), 초과 시 드래그로 보고 상세 이동 차단 */
const SLIDE_LINK_TAP_MAX_PX = 12;

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

/** incoming 상승 곡선 진행도가 이 값 미만이면 center(210) 아래 — 하단 일찍 비침 완화 */
const INCOMING_LAYER_ABOVE_CENTER_AFTER_PROGRESS = 0.06;

/** 형제 `.slideDeckLayer` 간 실제 쌓임 — 오버레이(250) 아래. 상승 중반부터 incoming이 center보다 앞 */
function layerZIndexForRole(role: SceneRole, sceneT: number, incomingProgress: number): number {
  if (role === "idle") return 10;
  if (role === "outgoing") return 110;
  if (role === "center") return 210;
  if (role === "incoming") {
    if (sceneT < INCOMING_DELAY_S) return 190;
    if (incomingProgress < INCOMING_LAYER_ABOVE_CENTER_AFTER_PROGRESS) return 200;
    return 220;
  }
  return 10;
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

/**
 * @param sceneT 장면 로컬 시간(초), 0 ~ SCENE_S. 템플릿과 동일 시계.
 * @param roleProgress incoming: delay~(장면 끝) 선형 0~1 / outgoing: 0~1.
 */
function cardStyleForRole(role: SceneRole, sceneT: number, roleProgress: number): CSSProperties {
  if (role === "idle") {
    return {
      opacity: 0,
      visibility: "hidden",
      transform: "translateY(calc(50cqh + 50%)) scale(1)",
      filter: "blur(0)",
    };
  }

  if (role === "incoming") {
    if (sceneT < INCOMING_DELAY_S) {
      return {
        opacity: 0,
        visibility: "hidden",
        transform: "translateY(calc(50cqh + 50%)) scale(1)",
        filter: "blur(0)",
      };
    }
    const factor = riseFactor(roleProgress);
    return {
      opacity: 1,
      visibility: "visible",
      transform: `translateY(calc((50cqh + 50%) * ${factor})) scale(1)`,
      filter: "blur(0)",
    };
  }

  if (role === "center") {
    const centerFadeStart = CENTER_SETTLE_S + CENTER_FADE_DELAY_S;
    const centerFadeProgress =
      sceneT > centerFadeStart
        ? Math.min(1, (sceneT - centerFadeStart) / Math.max(0.001, SCENE_S - centerFadeStart))
        : 0;
    const centerOpacity = 1 + (CENTER_OPACITY_TARGET - 1) * centerFadeProgress;
    const factor = riseFactor(1);
    return {
      opacity: centerOpacity,
      visibility: "visible",
      transform: `translateY(calc((50cqh + 50%) * ${factor})) scale(1)`,
      filter: "blur(0)",
    };
  }

  const move = retreatAt(roleProgress);
  const fxProgress = Math.min(1, Math.max(0, roleProgress * FX_STRENGTH));
  const fxProgressBiased = Math.pow(fxProgress, FX_EARLY_BIAS);
  const outgoingOpacity =
    CENTER_OPACITY_TARGET + (OUTGOING_OPACITY_MIN - CENTER_OPACITY_TARGET) * fxProgressBiased;
  const outgoingScale = 1 + (OUTGOING_SCALE_TARGET - 1) * fxProgressBiased;
  return {
    opacity: outgoingOpacity,
    visibility: outgoingOpacity < 0.02 ? "hidden" : "visible",
    transform: `translateY(${move.ty}%) scale(${outgoingScale})`,
    filter: "blur(0)",
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
  sectionLabel = "진행중 대회",
  siteNoticeText,
}: {
  items: SlideDeckItem[];
  /** 슬라이드 영역 상단 왼쪽 라벨 (기본: 진행중 대회) */
  sectionLabel?: string;
  /** 공지관리(siteNotice) — 슬라이드 박스 내부 상단 공지 바 (enabled + text 있을 때만 전달) */
  siteNoticeText?: string | null;
}) {
  const t0 = useRef(Date.now());
  const [frameTime, setFrameTime] = useState(() => Date.now());
  const sceneOffsetRef = useRef(0);
  const pausedAtMsRef = useRef<number | null>(null);
  const pausedAccumulatedMsRef = useRef(0);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartSceneOffsetRef = useRef(0);
  const axisRef = useRef<"undecided" | "vertical" | "horizontal">("undecided");
  const pointerStartedOnCardLinkRef = useRef(false);
  const exceededTapSlopRef = useRef(false);
  const verticalDeckDragConfirmedRef = useRef(false);

  useEffect(() => {
    if (items.length === 0) return;
    let rafId = 0;
    const loop = () => {
      setFrameTime(Date.now());
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafId);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [items.length]);

  const n = items.length;

  /** React 합성 wheel은 브라우저에 따라 passive로 등록되어 preventDefault 경고가 난다. 네이티브만 non-passive. */
  useEffect(() => {
    const el = deckRef.current;
    if (!el || n === 0) return;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      if (pausedAtMsRef.current == null) {
        pausedAtMsRef.current = Date.now();
      }
      sceneOffsetRef.current -= e.deltaY / WHEEL_SCENE_STEP;
      setFrameTime(Date.now());
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
      resumeTimerRef.current = setTimeout(() => {
        if (!draggingRef.current) resumeAuto();
        resumeTimerRef.current = null;
      }, MANUAL_RESUME_DELAY_MS);
    };
    const wheelOpts: AddEventListenerOptions = { passive: false };
    el.addEventListener("wheel", onWheelNative, wheelOpts);
    return () => {
      el.removeEventListener("wheel", onWheelNative, wheelOpts);
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

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    exceededTapSlopRef.current = false;
    verticalDeckDragConfirmedRef.current = false;
    pointerStartedOnCardLinkRef.current =
      e.target instanceof Element && Boolean(e.target.closest("[data-slide-deck-card] a[href]"));
    draggingRef.current = true;
    pauseAuto();
    axisRef.current = "undecided";
    dragStartXRef.current = e.clientX;
    dragStartYRef.current = e.clientY;
    dragStartSceneOffsetRef.current = sceneOffsetRef.current;
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartXRef.current;
    const dy = e.clientY - dragStartYRef.current;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    if (adx > SLIDE_LINK_TAP_MAX_PX || ady > SLIDE_LINK_TAP_MAX_PX) {
      exceededTapSlopRef.current = true;
    }

    if (axisRef.current === "undecided") {
      if (adx < DECK_AXIS_LOCK_MIN_PX && ady < DECK_AXIS_LOCK_MIN_PX) return;
      if (ady >= adx * DECK_VERTICAL_DOMINANCE) {
        axisRef.current = "vertical";
        verticalDeckDragConfirmedRef.current = true;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
        e.currentTarget.style.touchAction = "none";
      } else {
        axisRef.current = "horizontal";
        return;
      }
    }

    if (axisRef.current === "horizontal") return;

    const dyMove = e.clientY - dragStartYRef.current;
    sceneOffsetRef.current = dragStartSceneOffsetRef.current - dyMove / DRAG_SCENE_STEP;
    setFrameTime(Date.now());
  };

  const endDragging = (pointerId: number, target: HTMLDivElement) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    axisRef.current = "undecided";
    target.style.removeProperty("touch-action");
    try {
      target.releasePointerCapture(pointerId);
    } catch {
      /* noop */
    }
    scheduleAutoResume();
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    const deck = e.currentTarget;
    const suppressCardNav =
      pointerStartedOnCardLinkRef.current && verticalDeckDragConfirmedRef.current;
    pointerStartedOnCardLinkRef.current = false;
    exceededTapSlopRef.current = false;
    verticalDeckDragConfirmedRef.current = false;
    if (suppressCardNav) {
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
    pointerStartedOnCardLinkRef.current = false;
    exceededTapSlopRef.current = false;
    verticalDeckDragConfirmedRef.current = false;
    endDragging(e.pointerId, e.currentTarget);
  };

  const autoNowMs = pausedAtMsRef.current ?? frameTime;
  const elapsed =
    (autoNowMs - t0.current - pausedAccumulatedMsRef.current) / 1000 +
    sceneOffsetRef.current * SCENE_S;
  const clampedElapsed = Math.max(0, elapsed);
  const sceneId = Math.floor(clampedElapsed / SCENE_S);
  const tInScene = clampedElapsed % SCENE_S;

  const trimmedNotice = siteNoticeText?.trim() ?? "";
  const noticeOverlay =
    trimmedNotice.length > 0 ? (
      <div className={styles.slideDeckNoticeWrap} aria-live="polite">
        <div className={styles.slideDeckNotice}>
          <span className={styles.slideDeckNoticeMarquee}>{trimmedNotice}</span>
        </div>
      </div>
    ) : null;

  const overlayChrome = (
    <div className={styles.slideDeckFrameOverlay}>
      <div className={styles.slideDeckTopChrome}>
        {noticeOverlay}
        {sectionLabel.trim() ? (
          <p className={styles.slideDeckLabel}>{sectionLabel.trim()}</p>
        ) : null}
      </div>
      {n === 0 ? (
        <div className={styles.slideDeckEmptyState}>
          <p className={styles.slideDeckEmptyStateText}>노출 중인 대회 카드가 없습니다.</p>
        </div>
      ) : null}
      <div className={styles.slideDeckBottomDots} aria-hidden="true">
        <span className={styles.slideDeckBottomDotY}>●</span>
        <span className={styles.slideDeckBottomDotR}>●</span>
        <span className={styles.slideDeckBottomDotW}>●</span>
      </div>
    </div>
  );

  const deck =
    n === 0 ? (
      <div className={styles.slideDeck} aria-label="진행 대회 슬라이드">
        {overlayChrome}
      </div>
    ) : (
      <div
        ref={deckRef}
        className={styles.slideDeck}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {items.map((item, i) => {
          const role = sceneRoleForCard(i, n, sceneId);
          const incomingProgress =
            role === "incoming"
              ? Math.min(
                  1,
                  Math.max(0, (tInScene - INCOMING_DELAY_S) / Math.max(0.001, SCENE_S - INCOMING_DELAY_S)),
                )
              : 0;
          const style = cardStyleForRole(
            role,
            tInScene,
            role === "incoming"
              ? incomingProgress
              : role === "outgoing"
                ? Math.min(1, (tInScene + OUTGOING_RETREAT_START_OFFSET_S) / RETREAT_S)
                : 0,
          );
          return (
            <div
              key={item.snapshotId}
              className={styles.slideDeckLayer}
              style={{ zIndex: layerZIndexForRole(role, tInScene, incomingProgress) }}
            >
              <div className={styles.slideDeckCard} data-slide-deck-card style={style}>
                <SlideDeckCard item={item} />
              </div>
            </div>
          );
        })}
        {/* 카드(transform)보다 위에 두기 위해 레이어 뒤·높은 z-index·flex로 창 안에 고정 */}
        {overlayChrome}
      </div>
    );

  /* 공지 유무와 동일한 바깥 박스(테두리·흐름) 유지 — 레이아웃 출렁임 완화 */
  return <div className={styles.slideDeckShell}>{deck}</div>;
}

