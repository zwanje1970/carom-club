"use client";

import { useEffect, useState } from "react";

const BALL_COLORS = [
  "bg-amber-400", // 노랑
  "bg-red-500",   // 빨강
  "bg-white",     // 흰색
] as const;

const STAGE_DURATIONS = {
  stage1: 2000,
  stage2: 3000,
  stage3: 3000,
  stage4: 1000,
};

const TEXT = "CAROM.CLUB";

// Triangle positions (vmin) and row positions for stage 2
const BALL_TRANSLATES: Record<string, { x: number; y: number }> = {
  "0_0": { x: 0, y: -25 },
  "0_1": { x: -28, y: 22 },
  "0_2": { x: 28, y: 22 },
  "2_0": { x: -7.5, y: 0 },
  "2_1": { x: 0, y: 0 },
  "2_2": { x: 7.5, y: 0 },
};

type Props = { onComplete: () => void };

export type LogoMetrics = {
  left: number;
  top: number;
  ballSizePx: number;
  gapPx: number;
};

export function LogoAnimation({ onComplete }: Props) {
  const [stage, setStage] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [lettersVisible, setLettersVisible] = useState(0);
  const [logoMetrics, setLogoMetrics] = useState<LogoMetrics | null>(null);

  useEffect(() => {
    if (stage === 0) {
      const t = setTimeout(() => setStage(1), 50);
      return () => clearTimeout(t);
    }
    if (stage === 1) {
      const t = setTimeout(() => setStage(2), STAGE_DURATIONS.stage1);
      return () => clearTimeout(t);
    }
    if (stage === 2) {
      const t = setTimeout(() => setStage(3), STAGE_DURATIONS.stage2);
      return () => clearTimeout(t);
    }
  }, [stage]);

  useEffect(() => {
    if (stage !== 3) return;
    const n = TEXT.length;
    const letterMs = STAGE_DURATIONS.stage3 / n;
    let i = 0;
    const interval = setInterval(() => {
      i += 1;
      setLettersVisible(i);
      if (i >= n) {
        clearInterval(interval);
        setStage(4);
      }
    }, letterMs);
    return () => clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== 4) return;
    const t = setTimeout(onComplete, STAGE_DURATIONS.stage4);
    return () => clearTimeout(t);
  }, [stage, onComplete]);

  // 현재 페이지 로고 위치 + 공 크기·자간 측정
  const measureLogo = () => {
    if (typeof document === "undefined") return;
    const logo = document.querySelector("[data-main-logo]") as HTMLElement | null;
    if (!logo) return;
    const logoRect = logo.getBoundingClientRect();
    const ballsContainer = logo.querySelector("[data-logo-balls]") as HTMLElement | null;
    if (!ballsContainer || ballsContainer.children.length < 3) {
      setLogoMetrics({ left: logoRect.left, top: logoRect.top, ballSizePx: 16, gapPx: 4 });
      return;
    }
    const r0 = (ballsContainer.children[0] as HTMLElement).getBoundingClientRect();
    const r1 = (ballsContainer.children[1] as HTMLElement).getBoundingClientRect();
    const ballSizePx = Math.round((r0.width + r0.height) / 2);
    const gapPx = Math.round(r1.left - r0.right);
    setLogoMetrics({
      left: logoRect.left,
      top: logoRect.top,
      ballSizePx,
      gapPx: Math.max(0, gapPx),
    });
  };

  useEffect(() => {
    measureLogo();
    window.addEventListener("resize", measureLogo);
    return () => window.removeEventListener("resize", measureLogo);
  }, []);

  // stage 2 진입 시점에 레이아웃 안정 후 다시 측정
  useEffect(() => {
    if (stage !== 2) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(measureLogo);
    });
    return () => cancelAnimationFrame(id);
  }, [stage]);

  const isCentered = stage <= 1;
  const isShrunk = stage >= 1;
  const isAtTop = stage >= 2;
  const useMeasured = isAtTop && logoMetrics !== null;
  // 도착 후(stage 3~)에만 측정한 공 크기·자간 적용 (이동 중엔 vmin으로 부드럽게)
  const useMeasuredBalls = useMeasured && stage >= 3 && logoMetrics!.ballSizePx > 0;
  const scale = useMeasuredBalls ? 1 : isAtTop ? 0.6 : isShrunk ? 1 : 2;
  const opacity = isAtTop ? 1 : isShrunk ? 0.3 : 1;
  const ballSizeVmin = isAtTop ? 6 : 44;

  return (
    <div
      className="absolute flex items-center gap-[0.2rem]"
      style={{
        ...(isCentered
          ? {
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }
          : useMeasured
            ? {
                top: logoMetrics!.top,
                left: logoMetrics!.left,
                transform: "none",
              }
            : {
                top: "1rem",
                left: "max(1rem, calc((100vw - 1024px) / 2 + 1rem))",
                transform: "none",
              }),
        transition:
          "top 3s cubic-bezier(0.33, 1, 0.68, 1), left 3s cubic-bezier(0.33, 1, 0.68, 1), transform 3s cubic-bezier(0.33, 1, 0.68, 1)",
      }}
    >
      <div
        className="relative"
        style={{
          width: useMeasuredBalls
            ? 3 * logoMetrics!.ballSizePx + 2 * logoMetrics!.gapPx
            : isAtTop
              ? "26vmin"
              : "85vmin",
          height: useMeasuredBalls ? logoMetrics!.ballSizePx : isAtTop ? "6vmin" : "75vmin",
          transition:
            "width 3s cubic-bezier(0.33, 1, 0.68, 1), height 3s cubic-bezier(0.33, 1, 0.68, 1)",
        }}
      >
        {BALL_COLORS.map((color, i) => {
          const key0 = `0_${i}` as keyof typeof BALL_TRANSLATES;
          const key2 = `2_${i}` as keyof typeof BALL_TRANSLATES;
          const from = BALL_TRANSLATES[key0];
          const to = BALL_TRANSLATES[key2];
          const usePx = useMeasuredBalls;
          const sizePx = usePx ? logoMetrics!.ballSizePx : 0;
          const gapPx = usePx ? logoMetrics!.gapPx : 0;
          const txPx = usePx
            ? (i === 0 ? -(sizePx + gapPx) : i === 1 ? 0 : sizePx + gapPx)
            : 0;
          const txVmin = usePx ? (i === 0 ? -7.5 : i === 1 ? 0 : 7.5) : isAtTop ? to.x : from.x;
          const tyVmin = usePx ? 0 : isAtTop ? to.y : from.y;
          return (
            <div
              key={i}
              className={`absolute rounded-full will-change-transform ${color}`}
              style={{
                ...(usePx
                  ? {
                      width: sizePx,
                      height: sizePx,
                      left: "50%",
                      top: "50%",
                      marginLeft: -sizePx / 2,
                      marginTop: -sizePx / 2,
                      transform: `translate(${txPx}px, 0) scale(${scale})`,
                    }
                  : {
                      width: `${ballSizeVmin}vmin`,
                      height: `${ballSizeVmin}vmin`,
                      left: "50%",
                      top: "50%",
                      marginLeft: `-${ballSizeVmin / 2}vmin`,
                      marginTop: `-${ballSizeVmin / 2}vmin`,
                      transform: `translate(${txVmin}vmin, ${tyVmin}vmin) scale(${scale})`,
                    }),
                opacity,
                transition:
                  "transform 3s cubic-bezier(0.33, 1, 0.68, 1), opacity 2s ease-out, width 3s cubic-bezier(0.33, 1, 0.68, 1), height 3s cubic-bezier(0.33, 1, 0.68, 1)",
                transitionDuration:
                  stage === 1 ? "2s" : stage === 2 ? "3s" : "0.2s",
                transitionDelay: stage === 2 ? `${i * 0.3}s` : "0s",
              }}
            />
          );
        })}
      </div>

      {isAtTop && (
        <span className="ml-0.5 text-lg font-bold tracking-tight text-white sm:text-xl leading-none">
          {TEXT.slice(0, lettersVisible)}
        </span>
      )}
    </div>
  );
}
