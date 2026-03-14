"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "./BottomNav";

type Props = { children: React.ReactNode };

/**
 * 모바일에서 BottomNav 표시 + 본문 하단 여백(pb-20).
 * /admin/* 에서는 BottomNav 미표시, 여백 없음.
 */
export function MobileBottomNavWrapper({ children }: Props) {
  const pathname = usePathname() ?? "";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <>
      <div className={isAdmin ? "" : "pb-20 md:pb-0"}>{children}</div>
      {!isAdmin && <BottomNav />}
    </>
  );
}
