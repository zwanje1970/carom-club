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
};

/**
 * Admin shell server gate.
 * Keeps auth/permission/settings loading out of `app/admin/layout.tsx`.
 */
export async function AdminLayoutServer({ children }: Props) {
  const session = await getSession();
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "";
  const isLoginPage = pathname === "/admin/login" || pathname.startsWith("/admin/login/");

  if (!session) {
    if (isLoginPage) return <>{children}</>;
    redirect("/admin/login");
  }

  if (session.role === "ZONE_MANAGER") {
    redirect("/zone");
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
    >
      <div className="w-full min-w-0 max-w-full">{children}</div>
    </AdminLayout>
  );
}
