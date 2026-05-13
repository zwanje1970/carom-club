import TournamentsListDetailTransitionShell from "./TournamentsListDetailTransitionShell";
import "./tournaments-list-detail-transition.css";

export default function SiteTournamentsSegmentLayout({ children }: { children: React.ReactNode }) {
  return <TournamentsListDetailTransitionShell>{children}</TournamentsListDetailTransitionShell>;
}
