import CommunityListDetailTransitionShell from "./CommunityListDetailTransitionShell";
import "./community.css";
import "./community-list-detail-transition.css";

export default function CommunityLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <CommunityListDetailTransitionShell>{children}</CommunityListDetailTransitionShell>;
}
