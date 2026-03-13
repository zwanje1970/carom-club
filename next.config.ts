import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: "node_modules/.cache/next-build",
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
