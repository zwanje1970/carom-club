"use client";

import { usePathname, useRouter } from "next/navigation";
import { useIntroController } from "./useIntroController";
import { IntroOverlay } from "./IntroOverlay";
import type { IntroSettings } from "@/lib/site-settings";

export function IntroScreen({ introSettings }: { introSettings: IntroSettings }) {
  const { stopIntro } = useIntroController();
  const pathname = usePathname();
  const router = useRouter();

  const handleEnd = () => {
    stopIntro();
    if (pathname !== "/") {
      router.push("/");
    }
  };

  return <IntroOverlay onEnd={handleEnd} introSettings={introSettings} />;
}
