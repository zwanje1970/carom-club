"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEventHandler,
  type WheelEventHandler,
} from "react";
import styles from "./main-scene-slide-deck.module.css";
import { SlideDeckCard, type SlideDeckItem } from "./tournament-slide-card";

export type { SlideDeckItem };

type SceneRole = "idle" | "incoming" | "center" | "outgoing";

/** 다음 카드(incoming) 숨김(초). 이 동안 위치는 항상 최하단(바닥)에 고정 */
const INCOMING_DELAY_S = 2;
/** 보이기 시작한 뒤 바닥→중앙 상승 시간(초) */
const INCOMING_RISE_DURATION_S = 4;
const FX_STRENGTH = 1.15;
const FX_EARLY_BIAS = 0.7;
/** 중앙 도착 후 이 시간(초) 동안은 위치·크기·불투명도 유지, 이후 후퇴 시작 */
const CENTER_HOLD_S = 4;
/** 퇴장(위로·축소·페이드)에만 쓰이는 시간(초) */
const RETREAT_DURATION_S = 6;
/** 한 장면 길이 = 중앙 유지 + 퇴장 */
const SCENE_S = CENTER_HOLD_S + RETREAT_DURATION_S;
/** 후퇴 경로의 세로 이동(%) 배율 — 1보다 크면 같은 진행도에서 더 위로 */
const RETREAT_TY_STRETCH = 1.4;
/** 후퇴 종료 시 불투명도 (30%) */
const RETREAT_OPACITY_END = 0.3;
const OUTGOING_SCALE_TARGET = 0;
const MANUAL_RESUME_DELAY_MS = 1800;
const WHEEL_SCENE_STEP = 240;
const DRAG_SCENE_STEP = 220;

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

/** 후퇴 진행도 0~1 → 위로 이동·축소·불투명도 100%→30% */
function retreatVisuals(progress: number): { opacity: number; transform: string } {
  const p = Math.min(1, Math.max(0, progress));
  const move = retreatAt(p);
  const fxProgress = Math.min(1, Math.max(0, p * FX_STRENGTH));
  const fxProgressBiased = Math.pow(fxProgress, FX_EARLY_BIAS);
  const outgoingScale = 1 + (OUTGOING_SCALE_TARGET - 1) * fxProgressBiased;
  const opacity = 1 + (RETREAT_OPACITY_END - 1) * fxProgressBiased;
  const tyPct = move.ty * RETREAT_TY_STRETCH;
  return {
    opacity,
    transform: `translateY(${tyPct}%) scale(${outgoingScale})`,
  };
}

/**
 * @param sceneT 장면 로컬 시간(초). t=0 은 중앙 카드 도착 직후(장면 시작). 퇴장·대기 길이와 별개로 모든 역할이 동일 시계 공유.
 */
function cardStyleForRole(role: SceneRole, sceneT: number, roleProgress: number): CSSProperties {
  if (role === "idle") {
    return {
      opacity: 0,
      visibility: "hidden",
      transform: "translateY(calc(90cqh + 50%)) scale(1)",
      filter: "blur(0)",
      zIndex: 1,
    };
  }

  if (role === "incoming") {
    if (sceneT < INCOMING_DELAY_S) {
      return {
        opacity: 0,
        visibility: "hidden",
        transform: `translateY(calc((90cqh + 50%) * ${riseFactor(0)})) scale(1)`,
        filter: "blur(0)",
        zIndex: 1,
      };
    }
    const factor = riseFactor(roleProgress);
    return {
      opacity: 1,
      visibility: "visible",
      transform: `translateY(calc((90cqh + 50%) * ${factor})) scale(1)`,
      filter: "blur(0)",
      zIndex: 120,
    };
  }

  if (role === "center") {
    const factor = riseFactor(1);
    if (sceneT < CENTER_HOLD_S) {
      return {
        opacity: 1,
        visibility: "visible",
        transform: `translateY(calc((90cqh + 50%) * ${factor})) scale(1)`,
        filter: "blur(0)",
        zIndex: 100,
      };
    }
    const retreatProgress = Math.min(1, (sceneT - CENTER_HOLD_S) / Math.max(0.001, RETREAT_DURATION_S));
    const rv = retreatVisuals(retreatProgress);
    return {
      opacity: rv.opacity,
      visibility: "visible",
      transform: rv.transform,
      filter: "blur(0)",
      zIndex: 100,
    };
  }

  const rv = retreatVisuals(1);
  return {
    opacity: rv.opacity,
    visibility: rv.opacity < 0.02 ? "hidden" : "visible",
    transform: rv.transform,
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
  const draggingRef = useRef(false);
  const dragStartYRef = useRef(0);
  const dragStartSceneOffsetRef = useRef(0);

  useEffect(() => {
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
  }, []);

  const n = items.length;
  if (n === 0) return null;

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
    e.preventDefault();
    pauseAuto();
    sceneOffsetRef.current -= e.deltaY / WHEEL_SCENE_STEP;
    setFrameTime(Date.now());
    scheduleAutoResume();
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    draggingRef.current = true;
    pauseAuto();
    dragStartYRef.current = e.clientY;
    dragStartSceneOffsetRef.current = sceneOffsetRef.current;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    if (!draggingRef.current) return;
    const dy = e.clientY - dragStartYRef.current;
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
    endDragging(e.pointerId, e.currentTarget);
  };

  const onPointerCancel: PointerEventHandler<HTMLDivElement> = (e) => {
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

  const deck = (
    <div
      data-no-root-swipe
      className={styles.slideDeck}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {items.map((item, i) => {
        const role = sceneRoleForCard(i, n, sceneId);
        const style = cardStyleForRole(
          role,
          tInScene,
          role === "incoming"
            ? Math.min(
                1,
                Math.max(0, (tInScene - INCOMING_DELAY_S) / INCOMING_RISE_DURATION_S),
              )
            : 0,
        );
        return (
          <div key={item.snapshotId} className={styles.slideDeckLayer}>
            <div className={styles.slideDeckCard} style={style}>
              <SlideDeckCard item={item} />
            </div>
          </div>
        );
      })}
      {/* 카드(transform)보다 위에 두기 위해 레이어 뒤·높은 z-index·flex로 창 안에 고정 */}
      <div className={styles.slideDeckFrameOverlay}>
        <div className={styles.slideDeckTopChrome}>
          {noticeOverlay}
          {sectionLabel.trim() ? (
            <p className={styles.slideDeckLabel}>{sectionLabel.trim()}</p>
          ) : null}
        </div>
        <div className={styles.slideDeckBottomDots} aria-hidden="true">
          <span className={styles.slideDeckBottomDotY}>●</span>
          <span className={styles.slideDeckBottomDotR}>●</span>
          <span className={styles.slideDeckBottomDotW}>●</span>
        </div>
      </div>
    </div>
  );

  if (trimmedNotice.length > 0) {
    return (
      <div data-no-root-swipe className={styles.slideDeckShell}>
        {deck}
      </div>
    );
  }

  return deck;
}

