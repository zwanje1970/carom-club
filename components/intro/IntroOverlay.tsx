"use client";

import { useEffect } from "react";
import type { IntroSettings } from "@/lib/site-settings";

export function IntroOverlay({
  onEnd,
  introSettings,
}: {
  onEnd: () => void;
  introSettings: IntroSettings;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onEnd, Math.max(1, introSettings.displaySeconds) * 1000);
    const handleKeyDown = () => onEnd();
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [introSettings.displaySeconds, onEnd]);

  return (
    <div className="fixed inset-0 z-[100] bg-black text-white">
      {introSettings.mediaType === "video" ? (
        <video
          className="absolute inset-0 h-full w-full object-cover"
          src={introSettings.mediaUrl}
          autoPlay
          muted
          playsInline
          loop
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={introSettings.mediaUrl}
          alt={introSettings.title || "인트로"}
        />
      )}
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative z-[1] flex h-full flex-col items-center justify-center px-6 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">{introSettings.title || "CAROM.CLUB"}</h2>
        {introSettings.description ? (
          <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">{introSettings.description}</p>
        ) : null}
        {introSettings.linkUrl ? (
          <a
            href={introSettings.linkUrl}
            className="mt-5 rounded bg-white px-4 py-2 text-sm font-semibold text-black"
            onClick={(e) => e.stopPropagation()}
          >
            바로가기
          </a>
        ) : null}
      </div>
      {introSettings.showSkipButton ? (
        <button
          type="button"
          onClick={onEnd}
          className="absolute bottom-8 left-1/2 z-[2] -translate-x-1/2 rounded border border-white/60 px-3 py-1.5 text-xs text-white hover:bg-white/10"
          aria-label="인트로 건너뛰기"
        >
          건너뛰기
        </button>
      ) : null}
      <div className="absolute inset-0 z-[0] cursor-pointer" onClick={onEnd} aria-hidden />
    </div>
  );
}
