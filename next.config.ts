import type { NextConfig } from "next";
import { fileURLToPath } from "url";

/** Monorepo/workspace tracing + Turbopack must share the same root (Next.js 16+). */
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingExcludes: {
    "/*": ["./legacy-local-backup/**/*"],
  },
};

export default nextConfig;
