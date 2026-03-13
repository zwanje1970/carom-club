"use client";

import { usePathname } from "next/navigation";
import { IntroProvider, useIntroController } from "./useIntroController";
import { IntroScreen } from "./IntroScreen";

function IntroGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isIntroVisible } = useIntroController();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  return (
    <>
      {isIntroVisible && !isAdminRoute && <IntroScreen />}
      {children}
    </>
  );
}

export function IntroRoot({ children }: { children: React.ReactNode }) {
  return (
    <IntroProvider>
      <IntroGate>{children}</IntroGate>
    </IntroProvider>
  );
}
