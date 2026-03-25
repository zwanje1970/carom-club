"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type IntroController = {
  isIntroVisible: boolean;
  startIntro: () => void;
  stopIntro: () => void;
  restartIntro: () => void;
};

const IntroContext = createContext<IntroController | null>(null);

export function IntroProvider({ children }: { children: ReactNode }) {
  const [isIntroVisible, setIsIntroVisible] = useState(false);

  const stopIntro = useCallback(() => {
    setIsIntroVisible(false);
  }, []);

  const startIntro = useCallback(() => {
    setIsIntroVisible(true);
  }, []);

  const restartIntro = useCallback(() => {
    setIsIntroVisible(true);
  }, []);

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
