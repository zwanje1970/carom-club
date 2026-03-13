"use client";

import Link from "next/link";
import { useSiteSettings } from "@/components/SiteSettingsProvider";

const DEFAULT_DESCRIPTION = "당구 대회와 커뮤니티를 한곳에서.";

export function SiteHeroContent() {
  const { siteName, siteDescription } = useSiteSettings();
  const description = siteDescription?.trim() || DEFAULT_DESCRIPTION;

  return (
    <>
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-site-primary">
        당구 대회 · 커뮤니티
      </p>
      <h1 className="mt-4 text-4xl font-bold tracking-tight text-site-text sm:text-5xl md:text-6xl lg:text-7xl">
        {siteName}
      </h1>
      <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-gray-600">
        {description}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/tournaments"
          className="rounded-lg bg-site-primary px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          대회 보기
        </Link>
        <Link
          href="/signup"
          className="rounded-lg border border-site-border bg-site-card px-6 py-3 text-sm font-medium text-site-text transition hover:border-site-border hover:bg-site-bg"
        >
          회원가입
        </Link>
      </div>
    </>
  );
}
