import SiteHubRouteLoadingShell from "../components/SiteHubRouteLoadingShell";

/** 커뮤니티 목록·상세 등 전환 시 RSC 대기 구간 */
export default function SiteCommunitySegmentLoading() {
  return (
    <SiteHubRouteLoadingShell
      brandTitle="커뮤니티"
      auxiliaryBarClassName="site-shell-controls--site-list"
      sectionClassName="site-site-gray-main v3-stack ui-community-page"
    />
  );
}
