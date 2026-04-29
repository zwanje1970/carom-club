import { headers } from "next/headers";
import { isCaromClubMobileAppShell } from "../../../lib/is-carom-club-mobile-app-shell";
import { getClientStatusByUserId } from "../../../lib/surface-read";
import { getRequestSessionUser } from "../../../lib/server/request-session-user";
import type { SiteLayoutMenuItem } from "../../../lib/types/entities";

function menuPathOnly(href: string): string {
  const p = href.split("?")[0] ?? "";
  return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
}

/** PC 헤더에서 동적 노출로 대체하는 관리자 진입 링크(설정에 박혀 있을 수 있는 항목 제거) */
export function filterPcHeaderAdminMenuItems(menuItems: SiteLayoutMenuItem[]): SiteLayoutMenuItem[] {
  return menuItems.filter((item) => {
    const p = menuPathOnly(item.href);
    return p !== "/admin" && p !== "/platform" && p !== "/client";
  });
}

export type PcSiteHeaderAdminEntry = { showClient: boolean; showPlatform: boolean };

/** 공개 /site·대시보드 PC 헤더: 로그인 + 역할·클라이언트 승인 기준 */
export async function getPcSiteHeaderAdminFlags(): Promise<PcSiteHeaderAdminEntry> {
  const user = await getRequestSessionUser();
  if (!user) return { showClient: false, showPlatform: false };

  const headerList = await headers();
  const appShell = isCaromClubMobileAppShell(headerList);

  if (user.role === "PLATFORM") {
    return { showClient: false, showPlatform: appShell ? false : true };
  }

  if (user.role === "CLIENT") {
    const st = await getClientStatusByUserId(user.id);
    return { showClient: st === "APPROVED", showPlatform: false };
  }

  return { showClient: false, showPlatform: false };
}
