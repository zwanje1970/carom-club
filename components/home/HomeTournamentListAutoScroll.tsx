"use client";

import { useEffect, useRef } from "react";
import { flowSpeedToPxPerSec } from "@/lib/home-carousel-flow";

type Props = {
  /** 관리자 설정 1~100 (느림~빠름) */
  flowSpeed: number;
  children: React.ReactNode;
};

/**
 * 모바일(~md 미만)에서 가로 목록을 연속 흐름으로 스크롤(무한 루프).
 * 자식에 동일 카드가 두 번 나열되어 있어야 하며, scrollWidth의 절반에서 루프 리셋.
 */
export function HomeTournamentListAutoScroll({ flowSpeed, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const inAutoFlowRef = useRef(false);
  const userPauseUntilRef = useRef(0);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onScroll = () => {
      if (inAutoFlowRef.current) return;
      userPauseUntilRef.current = Date.now() + 4000;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let rafId = 0;
    const speedPx = flowSpeedToPxPerSec(flowSpeed);

    const tick = (now: number) => {
      const el = ref.current;
      if (!el) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (window.matchMedia("(min-width: 768px)").matches) {
        lastTsRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      if (pausedRef.current || Date.now() < userPauseUntilRef.current) {
        lastTsRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const half = el.scrollWidth / 2;
      if (half < 8 || el.scrollWidth <= el.clientWidth + 2) {
        lastTsRef.current = null;
        rafId = requestAnimationFrame(tick);
        return;
      }

      const last = lastTsRef.current ?? now;
      const dt = Math.min(0.064, (now - last) / 1000);
      lastTsRef.current = now;

      inAutoFlowRef.current = true;
      el.scrollLeft += speedPx * dt;
      if (el.scrollLeft >= half - 0.5) {
        el.scrollLeft -= half;
      }
      queueMicrotask(() => {
        inAutoFlowRef.current = false;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [flowSpeed]);

  return (
    <div
      ref={ref}
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onTouchStart={() => {
        pausedRef.current = true;
      }}
      onTouchEnd={() => {
        window.setTimeout(() => {
          pausedRef.current = false;
        }, 2200);
      }}
      className="mt-6 -mx-4 sm:-mx-6 flex gap-4 overflow-x-auto overflow-y-hidden touch-pan-x pb-4 md:overflow-visible md:flex-wrap md:pb-0"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}
