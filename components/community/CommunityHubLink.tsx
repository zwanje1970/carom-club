"use client";

import Link from "next/link";

export function CommunityHubLink({ className }: { className?: string }) {
  const prewarm = () => {
    const params = new URLSearchParams({ take: "10" });
    fetch(`/api/community/main?${params.toString()}`, {
      method: "GET",
      credentials: "include",
      cache: "force-cache",
    }).catch(() => {
      // non-blocking prewarm
    });
  };

  return (
    <Link
      href="/community"
      prefetch={false}
      onMouseEnter={prewarm}
      onFocus={prewarm}
      onClick={prewarm}
      className={className}
    >
      커뮤니티
    </Link>
  );
}
