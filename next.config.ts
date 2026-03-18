import type { NextConfig } from "next";
import path from "path";

type RemotePattern = {
  protocol: "https" | "http";
  hostname: string;
  port?: string;
  pathname: string;
  search?: string;
};

function hostnameFromEnvUrl(urlStr: string | undefined): string | null {
  if (!urlStr?.trim()) return null;
  try {
    const u = urlStr.startsWith("http") ? urlStr : `https://${urlStr}`;
    return new URL(u).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function buildRemotePatterns(): RemotePattern[] {
  const patterns: RemotePattern[] = [
    {
      protocol: "https",
      hostname: "**.public.blob.vercel-storage.com",
      port: "",
      pathname: "/**",
      // search 미지정: Blob 서명 URL 등 ?token= 쿼리 허용 (search: "" 는 쿼리 없는 URL만 매칭 → 400 유발)
    },
    {
      protocol: "https",
      hostname: "*.public.blob.vercel-storage.com",
      port: "",
      pathname: "/**",
    },
  ];

  const siteHost = hostnameFromEnvUrl(process.env.NEXT_PUBLIC_SITE_URL);
  if (siteHost) {
    patterns.push({
      protocol: "https",
      hostname: siteHost,
      port: "",
      pathname: "/**",
    });
    if (siteHost.startsWith("www.")) {
      const apex = siteHost.slice(4);
      if (apex)
        patterns.push({ protocol: "https", hostname: apex, port: "", pathname: "/**" });
    } else {
      patterns.push({
        protocol: "https",
        hostname: `www.${siteHost}`,
        port: "",
        pathname: "/**",
      });
    }
  }

  const vercelHost = process.env.VERCEL_URL
    ? hostnameFromEnvUrl(`https://${process.env.VERCEL_URL}`)
    : null;
  if (vercelHost) {
    patterns.push({
      protocol: "https",
      hostname: vercelHost,
      port: "",
      pathname: "/**",
    });
  }

  patterns.push({
    protocol: "https",
    hostname: "*.vercel.app",
    port: "",
    pathname: "/**",
  });

  const extra = process.env.NEXT_PUBLIC_IMAGE_REMOTE_HOSTS;
  if (extra?.trim()) {
    for (const part of extra.split(",").map((s) => s.trim()).filter(Boolean)) {
      const h = hostnameFromEnvUrl(part.includes("://") ? part : `https://${part}`);
      if (h)
        patterns.push({ protocol: "https", hostname: h, port: "", pathname: "/**" });
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: buildRemotePatterns(),
    localPatterns: [{ pathname: "/uploads/**" }],
    /**
     * Vercel 배포: Image Optimization 이 Blob·쿼리·호스트 불일치로 400 나는 경우가 많아 비활성화.
     * 자체 호스팅 등에서는 미설정 시 최적화 유지. 필요 시 NEXT_IMAGE_UNOPTIMIZED=1
     */
    unoptimized:
      process.env.VERCEL === "1" || process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
  },
};

export default nextConfig;
