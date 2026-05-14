import type { NextConfig } from "next";
import { fileURLToPath } from "url";

/** Monorepo/workspace tracing + Turbopack must share the same root (Next.js 16+). */
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js"],
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingExcludes: {
    "/*": ["./legacy-local-backup/**/*"],
  },
  outputFileTracingIncludes: {
    "/api/client/tournament-card-image": [
      "./node_modules/@fontsource-variable/noto-sans-kr/files/*.woff2",
    ],
  },
};

export default nextConfig;
