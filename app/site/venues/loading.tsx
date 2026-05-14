import SiteDetailShellBodyLoader from "../components/SiteDetailShellBodyLoader";

/** 클럽 목록·상세 전환 시 RSC 대기 구간 */
export default function SiteVenuesSegmentLoading() {
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
