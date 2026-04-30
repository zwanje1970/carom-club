import type { NextConfig } from "next";
import { fileURLToPath } from "url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  outputFileTracingExcludes: {
    "/*": ["./legacy-local-backup/**/*"],
  },
};

export default nextConfig;
