import SiteHubRouteLoadingShell from "../components/SiteHubRouteLoadingShell";

/** 목록·상세 전환 시 RSC 대기 구간 — 상단 셸 유지, 본문만 경량 로더 */
export default function SiteTournamentsSegmentLoading() {
  return <SiteHubRouteLoadingShell brandTitle="대회안내" />;
}
