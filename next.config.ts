import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  distDir: "node_modules/.cache/next-build",
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
    ],
    // 로컬 개발: public/uploads 에 저장된 이미지도 next/image 로 표시
    localPatterns: [{ pathname: "/uploads/**" }],
  },
};

export default nextConfig;
