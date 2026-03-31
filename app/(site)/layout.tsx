import { pretendard } from "../fonts";
import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { getSession } from "@/lib/auth";
import { canShowNoteEntry } from "@/lib/entry-visibility";
import { getSiteSettings } from "@/lib/site-settings";
import { isPlatformAdmin } from "@/types/auth";

/** 기본 UI: Pretendard만 로드. 헤더·하단 네비까지 동일 글꼴 트리 안에 둔다. */
export default async function SiteGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const siteSettings = await getSiteSettings();
  const showMainSiteNoteEntry = canShowNoteEntry(isPlatformAdmin(session));

  return (
    <div className={`min-h-dvh min-h-screen ${pretendard.variable} ${pretendard.className}`}>
      <IntroRoot introSettings={siteSettings.introSettings}>
        <MainSiteHeaderWrapper />
        <MobileBottomNavWrapper showMainSiteNoteEntry={showMainSiteNoteEntry}>{children}</MobileBottomNavWrapper>
      </IntroRoot>
    </div>
  );
}
