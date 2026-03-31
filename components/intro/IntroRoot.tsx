"use client";

import { usePathname } from "next/navigation";
import { IntroProvider, useIntroController } from "./useIntroController";
import { IntroScreen } from "./IntroScreen";
import type { IntroSettings } from "@/lib/site-settings";

function IntroGate({
  children,
  introSettings,
}: {
  children: React.ReactNode;
  introSettings: IntroSettings;
}) {
  const pathname = usePathname();
  const { isIntroVisible } = useIntroController();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;
  return (
    <>
      {children}
      {isIntroVisible && !isAdminRoute && introSettings.enabled && <IntroScreen introSettings={introSettings} />}
    </>
  );
}

export function IntroRoot({
  children,
  introSettings,
}: {
  children: React.ReactNode;
  introSettings: IntroSettings;
}) {
  return (
    <IntroProvider>
      <IntroGate introSettings={introSettings}>{children}</IntroGate>
    </IntroProvider>
  );
}
