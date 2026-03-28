"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";

export function CommunityHeader() {
  const router = useRouter();

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:bg-slate-950 dark:border-slate-800 md:hidden">
      <div className="w-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded-full p-2 -ml-2 transition-transform transition-colors active:bg-gray-100 active:scale-95"
          aria-label="나가기"
        >
          <X size={24} className="text-gray-700 dark:text-slate-300" />
        </button>
      </div>

      <h1 className="flex-1 truncate text-center text-base font-semibold text-gray-900 dark:text-white">
        커뮤니티
      </h1>

      <div className="flex w-10 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full p-2 -mr-2 transition-transform transition-colors active:bg-gray-100 active:scale-95"
          aria-label="뒤로가기"
        >
          <ChevronLeft size={24} className="text-gray-700 dark:text-slate-300" />
        </button>
      </div>
    </header>
  );
}
