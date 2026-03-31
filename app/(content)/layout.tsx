import { notoSansKr } from "../fonts-noto";
import { IntroRoot } from "@/components/intro/IntroRoot";
import { MainSiteHeaderWrapper } from "@/components/layout/MainSiteHeaderWrapper";
import { MobileBottomNavWrapper } from "@/components/layout/MobileBottomNavWrapper";
import { getSession } from "@/lib/auth";
import { canShowNoteEntry } from "@/lib/entry-visibility";
import { getSiteSettings } from "@/lib/site-settings";
import { isPlatformAdmin } from "@/types/auth";

/** 읽기 중심 콘텐츠: Noto Sans KR만 로드. 헤더·네비 포함 동일 페이지에서 Pretendard 미사용. */
export default async function ContentGroupLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const siteSettings = await getSiteSettings();
  const showMainSiteNoteEntry = canShowNoteEntry(isPlatformAdmin(session));

  return (
    <div className={`min-h-dvh min-h-screen ${notoSansKr.className}`}>
      <IntroRoot introSettings={siteSettings.introSettings}>
        <MainSiteHeaderWrapper />
        <MobileBottomNavWrapper showMainSiteNoteEntry={showMainSiteNoteEntry}>{children}</MobileBottomNavWrapper>
      </IntroRoot>
    </div>
  );
}
