import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
    eslint: {
    ignoreDuringBuilds: true,
  },
  outputFileTracingRoot: path.join(__dirname),
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        port: "",
        pathname: "/**",
        search: "",
      },
    ],
    // 로컬 개발: public/uploads 에 저장된 이미지도 next/image 로 표시
    localPatterns: [{ pathname: "/uploads/**" }],
  },
};

export default nextConfig;
