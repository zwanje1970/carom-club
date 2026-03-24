"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import type { ClientOrganization } from "@/types/client-organization";
import { ClientOrganizationSelect } from "@/components/client/console/ClientOrganizationSelect";
import { MobileLandscapeLockButton } from "@/components/MobileLandscapeLockButton";
import { ClientConsoleBottomNav } from "@/components/client/console/ClientConsoleBottomNav";
import { ClientConsoleMobileOverflowMenu } from "@/components/client/console/ClientConsoleMobileOverflowMenu";
import { ClientConsoleNewTournamentFab } from "@/components/client/console/ClientConsoleNewTournamentFab";

/**
 * 클라이언트 콘솔 사이드바 — 상위 대표 진입점 6개만 노출
 * - 운영(승인·대진·명단 등): /client/operations… → 사이드바 「대회 운영」활성
 * - 정보·탭 보기: /client/tournaments… → 「대회 운영」활성 + 헤더 타이틀은 「대회 정보」
 * - 레거시 호환 경로(/client/participants 등)는 operations로 리다이렉트되며, 활성/타이틀 판단에는 넣지 않음
 */
const CLIENT_CONSOLE_NAV = [
  { id: "dash", href: "/client/dashboard", label: "운영 대시보드" },
  { id: "org", href: "/client/setup", label: "내 정보/사업장 관리" },
  { id: "tournament", href: "/client/operations", label: "대회 운영" },
  { id: "promo", href: "/client/promo", label: "콘텐츠/홍보" },
  { id: "billing", href: "/client/billing", label: "정산" },
  { id: "settings", href: "/client/settings", label: "설정" },
] as const;

function isClientNavActive(id: (typeof CLIENT_CONSOLE_NAV)[number]["id"], pathname: string): boolean {
  switch (id) {
    case "dash":
      return pathname === "/client" || pathname === "/client/dashboard";
    case "org":
      return pathname === "/client/setup" || pathname.startsWith("/client/setup/");
    case "tournament":
      return (
        pathname.startsWith("/client/operations") || pathname.startsWith("/client/tournaments")
      );
    case "promo":
      return pathname.startsWith("/client/promo") || pathname.startsWith("/client/content");
    case "billing":
      return pathname.startsWith("/client/billing");
    case "settings":
      return pathname.startsWith("/client/settings");
    default:
      return false;
  }
}

function resolveConsoleTitle(pathname: string): string {
  if (pathname === "/client" || pathname === "/client/dashboard") return "운영 대시보드";
  if (pathname.startsWith("/client/setup")) return "내 정보/사업장 관리";
  if (pathname.startsWith("/client/operations")) return "대회 운영";
  if (pathname.startsWith("/client/tournaments")) return "대회 정보";
  if (pathname.startsWith("/client/billing/platform")) return "플랫폼 이용";
  if (pathname.startsWith("/client/billing")) return "정산";
  if (pathname.startsWith("/client/settings")) return "설정";
  if (pathname.startsWith("/client/promo") || pathname.startsWith("/client/content")) return "콘텐츠/홍보";
  if (pathname.startsWith("/client/schedule")) return "일정 / 예약";
  if (pathname.startsWith("/client/zones")) return "부/권역";
  if (pathname.startsWith("/client/co-admins")) return "공동관리자";
  return "클라이언트 콘솔";
}

const navBtn =
  "block w-full border-l-2 border-transparent px-2 py-2 text-left text-[13px] leading-tight text-zinc-700 hover:bg-zinc-200/60 dark:text-zinc-300 dark:hover:bg-zinc-800/80";
const navBtnActive =
  "border-zinc-800 bg-zinc-200/80 font-medium text-zinc-900 dark:border-zinc-100 dark:bg-zinc-800 dark:text-zinc-50";

export function ClientConsoleShell({
  copy,
  organizations,
  activeOrganizationId,
  children,
}: {
  copy: Record<string, string>;
  organizations: ClientOrganization[];
  activeOrganizationId: string | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const c = copy as Record<AdminCopyKey, string>;
  const title = resolveConsoleTitle(pathname);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-zinc-100 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="hidden w-[15rem] shrink-0 flex-col border-r border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 lg:flex">
        <div className="flex h-12 shrink-0 items-center border-b border-zinc-300 px-3 dark:border-zinc-700">
          <Link
            href="/client/dashboard"
            className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {getCopyValue(c, "client.dashboard.consoleTitle")}
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">메뉴</p>
          <ul className="space-y-0.5">
            {CLIENT_CONSOLE_NAV.map((item) => {
              const active = isClientNavActive(item.id, pathname);
              return (
                <li key={item.id}>
                  <Link href={item.href} className={`${navBtn} ${active ? navBtnActive : ""}`}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="shrink-0 border-t border-zinc-300 p-2 dark:border-zinc-700">
          <Link
            href="/"
            className="block px-2 py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
          >
            {getCopyValue(c, "nav.home")}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-300 bg-white px-4 dark:border-zinc-700 dark:bg-zinc-950 lg:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href="/"
              className="shrink-0 rounded-sm border border-zinc-400 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              title="사이트 메인으로"
            >
              {getCopyValue(c, "client.console.homeButton")}
            </Link>
            <h1 className="min-w-0 truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
          </div>
          <MobileLandscapeLockButton />
          <ClientConsoleMobileOverflowMenu />
          <ClientOrganizationSelect organizations={organizations} activeOrganizationId={activeOrganizationId} />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 p-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] dark:bg-zinc-950 md:p-6 lg:pb-6">
          {children}
        </main>
        <ClientConsoleBottomNav />
        <ClientConsoleNewTournamentFab />
      </div>
    </div>
  );
}
