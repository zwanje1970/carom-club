import SiteDetailShellBodyLoader from "./components/SiteDetailShellBodyLoader";

/** `/site` 세그먼트 전환용 — 본문 슬롯 배경 즉시 채움 */
export default function Loading() {
  return (
    <div className="site-hub-route-loading site-hub-route-loading--fill">
      <SiteDetailShellBodyLoader />
    </div>
  );
}
