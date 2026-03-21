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
  outputFileTracingRoot: path.join(__dirname),

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          { type: "host", value: "www.carom.club" },
        ],
        destination: "https://carom.club/:path*",
        permanent: true,
      },
      /** apex에서 HTTP로 들어온 요청 → HTTPS (Vercel 앞단에서 막히는 경우도 있으나, Next에서 한 번 더 정규화) */
      {
        source: "/:path*",
        has: [
          { type: "host", value: "carom.club" },
          { type: "header", key: "x-forwarded-proto", value: "http" },
        ],
        destination: "https://carom.club/:path*",
        permanent: true,
      },
    ];
  },

  images: {
    remotePatterns: buildRemotePatterns(),
    localPatterns: [{ pathname: "/uploads/**" }],
    unoptimized:
      process.env.VERCEL === "1" || process.env.NEXT_IMAGE_UNOPTIMIZED === "1",
  },
};

export default nextConfig;