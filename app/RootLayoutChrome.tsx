import { GlobalChromeModeProvider } from "@/components/community/BallPlacementFullscreenContext";
import { AdminFloatButton } from "@/components/AdminFloatButton";
import { ClientFloatButton } from "@/components/ClientFloatButton";
import NotificationBanner from "@/components/NotificationBanner";
import { RegisterServiceWorker } from "@/components/push/RegisterServiceWorker";
import { ClientPerfLogger } from "@/components/ClientPerfLogger";

type Props = {
  children: React.ReactNode;
};

/**
 * Root app chrome with the minimum session-derived primitive props.
 * Keeps auth/session logic out of `app/layout.tsx`.
 */
export function RootLayoutChrome({ children }: Props) {
  return (
    <>
      <ClientPerfLogger />
      <RegisterServiceWorker />
      <NotificationBanner />
      <GlobalChromeModeProvider>{children}</GlobalChromeModeProvider>
      <AdminFloatButton />
      <ClientFloatButton />
    </>
  );
}
