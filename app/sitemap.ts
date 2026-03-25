import type { MetadataRoute } from "next";
import { DEFAULT_SITE_URL } from "@/lib/site-settings";

/** 정적 주요 URL — robots.txt의 Sitemap과 동일 origin */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
  const now = new Date();
  const paths: {
    path: string;
    changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
    priority: number;
  }[] = [
    { path: "/", changeFrequency: "daily", priority: 1 },
    { path: "/tournaments", changeFrequency: "daily", priority: 0.9 },
    { path: "/venues", changeFrequency: "weekly", priority: 0.9 },
    { path: "/community", changeFrequency: "daily", priority: 0.85 },
    { path: "/notice", changeFrequency: "weekly", priority: 0.7 },
    { path: "/login", changeFrequency: "monthly", priority: 0.4 },
    { path: "/apply/client", changeFrequency: "monthly", priority: 0.5 },
  ];
  return paths.map(({ path, changeFrequency, priority }) => ({
    url: path === "/" ? base : `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));
}
