"use client";

import { usePathname, useRouter } from "next/navigation";
import { useIntroController } from "./useIntroController";
import { IntroOverlay } from "./IntroOverlay";

export function IntroScreen() {
  const { stopIntro } = useIntroController();
  const pathname = usePathname();
  const router = useRouter();

  const handleEnd = () => {
    stopIntro();
    if (pathname !== "/") {
      router.push("/");
    }
  };

  return <IntroOverlay onEnd={handleEnd} />;
}
