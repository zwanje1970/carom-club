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
      if (apex) {
        patterns.push({
          protocol: "https",
          hostname: apex,
          port: "",
          pathname: "/**",
        });
      }
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
      if (h) {
        patterns.push({
          protocol: "https",
          hostname: h,
          port: "",
          pathname: "/**",
        });
      }
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  /** barrel import 트리쉐이킹 — 레거시 JS·미사용 청크 완화에 도움 */
  experimental: {
    optimizePackageImports: ["@tiptap/react", "@tiptap/starter-kit"],
  },
  outputFileTracingRoot: path.join(__dirname),

  /** www/apex·HTTP 정규화 redirects 는 사용하지 않음 — Vercel Domains(리다이렉트·HTTPS)와 중복 시 ERR_TOO_MANY_REDIRECTS 발생 가능 */

  images: {
    remotePatterns: buildRemotePatterns(),
    localPatterns: [{ pathname: "/uploads/**" }, { pathname: "/images/**" }],
    /** AVIF 우선 → WebP 폴백 (기본 파이프라인) */
    formats: ["image/avif", "image/webp"],
    /** 모바일 LCP용으로 과대 해상도(3840 등) 제거, 흔한 단말·뷰포트 위주 */
    deviceSizes: [360, 390, 414, 640, 750, 828, 1080, 1200, 1280, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    /** Vercel에서도 최적화 사용. 필요 시에만 NEXT_IMAGE_UNOPTIMIZED=1 */
    unoptimized: process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
  },
};

export default nextConfig;