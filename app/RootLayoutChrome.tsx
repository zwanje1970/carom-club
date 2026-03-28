import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { GlobalChromeModeProvider } from "@/components/community/BallPlacementFullscreenContext";
import { AdminFloatButton } from "@/components/AdminFloatButton";
import { ClientFloatButton } from "@/components/ClientFloatButton";
import NotificationBanner from "@/components/NotificationBanner";
import { RegisterServiceWorker } from "@/components/push/RegisterServiceWorker";
import { ClientPerfLogger } from "@/components/ClientPerfLogger";
import { getSession } from "@/lib/auth";
import { canShowNoteEntry } from "@/lib/entry-visibility";
import { isPlatformAdmin } from "@/types/auth";

type Props = {
  children: React.ReactNode;
};

/**
 * Root app chrome with the minimum session-derived primitive props.
 * Keeps auth/session logic out of `app/layout.tsx`.
 */
export async function RootLayoutChrome({ children }: Props) {
  const session = await getSession();
  const showMainSiteNoteEntry = canShowNoteEntry(isPlatformAdmin(session));

  return (
    <>
      <ClientPerfLogger />
      <RegisterServiceWorker />
      <NotificationBanner />
      <GlobalChromeModeProvider>
        <IntroRoot>
          <MainSiteHeaderWrapper />
          <MobileBottomNavWrapper showMainSiteNoteEntry={showMainSiteNoteEntry}>
            {children}
          </MobileBottomNavWrapper>
        </IntroRoot>
      </GlobalChromeModeProvider>
      <AdminFloatButton />
      <ClientFloatButton />
    </>
  );
}
