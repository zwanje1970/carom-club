import SiteDetailShellBodyLoader from "./components/SiteDetailShellBodyLoader";

/** `/site` 세그먼트 전환용 — 무거운 전체 스켈레톤 대신 상세와 동일 톤의 소형 로더만 */
export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "min(42dvh, 18rem)",
        padding: "1rem",
        boxSizing: "border-box",
      }}
    >
      <SiteDetailShellBodyLoader />
    </div>
  );
}
