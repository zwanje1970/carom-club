"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getCopyValue, type AdminCopyKey } from "@/lib/admin-copy";
import type { ClientOrganization } from "@/types/client-organization";
import { ClientOrganizationSelect } from "@/components/client/console/ClientOrganizationSelect";

/** 1차: 업무 콘솔 메뉴 (요구사항 6항) */
const PRIMARY_NAV: { href: string; label: string }[] = [
  { href: "/client/dashboard", label: "대시보드" },
  { href: "/client/content", label: "콘텐츠 관리" },
  { href: "/client/operations", label: "운영 관리" },
  { href: "/client/schedule", label: "일정 / 예약" },
  { href: "/client/billing", label: "대회 정산" },
  { href: "/client/settings", label: "설정" },
];

/** 기존 클라이언트 업무 화면 — 사이드에서 계속 진입 가능 */
const LEGACY_NAV: { href: string; copyKey: AdminCopyKey }[] = [
  { href: "/client/tournaments", copyKey: "client.sidebar.myTournaments" },
  { href: "/client/participants", copyKey: "client.sidebar.participants" },
  { href: "/client/zones", copyKey: "client.sidebar.zones" },
  { href: "/client/brackets", copyKey: "client.sidebar.brackets" },
  { href: "/client/results", copyKey: "client.sidebar.results" },
  { href: "/client/co-admins", copyKey: "client.sidebar.coAdmins" },
  { href: "/client/promo", copyKey: "client.sidebar.promo" },
  { href: "/client/setup", copyKey: "client.sidebar.setup" },
];

function resolveConsoleTitle(pathname: string): string {
  if (pathname === "/client" || pathname === "/client/dashboard") return "대시보드";
  if (pathname.startsWith("/client/content")) return "콘텐츠 관리";
  if (pathname.includes("/operations/tournaments/") && pathname.includes("/bracket-build")) return "대진 생성 콘솔";
  if (/\/operations\/tournaments\/[^/]+\/bracket$/.test(pathname)) return "브래킷 보기·수정";
  if (pathname.includes("/operations/tournaments/") && pathname.includes("/participant-roster")) return "참가 명단 확정";
  if (pathname.includes("/operations/tournaments/") && pathname.includes("/participants")) return "참가자 관리";
  if (pathname.startsWith("/client/operations")) return "운영 관리";
  if (pathname.startsWith("/client/schedule")) return "일정 / 예약";
  if (pathname.startsWith("/client/billing/platform")) return "플랫폼 이용";
  if (pathname.startsWith("/client/billing")) return "대회 정산";
  if (pathname.startsWith("/client/settings")) return "설정";
  if (pathname.startsWith("/client/tournaments")) return "대회";
  if (pathname.startsWith("/client/participants")) return "접수·참가자";
  if (pathname.startsWith("/client/zones")) return "권역·코트";
  if (pathname.startsWith("/client/brackets")) return "대진표";
  if (pathname.startsWith("/client/results")) return "경기 결과";
  if (pathname.startsWith("/client/co-admins")) return "공동 관리자";
  if (pathname.startsWith("/client/promo")) return "프로모션";
  if (pathname.startsWith("/client/setup")) return "업체 설정";
  return "대회 운영 콘솔";
}

function isPrimaryActive(pathname: string, href: string): boolean {
  if (href === "/client/dashboard") {
    return pathname === "/client" || pathname === "/client/dashboard";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isLegacyActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
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
      {/* 좌측 고정 사이드바 */}
      <aside className="flex w-[15rem] shrink-0 flex-col border-r border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
        <div className="flex h-12 shrink-0 items-center border-b border-zinc-300 px-3 dark:border-zinc-700">
          <Link
            href="/client/dashboard"
            className="text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
          >
            {getCopyValue(c, "client.dashboard.consoleTitle")}
          </Link>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            대회 운영 콘솔
          </p>
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map((item) => {
              const active = isPrimaryActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${navBtn} ${active ? navBtnActive : ""}`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>

          <p className="mb-1.5 mt-5 px-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            대회·운영
          </p>
          <ul className="space-y-0.5">
            {LEGACY_NAV.map((item) => {
              const label = getCopyValue(c, item.copyKey);
              const active = isLegacyActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${navBtn} ${active ? navBtnActive : ""}`}
                  >
                    {label}
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

      {/* 상단 헤더 + 메인 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-zinc-300 bg-white px-4 dark:border-zinc-700 dark:bg-zinc-950">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Link
              href="/"
              className="shrink-0 rounded-sm border border-zinc-400 bg-zinc-50 px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
              title="사이트 메인으로"
            >
              {getCopyValue(c, "client.console.homeButton")}
            </Link>
            <h1 className="min-w-0 truncate text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">
              {title}
            </h1>
          </div>
          <ClientOrganizationSelect
            organizations={organizations}
            activeOrganizationId={activeOrganizationId}
          />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto bg-zinc-100 p-4 dark:bg-zinc-950 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
