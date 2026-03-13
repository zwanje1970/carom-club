"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** 한 번 인트로를 닫으면 이 키로 저장되어, 다음 접속부터는 인트로를 보여주지 않음 */
const INTRO_STORAGE_KEY = "introPlayed";

type IntroController = {
  isIntroVisible: boolean;
  startIntro: () => void;
  stopIntro: () => void;
  restartIntro: () => void;
};

const IntroContext = createContext<IntroController | null>(null);

export function IntroProvider({ children }: { children: ReactNode }) {
  // 'pending': 마운트 후 localStorage 확인 전 (인트로 미표시로 하이드레이션 일치)
  // true: 처음 접속 → 인트로 표시
  // false: 이미 본 적 있음 → 인트로 미표시
  const [isIntroVisible, setIsIntroVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  const stopIntro = useCallback(() => {
    setIsIntroVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(INTRO_STORAGE_KEY, "true");
    }
  }, []);

  const startIntro = useCallback(() => {
    setIsIntroVisible(true);
  }, []);

  const restartIntro = useCallback(() => {
    setIsIntroVisible(true);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  // 마운트 후, 처음 접속인 경우에만 인트로 표시 (이후 접속에서는 localStorage에 의해 미표시)
  useEffect(() => {
    if (!mounted || typeof window === "undefined") return;
    const played = window.localStorage.getItem(INTRO_STORAGE_KEY);
    if (played !== "true") {
      setIsIntroVisible(true);
    }
  }, [mounted]);

  return (
    <IntroContext.Provider
      value={{ isIntroVisible, startIntro, stopIntro, restartIntro }}
    >
      {children}
    </IntroContext.Provider>
  );
}

export function useIntroController(): IntroController {
  const ctx = useContext(IntroContext);
  if (!ctx) {
    throw new Error("useIntroController must be used within IntroProvider");
  }
  return ctx;
}
