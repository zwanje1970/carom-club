import { pretendard } from "../fonts";
import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { getSiteSettings } from "@/lib/site-settings";

/** 기본 UI: Pretendard만 로드. 헤더·하단 네비까지 동일 글꼴 트리 안에 둔다. */
export default async function SiteGroupLayout({ children }: { children: React.ReactNode }) {
  const siteSettings = await getSiteSettings();

  return (
    <div className={`min-h-dvh min-h-screen ${pretendard.variable} ${pretendard.className}`}>
      <IntroRoot introSettings={siteSettings.introSettings}>
        <MainSiteHeaderWrapper />
        <MobileBottomNavWrapper showMainSiteNoteEntry={false}>{children}</MobileBottomNavWrapper>
      </IntroRoot>
    </div>
  );
}
