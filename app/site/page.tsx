import type { Metadata } from "next";
import SiteOperationalHome from "./operational-site-home";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "캐롬클럽",
  description: "당구 대회·클럽 안내",
  alternates: {
    canonical: "/",
  },
};

export default SiteOperationalHome;
