import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";

/** 커뮤니티 목록·상세 등 전환 시 RSC 대기 구간 */
export default function SiteCommunitySegmentLoading() {
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
