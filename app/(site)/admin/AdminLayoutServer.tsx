import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { getAdminCopy } from "@/lib/admin-copy-server";
import { getSiteSettings } from "@/lib/site-settings";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPageActions } from "@/components/admin/AdminPageActions";
import { AdminLogoutAndLoginButton } from "@/components/admin/AdminLogoutAndLoginButton";
import { hasPermission, PERMISSION_KEYS } from "@/lib/auth/permissions.server";

type Props = {
  children: React.ReactNode;
  requirePlatformAdmin?: boolean;
  scope?: "admin" | "platform";
};

/**
 * Admin shell server gate.
 * Keeps auth/permission/settings loading out of `app/admin/layout.tsx`.
 */
export async function AdminLayoutServer({
  children,
  requirePlatformAdmin = false,
  scope = "admin",
}: Props) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isPlatformArea =
    pathname === "/admin/platform" ||
    pathname.startsWith("/admin/platform/") ||
    pathname === "/admin/venues" ||
    pathname.startsWith("/admin/venues/") ||
    pathname === "/admin/client-applications" ||
    pathname.startsWith("/admin/client-applications/") ||
    pathname === "/admin/pricing-plans" ||
    pathname.startsWith("/admin/pricing-plans/") ||
    pathname === "/admin/settings/platform-billing" ||
    pathname.startsWith("/admin/settings/platform-billing/") ||
    pathname === "/admin/members" ||
    pathname.startsWith("/admin/members/") ||
    pathname === "/admin/fee-ledger" ||
    pathname.startsWith("/admin/fee-ledger/");
  const resolvedScope: "admin" | "platform" = scope === "platform" || isPlatformArea ? "platform" : "admin";
  const shouldRequirePlatformAdmin = requirePlatformAdmin || isPlatformArea;
  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  if (isLoginPage) return <>{children}</>;

  if (!session) {
    redirect("/admin/login");
  }

  if (session.role === "ZONE_MANAGER") {
    redirect("/zone");
  }

  if (shouldRequirePlatformAdmin && session.role !== "PLATFORM_ADMIN") {
    redirect("/admin/site");
  }

  const canAccessAdmin = await hasPermission(session, PERMISSION_KEYS.ADMIN_ACCESS);
  if (!canAccessAdmin || session.authChannel !== "admin") {
    return (
      <div className="min-h-screen flex flex-col bg-site-bg p-4">
        <div className="px-2 pt-4">
          <AdminPageActions />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center max-w-sm">
            <h1 className="text-xl font-bold text-site-text">캐롬클럽 관리자 권한이 없습니다</h1>
            <p className="mt-2 text-gray-600">이 계정은 관리자가 아닙니다.</p>
            <p className="mt-3 text-sm text-gray-500">
              관리자 전용 계정(아이디: <strong>admin</strong>)으로 로그인하세요. 계정이 없다면 터미널에서{" "}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">npx prisma db seed</code>를 실행한 뒤
              비밀번호 <strong>admin1234</strong>로 로그인하세요.
            </p>
            <p className="mt-2 text-sm text-gray-500">지금 로그인된 계정을 로그아웃한 뒤 admin으로 다시 로그인하세요.</p>
            <AdminLogoutAndLoginButton className="mt-6 inline-block rounded-lg bg-site-primary px-5 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-70">
              로그아웃 후 관리자로 로그인
            </AdminLogoutAndLoginButton>
            <p className="mt-4">
              <Link href="/" className="text-sm text-site-primary hover:underline">
                메인으로 이동
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  const [copy, siteSettings] = await Promise.all([getAdminCopy(), getSiteSettings()]);

  return (
    <AdminLayout
      copy={copy}
      userName={session.name ?? session.username ?? "관리자"}
      footer={siteSettings.footer}
      scope={resolvedScope}
    >
      <div className="w-full min-w-0">{children}</div>
    </AdminLayout>
  );
}
