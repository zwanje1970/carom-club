"use client";

import Link from "next/link";

export function CommunityHubLink({ className }: { className?: string }) {
  return (
    <Link
      href="/community"
      prefetch={false}
      className={className}
    >
      커뮤니티
    </Link>
  );
}
