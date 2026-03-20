"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/** 레거시 /community/boards/[slug] → /community/[slug] 로 통일 */
export default function CommunityBoardsLegacyRedirect() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  useEffect(() => {
    if (slug) router.replace(`/community/${slug}`);
  }, [slug, router]);

  return (
    <main className="min-h-screen bg-site-bg p-6 text-center text-sm text-gray-500">
      이동 중…
    </main>
  );
}
