import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";

/** 목록·상세 전환 시 RSC 대기 구간 — 상단 셸 유지, 본문만 경량 로더 */
export default function SiteTournamentsSegmentLoading() {
  return (
    <div
      className="site-hub-route-loading"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "min(38dvh, 16rem)",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <SiteDetailShellBodyLoader />
    </div>
  );
}
