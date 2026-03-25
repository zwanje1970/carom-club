import type { MetadataRoute } from "next";
import { DEFAULT_SITE_URL } from "@/lib/site-settings";

/** 크롤러용 robots.txt — Google 검색 콘솔·Lighthouse가 파싱하기 쉬운 Metadata Route 형식 */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
