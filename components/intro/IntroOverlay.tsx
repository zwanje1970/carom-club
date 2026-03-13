"use client";

import { useEffect, useRef, useState } from "react";

const INTRO_TEXT = "CAROM.CLUB";
const START_SIZE_VMIN = 220;
const OVERLAP_VMIN = 66; // ~40–50% overlap (scale with START_SIZE_VMIN)
const PHASE1_DURATION_MS = 2000;
const HOLD_AFTER_PHASE1_MS = 500;
const BALL_MOVE_DURATION_MS = 500;
const DELAY_BEFORE_LETTERS_MS = 200;
const LETTER_INTERVAL_MS = 200;
const DELAY_AFTER_LETTERS_MS = 600;

type LogoMetrics = {
  ballRects: DOMRect[];
  textRect: DOMRect;
  textFontSize: string;
  textLetterSpacing: string;
};

function measureLogo(): LogoMetrics | null {
  const mainLogo = document.querySelector("[data-main-logo]");
  const ballsContainer = mainLogo?.querySelector("[data-logo-balls]");
  const textEl = mainLogo?.querySelector("[data-logo-text]") as HTMLElement | null;
  if (!ballsContainer || !textEl) return null;
  const ballEls = Array.from(ballsContainer.children).slice(0, 3);
  if (ballEls.length !== 3) return null;
  const ballRects = ballEls.map((el) => el.getBoundingClientRect());
  const textRect = textEl.getBoundingClientRect();
  const textStyle = textEl ? window.getComputedStyle(textEl) : null;
  return {
    ballRects,
    textRect,
    textFontSize: textStyle?.fontSize ?? "18px",
    textLetterSpacing: textStyle?.letterSpacing ?? "normal",
  };
}

function applyBallStartStyle(
  el: HTMLElement,
  index: number,
  sizeVmin: number,
  opacity: number
) {
  const half = sizeVmin / 2;
  const offsetX = index === 0 ? -OVERLAP_VMIN : index === 1 ? 0 : OVERLAP_VMIN;
  el.style.position = "fixed";
  el.style.left = "50%";
  el.style.top = "50%";
  el.style.marginLeft = `-${half}vmin`;
  el.style.marginTop = `-${half}vmin`;
  el.style.width = `${sizeVmin}vmin`;
  el.style.height = `${sizeVmin}vmin`;
  el.style.transform = `translate(${offsetX}vmin, 0)`;
  el.style.opacity = String(opacity);
  el.style.borderRadius = "50%";
  el.style.pointerEvents = "none";
}

function applyBallFinalStyle(el: HTMLElement, rect: DOMRect) {
  el.style.transition = `left ${BALL_MOVE_DURATION_MS}ms ease-out, top ${BALL_MOVE_DURATION_MS}ms ease-out, width ${BALL_MOVE_DURATION_MS}ms ease-out, height ${BALL_MOVE_DURATION_MS}ms ease-out, opacity ${BALL_MOVE_DURATION_MS}ms ease-out`;
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
  el.style.marginLeft = "0";
  el.style.marginTop = "0";
  el.style.transform = "none";
  el.style.opacity = "1";
}

export function IntroOverlay({ onEnd }: { onEnd: () => void }) {
  const ballRefs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
  const [lettersVisible, setLettersVisible] = useState(0);
  const [metrics, setMetrics] = useState<LogoMetrics | null>(null);
  const metricsRef = useRef<LogoMetrics | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timelineStartedRef = useRef(false);

  useEffect(() => {
    if (timelineStartedRef.current) return;

    const measured = measureLogo();
    if (!measured) return;

    metricsRef.current = measured;
    setMetrics(measured);

    const balls = ballRefs.map((r) => r.current).filter(Boolean) as HTMLElement[];
    if (balls.length !== 3) return;

    timelineStartedRef.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    // Start: huge, overlapping, opacity 1
    const sizeStart = START_SIZE_VMIN;
    balls.forEach((el, i) => applyBallStartStyle(el, i, sizeStart, 1));

    // Phase 1: shrink to 20%, opacity 0.3
    const sizePhase1End = START_SIZE_VMIN * 0.2; // 30vmin
    timeouts.push(
      setTimeout(() => {
        balls.forEach((el) => {
          el.style.transition = `width ${PHASE1_DURATION_MS}ms ease-out, height ${PHASE1_DURATION_MS}ms ease-out, margin-left ${PHASE1_DURATION_MS}ms ease-out, margin-top ${PHASE1_DURATION_MS}ms ease-out, opacity ${PHASE1_DURATION_MS}ms ease-out`;
        });
        balls.forEach((el, i) => applyBallStartStyle(el, i, sizePhase1End, 0.3));
      }, 100)
    );

    const phase2Start = 100 + PHASE1_DURATION_MS + HOLD_AFTER_PHASE1_MS;

    function animateBallToFinal(ballIndex: number) {
      const m = metricsRef.current;
      const el = ballRefs[ballIndex].current;
      if (!m || !el) return;
      const rect = m.ballRects[ballIndex];
      const now = el.getBoundingClientRect();
      el.style.transition = "none";
      el.style.left = `${now.left}px`;
      el.style.top = `${now.top}px`;
      el.style.width = `${now.width}px`;
      el.style.height = `${now.height}px`;
      el.style.marginLeft = "0";
      el.style.marginTop = "0";
      el.style.transform = "none";
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          applyBallFinalStyle(el, rect);
        });
      });
    }

    timeouts.push(setTimeout(() => animateBallToFinal(0), phase2Start));
    timeouts.push(setTimeout(() => animateBallToFinal(1), phase2Start + BALL_MOVE_DURATION_MS));
    timeouts.push(setTimeout(() => animateBallToFinal(2), phase2Start + BALL_MOVE_DURATION_MS * 2));

    const lettersStart =
      phase2Start + BALL_MOVE_DURATION_MS * 3 + DELAY_BEFORE_LETTERS_MS;
    const lettersArr = INTRO_TEXT.split("");
    lettersArr.forEach((_, i) => {
      timeouts.push(
        setTimeout(() => setLettersVisible((n) => Math.max(n, i + 1)), lettersStart + i * LETTER_INTERVAL_MS)
      );
    });

    const endTime =
      lettersStart + lettersArr.length * LETTER_INTERVAL_MS + DELAY_AFTER_LETTERS_MS;
    timeouts.push(
      setTimeout(() => {
        const overlay = overlayRef.current;
        if (overlay) {
          overlay.style.transition = "opacity 0.35s ease-out";
          overlay.style.opacity = "0";
        }
        timeouts.push(setTimeout(() => onEnd(), 400));
      }, endTime)
    );

    return () => {
      timelineStartedRef.current = false;
      timeouts.forEach(clearTimeout);
    };
    // Intentionally run once on mount; ballRefs are stable refs, no need in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEnd]);

  useEffect(() => {
    const handleKeyDown = () => onEnd();
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onEnd]);

  return (
    <div
      ref={overlayRef}
      className="pointer-events-none fixed inset-0 z-[100] flex flex-col bg-black"
      style={{ opacity: 1 }}
      aria-hidden
    >
      {/* Balls — position/size controlled by JS (인트로 공 색상: LogoLink variant="white"와 동일) */}
      <div ref={ballRefs[0]} className="rounded-full bg-amber-400" />
      <div ref={ballRefs[1]} className="rounded-full bg-red-500" />
      <div ref={ballRefs[2]} className="rounded-full bg-white" />
      {/* Text — positioned to match main logo text */}
      <div
        className="pointer-events-none fixed flex items-baseline font-bold text-white"
        style={
          metrics
            ? {
                left: metrics.textRect.left,
                top: metrics.textRect.top,
                fontSize: metrics.textFontSize,
                letterSpacing: metrics.textLetterSpacing,
              }
            : { left: 0, top: 0, opacity: 0 }
        }
      >
        {INTRO_TEXT.split("").map((char, i) => (
          <span
            key={i}
            style={{
              opacity: i < lettersVisible ? 1 : 0,
              transition: "opacity 0.15s ease-out",
            }}
          >
            {char}
          </span>
        ))}
      </div>
      <button
        type="button"
        onClick={onEnd}
        onKeyDown={(e) => { e.preventDefault(); onEnd(); }}
        className="pointer-events-auto absolute bottom-8 left-1/2 -translate-x-1/2 text-sm text-white/70 hover:text-white transition"
        aria-label="Press any key to skip"
      >
        Press any key to skip
      </button>
      {/* 화면 클릭 또는 아무 키 입력 시 인트로 종료 */}
      <div
        role="button"
        tabIndex={0}
        onClick={onEnd}
        onKeyDown={(e) => { e.preventDefault(); onEnd(); }}
        className="pointer-events-auto absolute inset-0 cursor-pointer"
        aria-label="Press any key to skip"
      />
    </div>
  );
}
