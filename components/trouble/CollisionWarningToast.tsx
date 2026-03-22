"use client";

import { useEffect, useRef } from "react";
import { TROUBLE_SOLUTION_CONSOLE } from "@/components/trouble/trouble-console-contract";
import { COLLISION_POPUP_MESSAGE } from "@/hooks/useTroublePathPlayback";

export function CollisionWarningToast({
  message,
  onDismiss,
  regionAttr,
  variant = "trouble",
}: {
  message: string | null;
  onDismiss: () => void;
  /** data-trouble-region (기본: 콘솔 계약) */
  regionAttr?: string;
  /** trouble: data-trouble-* / plain: 충돌 안내만 */
  variant?: "trouble" | "plain";
}) {
  const dismissedRef = useRef(false);

  useEffect(() => {
    dismissedRef.current = false;
  }, [message]);

  useEffect(() => {
    if (!message) return;
    const id = window.setTimeout(() => {
      if (dismissedRef.current) return;
      dismissedRef.current = true;
      onDismiss();
    }, 4600);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);

  if (!message) return null;

  const region = regionAttr ?? TROUBLE_SOLUTION_CONSOLE.region.collisionWarning;
  const troubleProps =
    variant === "trouble"
      ? {
          "data-trouble-region": region,
        }
      : {
          "data-nangu-region": "nangu-collision-warning",
        };

  const handleAnimationEnd = () => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    onDismiss();
  };

  const body =
    message === COLLISION_POPUP_MESSAGE ? (
      <>
        충돌이
        <br />
        발생하였습니다.
      </>
    ) : (
      message
    );

  return (
    <div
      role="alert"
      aria-live="assertive"
      {...troubleProps}
      className="pointer-events-none fixed inset-0 z-[120] flex items-center justify-center p-6"
    >
      <span
        className="animate-collision-warning-blink max-w-[min(94vw,42rem)] text-center text-5xl font-bold leading-tight tracking-tight text-white [text-shadow:0_0_40px_rgb(0_0_0/0.85),0_2px_16px_rgb(0_0_0/0.9),0_0_3px_rgb(0_0_0/1)] sm:text-6xl md:text-7xl lg:text-8xl"
        onAnimationEnd={handleAnimationEnd}
      >
        {body}
      </span>
    </div>
  );
}
