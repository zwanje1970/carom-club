import VenuesListDetailTransitionShell from "./VenuesListDetailTransitionShell";
import "./venues-list-detail-transition.css";

export default function SiteVenuesSegmentLayout({ children }: { children: React.ReactNode }) {
  return <VenuesListDetailTransitionShell>{children}</VenuesListDetailTransitionShell>;
}
