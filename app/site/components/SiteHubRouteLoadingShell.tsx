import SiteDetailShellBodyLoader from "./SiteDetailShellBodyLoader";
import SiteShellFrame from "./SiteShellFrame";

type Props = {
  brandTitle: string;
  sectionClassName?: string;
  auxiliaryBarClassName?: string;
};

/** 허브 목록·상세 전환·세그먼트 loading — 헤더+본문 배경을 즉시 채워 blank 슬라이드 방지 */
export default function SiteHubRouteLoadingShell({
  brandTitle,
  sectionClassName = "site-site-gray-main v3-stack",
  auxiliaryBarClassName,
}: Props) {
  return (
    <SiteShellFrame
      brandTitle={brandTitle}
      {...(auxiliaryBarClassName ? { auxiliaryBarClassName } : {})}
    >
      <section className={`${sectionClassName} site-hub-route-loading-section`}>
        <SiteDetailShellBodyLoader />
      </section>
    </SiteShellFrame>
  );
}
